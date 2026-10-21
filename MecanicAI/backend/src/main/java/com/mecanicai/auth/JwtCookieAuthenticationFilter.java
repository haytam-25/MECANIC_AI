package com.mecanicai.auth;

import java.io.IOException;
import java.util.Optional;

import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;

import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.authority.AuthorityUtils;
import org.springframework.security.core.context.SecurityContext;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.web.filter.OncePerRequestFilter;

/**
 * Autentica la petición a partir de la cookie de sesión (JWT) si la sesión sigue valiendo (ver
 * {@link SessionService}); si no, borra la cookie y la petición sigue como invitado. No es un bean para que Spring
 * Boot no lo registre también como filtro de servlet; se añade solo a la cadena de seguridad.
 */
public class JwtCookieAuthenticationFilter extends OncePerRequestFilter {

	private final JwtService jwtService;

	private final SessionService sessions;

	private final SessionCookies cookies;

	public JwtCookieAuthenticationFilter(JwtService jwtService, SessionService sessions, SessionCookies cookies) {
		this.jwtService = jwtService;
		this.sessions = sessions;
		this.cookies = cookies;
	}

	@Override
	protected void doFilterInternal(HttpServletRequest request, HttpServletResponse response, FilterChain chain)
			throws ServletException, IOException {
		if (SecurityContextHolder.getContext().getAuthentication() == null) {
			cookies.read(request, SessionCookies.SESSION_COOKIE).ifPresent(token -> {
				Optional<AuthUser> user = jwtService.parse(token).filter(sessions::isActive);
				if (user.isEmpty()) {
					// Caducada, manipulada, cerrada o de una cuenta borrada: el navegador deja de enviarla
					cookies.clearSession(response);
					return;
				}
				var authentication = UsernamePasswordAuthenticationToken.authenticated(user.get(), null,
						AuthorityUtils.createAuthorityList("ROLE_USER"));
				SecurityContext context = SecurityContextHolder.createEmptyContext();
				context.setAuthentication(authentication);
				SecurityContextHolder.setContext(context);
			});
		}
		chain.doFilter(request, response);
	}

	@Override
	protected boolean shouldNotFilterAsyncDispatch() {
		// Las respuestas en streaming (SSE) terminan con un dispatch asíncrono que también debe ir autenticado
		return false;
	}

}
