package com.mecanicai.catalog;

import java.time.Instant;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Optional;
import java.util.Set;
import java.util.concurrent.CompletableFuture;
import java.util.concurrent.ConcurrentHashMap;
import java.util.regex.Pattern;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.stereotype.Service;

import com.mecanicai.ai.AiClient;
import com.mecanicai.ai.AiException;
import com.mecanicai.ai.AiJsonRequest;
import com.mecanicai.catalog.CatalogService.Brand;
import com.mecanicai.catalog.CatalogService.Model;
import com.mecanicai.common.AppException;
import com.mecanicai.config.AppProperties;
import com.mecanicai.usage.UsageService;
import com.mecanicai.usage.UsageService.Reservation;
import com.mecanicai.vehicle.Fuel;

import tools.jackson.core.JacksonException;
import tools.jackson.databind.JsonNode;
import tools.jackson.databind.json.JsonMapper;

/**
 * Sugiere las motorizaciones de un modelo y año concretos preguntando a la IA. El resultado se guarda en
 * {@code engine_cache}, así que cada combinación marca/modelo/año solo se consulta una vez.
 * <p>
 * Para las marcas de {@link #DETAILED_BRANDS} la búsqueda es más precisa: se piden todas las versiones con su
 * denominación exacta (p. ej. "330d" en BMW) y el código de motor que conocen los mecánicos (p. ej. "M57").
 */
@Service
public class EngineSuggestionService {

	private static final Logger log = LoggerFactory.getLogger(EngineSuggestionService.class);

	private static final int MAX_ENGINES = 20;

	/** Marcas muy conocidas por sus códigos de motor, en las que se pide la lista completa con códigos. */
	static final Set<String> DETAILED_BRANDS = Set.of("bmw", "volkswagen", "audi");

	private static final int MAX_DETAILED_ENGINES = 40;

	private static final int MAX_CODE_LENGTH = 25;

	private static final String SYSTEM_PROMPT = """
			Eres un experto en automoción del mercado español. Respondes solo con datos reales y verificables \
			de las versiones que se vendieron en España.""";

	private static final Map<String, Object> NAME = Map.of("type", "string",
			"description", "Denominación comercial del motor sin la potencia, p. ej. 1.6 TDI");

	private static final Map<String, Object> FUEL = Map.of("type", "string",
			"enum", List.of("GASOLINA", "DIESEL", "HIBRIDO", "HIBRIDO_ENCHUFABLE", "ELECTRICO", "GLP", "GNC"));

	private static final Map<String, Object> POWER = Map.of("type", "integer", "description", "Potencia en CV");

	private static final Map<String, Object> CODE = Map.of("type", "string",
			"description", "Código de motor, p. ej. M57, N47, B47, BKD, CFFB o EA888. Vacío si no se sabe");

	private static final Map<String, Object> SCHEMA = schema(
			Map.of("name", NAME, "fuel", FUEL, "powerCv", POWER));

	private static final Map<String, Object> DETAILED_SCHEMA = schema(
			Map.of("name", NAME, "fuel", FUEL, "powerCv", POWER, "code", CODE));

	private static Map<String, Object> schema(Map<String, Object> properties) {
		return Map.of("type", "object",
				"properties", Map.of("engines", Map.of(
						"type", "array",
						"items", Map.of(
								"type", "object",
								"properties", properties,
								"required", List.of("name", "fuel", "powerCv")))),
				"required", List.of("engines"));
	}

	/** {@code code}: código de motor (solo en las marcas de {@link #DETAILED_BRANDS}), o null. */
	public record EngineOption(String name, Fuel fuel, Integer powerCv, String code) {
	}

	/** {@code source}: cache | ai | demo | limited (demasiadas consultas) | unavailable (la IA falló). */
	public record EngineSuggestions(List<EngineOption> engines, String source) {
	}

	private final CatalogService catalog;

	private final AiClient ai;

	private final UsageService usage;

	private final JdbcClient jdbc;

	private final JsonMapper jsonMapper;

