package com.mecanicai.auth;

import static org.assertj.core.api.Assertions.assertThat;

import java.util.UUID;

import org.junit.jupiter.api.Test;

import com.mecanicai.TestProps;

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

}
