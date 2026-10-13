package com.mecanicai.config;

import java.io.IOException;

import jakarta.servlet.DispatcherType;
import jakarta.servlet.http.HttpServletResponse;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.http.MediaType;
import org.springframework.security.config.annotation.web.builders.HttpSecurity;
import org.springframework.security.config.annotation.web.configurers.AbstractHttpConfigurer;
import org.springframework.security.config.oauth2.client.CommonOAuth2Provider;
import org.springframework.security.oauth2.client.registration.ClientRegistrationRepository;
import org.springframework.security.oauth2.client.registration.InMemoryClientRegistrationRepository;
import org.springframework.security.oauth2.client.web.DefaultOAuth2AuthorizationRequestResolver;
import org.springframework.security.oauth2.client.web.HttpSessionOAuth2AuthorizedClientRepository;
import org.springframework.security.oauth2.client.web.OAuth2AuthorizationRequestRedirectFilter;
import org.springframework.security.web.SecurityFilterChain;
import org.springframework.security.web.authentication.UsernamePasswordAuthenticationFilter;
import org.springframework.security.web.context.RequestAttributeSecurityContextRepository;

import com.mecanicai.auth.CsrfHeaderFilter;
import com.mecanicai.auth.JwtCookieAuthenticationFilter;
import com.mecanicai.auth.JwtService;
import com.mecanicai.auth.OAuth2LoginSuccessHandler;
import com.mecanicai.auth.SessionCookies;
import com.mecanicai.common.ApiError;

import tools.jackson.databind.json.JsonMapper;

@Configuration
public class SecurityConfig {

	private static final Logger log = LoggerFactory.getLogger(SecurityConfig.class);

	@Bean
	SecurityFilterChain securityFilterChain(HttpSecurity http, AppProperties props, JwtService jwtService,
			SessionCookies cookies, OAuth2LoginSuccessHandler loginSuccessHandler, JsonMapper jsonMapper) {
		http
			// CSRF: cookie SameSite=Lax + cabecera obligatoria X-MecanicAI (ver CsrfHeaderFilter)
			.csrf(AbstractHttpConfigurer::disable)
			.httpBasic(AbstractHttpConfigurer::disable)
			.formLogin(AbstractHttpConfigurer::disable)
			.logout(AbstractHttpConfigurer::disable)
			.requestCache(AbstractHttpConfigurer::disable)
			// La autenticación vive en la cookie JWT, no en la sesión HTTP
			.securityContext(context -> context.securityContextRepository(new RequestAttributeSecurityContextRepository()))
			.authorizeHttpRequests(auth -> auth
				.dispatcherTypeMatchers(DispatcherType.ASYNC, DispatcherType.ERROR).permitAll()
				.requestMatchers("/api/vehicles/**", "/api/conversations/**", "/api/reports/**", "/api/repairs/**",
						"/api/basket/**", "/api/auth/logout",
						"/api/auth/account")
				.authenticated()
				.anyRequest().permitAll())
			.exceptionHandling(ex -> ex.authenticationEntryPoint((request, response, authException) -> writeError(
					response, jsonMapper, HttpServletResponse.SC_UNAUTHORIZED,
					new ApiError("UNAUTHORIZED", "Inicia sesión para continuar"))))
			.addFilterBefore(new CsrfHeaderFilter(jsonMapper), UsernamePasswordAuthenticationFilter.class)
			.addFilterBefore(new JwtCookieAuthenticationFilter(jwtService, cookies),
					UsernamePasswordAuthenticationFilter.class);

		AppProperties.Google google = props.auth().google();
		if (google.configured()) {
			ClientRegistrationRepository registrations = new InMemoryClientRegistrationRepository(
					CommonOAuth2Provider.GOOGLE.getBuilder("google")
						.clientId(google.clientId())
						.clientSecret(google.clientSecret())
						.build());
			var resolver = new DefaultOAuth2AuthorizationRequestResolver(registrations,
					OAuth2AuthorizationRequestRedirectFilter.DEFAULT_AUTHORIZATION_REQUEST_BASE_URI);
			// Deja elegir cuenta de Google aunque haya una sesión abierta
			resolver.setAuthorizationRequestCustomizer(
					request -> request.additionalParameters(params -> params.put("prompt", "select_account")));

			http.oauth2Login(oauth -> oauth
				.clientRegistrationRepository(registrations)
				.authorizedClientRepository(new HttpSessionOAuth2AuthorizedClientRepository())
				.authorizationEndpoint(endpoint -> endpoint.authorizationRequestResolver(resolver))
				.successHandler(loginSuccessHandler)
				.failureHandler((request, response, ex) -> {
					// La web solo muestra un aviso: el motivo queda en el log (p. ej. "invalid_client" = secreto incorrecto)
					log.warn("Login con Google fallido: {}", ex.getMessage());
					response.sendRedirect(OAuth2LoginSuccessHandler.withQuery(props.frontendUrl(), "login=error"));
				}));
		}
		return http.build();
	}

	private static void writeError(HttpServletResponse response, JsonMapper jsonMapper, int status, ApiError error)
			throws IOException {
		response.setStatus(status);
		response.setContentType(MediaType.APPLICATION_JSON_VALUE);
		response.setCharacterEncoding("UTF-8");
		jsonMapper.writeValue(response.getOutputStream(), error);
	}

}
