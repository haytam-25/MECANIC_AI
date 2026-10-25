package com.mecanicai.maintenance;

import java.sql.Timestamp;
import java.time.Instant;
import java.time.ZoneId;
import java.util.ArrayList;
import java.util.Arrays;
import java.util.EnumMap;
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
import com.mecanicai.catalog.CatalogService;
import com.mecanicai.config.AppProperties;
import com.mecanicai.maintenance.MaintenanceItem.Interval;
import com.mecanicai.usage.LookupQuota;
import com.mecanicai.usage.LookupQuota.Ticket;
import com.mecanicai.vehicle.Fuel;
import com.mecanicai.vehicle.VehicleSpec;

import tools.jackson.core.JacksonException;
import tools.jackson.databind.JsonNode;
import tools.jackson.databind.json.JsonMapper;

/**
 * Plan de mantenimiento de un coche para el "informe médico": qué elementos lleva, cada cuánto se cambian y si
 * el motor tiene correa o cadena de distribución.
 * <p>
 * Se pregunta a la IA y se guarda en {@code maintenance_cache}, así que cada versión de coche se consulta una sola
 * vez. Si la IA no responde (o no conoce el coche) se usan los intervalos habituales de {@link MaintenanceItem}. Los
 * kilómetros y fechas del usuario nunca salen de su navegador: el informe se calcula allí.
 */
@Service
public class MaintenancePlanService {

	private static final Logger log = LoggerFactory.getLogger(MaintenancePlanService.class);

	/**
	 * Cambiarlo invalida la caché (p. ej. si cambia el prompt o la lista de elementos). v2: la marca y el modelo del
	 * catálogo se comprueban antes de preguntar (ver {@link CatalogService#canonical}); las de v1 se borraron.
	 */
	static final String CACHE_VERSION = "v2";

	/** Con menos elementos que estos se considera que la IA no conoce bien el coche y se usa la lista habitual. */
	static final int MIN_AI_ITEMS = 5;

	private static final int MAX_NOTE = 220;

	private static final String SYSTEM_PROMPT = """
			Eres un jefe de taller experto en el mantenimiento de los coches vendidos en España. Respondes solo con \
			datos reales del plan de mantenimiento del fabricante o, si no lo conoces, con los intervalos habituales en \
			los talleres.""";

	private static final Map<String, Object> SCHEMA = Map.of("type", "object",
			"properties", Map.of(
					"timing", Map.of("type", "string", "enum", Arrays.stream(Timing.values()).map(Enum::name).toList()),
					"timingNote", Map.of("type", "string"),
					"items", Map.of("type", "array", "items", Map.of(
							"type", "object",
							"properties", Map.of(
									"id", Map.of("type", "string",
											"enum", Arrays.stream(MaintenanceItem.values()).map(Enum::name).toList()),
									"intervalKm", Map.of("type", "integer", "description", "0 si solo depende del tiempo"),
									"intervalMonths", Map.of("type", "integer", "description", "0 si solo depende de los km"),
									"note", Map.of("type", "string")),
							"required", List.of("id", "intervalKm", "intervalMonths")))),
			"required", List.of("timing", "items"));

	/**
	 * Un elemento del informe. Sin intervalos (cadena de distribución) no tiene cambio programado. {@code minor}: poco
	 * importante (si es lo único pendiente, el diagnóstico no alarma).
	 */
	public record PlanItem(String id, String name, String description, Integer intervalKm, Integer intervalMonths,
			String note, boolean critical, boolean minor) {
	}

	/**
	 * {@code timing}: valor de {@link Timing}. {@code source}: cache | ai | demo | limited (demasiadas consultas) |
	 * unavailable (la IA falló). En los tres últimos el plan es el habitual, no el de ese coche.
	 */
	public record MaintenancePlan(String timing, String timingNote, List<PlanItem> items, String source) {
	}

	/** Lo que devuelve la IA, ya validado. */
	record AiPlan(Timing timing, String timingNote, Map<MaintenanceItem, AiItem> items) {

		boolean useful() {
			return timing != Timing.DESCONOCIDA || items.size() >= MIN_AI_ITEMS;
		}
	}

	/** {@code km}/{@code months} null = no depende de eso. */
	record AiItem(Integer km, Integer months, String note) {
	}

	private final AiClient ai;

	private final CatalogService catalog;

	private final LookupQuota quota;

	private final JdbcClient jdbc;

	private final JsonMapper jsonMapper;

	private final AppProperties.Engines settings;

	private final ZoneId zone;

	public MaintenancePlanService(AiClient ai, CatalogService catalog, LookupQuota quota, JdbcClient jdbc,
			JsonMapper jsonMapper, AppProperties props) {
		this.ai = ai;
		this.catalog = catalog;
		this.quota = quota;
		this.jdbc = jdbc;
		this.jsonMapper = jsonMapper;
		// Mismos modelos y límites que las motorizaciones: también es una consulta corta que se guarda en caché
		this.settings = props.ai().engines();
		this.zone = props.timezone();
	}

