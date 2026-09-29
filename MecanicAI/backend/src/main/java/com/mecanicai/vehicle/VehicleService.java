package com.mecanicai.vehicle;

import java.util.List;
import java.util.UUID;

import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import com.mecanicai.common.AppException;
import com.mecanicai.config.AppProperties;

@Service
public class VehicleService {

	private final VehicleRepository vehicles;

	private final AppProperties props;

	public VehicleService(VehicleRepository vehicles, AppProperties props) {
		this.vehicles = vehicles;
		this.props = props;
	}

	@Transactional(readOnly = true)
	public List<VehicleDto> list(UUID userId) {
		return vehicles.findByUserIdOrderByCreatedAtDesc(userId).stream().map(VehicleDto::from).toList();
	}

	/** Guarda el vehículo en el garaje del usuario; si ya tenía uno idéntico, reutiliza ese. */
	@Transactional
	public Vehicle create(UUID userId, VehicleSpec rawSpec) {
		VehicleSpec spec = rawSpec.normalized();
		spec.validateYear(props.timezone());
		return vehicles.findByUserIdOrderByCreatedAtDesc(userId)
			.stream()
			.filter(existing -> existing.toSpec().equals(spec))
			.findFirst()
			.orElseGet(() -> vehicles.save(new Vehicle(userId, spec)));
	}

	@Transactional(readOnly = true)
	public Vehicle require(UUID userId, UUID vehicleId) {
		return vehicles.findByIdAndUserId(vehicleId, userId)
			.orElseThrow(() -> AppException.notFound("Vehículo no encontrado"));
	}

	/** Borra el vehículo y, en cascada, sus conversaciones. */
	@Transactional
	public void delete(UUID userId, UUID vehicleId) {
		vehicles.delete(require(userId, vehicleId));
	}

}
