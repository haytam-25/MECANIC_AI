package com.mecanicai.usage;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import java.time.Instant;
import java.util.concurrent.atomic.AtomicReference;

import org.junit.jupiter.api.Test;
import org.springframework.http.HttpStatus;

import com.mecanicai.common.AppException;

class RateLimiterTest {

	private final AtomicReference<Instant> now = new AtomicReference<>(Instant.parse("2026-10-08T10:00:00Z"));

	private final RateLimiter limiter = new RateLimiter(now::get);

	@Test
	void allowsUpToTheLimitEachMinute() {
		for (int i = 0; i < 3; i++) {
			assertThat(limiter.tryAcquire("chat:a", 3)).isTrue();
		}
		assertThat(limiter.tryAcquire("chat:a", 3)).isFalse();
		// Cada cliente tiene su propia cuenta
		assertThat(limiter.tryAcquire("chat:b", 3)).isTrue();
	}

	@Test
	void theCountStartsAgainTheNextMinute() {
		assertThat(limiter.tryAcquire("chat:a", 1)).isTrue();
		assertThat(limiter.tryAcquire("chat:a", 1)).isFalse();
		now.set(now.get().plusSeconds(60));
		assertThat(limiter.tryAcquire("chat:a", 1)).isTrue();
	}

	@Test
	void checkThrowsTooManyRequestsOverTheLimit() {
		limiter.check("reports:a", 1);
		assertThatThrownBy(() -> limiter.check("reports:a", 1)).isInstanceOfSatisfying(AppException.class, ex -> {
			assertThat(ex.status()).isEqualTo(HttpStatus.TOO_MANY_REQUESTS);
			assertThat(ex.code()).isEqualTo("TOO_FAST");
		});
	}

	@Test
	void zeroMeansNoLimit() {
		for (int i = 0; i < 100; i++) {
			assertThat(limiter.tryAcquire("chat:a", 0)).isTrue();
		}
	}

}
