package com.mecanicai.maintenance;

import jakarta.servlet.http.HttpServletRequest;
import jakarta.validation.Valid;

import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import com.mecanicai.auth.AuthUser;
import com.mecanicai.maintenance.MaintenancePlanService.MaintenancePlan;
import com.mecanicai.usage.UsageService;
import com.mecanicai.vehicle.VehicleSpec;

/** "Informe médico": abierto también a invitados (el coche va en la petición, no hace falta tenerlo guardado). */
@RestController
@RequestMapping("/api/maintenance")
public class MaintenanceController {

	private final MaintenancePlanService plans;

	public MaintenanceController(MaintenancePlanService plans) {
		this.plans = plans;
	}

	@PostMapping("/plan")
	public MaintenancePlan plan(@Valid @RequestBody VehicleSpec vehicle, @AuthenticationPrincipal AuthUser user,
			HttpServletRequest request) {
		String clientKey = user != null ? UsageService.userSubject(user.id()) : UsageService.ipSubject(request.getRemoteAddr());
		return plans.plan(vehicle, clientKey);
	}

}
