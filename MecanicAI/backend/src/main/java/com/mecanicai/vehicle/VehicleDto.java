package com.mecanicai.vehicle;

import java.util.UUID;

public record VehicleDto(UUID id, String brandId, String brand, String modelId, String model, int year, String engine,
		Fuel fuel, Integer powerCv, String plate, String displayName, String engineLabel) {

	public static VehicleDto from(Vehicle vehicle) {
		VehicleSpec spec = vehicle.toSpec();
		return new VehicleDto(vehicle.getId(), spec.brandId(), spec.brand(), spec.modelId(), spec.model(), spec.year(),
				spec.engine(), spec.fuel(), spec.powerCv(), spec.plate(), spec.displayName(), spec.engineLabel());
	}

}
