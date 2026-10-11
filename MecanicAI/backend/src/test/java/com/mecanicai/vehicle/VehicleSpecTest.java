package com.mecanicai.vehicle;

import static org.assertj.core.api.Assertions.assertThat;

import org.junit.jupiter.api.Test;

class VehicleSpecTest {

	@Test
	void buildsReadableLabels() {
		VehicleSpec full = new VehicleSpec("toyota", "Toyota", "c-hr", "C-HR", 2020, "1.8 Hybrid", Fuel.HIBRIDO, 122,
				null);
		assertThat(full.label()).isEqualTo("Toyota C-HR (2020) · 1.8 Hybrid · 122 CV · Híbrido");

		VehicleSpec onlyFuel = new VehicleSpec(null, "Fiat", null, "Panda", 2008, null, Fuel.GASOLINA, null, null);
		assertThat(onlyFuel.engineLabel()).isEqualTo("Gasolina");

		VehicleSpec nothing = new VehicleSpec(null, "Fiat", null, "Panda", 2008, null, null, null, null);
		assertThat(nothing.engineLabel()).isNull();
		assertThat(nothing.label()).isEqualTo("Fiat Panda (2008)");
	}

	@Test
	void normalizationTrimsAndBlanksBecomeNull() {
		VehicleSpec spec = new VehicleSpec(" ", " SEAT ", "", " Ibiza ", 2010, "  ", null, null, null).normalized();
		assertThat(spec).isEqualTo(new VehicleSpec(null, "SEAT", null, "Ibiza", 2010, null, null, null, null));
	}

	@Test
	void thePlateIsStoredInUpperCaseWithoutSeparators() {
		assertThat(ibiza(" 1234 bcd ").normalized().plate()).isEqualTo("1234BCD");
		assertThat(ibiza("M-1234-ab").normalized().plate()).isEqualTo("M1234AB");
		assertThat(ibiza(" - ").normalized().plate()).isNull();
		assertThat(ibiza(null).normalized().plate()).isNull();
	}

	@Test
	void thePlateIsNotPartOfTheCarOrItsLabels() {
		assertThat(ibiza("1234BCD").sameCar(ibiza(null))).isTrue();
		assertThat(ibiza("1234BCD").sameCar(ibiza("5678FGH"))).isTrue();
		assertThat(ibiza("1234BCD")).isNotEqualTo(ibiza("5678FGH"));
		assertThat(ibiza("1234BCD").label()).isEqualTo("SEAT Ibiza (2010)");
	}

	private static VehicleSpec ibiza(String plate) {
		return new VehicleSpec(null, "SEAT", null, "Ibiza", 2010, null, null, null, plate);
	}

	@Test
	void fuelIsParsedTolerantly() {
		assertThat(Fuel.parse("Diésel")).contains(Fuel.DIESEL);
		assertThat(Fuel.parse("híbrido enchufable")).contains(Fuel.HIBRIDO_ENCHUFABLE);
		assertThat(Fuel.parse("PHEV")).contains(Fuel.HIBRIDO_ENCHUFABLE);
		assertThat(Fuel.parse("electric")).contains(Fuel.ELECTRICO);
		assertThat(Fuel.parse("gasoline")).contains(Fuel.GASOLINA);
		assertThat(Fuel.parse("vapor")).isEmpty();
		assertThat(Fuel.parse(null)).isEmpty();
	}

}