	private final AppProperties.Engines settings;

	/** Consultas a la IA en curso, por marca/modelo/año: las peticiones del mismo coche esperan a la primera. */
	private final Map<String, CompletableFuture<EngineSuggestions>> inFlight = new ConcurrentHashMap<>();

	public EngineSuggestionService(CatalogService catalog, AiClient ai, UsageService usage, JdbcClient jdbc,
			JsonMapper jsonMapper, AppProperties props) {
		this.catalog = catalog;
		this.ai = ai;
		this.usage = usage;
		this.jdbc = jdbc;
		this.jsonMapper = jsonMapper;
		this.settings = props.ai().engines();
	}

	public EngineSuggestions suggest(String brandId, String modelId, int year, String clientKey) {
		Brand brand = catalog.brand(brandId).orElseThrow(() -> AppException.notFound("Marca no encontrada"));
		Model model = catalog.model(brandId, modelId).orElseThrow(() -> AppException.notFound("Modelo no encontrado"));
		if (!model.coversYear(year, catalog.currentYear())) {
			throw AppException.badRequest("INVALID_YEAR", "Ese año no está disponible para el " + model.name());
		}

		Optional<String> cached = jdbc
			.sql("SELECT engines_json FROM engine_cache WHERE brand_id = :brand AND model_id = :model AND model_year = :year")
			.param("brand", brand.id())
			.param("model", model.id())
			.param("year", year)
			.query(String.class)
			.optional();
		boolean detailed = DETAILED_BRANDS.contains(brand.id());
		int maxEngines = detailed ? MAX_DETAILED_ENGINES : MAX_ENGINES;
		if (cached.isPresent()) {
			return new EngineSuggestions(parse(jsonMapper, cached.get(), maxEngines), "cache");
		}

		Reservation reservation;
		try {
			reservation = usage.consume("engines:" + clientKey, settings.dailyLookupsPerClient(),
					"Demasiadas consultas de motorizaciones por hoy");
		}
		catch (AppException ex) {
			return new EngineSuggestions(List.of(), "limited");
		}

		// La IA tarda unos segundos: si ya se está preguntando por este mismo coche (otra pestaña, otro usuario, el
		// usuario que vuelve atrás y entra otra vez...) se espera esa respuesta en vez de lanzar otra consulta
		String key = brand.id() + "/" + model.id() + "/" + year;
		CompletableFuture<EngineSuggestions> mine = new CompletableFuture<>();
		CompletableFuture<EngineSuggestions> running = inFlight.putIfAbsent(key, mine);
		if (running != null) {
			usage.refund(reservation);
			return running.exceptionally(ex -> new EngineSuggestions(List.of(), "unavailable")).join();
		}
		try {
			EngineSuggestions result = askAi(brand, model, year, detailed, maxEngines, reservation);
			mine.complete(result);
			return result;
		}
		catch (RuntimeException ex) {
			mine.completeExceptionally(ex);
			throw ex;
		}
		finally {
			inFlight.remove(key, mine);
		}
	}

	private EngineSuggestions askAi(Brand brand, Model model, int year, boolean detailed, int maxEngines,
			Reservation reservation) {
		try {
			String json = ai.generateJson(new AiJsonRequest(settings.models(), settings.thinkingLevel(), SYSTEM_PROMPT,
					detailed ? detailedPrompt(brand, model, year) : prompt(brand, model, year),
					detailed ? DETAILED_SCHEMA : SCHEMA, settings.timeout()));
			List<EngineOption> engines = parse(jsonMapper, json, maxEngines);
			if (ai.isDemo()) {
				return new EngineSuggestions(engines, "demo");
			}
			if (!engines.isEmpty()) {
				store(brand.id(), model.id(), year, engines);
			}
			return new EngineSuggestions(engines, "ai");
		}
		catch (AiException | JacksonException ex) {
			usage.refund(reservation);
			log.warn("No se pudieron sugerir motorizaciones para {} {} {}: {}", brand.name(), model.name(), year,
					ex.getMessage());
			return new EngineSuggestions(List.of(), "unavailable");
		}
	}

