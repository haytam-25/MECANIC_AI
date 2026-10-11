package com.mecanicai.vehicle;

import java.util.List;
import java.util.Objects;
import java.util.Optional;
import java.util.UUID;

import org.springframework.http.HttpStatus;
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

	/**
	 * Guarda el vehículo en el garaje del usuario; si ya tenía uno idéntico, reutiliza ese. Como mucho
	 * {@code app.limits.max-vehicles} coches por usuario.
	 * <p>
	 * La matrícula solo distingue dos coches iguales cuando los dos la tienen y es distinta: elegir otra vez un
	 * coche sin indicarla abre el que ya había, e indicarla en uno que no la tenía se la añade.
	 */
	@Transactional
	public Vehicle create(UUID userId, VehicleSpec rawSpec) {
		VehicleSpec spec = rawSpec.normalized();
		spec.validateYear(props.timezone());
		List<Vehicle> garage = vehicles.findByUserIdOrderByCreatedAtDesc(userId);
		List<Vehicle> sameCar = garage.stream().filter(existing -> existing.toSpec().sameCar(spec)).toList();
		Optional<Vehicle> known = sameCar.stream()
			.filter(existing -> Objects.equals(existing.getPlate(), spec.plate()))
			.findFirst();
		if (known.isEmpty() && spec.plate() == null) {
			known = sameCar.stream().findFirst();
		}
		if (known.isEmpty()) {
			known = sameCar.stream().filter(existing -> existing.getPlate() == null).findFirst();
			known.ifPresent(existing -> existing.setPlate(spec.plate()));
		}
		return known.orElseGet(() -> {
			int max = props.limits().maxVehicles();
			if (garage.size() >= max) {
				throw new AppException(HttpStatus.CONFLICT, "VEHICLE_LIMIT",
						"Tu garaje está lleno (máximo %d coches). Borra uno para añadir otro.".formatted(max));
			}
			return vehicles.save(new Vehicle(userId, spec));
		});
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
