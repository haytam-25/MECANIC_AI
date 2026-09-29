package com.mecanicai.auth;

import java.io.IOException;
import java.util.Set;

import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;

import org.springframework.http.MediaType;
import org.springframework.web.filter.OncePerRequestFilter;

import com.mecanicai.common.ApiError;

import tools.jackson.databind.json.JsonMapper;

/**
 * Protección CSRF para la API: toda petición que modifica datos debe llevar la cabecera {@value #HEADER}.
 * Un formulario o script de otra web no puede añadir cabeceras propias sin una petición CORS previa (que no
 * permitimos), y además la cookie de sesión es SameSite=Lax.
 */
public class CsrfHeaderFilter extends OncePerRequestFilter {

	public static final String HEADER = "X-MecanicAI";

	private static final Set<String> SAFE_METHODS = Set.of("GET", "HEAD", "OPTIONS", "TRACE");

	private final JsonMapper jsonMapper;

	public CsrfHeaderFilter(JsonMapper jsonMapper) {
		this.jsonMapper = jsonMapper;
	}

	@Override
	protected void doFilterInternal(HttpServletRequest request, HttpServletResponse response, FilterChain chain)
			throws ServletException, IOException {
		boolean mutating = !SAFE_METHODS.contains(request.getMethod());
		if (mutating && request.getRequestURI().startsWith("/api/") && request.getHeader(HEADER) == null) {
			response.setStatus(HttpServletResponse.SC_FORBIDDEN);
			response.setContentType(MediaType.APPLICATION_JSON_VALUE);
			response.setCharacterEncoding("UTF-8");
			jsonMapper.writeValue(response.getOutputStream(), new ApiError("CSRF", "Falta la cabecera " + HEADER));
			return;
		}
		chain.doFilter(request, response);
	}

}
