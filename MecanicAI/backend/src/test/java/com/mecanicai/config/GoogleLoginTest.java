package com.mecanicai.config;

import static org.hamcrest.Matchers.containsString;
import static org.hamcrest.Matchers.startsWith;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.header;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.context.properties.EnableConfigurationProperties;
import org.springframework.boot.webmvc.test.autoconfigure.WebMvcTest;
import org.springframework.context.annotation.Import;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.test.web.servlet.MockMvc;

import com.mecanicai.ai.AiClient;
import com.mecanicai.auth.AuthController;
import com.mecanicai.auth.JwtService;
import com.mecanicai.auth.OAuth2LoginSuccessHandler;
import com.mecanicai.auth.SessionCookies;
import com.mecanicai.auth.SessionService;
import com.mecanicai.usage.UsageService;
import com.mecanicai.user.UserService;

/**
 * Inicio de sesión con Google cuando está configurado. Spring Security pide PKCE por defecto: este test avisa si una
 * versión nueva dejara de hacerlo.
 */
@WebMvcTest(controllers = AuthController.class,
		properties = { "app.auth.jwt-secret=test-secret-0123456789-0123456789-abcdef", "app.auth.cookie-secure=false",
				"app.auth.google.client-id=cliente-de-prueba", "app.auth.google.client-secret=secreto-de-prueba" })
@EnableConfigurationProperties(AppProperties.class)
@Import({ SecurityConfig.class, JwtService.class, SessionCookies.class, OAuth2LoginSuccessHandler.class })
class GoogleLoginTest {

	@Autowired
	MockMvc mvc;

	@MockitoBean
	UserService users;

	@MockitoBean
	UsageService usage;

	@MockitoBean
	AiClient aiClient;

	@MockitoBean
	SessionService sessions;

	@Test
	void theRequestToGoogleUsesPkceAndLetsTheUserChooseTheAccount() throws Exception {
		mvc.perform(get("/oauth2/authorization/google"))
			.andExpect(status().is3xxRedirection())
			.andExpect(header().string("Location", startsWith("https://accounts.google.com/o/oauth2/v2/auth?")))
			.andExpect(header().string("Location", containsString("code_challenge_method=S256")))
			.andExpect(header().string("Location", containsString("code_challenge=")))
			.andExpect(header().string("Location", containsString("prompt=select_account")));
	}

}
