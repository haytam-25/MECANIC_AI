package com.mecanicai.ai;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import java.time.Duration;
import java.util.ArrayList;
import java.util.List;

import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.Test;

import com.google.genai.errors.ApiException;

class GeminiAiClientTest {

	private static final ApiException MINIMAL_NOT_SUPPORTED = new ApiException(400, "INVALID_ARGUMENT",
			"Thinking level MINIMAL is not supported for this model.");

	private final GeminiAiClient client = new GeminiAiClient("clave-de-prueba", Duration.ofSeconds(5));

	private final List<String> levels = new ArrayList<>();

	@AfterEach
	void close() {
		client.close();
	}

	@Test
	void aModelWithoutMinimalThinkingIsRetriedWithLowAndRemembered() {
		String first = client.withSupportedThinking("gemini-3.8-flash", "minimal", level -> {
			levels.add(level);
			if (level.equals("minimal")) {
				throw MINIMAL_NOT_SUPPORTED;
			}
			return "ok";
		});
		client.withSupportedThinking("gemini-3.8-flash", "minimal", level -> levels.add(level));

		assertThat(first).isEqualTo("ok");
		assertThat(levels).containsExactly("minimal", "low", "low");
	}

	@Test
	void otherModelsKeepMinimalThinking() {
		client.withSupportedThinking("gemini-3.8-flash", "minimal", level -> {
			if (level.equals("minimal")) {
				throw MINIMAL_NOT_SUPPORTED;
			}
			return "ok";
		});
		client.withSupportedThinking("gemini-3.5-flash-lite", "minimal", level -> levels.add(level));

		assertThat(levels).containsExactly("minimal");
	}

	@Test
	void otherErrorsArePropagated() {
		ApiException saturated = new ApiException(503, "UNAVAILABLE", "This model is currently experiencing high demand.");
		assertThatThrownBy(() -> client.withSupportedThinking("gemini-3.5-flash-lite", "minimal", level -> {
			levels.add(level);
			throw saturated;
		})).isSameAs(saturated);
		assertThat(levels).containsExactly("minimal");
	}

}
