package com.mecanicai.auth;

import static org.assertj.core.api.Assertions.assertThat;

import java.nio.charset.StandardCharsets;
import java.time.Instant;
import java.util.UUID;

import javax.crypto.spec.SecretKeySpec;

import org.junit.jupiter.api.Test;
import org.springframework.security.oauth2.jose.jws.MacAlgorithm;
import org.springframework.security.oauth2.jwt.JwsHeader;
import org.springframework.security.oauth2.jwt.JwtClaimsSet;
import org.springframework.security.oauth2.jwt.JwtEncoderParameters;
import org.springframework.security.oauth2.jwt.NimbusJwtEncoder;

import com.mecanicai.TestProps;
import com.nimbusds.jose.jwk.source.ImmutableSecret;

class JwtServiceTest {

	private final JwtService jwt = new JwtService(TestProps.defaults());

	@Test
	void eachLoginIsANewSession() {
		UUID userId = UUID.randomUUID();
		AuthUser first = jwt.parse(jwt.issue(userId)).orElseThrow();
		AuthUser second = jwt.parse(jwt.issue(userId)).orElseThrow();

		assertThat(first.id()).isEqualTo(userId);
		assertThat(first.sessionId()).isNotNull().isNotEqualTo(second.sessionId());
		assertThat(first.issuedAt()).isNotNull();
	}

	@Test
	void aRenewedTokenKeepsItsSession() {
		UUID userId = UUID.randomUUID();
		UUID sessionId = UUID.randomUUID();
		AuthUser renewed = jwt.parse(jwt.issue(userId, sessionId)).orElseThrow();

		assertThat(renewed.id()).isEqualTo(userId);
		assertThat(renewed.sessionId()).isEqualTo(sessionId);
	}

	@Test
	void garbageIsNotAToken() {
		assertThat(jwt.parse("no-es-un-jwt")).isEmpty();
	}

	@Test
	void aTokenWithoutItsSessionIsNotValid() {
		// Bien firmado y sin caducar, pero sin "sid": no se podría revocar al cerrar sesión
		byte[] secret = TestProps.defaults().auth().jwtSecret().getBytes(StandardCharsets.UTF_8);
		var encoder = new NimbusJwtEncoder(new ImmutableSecret<>(new SecretKeySpec(secret, "HmacSHA256")));
		Instant now = Instant.now();
		JwtClaimsSet claims = JwtClaimsSet.builder()
			.issuer("mecanicai")
			.subject(UUID.randomUUID().toString())
			.issuedAt(now)
			.expiresAt(now.plusSeconds(3600))
			.build();
		String token = encoder.encode(JwtEncoderParameters.from(JwsHeader.with(MacAlgorithm.HS256).build(), claims))
			.getTokenValue();

		assertThat(jwt.parse(token)).isEmpty();
	}

}
