package com.mecanicai.vehicle;

import java.time.Year;
import java.time.ZoneId;
import java.util.Locale;

import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

import com.mecanicai.common.AppException;

/**
 * Datos de un vehículo tal y como los elige el usuario en el asistente (marca, modelo, año, motorización y,
 * si quiere, la matrícula). Los ids del catálogo son opcionales: si el usuario escribe una marca o modelo a mano,
 * van vacíos. La matrícula solo identifica el coche en el garaje: no forma parte de lo que se envía a la IA.
 */
public record VehicleSpec(
		@Size(max = 60) String brandId,
		@NotBlank @Size(max = 60) String brand,
		@Size(max = 80) String modelId,
		@NotBlank @Size(max = 80) String model,
		@Min(1950) @Max(2100) int year,
		@Size(max = 100) String engine,
		Fuel fuel,
		@Min(1) @Max(2000) Integer powerCv,
		@Size(max = 12) String plate) {

	/** Limpia espacios y convierte los textos vacíos en null. La matrícula queda como "1234BCD". */
	public VehicleSpec normalized() {
		return new VehicleSpec(blankToNull(brandId), brand.trim(), blankToNull(modelId), model.trim(), year,
				blankToNull(engine), fuel, powerCv, normalizePlate(plate));
	}

	/** Mismo coche sin contar la matrícula (misma marca, modelo, año y motorización). */
	public boolean sameCar(VehicleSpec other) {
		return withPlate(null).equals(other.withPlate(null));
	}

	public VehicleSpec withPlate(String newPlate) {
		return new VehicleSpec(brandId, brand, modelId, model, year, engine, fuel, powerCv, newPlate);
	}

	public void validateYear(ZoneId zone) {
		int maxYear = Year.now(zone).getValue() + 1;
		if (year > maxYear) {
			throw AppException.badRequest("INVALID_YEAR", "El año no puede ser posterior a " + maxYear);
		}
	}

	/** Ej.: "SEAT León (2016)". */
	public String displayName() {
		return brand + " " + model + " (" + year + ")";
	}

	/** Ej.: "1.6 TDI · 115 CV · Diésel", o null si no se conoce. */
	public String engineLabel() {
		StringBuilder label = new StringBuilder();
		if (engine != null) {
			label.append(engine);
		}
		if (powerCv != null) {
			label.append(label.isEmpty() ? "" : " · ").append(powerCv).append(" CV");
		}
		if (fuel != null) {
			label.append(label.isEmpty() ? "" : " · ").append(fuel.label());
		}
		return label.isEmpty() ? null : label.toString();
	}

	/** Ej.: "SEAT León (2016) · 1.6 TDI · 115 CV · Diésel". */
	public String label() {
		String engineLabel = engineLabel();
		return engineLabel == null ? displayName() : displayName() + " · " + engineLabel;
	}

	private static String blankToNull(String value) {
		return value == null || value.isBlank() ? null : value.trim();
	}

	/** En mayúsculas y solo con letras y números: "1234 bcd" y "1234-BCD" son la misma matrícula. */
	private static String normalizePlate(String value) {
		if (value == null) {
			return null;
		}
		String plate = value.toUpperCase(Locale.ROOT).replaceAll("[^A-Z0-9]", "");
		return plate.isEmpty() ? null : plate;
	}

}