	private static String prompt(Brand brand, Model model, int year) {
		return """
				Enumera las motorizaciones que se vendieron en España del %s %s del año %d.
				- Incluye cada combinación distinta de motor y potencia: gasolina, diésel, híbridos, híbridos \
				enchufables, eléctricos, GLP o GNC.
				- "name": denominación comercial habitual del motor, SIN la potencia (ej.: "1.6 TDI", \
				"1.2 PureTech", "1.5 dCi", "2.0 TFSI", "E-Tech Full Hybrid", "Eléctrico 58 kWh").
				- "powerCv": potencia en CV.
				- Máximo %d entradas. Si no conoces con seguridad ese modelo y año, devuelve una lista vacía. \
				No inventes versiones.""".formatted(brand.name(), model.name(), year, MAX_ENGINES);
	}

	/** BMW, Volkswagen y Audi: todas las versiones, con su denominación exacta y su código de motor. */
	static String detailedPrompt(Brand brand, Model model, int year) {
		String naming = switch (brand.id()) {
			case "bmw" -> """
					- "name": denominación de la versión tal como la usa BMW, SIN la potencia (ej.: "116d", "118i", \
					"320d", "330d", "330e", "M340i", "M3", "M3 Competition"). En los X, Z e i usa su nomenclatura \
					(ej.: "sDrive18d", "xDrive30d", "sDrive20i", "eDrive40", "xDrive50"). No repitas una versión solo \
					porque exista también con tracción xDrive, salvo que cambie el motor o la potencia.
					- "code": familia de motor tal como la conocen los mecánicos (ej.: M57, N47, B47, N57, B57, M54, \
					N52, N54, N55, B48, B58, S54, S55, S58). Si es una evolución conocida puedes indicarla \
					(ej.: "M57N2", "N47 (N47D20)"). Ten en cuenta el año: el 330d de 2005 lleva M57 y el de 2010 N57.""";
			case "audi" -> """
					- "name": cilindrada y tecnología del motor, SIN la potencia (ej.: "1.9 TDI", "2.0 TDI", \
					"1.8 T", "2.0 TFSI", "3.0 TDI", "4.2 FSI"). Desde 2017 Audi usa nombres numéricos: en ese caso pon \
					el número seguido de la cilindrada (ej.: "35 TFSI 1.5", "40 TDI 2.0", "50 TDI 3.0"). Incluye las \
					versiones deportivas (S3, RS3, S4, RS6...) con su motor (ej.: "S3 2.0 TFSI", "RS3 2.5 TFSI").
					- "code": código de letras del motor que usan los talleres (ej.: AWX, BKD, BRE, CAGA, CJCA, DETA); \
					si esa versión usa varios códigos, pon como máximo dos separados por " / ". Si no conoces el código \
					de letras con seguridad, pon la familia (ej.: EA189, EA288, EA888, EA211, EA113, EA897).""";
			default -> """
					- "name": cilindrada y tecnología del motor, SIN la potencia (ej.: "1.9 TDI", "2.0 TDI", \
					"1.4 TSI", "2.0 TSI", "1.6 FSI", "1.8 T", "eHybrid", "GTI 2.0 TSI", "R 2.0 TSI", "Eléctrico 77 kWh").
					- "code": código de letras del motor que usan los talleres (ej.: ALH, ASZ, AUM, BKD, BXE, CAYC, \
					CZCA, DFGA); si esa versión usa varios códigos, pon como máximo dos separados por " / ". Si no \
					conoces el código de letras con seguridad, pon la familia (ej.: EA189, EA288, EA888, EA211, EA111).""";
		};
		return """
				Enumera TODAS las motorizaciones que se vendieron en España del %s %s del año %d.
				- Incluye cada combinación distinta de motor y potencia: gasolina, diésel, híbridos, híbridos \
				enchufables, eléctricos y versiones deportivas.
				%s
				- Si ese año se vendían a la vez dos generaciones o carrocerías con motores distintos, añade al final \
				del nombre su código entre paréntesis en TODAS las entradas (ej.: "320d (E46)" y "320d (E90)", \
				"118i (E87)" y "118i (F20)", "2.0 TDI (B7)" y "2.0 TDI (B8)"). Si solo hay una, no lo pongas.
				- En los eléctricos "code" puede ir vacío.
				- "powerCv": potencia en CV.
				- Máximo %d entradas. Si no conoces con seguridad ese modelo y año, devuelve una lista vacía. \
				No inventes versiones ni códigos: si dudas de un código, déjalo vacío.""".formatted(brand.name(),
				model.name(), year, naming, MAX_DETAILED_ENGINES);
	}

