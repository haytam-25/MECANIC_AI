package com.mecanicai.vehicle;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

import org.springframework.data.jpa.repository.JpaRepository;

public interface VehicleRepository extends JpaRepository<Vehicle, UUID> {

	List<Vehicle> findByUserIdOrderByCreatedAtDesc(UUID userId);

	Optional<Vehicle> findByIdAndUserId(UUID id, UUID userId);

}
