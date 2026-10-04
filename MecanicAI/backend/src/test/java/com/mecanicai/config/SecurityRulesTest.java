package com.mecanicai.config;

import static org.mockito.ArgumentMatchers.any;
import static org.mockito.BDDMockito.given;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.header;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import java.util.List;
import java.util.UUID;

import jakarta.servlet.http.Cookie;

import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.context.properties.EnableConfigurationProperties;
import org.springframework.boot.webmvc.test.autoconfigure.WebMvcTest;
import org.springframework.context.annotation.Import;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.test.web.servlet.MockMvc;

import com.mecanicai.ai.AiClient;
import com.mecanicai.auth.AuthController;
import com.mecanicai.auth.CsrfHeaderFilter;
import com.mecanicai.auth.JwtService;
import com.mecanicai.auth.OAuth2LoginSuccessHandler;
import com.mecanicai.auth.SessionCookies;
import com.mecanicai.maintenance.HealthReportController;
import com.mecanicai.maintenance.HealthReportService;
import com.mecanicai.maintenance.HealthReportService.ReportResult;
import com.mecanicai.usage.UsageService;
import com.mecanicai.user.UserService;
import com.mecanicai.vehicle.VehicleController;
import com.mecanicai.vehicle.VehicleService;

/**
 * Reglas de seguridad de la API: qué es público, qué exige sesión y la protección CSRF.
 */
// Google vacío a propósito: el test no debe depender de las claves que haya en backend/.env
@WebMvcTest(controllers = { AuthController.class, VehicleController.class, HealthReportController.class },
		properties = { "app.auth.jwt-secret=test-secret-0123456789-0123456789-abcdef", "app.auth.cookie-secure=false",
				"app.auth.google.client-id=", "app.auth.google.client-secret=" })
@EnableConfigurationProperties(AppProperties.class)
@Import({ SecurityConfig.class, JwtService.class, SessionCookies.class, OAuth2LoginSuccessHandler.class })
class SecurityRulesTest {

	@Autowired
	MockMvc mvc;

	@Autowired
	JwtService jwtService;

	@MockitoBean
	UserService users;

	@MockitoBean
	UsageService usage;

	@MockitoBean
	AiClient aiClient;

	@MockitoBean
	VehicleService vehicles;

	@MockitoBean
	HealthReportService reports;

	@Test
	void guestsCanAskWhoTheyAreAndGetAGuestCookie() throws Exception {
		mvc.perform(get("/api/auth/me"))
			.andExpect(status().isOk())
			.andExpect(jsonPath("$.authenticated").value(false))
			.andExpect(jsonPath("$.features.googleLogin").value(false))
			.andExpect(jsonPath("$.features.guestDailyMessages").value(5))
			.andExpect(jsonPath("$.features.freeDailyMessages").value(20))
			.andExpect(jsonPath("$.features.guestWeeklyReports").value(2))
			.andExpect(jsonPath("$.features.freeWeeklyReports").value(5))
			.andExpect(jsonPath("$.features.devLogin").doesNotExist())
			.andExpect(header().string("Set-Cookie", org.hamcrest.Matchers.containsString("mecanicai_guest=")));
	}

	@Test
	void privateEndpointsRequireASession() throws Exception {
		mvc.perform(get("/api/vehicles"))
			.andExpect(status().isUnauthorized())
			.andExpect(jsonPath("$.code").value("UNAUTHORIZED"));
	}

	@Test
	void aValidSessionCookieAuthenticates() throws Exception {
		given(vehicles.list(any())).willReturn(List.of());
		mvc.perform(get("/api/vehicles").cookie(session(UUID.randomUUID()))).andExpect(status().isOk());
	}

	@Test
	void aTamperedTokenIsRejected() throws Exception {
		String token = jwtService.issue(UUID.randomUUID());
		String tampered = token.substring(0, token.length() - 4) + "AAAA";
		mvc.perform(get("/api/vehicles").cookie(new Cookie(SessionCookies.SESSION_COOKIE, tampered)))
			.andExpect(status().isUnauthorized());
	}

	@Test
	void mutatingRequestsRequireTheCsrfHeader() throws Exception {
		Cookie session = session(UUID.randomUUID());
		mvc.perform(post("/api/auth/logout").cookie(session))
			.andExpect(status().isForbidden())
			.andExpect(jsonPath("$.code").value("CSRF"));
		mvc.perform(post("/api/auth/logout").cookie(session).header(CsrfHeaderFilter.HEADER, "1"))
			.andExpect(status().isNoContent());
	}

	@Test
	void savedReportsAreOnlyForAccountsButGuestsCanCountTheirs() throws Exception {
		mvc.perform(get("/api/reports")).andExpect(status().isUnauthorized());
		mvc.perform(post("/api/reports").header(CsrfHeaderFilter.HEADER, "1")).andExpect(status().isUnauthorized());

		given(reports.guest(any(), any())).willReturn(new ReportResult(null, null));
		mvc.perform(post("/api/guest/reports").header(CsrfHeaderFilter.HEADER, "1")).andExpect(status().isOk());
	}

	@Test
	void aReportWithInvalidAnswersIsRejected() throws Exception {
		String body = """
				{"vehicleId": "%s", "input": {"currentKm": "98000", "timing": null,
				 "answers": {"ACEITE": {"kind": "hackeado", "km": "", "time": "", "unit": "meses"}}}}"""
			.formatted(UUID.randomUUID());
		mvc.perform(post("/api/reports").cookie(session(UUID.randomUUID()))
			.header(CsrfHeaderFilter.HEADER, "1")
			.contentType("application/json")
			.content(body)).andExpect(status().isBadRequest()).andExpect(jsonPath("$.code").value("VALIDATION"));
	}

	private Cookie session(UUID userId) {
		return new Cookie(SessionCookies.SESSION_COOKIE, jwtService.issue(userId));
	}

}
