package com.mecanicai.maintenance;

import java.util.List;

import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import jakarta.validation.Valid;

import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RestController;

import com.mecanicai.auth.AuthUser;
import com.mecanicai.auth.SessionCookies;
import com.mecanicai.maintenance.HealthReportService.ReportResult;
import com.mecanicai.maintenance.HealthReportService.SaveReportRequest;
import com.mecanicai.maintenance.HealthReportService.SavedReport;

/**
 * Informes médicos. Con cuenta ({@code /api/reports}) se guardan; como invitado ({@code /api/guest/reports}) solo se
 * cuentan para el límite semanal.
 */
@RestController
public class HealthReportController {

	private final HealthReportService reports;

	private final SessionCookies cookies;

	public HealthReportController(HealthReportService reports, SessionCookies cookies) {
		this.reports = reports;
		this.cookies = cookies;
	}

	@GetMapping("/api/reports")
	public List<SavedReport> list(@AuthenticationPrincipal AuthUser user) {
		return reports.list(user.id());
	}

	@PostMapping("/api/reports")
	public ReportResult save(@AuthenticationPrincipal AuthUser user, @Valid @RequestBody SaveReportRequest body) {
		return reports.save(user.id(), body);
	}

	@PostMapping("/api/guest/reports")
	public ReportResult guest(HttpServletRequest request, HttpServletResponse response) {
		return reports.guest(cookies.guestId(request, response), request.getRemoteAddr());
	}

}
