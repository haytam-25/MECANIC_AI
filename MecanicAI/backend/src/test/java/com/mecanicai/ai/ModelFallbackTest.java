package com.mecanicai.ai;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import java.time.Duration;
import java.util.ArrayList;
import java.util.List;

import org.junit.jupiter.api.Test;

import com.mecanicai.ai.AiException.Kind;

class ModelFallbackTest {

	private static final Duration NO_PAUSE = Duration.ZERO;

	private final List<String> tried = new ArrayList<>();

	@Test
	void usesTheNextModelWhenOneIsSaturated() {
		String result = ModelFallback.run(List.of("a", "b", "c"), model -> {
			tried.add(model);
			if (model.equals("a")) {
				throw new AiException(Kind.RATE_LIMITED, "503");
			}
			return "respuesta de " + model;
		}, NO_PAUSE);

		assertThat(result).isEqualTo("respuesta de b");
		assertThat(tried).containsExactly("a", "b");
	}

	@Test
	void permanentErrorsAreNotRetriedWithOtherModels() {
		assertThatThrownBy(() -> ModelFallback.run(List.of("a", "b"), model -> {
			tried.add(model);
			throw new AiException(Kind.BLOCKED, "bloqueado");
		}, NO_PAUSE)).isInstanceOf(AiException.class);
		assertThat(tried).containsExactly("a");
	}

	@Test
	void triesASecondRoundAndThenReportsTheLastError() {
		assertThatThrownBy(() -> ModelFallback.run(List.of("a", "b"), model -> {
			tried.add(model);
			throw new AiException(Kind.RATE_LIMITED, "saturado " + model);
		}, NO_PAUSE)).hasMessage("saturado b");
		assertThat(tried).containsExactly("a", "b", "a", "b");
	}

	@Test
	void theSecondRoundCanSucceed() {
		String result = ModelFallback.run(List.of("a"), model -> {
			tried.add(model);
			if (tried.size() == 1) {
				throw new AiException(Kind.RATE_LIMITED, "pico de demanda");
			}
			return "ok";
		}, NO_PAUSE);
		assertThat(result).isEqualTo("ok");
	}

	@Test
	void anAnswerCutHalfwayIsRestartedWithTheNextModel() {
		List<String> received = new ArrayList<>();
		String result = ModelFallback.stream(List.of("a", "b"), (model, onDelta) -> {
			if (model.equals("a")) {
				onDelta.accept("Texto parcial ");
				throw new AiException(Kind.RATE_LIMITED, "503 a mitad de respuesta");
			}
			onDelta.accept("Respuesta ");
			onDelta.accept("completa");
			return "Respuesta completa";
		}, received::add, () -> received.add("<reinicio>"), NO_PAUSE);

		assertThat(result).isEqualTo("Respuesta completa");
		assertThat(received).containsExactly("Texto parcial ", "<reinicio>", "Respuesta ", "completa");
	}

	@Test
	void noRestartIsSignalledWhenNothingWasSentYet() {
		List<String> received = new ArrayList<>();
		ModelFallback.stream(List.of("a", "b"), (model, onDelta) -> {
			if (model.equals("a")) {
				throw new AiException(Kind.RATE_LIMITED, "503 al empezar");
			}
			onDelta.accept("ok");
			return "ok";
		}, received::add, () -> received.add("<reinicio>"), NO_PAUSE);

		assertThat(received).containsExactly("ok");
	}

}
