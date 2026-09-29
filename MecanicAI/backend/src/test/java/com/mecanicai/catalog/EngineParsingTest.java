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

		assertThat(engines).containsExactly(new EngineOption("1.4 TSI", Fuel.GASOLINA, 125),
				new EngineOption("1.6 TDI", Fuel.DIESEL, 115), new EngineOption("2.0 TDI", Fuel.DIESEL, 150),
				new EngineOption("1.4 TSI ACT", Fuel.HIBRIDO_ENCHUFABLE, null));
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
			.containsExactly(new EngineOption("Eléctrico 58 kWh", Fuel.ELECTRICO, 204));
		assertThat(EngineSuggestionService.parse(jsonMapper, "{\"engines\": []}")).isEmpty();
	}

}
