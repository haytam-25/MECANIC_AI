package com.mecanicai.repair;

import java.util.List;
import java.util.UUID;

import jakarta.validation.Valid;

import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import com.mecanicai.auth.AuthUser;
import com.mecanicai.repair.RepairService.Repair;
import com.mecanicai.repair.RepairService.RepairRequest;

/** Diario de reparaciones: solo con cuenta (el de los invitados no sale del navegador). */
@RestController
@RequestMapping("/api/repairs")
public class RepairController {

	private final RepairService repairs;

	public RepairController(RepairService repairs) {
		this.repairs = repairs;
	}

	@GetMapping
	public List<Repair> list(@AuthenticationPrincipal AuthUser user) {
		return repairs.list(user.id());
	}

	@PostMapping
	public Repair create(@AuthenticationPrincipal AuthUser user, @Valid @RequestBody RepairRequest body) {
		return repairs.create(user.id(), body);
	}

	@PutMapping("/{id}")
	public Repair update(@AuthenticationPrincipal AuthUser user, @PathVariable UUID id,
			@Valid @RequestBody RepairRequest body) {
		return repairs.update(user.id(), id, body);
	}

	@DeleteMapping("/{id}")
	public ResponseEntity<Void> delete(@AuthenticationPrincipal AuthUser user, @PathVariable UUID id) {
		repairs.delete(user.id(), id);
		return ResponseEntity.noContent().build();
	}

}
