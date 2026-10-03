package com.mecanicai.catalog;

import static org.assertj.core.api.Assertions.assertThat;

import java.util.List;

import org.junit.jupiter.api.Test;

import com.mecanicai.catalog.EngineSuggestionService.EngineOption;
import com.mecanicai.vehicle.Fuel;

import tools.jackson.databind.json.JsonMapper;

class EngineParsingTest {

	private final JsonMapper jsonMapper = JsonMapper.builder().build();

	@Test
	void cleansDeduplicatesAndSortsWhatTheAiReturns() {
		String json = """
				{"engines": [
				  {"name": "2.0 TDI", "fuel": "Diésel", "powerCv": 150},
				  {"name": "1.6  TDI", "fuel": "DIESEL", "powerCv": 115},
				  {"name": "1.6 TDI", "fuel": "diesel", "powerCv": 115},
				  {"name": "1.4 TSI", "fuel": "GASOLINA", "powerCv": 125},
				  {"name": "", "fuel": "GASOLINA", "powerCv": 90},
				  {"name": "1.4 TSI ACT", "fuel": "phev", "powerCv": 99999}
				]}""";

		List<EngineOption> engines = EngineSuggestionService.parse(jsonMapper, json);

		assertThat(engines).containsExactly(new EngineOption("1.4 TSI", Fuel.GASOLINA, 125, null),
				new EngineOption("1.6 TDI", Fuel.DIESEL, 115, null), new EngineOption("2.0 TDI", Fuel.DIESEL, 150, null),
				new EngineOption("1.4 TSI ACT", Fuel.HIBRIDO_ENCHUFABLE, null, null));
	}

	@Test
	void removesThePowerRepeatedInTheName() {
		String json = """
				{"engines": [
				  {"name": "1.2 TSI 110", "fuel": "GASOLINA", "powerCv": 110},
				  {"name": "1.0 TSI Ecomotive (115 CV)", "fuel": "GASOLINA", "powerCv": 115},
				  {"name": "Eléctrico 58 kWh", "fuel": "ELECTRICO", "powerCv": 204}
				]}""";

		assertThat(EngineSuggestionService.parse(jsonMapper, json)).extracting(EngineOption::name)
			.containsExactly("1.2 TSI", "1.0 TSI Ecomotive", "Eléctrico 58 kWh");
	}

	@Test
	void acceptsAPlainArrayAndEmptyResults() {
		assertThat(EngineSuggestionService.parse(jsonMapper, "[{\"name\":\"Eléctrico 58 kWh\",\"fuel\":\"ELECTRICO\",\"powerCv\":204}]"))
			.containsExactly(new EngineOption("Eléctrico 58 kWh", Fuel.ELECTRICO, 204, null));
		assertThat(EngineSuggestionService.parse(jsonMapper, "{\"engines\": []}")).isEmpty();
	}

	@Test
	void keepsTheEngineCodeApartFromTheName() {
		String json = """
				{"engines": [
				  {"name": "330d M57", "fuel": "DIESEL", "powerCv": 231, "code": "M57"},
				  {"name": "320d", "fuel": "DIESEL", "powerCv": 163, "code": " N47 "},
				  {"name": "320d", "fuel": "DIESEL", "powerCv": 163, "code": "M47"},
				  {"name": "2.0 TDI (BKD) 140", "fuel": "DIESEL", "powerCv": 140, "code": "BKD"},
				  {"name": "eDrive40", "fuel": "ELECTRICO", "powerCv": 340, "code": ""},
				  {"name": "118i", "fuel": "GASOLINA", "powerCv": 136, "code": "un código larguísimo que no es un código"}
				]}""";

		assertThat(EngineSuggestionService.parse(jsonMapper, json)).containsExactly(
				new EngineOption("118i", Fuel.GASOLINA, 136, null), new EngineOption("2.0 TDI", Fuel.DIESEL, 140, "BKD"),
				new EngineOption("320d", Fuel.DIESEL, 163, "N47"), new EngineOption("320d", Fuel.DIESEL, 163, "M47"),
				new EngineOption("330d", Fuel.DIESEL, 231, "M57"), new EngineOption("eDrive40", Fuel.ELECTRICO, 340, null));
	}

	@Test
	void detailedBrandsAllowLongerLists() {
		StringBuilder json = new StringBuilder("{\"engines\": [");
		for (int i = 0; i < 45; i++) {
			json.append(i == 0 ? "" : ",").append("{\"name\":\"v").append(i).append("\",\"fuel\":\"DIESEL\",\"powerCv\":")
				.append(100 + i).append('}');
		}
		json.append("]}");

		assertThat(EngineSuggestionService.parse(jsonMapper, json.toString())).hasSize(20);
		assertThat(EngineSuggestionService.parse(jsonMapper, json.toString(), 40)).hasSize(40);
	}

	@Test
	void bmwVolkswagenAndAudiAskForEngineCodes() throws Exception {
		CatalogService catalog = new CatalogService(jsonMapper, com.mecanicai.TestProps.defaults());
		assertThat(EngineSuggestionService.DETAILED_BRANDS).allSatisfy(id -> assertThat(catalog.brand(id)).isPresent());

		CatalogService.Brand bmw = catalog.brand("bmw").orElseThrow();
		String prompt = EngineSuggestionService.detailedPrompt(bmw, bmw.modelsById().get("serie-3"), 2005);
		assertThat(prompt).contains("BMW Serie 3 del año 2005", "330d", "M57", "\"code\"").doesNotContain("%");
	}

}