	public MaintenancePlan plan(VehicleSpec rawSpec, String clientKey) {
		// La IA y la caché ven el mismo coche: si los ids son del catálogo, también sus nombres
		VehicleSpec spec = catalog.canonical(rawSpec.normalized());
		spec.validateYear(zone);
		Fuel fuel = spec.fuel();
		String key = cacheKey(spec);

		Optional<String> cached = jdbc.sql("SELECT plan_json FROM maintenance_cache WHERE cache_key = :key")
			.param("key", key)
			.query(String.class)
			.optional();
		if (cached.isPresent()) {
			try {
				return build(fuel, parse(jsonMapper, cached.get()), "cache");
			}
			catch (JacksonException ex) {
				log.warn("Plan de mantenimiento en caché ilegible ({}): se vuelve a consultar", key);
				jdbc.sql("DELETE FROM maintenance_cache WHERE cache_key = :key").param("key", key).update();
			}
		}
		if (ai.isDemo()) {
			return build(fuel, null, "demo");
		}

		Optional<Ticket> ticket = quota.acquire("maintenance", clientKey);
		if (ticket.isEmpty()) {
			return build(fuel, null, "limited");
		}

		try {
			String json = ai.generateJson(new AiJsonRequest(settings.models(), settings.thinkingLevel(), SYSTEM_PROMPT,
					prompt(spec), SCHEMA, settings.timeout()));
			AiPlan plan = parse(jsonMapper, json);
			if (plan.useful()) {
				store(key, json);
			}
			return build(fuel, plan, "ai");
		}
		catch (AiException | JacksonException ex) {
			quota.refund(ticket.get());
			log.warn("No se pudo obtener el plan de mantenimiento de {}: {}", spec.label(), ex.getMessage());
			return build(fuel, null, "unavailable");
		}
	}

	static String prompt(VehicleSpec spec) {
		StringBuilder items = new StringBuilder();
		for (MaintenanceItem item : MaintenanceItem.values()) {
			String label = item == MaintenanceItem.DISTRIBUCION ? "correa de distribución" : item.label();
			items.append("  ").append(item.name()).append(": ").append(label.toLowerCase(Locale.ROOT)).append('\n');
		}
		return """
				Plan de mantenimiento de este coche:
				- Marca y modelo: %s %s
				- Año: %d
				- Motor: %s
				- Combustible: %s
				- Potencia: %s

				- "timing": distribución de ESE motor: CORREA, CORREA_EN_ACEITE (correa bañada en aceite, como el \
				1.2 PureTech o el 1.0 EcoBoost), CADENA, NINGUNA (eléctricos) o DESCONOCIDA si no lo sabes con \
				seguridad o si depende del motor y no se indica.
				- "timingNote": una frase útil sobre la distribución de este motor (problemas conocidos, qué conviene \
				cambiar a la vez, aceite que exige...). Vacío si no hay nada destacable.
				- "items": de esta lista, solo los elementos que lleva este coche, con el intervalo de cambio del \
				fabricante (o el habitual en talleres):
				%s\
				- "intervalKm": cada cuántos km se cambia (0 si solo depende del tiempo). "intervalMonths": cada \
				cuántos meses (0 si solo depende de los km). En DISTRIBUCION pon el intervalo de la correa; si es de \
				cadena, 0 y 0. Las pastillas, discos y amortiguadores dependen del uso: pon la duración media.
				- Omite lo que no lleva (bujías en un diésel, aceite en un eléctrico, filtro de combustible que va \
				dentro del depósito y no se cambia...).
				- "note": SOLO si hay algo concreto de ESTE motor o modelo que el dueño debe saber y que no valdría \
				para cualquier coche (máximo 140 caracteres; ej.: "Usa aceite que cumpla la norma VW 507.00" o "Con \
				Start-Stop lleva batería AGM"). Consejos genéricos como "revisar el desgaste" o "cambiar antes del \
				invierno" NO: deja la nota vacía. Lo normal es que casi todas vayan vacías.
				- No inventes. Si no conoces este coche, devuelve "timing": "DESCONOCIDA" e "items" vacío.""".formatted(
				spec.brand(), spec.model(), spec.year(), spec.engine() != null ? spec.engine() : "no indicado",
				spec.fuel() != null ? spec.fuel().label() : "no indicado",
				spec.powerCv() != null ? spec.powerCv() + " CV" : "no indicada", items);
	}

	/** Valida lo que devuelve la IA: descarta ids desconocidos, duplicados e intervalos absurdos. */
	static AiPlan parse(JsonMapper jsonMapper, String json) {
		JsonNode root = jsonMapper.readTree(json);
		Map<MaintenanceItem, AiItem> items = new EnumMap<>(MaintenanceItem.class);
		for (JsonNode node : root.path("items")) {
			Optional<MaintenanceItem> item = MaintenanceItem.parse(node.path("id").asString(null));
			if (item.isEmpty() || items.containsKey(item.get())) {
				continue;
			}
			items.put(item.get(), new AiItem(range(node.path("intervalKm").asInt(0), 1_000, 400_000),
					range(node.path("intervalMonths").asInt(0), 1, 240), note(node.path("note").asString(""))));
		}
		return new AiPlan(Timing.parse(root.path("timing").asString(null)), note(root.path("timingNote").asString("")),
				items);
	}

