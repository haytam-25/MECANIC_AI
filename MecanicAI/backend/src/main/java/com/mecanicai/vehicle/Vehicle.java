package com.mecanicai.vehicle;

import java.time.Instant;
import java.util.UUID;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Table;

@Entity
@Table(name = "vehicle")
public class Vehicle {

	@Id
	@GeneratedValue(strategy = GenerationType.UUID)
	private UUID id;

	@Column(name = "user_id", nullable = false)
	private UUID userId;

	@Column(name = "brand_id")
	private String brandId;

	@Column(nullable = false)
	private String brand;

	@Column(name = "model_id")
	private String modelId;

	@Column(nullable = false)
	private String model;

	@Column(name = "model_year", nullable = false)
	private int year;

	private String engine;

	@Enumerated(EnumType.STRING)
	private Fuel fuel;

	@Column(name = "power_cv")
	private Integer powerCv;

	@Column(name = "created_at", nullable = false)
	private Instant createdAt;

	protected Vehicle() {
	}

	public Vehicle(UUID userId, VehicleSpec spec) {
		this.userId = userId;
		this.brandId = spec.brandId();
		this.brand = spec.brand();
		this.modelId = spec.modelId();
		this.model = spec.model();
		this.year = spec.year();
		this.engine = spec.engine();
		this.fuel = spec.fuel();
		this.powerCv = spec.powerCv();
		this.createdAt = Instant.now();
	}

	public VehicleSpec toSpec() {
		return new VehicleSpec(brandId, brand, modelId, model, year, engine, fuel, powerCv);
	}

	public UUID getId() {
		return id;
	}

}
