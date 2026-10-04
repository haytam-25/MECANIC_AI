package com.mecanicai.auth;

import java.time.Duration;
import java.time.Instant;
import java.util.Optional;
import java.util.UUID;

import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;

import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import com.mecanicai.ai.AiClient;
import com.mecanicai.config.AppProperties;
import com.mecanicai.config.AppProperties.PlanSettings;
import com.mecanicai.maintenance.HealthReportService;
import com.mecanicai.usage.Usage;
import com.mecanicai.usage.UsageService;
import com.mecanicai.user.Plan;
import com.mecanicai.user.User;
import com.mecanicai.user.UserService;

@RestController
@RequestMapping("/api/auth")
public class AuthController {

	/** Si el token tiene más de un día se renueva: la sesión dura mientras el usuario siga entrando. */
	private static final Duration RENEW_AFTER = Duration.ofDays(1);

	private final UserService users;

	private final JwtService jwtService;

	private final SessionCookies cookies;

	private final UsageService usage;

	private final AppProperties props;

	private final AiClient aiClient;

	public AuthController(UserService users, JwtService jwtService, SessionCookies cookies, UsageService usage,
			AppProperties props, AiClient aiClient) {
		this.users = users;
		this.jwtService = jwtService;
		this.cookies = cookies;
		this.usage = usage;
		this.props = props;
		this.aiClient = aiClient;
	}

	public record UserDto(UUID id, String name, String email, String avatarUrl, Plan plan) {

		static UserDto from(User user) {
			return new UserDto(user.getId(), user.getName(), user.getEmail(), user.getAvatarUrl(), user.getPlan());
		}
	}

	/** Qué opciones debe mostrar el frontend. */
	public record Features(boolean googleLogin, boolean aiDemo, int guestDailyMessages, int freeDailyMessages,
			int guestWeeklyReports, int freeWeeklyReports) {
	}

	/** {@code usage}: mensajes de hoy. {@code reports}: informes médicos de esta semana. */
	public record MeResponse(boolean authenticated, UserDto user, Usage usage, Usage reports, Features features) {
	}

	@GetMapping("/me")
	public MeResponse me(@AuthenticationPrincipal AuthUser principal, HttpServletRequest request,
			HttpServletResponse response) {
		Features features = new Features(props.auth().google().configured(), aiClient.isDemo(),
				props.guest().dailyMessages(), props.plans().free().dailyMessages(), props.guest().weeklyReports(),
				props.plans().free().weeklyReports());

		if (principal != null) {
			Optional<User> user = users.find(principal.id());
			if (user.isPresent()) {
				User u = user.get();
				if (principal.issuedAt() == null || principal.issuedAt().isBefore(Instant.now().minus(RENEW_AFTER))) {
					cookies.writeSession(response, jwtService.issue(u.getId()));
				}
				PlanSettings plan = props.plans().of(u.getPlan());
				return new MeResponse(true, UserDto.from(u),
						usage.peek(UsageService.userSubject(u.getId()), plan.dailyMessages()),
						usage.peekWeekly(HealthReportService.userSubject(u.getId()), plan.weeklyReports()), features);
			}
			cookies.clearSession(response);
		}

		String guestId = cookies.guestId(request, response);
		Usage guestUsage = usage.peek(UsageService.guestSubject(guestId), props.guest().dailyMessages());
		Usage guestReports = usage.peekWeekly(HealthReportService.guestSubject(guestId), props.guest().weeklyReports());
		return new MeResponse(false, null, guestUsage, guestReports, features);
	}

	@PostMapping("/logout")
	public ResponseEntity<Void> logout(HttpServletResponse response) {
		cookies.clearSession(response);
		return ResponseEntity.noContent().build();
	}

	/** Borra la cuenta y todos sus datos (derecho de supresión, RGPD). */
	@DeleteMapping("/account")
	public ResponseEntity<Void> deleteAccount(@AuthenticationPrincipal AuthUser principal,
			HttpServletResponse response) {
		users.delete(principal.id());
		cookies.clearSession(response);
		return ResponseEntity.noContent().build();
	}

}