	/**
	 * Junta lo que sabe la IA con los intervalos habituales. Con {@code ai} null (la IA no respondió) el plan es el
	 * habitual para ese combustible.
	 */
	static MaintenancePlan build(Fuel fuel, AiPlan ai, String source) {
		Timing timing = timing(fuel, ai);
		boolean aiList = ai != null && ai.items().size() >= MIN_AI_ITEMS;
		List<PlanItem> items = new ArrayList<>();
		for (MaintenanceItem item : MaintenanceItem.values()) {
			Interval standard = item.defaultInterval(fuel);
			// No existe en este tipo de coche, aunque la IA diga lo contrario (p. ej. bujías en un diésel)
			if (standard == null || (item == MaintenanceItem.DISTRIBUCION && timing == Timing.NINGUNA)) {
				continue;
			}
			AiItem fromAi = ai != null ? ai.items().get(item) : null;
			// Lo importante para la seguridad (y la distribución) se revisa siempre, aunque la IA se lo salte; lo poco
			// importante también, porque su intervalo no depende del coche
			boolean included = aiList ? fromAi != null || item.critical() || item.minor()
					: item.includedByDefault(fuel);
			if (!included) {
				continue;
			}

			Interval interval;
			if (item == MaintenanceItem.DISTRIBUCION && timing == Timing.CADENA) {
				interval = new Interval(null, null);
			}
			else if (item.minor()) {
				interval = standard;
			}
			else if (fromAi != null && (fromAi.km() != null || fromAi.months() != null)
					&& plausible(fromAi.km(), standard.km()) && plausible(fromAi.months(), standard.months())) {
				interval = new Interval(fromAi.km(), fromAi.months());
			}
			else {
				interval = standard;
			}
			String name = item == MaintenanceItem.DISTRIBUCION ? timing.label() : item.label();
			items.add(new PlanItem(item.name(), name, item.description(), interval.km(), interval.months(),
					fromAi != null ? fromAi.note() : null, item.critical(), item.minor()));
		}
		return new MaintenancePlan(timing.name(), ai != null ? ai.timingNote() : null, List.copyOf(items), source);
	}

	private static Timing timing(Fuel fuel, AiPlan ai) {
		if (fuel == Fuel.ELECTRICO) {
			return Timing.NINGUNA;
		}
		Timing timing = ai != null ? ai.timing() : Timing.DESCONOCIDA;
		// Sin motor de combustión solo puede ser eléctrico: si el coche no lo es, la IA se ha liado
		return timing == Timing.NINGUNA && fuel != null ? Timing.DESCONOCIDA : timing;
	}

	/**
	 * Misma versión de coche = mismo plan. La marca y el modelo van en dos campos: el id del catálogo o el texto
	 * escrito a mano (el otro vacío), para que un coche escrito a mano nunca comparta clave con uno del catálogo.
	 * {@code spec} debe venir de {@link CatalogService#canonical}.
	 */
	static String cacheKey(VehicleSpec spec) {
		return String.join("|", CACHE_VERSION, idOrText(spec.brandId(), spec.brand()),
				idOrText(spec.modelId(), spec.model()), String.valueOf(spec.year()), keyPart(spec.engine()),
				spec.fuel() != null ? spec.fuel().name() : "", spec.powerCv() != null ? spec.powerCv().toString() : "");
	}

	/** "seat" → "seat|"; escrito a mano "Seat" → "|seat". */
	private static String idOrText(String catalogId, String text) {
		return catalogId != null ? catalogId + "|" : "|" + keyPart(text);
	}

	private static String keyPart(String value) {
		return value == null ? "" : value.trim().replaceAll("\\s+", " ").toLowerCase(Locale.ROOT);
	}

	private static Integer range(int value, int min, int max) {
		return value >= min && value <= max ? value : null;
	}

	/**
	 * Un intervalo de la IA muy lejos del habitual de ese elemento es una errata (p. ej. aceite cada 300.000 km en vez
	 * de 30.000): entre un tercio y el triple del habitual se acepta; si no, se usa el habitual.
	 */
	private static boolean plausible(Integer fromAi, Integer standard) {
		return fromAi == null || standard == null || (fromAi >= standard / 3 && fromAi <= standard * 3);
	}

	private static String note(String raw) {
		String note = raw.trim().replaceAll("\\s+", " ");
		if (note.isEmpty()) {
			return null;
		}
		return note.length() > MAX_NOTE ? note.substring(0, MAX_NOTE - 1).trim() + "…" : note;
	}

	private void store(String key, String json) {
		jdbc.sql("""
				INSERT INTO maintenance_cache (cache_key, plan_json, created_at)
				VALUES (:key, :json, :createdAt)
				ON CONFLICT DO NOTHING""")
			.param("key", key)
			.param("json", json)
			.param("createdAt", Timestamp.from(Instant.now()))
			.update();
	}

}
