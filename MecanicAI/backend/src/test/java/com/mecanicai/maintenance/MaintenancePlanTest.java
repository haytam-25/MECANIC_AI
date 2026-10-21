package com.mecanicai.maintenance;

import static org.assertj.core.api.Assertions.assertThat;

import java.util.List;
import java.util.Map;
import java.util.function.Function;
import java.util.stream.Collectors;

import org.junit.jupiter.api.Test;

import com.mecanicai.maintenance.MaintenancePlanService.AiPlan;
import com.mecanicai.maintenance.MaintenancePlanService.MaintenancePlan;
import com.mecanicai.maintenance.MaintenancePlanService.PlanItem;
import com.mecanicai.vehicle.Fuel;
import com.mecanicai.vehicle.VehicleSpec;

import tools.jackson.databind.json.JsonMapper;

class MaintenancePlanTest {

	private final JsonMapper jsonMapper = JsonMapper.builder().build();

	private static Map<String, PlanItem> byId(MaintenancePlan plan) {
		return plan.items().stream().collect(Collectors.toMap(PlanItem::id, Function.identity()));
	}

	@Test
	void withoutAiADieselGetsTheUsualPlan() {
		MaintenancePlan plan = MaintenancePlanService.build(Fuel.DIESEL, null, "unavailable");
		Map<String, PlanItem> items = byId(plan);

		assertThat(plan.timing()).isEqualTo("DESCONOCIDA");
		assertThat(items).containsKeys("ACEITE", "FILTRO_COMBUSTIBLE", "DISTRIBUCION", "LIQUIDO_FRENOS", "NEUMATICOS")
			.doesNotContainKey("BUJIAS");
		assertThat(items.get("DISTRIBUCION").name()).isEqualTo("Correa o cadena de distribución");
		assertThat(items.get("DISTRIBUCION").intervalKm()).isEqualTo(120_000);
		assertThat(items.get("LIQUIDO_FRENOS").intervalKm()).isNull();
		assertThat(items.get("LIQUIDO_FRENOS").intervalMonths()).isEqualTo(24);
		assertThat(items.get("LIQUIDO_FRENOS").critical()).isTrue();
	}

	@Test
	void withoutAiAGasolineCarHasSparkPlugsButNoFuelFilter() {
		Map<String, PlanItem> items = byId(MaintenancePlanService.build(Fuel.GASOLINA, null, "demo"));
		assertThat(items).containsKey("BUJIAS").doesNotContainKey("FILTRO_COMBUSTIBLE");
	}

	@Test
	void anElectricCarHasNoOilNorTimingBelt() {
		String json = """
				{"timing": "CORREA", "items": [{"id": "ACEITE", "intervalKm": 15000, "intervalMonths": 12}]}""";
		MaintenancePlan plan = MaintenancePlanService.build(Fuel.ELECTRICO,
				MaintenancePlanService.parse(jsonMapper, json), "ai");

		assertThat(plan.timing()).isEqualTo("NINGUNA");
		assertThat(byId(plan)).doesNotContainKeys("ACEITE", "FILTRO_AIRE", "BUJIAS", "DISTRIBUCION", "CORREA_ACCESORIOS")
			.containsKeys("FILTRO_HABITACULO", "LIQUIDO_FRENOS", "NEUMATICOS", "BATERIA");
	}

	@Test
	void usesTheAiIntervalsAndNotesForThatCar() {
		String json = """
				{"timing": "CORREA_EN_ACEITE", "timingNote": "  Usa   solo aceite PSA B71 2312. ",
				 "items": [
				  {"id": "ACEITE", "intervalKm": 25000, "intervalMonths": 12, "note": "Aceite 0W-30"},
				  {"id": "aceite", "intervalKm": 1, "intervalMonths": 1},
				  {"id": "FILTRO_AIRE", "intervalKm": 40000, "intervalMonths": 0},
				  {"id": "BUJIAS", "intervalKm": 0, "intervalMonths": 0},
				  {"id": "DISTRIBUCION", "intervalKm": 100000, "intervalMonths": 72},
				  {"id": "PASTILLAS_FRENO", "intervalKm": 9999999, "intervalMonths": 0},
				  {"id": "BATERIA", "intervalKm": 0, "intervalMonths": 60},
				  {"id": "TURBO", "intervalKm": 100000, "intervalMonths": 0}
				]}""";
		AiPlan ai = MaintenancePlanService.parse(jsonMapper, json);
		assertThat(ai.items()).hasSize(6);

		MaintenancePlan plan = MaintenancePlanService.build(Fuel.GASOLINA, ai, "ai");
		Map<String, PlanItem> items = byId(plan);

		assertThat(plan.timing()).isEqualTo("CORREA_EN_ACEITE");
		assertThat(plan.timingNote()).isEqualTo("Usa solo aceite PSA B71 2312.");
		assertThat(items.get("ACEITE")).extracting(PlanItem::intervalKm, PlanItem::intervalMonths, PlanItem::note)
			.containsExactly(25_000, 12, "Aceite 0W-30");
		// Solo por km si la IA lo dice así
		assertThat(items.get("FILTRO_AIRE").intervalMonths()).isNull();
		// Intervalos sin sentido: se usan los habituales
		assertThat(items.get("BUJIAS").intervalKm()).isEqualTo(60_000);
		assertThat(items.get("PASTILLAS_FRENO").intervalKm()).isEqualTo(40_000);
		assertThat(items.get("DISTRIBUCION").name()).isEqualTo("Correa de distribución (bañada en aceite)");
		// La IA dio su propia lista: lo que no incluye no aparece, salvo lo crítico y lo poco importante
		assertThat(items).doesNotContainKeys("REFRIGERANTE", "CORREA_ACCESORIOS")
			.containsKeys("LIQUIDO_FRENOS", "NEUMATICOS", "AMORTIGUADORES", "DISCOS_FRENO", "ESCOBILLAS",
					"FILTRO_HABITACULO");
	}

