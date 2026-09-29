package com.mecanicai.auth;

import java.io.IOException;

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
 * Autentica la petición a partir de la cookie de sesión (JWT). No es un bean para que Spring Boot no lo registre
 * también como filtro de servlet; se añade solo a la cadena de seguridad.
 */
public class JwtCookieAuthenticationFilter extends OncePerRequestFilter {

	private final JwtService jwtService;

	private final SessionCookies cookies;

	public JwtCookieAuthenticationFilter(JwtService jwtService, SessionCookies cookies) {
		this.jwtService = jwtService;
		this.cookies = cookies;
	}

	@Override
	protected void doFilterInternal(HttpServletRequest request, HttpServletResponse response, FilterChain chain)
			throws ServletException, IOException {
		if (SecurityContextHolder.getContext().getAuthentication() == null) {
			cookies.read(request, SessionCookies.SESSION_COOKIE).flatMap(jwtService::parse).ifPresent(user -> {
				var authentication = UsernamePasswordAuthenticationToken.authenticated(user, null,
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
