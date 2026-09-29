package com.mecanicai.auth;

import java.time.Duration;
import java.util.Arrays;
import java.util.Optional;
import java.util.UUID;
import java.util.regex.Pattern;

import jakarta.servlet.http.Cookie;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;

import org.springframework.http.HttpHeaders;
import org.springframework.http.ResponseCookie;
import org.springframework.stereotype.Component;

import com.mecanicai.config.AppProperties;

/**
 * Cookies de la aplicación: la sesión del usuario (JWT) y el identificador anónimo del invitado.
 * Ambas son HttpOnly y SameSite=Lax, así que el JavaScript no puede leerlas y no viajan en peticiones de otros sitios.
 */
@Component
public class SessionCookies {

	public static final String SESSION_COOKIE = "mecanicai_session";

	public static final String GUEST_COOKIE = "mecanicai_guest";

	private static final Pattern UUID_PATTERN = Pattern.compile("[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}");

	private final boolean secure;

	private final Duration sessionTtl;

	public SessionCookies(AppProperties props) {
		this.secure = props.auth().cookieSecure();
		this.sessionTtl = Duration.ofDays(props.auth().sessionDays());
	}

	public void writeSession(HttpServletResponse response, String token) {
		add(response, cookie(SESSION_COOKIE, token, sessionTtl));
	}

	public void clearSession(HttpServletResponse response) {
		add(response, cookie(SESSION_COOKIE, "", Duration.ZERO));
	}

	public Optional<String> read(HttpServletRequest request, String name) {
		Cookie[] cookies = request.getCookies();
		if (cookies == null) {
			return Optional.empty();
		}
		return Arrays.stream(cookies)
			.filter(c -> name.equals(c.getName()) && c.getValue() != null && !c.getValue().isBlank())
			.map(Cookie::getValue)
			.findFirst();
	}

	/** Identificador anónimo y estable del invitado; lo crea la primera vez. */
	public String guestId(HttpServletRequest request, HttpServletResponse response) {
		return read(request, GUEST_COOKIE).filter(v -> UUID_PATTERN.matcher(v).matches()).orElseGet(() -> {
			String id = UUID.randomUUID().toString();
			add(response, cookie(GUEST_COOKIE, id, Duration.ofDays(365)));
			return id;
		});
	}

	private ResponseCookie cookie(String name, String value, Duration maxAge) {
		return ResponseCookie.from(name, value)
			.httpOnly(true)
			.secure(secure)
			.sameSite("Lax")
			.path("/")
			.maxAge(maxAge)
			.build();
	}

	private static void add(HttpServletResponse response, ResponseCookie cookie) {
		response.addHeader(HttpHeaders.SET_COOKIE, cookie.toString());
	}

}
