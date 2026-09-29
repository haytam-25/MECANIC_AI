package com.mecanicai.auth;

import java.time.Duration;
import java.time.Instant;
import java.util.Optional;
import java.util.UUID;

import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import jakarta.validation.Valid;
import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import com.mecanicai.ai.AiClient;
import com.mecanicai.common.AppException;
import com.mecanicai.config.AppProperties;
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
	public record Features(boolean googleLogin, boolean devLogin, boolean aiDemo, int guestDailyMessages,
			int freeDailyMessages) {
	}

	public record MeResponse(boolean authenticated, UserDto user, Usage usage, Features features) {
	}

	public record DevLoginRequest(@NotBlank @Size(max = 80) String name, @NotBlank @Email @Size(max = 200) String email) {
	}

	@GetMapping("/me")
	public MeResponse me(@AuthenticationPrincipal AuthUser principal, HttpServletRequest request,
			HttpServletResponse response) {
		Features features = new Features(props.auth().google().configured(), props.auth().devLoginEnabled(),
				aiClient.isDemo(), props.guest().dailyMessages(), props.plans().free().dailyMessages());

		if (principal != null) {
			Optional<User> user = users.find(principal.id());
			if (user.isPresent()) {
				User u = user.get();
				if (principal.issuedAt() == null || principal.issuedAt().isBefore(Instant.now().minus(RENEW_AFTER))) {
					cookies.writeSession(response, jwtService.issue(u.getId()));
				}
				int limit = props.plans().of(u.getPlan()).dailyMessages();
				return new MeResponse(true, UserDto.from(u), usage.peek(UsageService.userSubject(u.getId()), limit),
						features);
			}
			cookies.clearSession(response);
		}

		String guestId = cookies.guestId(request, response);
		Usage guestUsage = usage.peek(UsageService.guestSubject(guestId), props.guest().dailyMessages());
		return new MeResponse(false, null, guestUsage, features);
	}

	@PostMapping("/logout")
	public ResponseEntity<Void> logout(HttpServletResponse response) {
		cookies.clearSession(response);
		return ResponseEntity.noContent().build();
	}

	/** Solo en desarrollo: entra sin Google para poder probar la app en local. */
	@PostMapping("/dev-login")
	public ResponseEntity<Void> devLogin(@Valid @RequestBody DevLoginRequest body, HttpServletResponse response) {
		if (!props.auth().devLoginEnabled()) {
			throw AppException.notFound("No disponible");
		}
		User user = users.upsertFromLogin("dev:" + body.email().toLowerCase(), body.email(), body.name(), null);
		cookies.writeSession(response, jwtService.issue(user.getId()));
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
