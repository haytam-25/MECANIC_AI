package com.mecanicai.vehicle;

import java.util.List;
import java.util.UUID;

import jakarta.validation.Valid;

import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import com.mecanicai.auth.AuthUser;

@RestController
@RequestMapping("/api/vehicles")
public class VehicleController {

	private final VehicleService vehicles;

	public VehicleController(VehicleService vehicles) {
		this.vehicles = vehicles;
	}

	@GetMapping
	public List<VehicleDto> list(@AuthenticationPrincipal AuthUser user) {
		return vehicles.list(user.id());
	}

	@PostMapping
	public VehicleDto create(@AuthenticationPrincipal AuthUser user, @Valid @RequestBody VehicleSpec spec) {
		return VehicleDto.from(vehicles.create(user.id(), spec));
	}

	@DeleteMapping("/{id}")
	public ResponseEntity<Void> delete(@AuthenticationPrincipal AuthUser user, @PathVariable UUID id) {
		vehicles.delete(user.id(), id);
		return ResponseEntity.noContent().build();
	}

}
