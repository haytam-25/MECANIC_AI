package com.mecanicai.auth;

import java.io.IOException;

import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import jakarta.servlet.http.HttpSession;

import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.oauth2.core.oidc.user.OidcUser;
import org.springframework.security.oauth2.core.user.OAuth2User;
import org.springframework.security.web.authentication.AuthenticationSuccessHandler;
import org.springframework.stereotype.Component;

import com.mecanicai.config.AppProperties;
import com.mecanicai.user.User;
import com.mecanicai.user.UserService;

/**
 * Al volver de Google: guarda/actualiza el usuario, crea la cookie de sesión y redirige al frontend.
 */
@Component
public class OAuth2LoginSuccessHandler implements AuthenticationSuccessHandler {

	private final UserService users;

	private final JwtService jwtService;

	private final SessionCookies cookies;

	private final String frontendUrl;

	public OAuth2LoginSuccessHandler(UserService users, JwtService jwtService, SessionCookies cookies,
			AppProperties props) {
		this.users = users;
		this.jwtService = jwtService;
		this.cookies = cookies;
		this.frontendUrl = props.frontendUrl();
	}

	@Override
	public void onAuthenticationSuccess(HttpServletRequest request, HttpServletResponse response,
			Authentication authentication) throws IOException {
		OAuth2User principal = (OAuth2User) authentication.getPrincipal();
		String subject = principal instanceof OidcUser oidc ? oidc.getSubject() : principal.getName();
		User user = users.upsertFromLogin("google:" + subject, principal.getAttribute("email"),
				principal.getAttribute("name"), principal.getAttribute("picture"));

		cookies.writeSession(response, jwtService.issue(user.getId()));

		// La sesión HTTP solo servía para el intercambio OAuth: a partir de aquí manda la cookie JWT
		HttpSession session = request.getSession(false);
		if (session != null) {
			session.invalidate();
		}
		SecurityContextHolder.clearContext();
		response.sendRedirect(withQuery(frontendUrl, "login=ok"));
	}

	public static String withQuery(String url, String query) {
		return url + (url.contains("?") ? "&" : "?") + query;
	}

}
