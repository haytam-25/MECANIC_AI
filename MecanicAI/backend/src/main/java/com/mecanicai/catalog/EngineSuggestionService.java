package com.mecanicai.catalog;

import java.time.Instant;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Optional;

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
 */
@Service
public class EngineSuggestionService {

	private static final Logger log = LoggerFactory.getLogger(EngineSuggestionService.class);

	private static final int MAX_ENGINES = 20;

	private static final String SYSTEM_PROMPT = """
			Eres un experto en automoción del mercado español. Respondes solo con datos reales y verificables \
			de las versiones que se vendieron en España.""";

	private static final Map<String, Object> SCHEMA = Map.of(
			"type", "object",
			"properties", Map.of("engines", Map.of(
					"type", "array",
					"items", Map.of(
							"type", "object",
							"properties", Map.of(
									"name", Map.of("type", "string",
											"description", "Denominación comercial del motor sin la potencia, p. ej. 1.6 TDI"),
									"fuel", Map.of("type", "string",
											"enum", List.of("GASOLINA", "DIESEL", "HIBRIDO", "HIBRIDO_ENCHUFABLE",
													"ELECTRICO", "GLP", "GNC")),
									"powerCv", Map.of("type", "integer", "description", "Potencia en CV")),
							"required", List.of("name", "fuel", "powerCv")))),
			"required", List.of("engines"));

	public record EngineOption(String name, Fuel fuel, Integer powerCv) {
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
		if (cached.isPresent()) {
			return new EngineSuggestions(parse(jsonMapper, cached.get()), "cache");
		}

		Reservation reservation;
		try {
			reservation = usage.consume("engines:" + clientKey, settings.dailyLookupsPerClient(),
					"Demasiadas consultas de motorizaciones por hoy");
		}
		catch (AppException ex) {
			return new EngineSuggestions(List.of(), "limited");
		}

		try {
			String json = ai.generateJson(new AiJsonRequest(settings.models(), settings.thinkingLevel(), SYSTEM_PROMPT,
					prompt(brand, model, year), SCHEMA, settings.timeout()));
			List<EngineOption> engines = parse(jsonMapper, json);
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

	/** Valida y limpia lo que devuelve la IA: descarta basura, quita duplicados y ordena. */
	static List<EngineOption> parse(JsonMapper jsonMapper, String json) {
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
			EngineOption option = new EngineOption(name, fuel, powerCv);
			unique.putIfAbsent(name.toLowerCase(Locale.ROOT) + "|" + fuel + "|" + powerCv, option);
		}
		List<EngineOption> engines = new ArrayList<>(unique.values());
		engines.sort(Comparator
			.comparing((EngineOption e) -> e.fuel() == null ? Integer.MAX_VALUE : e.fuel().ordinal())
			.thenComparing(e -> e.powerCv() == null ? Integer.MAX_VALUE : e.powerCv())
			.thenComparing(EngineOption::name));
		return engines.size() > MAX_ENGINES ? List.copyOf(engines.subList(0, MAX_ENGINES)) : List.copyOf(engines);
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
