package com.mecanicai.ai;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import java.time.Duration;
import java.time.Instant;
import java.util.ArrayList;
import java.util.List;

import org.junit.jupiter.api.Test;

import com.mecanicai.ai.AiException.Kind;

class ModelFallbackTest {

	private static final Duration NO_PAUSE = Duration.ZERO;

	private static final Duration COOLDOWN = Duration.ofMinutes(2);

	private final List<String> tried = new ArrayList<>();

	private Instant now = Instant.parse("2026-10-01T10:00:00Z");

	private final ModelFallback fallback = new ModelFallback(NO_PAUSE, COOLDOWN, () -> now);

	@Test
	void usesTheNextModelWhenOneIsSaturated() {
		String result = fallback.run(List.of("a", "b", "c"), model -> {
			tried.add(model);
			if (model.equals("a")) {
				throw new AiException(Kind.RATE_LIMITED, "503");
			}
			return "respuesta de " + model;
		});

		assertThat(result).isEqualTo("respuesta de b");
		assertThat(tried).containsExactly("a", "b");
	}

	@Test
	void permanentErrorsAreNotRetriedWithOtherModels() {
		assertThatThrownBy(() -> fallback.run(List.of("a", "b"), model -> {
			tried.add(model);
			throw new AiException(Kind.BLOCKED, "bloqueado");
		})).isInstanceOf(AiException.class);
		assertThat(tried).containsExactly("a");
	}

	@Test
	void triesASecondRoundAndThenReportsTheLastError() {
		assertThatThrownBy(() -> fallback.run(List.of("a", "b"), model -> {
			tried.add(model);
			throw new AiException(Kind.RATE_LIMITED, "saturado " + model);
		})).hasMessage("saturado b");
		assertThat(tried).containsExactly("a", "b", "a", "b");
	}

	@Test
	void theSecondRoundCanSucceed() {
		String result = fallback.run(List.of("a"), model -> {
			tried.add(model);
			if (tried.size() == 1) {
				throw new AiException(Kind.RATE_LIMITED, "pico de demanda");
			}
			return "ok";
		});
		assertThat(result).isEqualTo("ok");
	}

	@Test
	void anAnswerCutHalfwayIsRestartedWithTheNextModel() {
		List<String> received = new ArrayList<>();
		String result = fallback.stream(List.of("a", "b"), (model, onDelta) -> {
			if (model.equals("a")) {
				onDelta.accept("Texto parcial ");
				throw new AiException(Kind.RATE_LIMITED, "503 a mitad de respuesta");
			}
			onDelta.accept("Respuesta ");
			onDelta.accept("completa");
			return "Respuesta completa";
		}, received::add, () -> received.add("<reinicio>"));

		assertThat(result).isEqualTo("Respuesta completa");
		assertThat(received).containsExactly("Texto parcial ", "<reinicio>", "Respuesta ", "completa");
	}

	@Test
	void noRestartIsSignalledWhenNothingWasSentYet() {
		List<String> received = new ArrayList<>();
		fallback.stream(List.of("a", "b"), (model, onDelta) -> {
			if (model.equals("a")) {
				throw new AiException(Kind.RATE_LIMITED, "503 al empezar");
			}
			onDelta.accept("ok");
			return "ok";
		}, received::add, () -> received.add("<reinicio>"));

		assertThat(received).containsExactly("ok");
	}

	@Test
	void aModelThatJustFailedIsTriedLastOnTheNextQuestion() {
		fallback.run(List.of("a", "b"), model -> {
			if (model.equals("a")) {
				throw new AiException(Kind.RATE_LIMITED, "429 sin cuota");
			}
			return "ok";
		});

		String result = fallback.run(List.of("a", "b"), model -> {
			tried.add(model);
			return "respuesta de " + model;
		});
		assertThat(result).isEqualTo("respuesta de b");
		assertThat(tried).containsExactly("b");
	}

	@Test
	void aPausedModelGoesBackToItsPlaceAfterTheCooldown() {
		fallback.run(List.of("a", "b"), model -> {
			if (model.equals("a")) {
				throw new AiException(Kind.RATE_LIMITED, "503");
			}
			return "ok";
		});
		now = now.plus(COOLDOWN).plusSeconds(1);

		fallback.run(List.of("a", "b"), model -> {
			tried.add(model);
			return "ok";
		});
		assertThat(tried).containsExactly("a");
	}

	@Test
	void pausedModelsAreStillTriedWhenTheOthersFail() {
		fallback.run(List.of("a", "b"), model -> {
			if (model.equals("a")) {
				throw new AiException(Kind.RATE_LIMITED, "503");
			}
			return "ok";
		});

		String result = fallback.run(List.of("a", "b"), model -> {
			tried.add(model);
			if (model.equals("b")) {
				throw new AiException(Kind.RATE_LIMITED, "503");
			}
			return "respuesta de " + model;
		});
		assertThat(result).isEqualTo("respuesta de a");
		assertThat(tried).containsExactly("b", "a");
	}

}