	@Test
	void minorItemsAreChangedEveryFourYearsWhateverTheAiSays() {
		String json = """
				{"timing": "CADENA", "items": [
				  {"id": "FILTRO_HABITACULO", "intervalKm": 15000, "intervalMonths": 12, "note": "Con carbón activo"},
				  {"id": "ESCOBILLAS", "intervalKm": 0, "intervalMonths": 12}
				]}""";
		for (Fuel fuel : new Fuel[] { Fuel.DIESEL, Fuel.ELECTRICO }) {
			Map<String, PlanItem> items = byId(
					MaintenancePlanService.build(fuel, MaintenancePlanService.parse(jsonMapper, json), "ai"));
			for (String id : List.of("FILTRO_HABITACULO", "ESCOBILLAS")) {
				assertThat(items.get(id))
					.extracting(PlanItem::intervalKm, PlanItem::intervalMonths, PlanItem::critical, PlanItem::minor)
					.containsExactly(null, 48, false, true);
			}
			assertThat(items.get("FILTRO_HABITACULO").note()).isEqualTo("Con carbón activo");
		}
	}

	@Test
	void aTimingChainHasNoScheduledChange() {
		String json = """
				{"timing": "CADENA", "items": [{"id": "DISTRIBUCION", "intervalKm": 200000, "intervalMonths": 0}]}""";
		PlanItem timing = byId(MaintenancePlanService.build(Fuel.DIESEL, MaintenancePlanService.parse(jsonMapper, json),
				"ai")).get("DISTRIBUCION");

		assertThat(timing.name()).isEqualTo("Cadena de distribución");
		assertThat(timing.intervalKm()).isNull();
		assertThat(timing.intervalMonths()).isNull();
	}

	@Test
	void anUnknownCarIsNotWorthCaching() {
		AiPlan unknown = MaintenancePlanService.parse(jsonMapper, "{\"timing\": \"DESCONOCIDA\", \"items\": []}");
		AiPlan nonsense = MaintenancePlanService.parse(jsonMapper, "{\"timing\": \"TURBINA\"}");
		AiPlan known = MaintenancePlanService.parse(jsonMapper, "{\"timing\": \"CADENA\", \"items\": []}");

		assertThat(unknown.useful()).isFalse();
		assertThat(nonsense.timing()).isEqualTo(Timing.DESCONOCIDA);
		assertThat(known.useful()).isTrue();
		// "Sin distribución" en un coche de combustión no tiene sentido
		assertThat(MaintenancePlanService.build(Fuel.DIESEL,
				MaintenancePlanService.parse(jsonMapper, "{\"timing\": \"NINGUNA\", \"items\": []}"), "ai").timing())
			.isEqualTo("DESCONOCIDA");
	}

	@Test
	void theCacheKeyIgnoresCaseAndSpaces() {
		VehicleSpec a = new VehicleSpec("seat", "SEAT", "leon", "León", 2016, "1.6  TDI", Fuel.DIESEL, 115, null);
		VehicleSpec b = new VehicleSpec("seat", "Seat", "leon", "Leon", 2016, "1.6 tdi", Fuel.DIESEL, 115, null);
		VehicleSpec other = new VehicleSpec("seat", "SEAT", "leon", "León", 2016, "2.0 TDI", Fuel.DIESEL, 150, null);

		assertThat(MaintenancePlanService.cacheKey(a)).isEqualTo(MaintenancePlanService.cacheKey(b))
			.isEqualTo("v2|seat||leon||2016|1.6 tdi|DIESEL|115")
			.isNotEqualTo(MaintenancePlanService.cacheKey(other));
		// La matrícula no cambia el plan ni llega a la IA
		assertThat(MaintenancePlanService.cacheKey(a.withPlate("1234BCD"))).isEqualTo(MaintenancePlanService.cacheKey(a));
		assertThat(MaintenancePlanService.prompt(a.withPlate("1234BCD"))).doesNotContain("1234BCD");
	}

	@Test
	void aHandTypedCarNeverSharesTheKeyOfACatalogCar() {
		VehicleSpec catalogCar = new VehicleSpec("seat", "SEAT", "leon", "León", 2016, "1.6 TDI", Fuel.DIESEL, 115, null);
		// Escrito a mano con el mismo texto que los ids del catálogo
		VehicleSpec typed = new VehicleSpec(null, "seat", null, "leon", 2016, "1.6 TDI", Fuel.DIESEL, 115, null);

		assertThat(MaintenancePlanService.cacheKey(typed)).isEqualTo("v2||seat||leon|2016|1.6 tdi|DIESEL|115")
			.isNotEqualTo(MaintenancePlanService.cacheKey(catalogCar));
	}

	@Test
	void thePromptDescribesTheCarAndEveryItem() {
		String prompt = MaintenancePlanService
			.prompt(new VehicleSpec(null, "Peugeot", null, "208", 2019, "1.2 PureTech", Fuel.GASOLINA, 100, null));
		assertThat(prompt).contains("Peugeot 208", "2019", "1.2 PureTech", "Gasolina", "100 CV", "CORREA_EN_ACEITE")
			.doesNotContain("%");
		for (MaintenanceItem item : MaintenanceItem.values()) {
			assertThat(prompt).contains(item.name() + ":");
		}
		assertThat(List.of(MaintenanceItem.values())).allSatisfy(item -> assertThat(item.description()).isNotBlank());
	}

}