	/** Valida y limpia lo que devuelve la IA: descarta basura, quita duplicados y ordena. */
	static List<EngineOption> parse(JsonMapper jsonMapper, String json) {
		return parse(jsonMapper, json, MAX_ENGINES);
	}

	static List<EngineOption> parse(JsonMapper jsonMapper, String json, int maxEngines) {
		JsonNode root = jsonMapper.readTree(json);
		JsonNode items = root.isArray() ? root : root.path("engines");
		Map<String, EngineOption> unique = new LinkedHashMap<>();
		for (JsonNode item : items) {
			String name = item.path("name").asString("").trim().replaceAll("\\s+", " ");
			if (name.isEmpty() || name.length() > 60) {
				continue;
			}
			Fuel fuel = Fuel.parse(item.path("fuel").asString(null)).orElse(null);
			int power = item.path("powerCv").asInt(0);
			Integer powerCv = power >= 20 && power <= 2000 ? power : null;
			if (powerCv != null) {
				// A veces la IA repite la potencia en el nombre ("1.2 TSI 110"): ya se muestra aparte
				String withoutPower = name.replaceFirst("(?i)\\s*\\(?" + powerCv + "\\s*(cv|ch|hp)?\\)?$", "").trim();
				if (!withoutPower.isEmpty()) {
					name = withoutPower;
				}
			}
			String code = item.path("code").asString("").trim().replaceAll("\\s+", " ");
			if (code.isEmpty() || code.length() > MAX_CODE_LENGTH || code.equalsIgnoreCase(name)) {
				code = null;
			}
			else {
				// Y a veces el código ("330d M57", "2.0 TDI (BKD)"): también se muestra aparte
				String withoutCode = name.replaceFirst("(?i)\\s*\\(?" + Pattern.quote(code) + "\\)?$", "")
					.trim();
				if (!withoutCode.isEmpty()) {
					name = withoutCode;
				}
			}
			EngineOption option = new EngineOption(name, fuel, powerCv, code);
			String key = name.toLowerCase(Locale.ROOT) + "|" + fuel + "|" + powerCv + "|"
					+ (code == null ? "" : code.toLowerCase(Locale.ROOT));
			unique.putIfAbsent(key, option);
		}
		List<EngineOption> engines = new ArrayList<>(unique.values());
		engines.sort(Comparator
			.comparing((EngineOption e) -> e.fuel() == null ? Integer.MAX_VALUE : e.fuel().ordinal())
			.thenComparing(e -> e.powerCv() == null ? Integer.MAX_VALUE : e.powerCv())
			.thenComparing(EngineOption::name));
		return engines.size() > maxEngines ? List.copyOf(engines.subList(0, maxEngines)) : List.copyOf(engines);
	}

	private void store(String brandId, String modelId, int year, List<EngineOption> engines) {
		jdbc.sql("""
				INSERT INTO engine_cache (brand_id, model_id, model_year, engines_json, created_at)
				VALUES (:brand, :model, :year, :json, :createdAt)
				ON CONFLICT DO NOTHING""")
			.param("brand", brandId)
			.param("model", modelId)
			.param("year", year)
			.param("json", jsonMapper.writeValueAsString(Map.of("engines", engines)))
			.param("createdAt", java.sql.Timestamp.from(Instant.now()))
			.update();
	}

}
