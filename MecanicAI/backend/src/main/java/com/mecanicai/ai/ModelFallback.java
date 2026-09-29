package com.mecanicai.ai;

import java.time.Duration;
import java.util.List;
import java.util.concurrent.atomic.AtomicBoolean;
import java.util.function.Consumer;
import java.util.function.Function;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

import com.mecanicai.ai.AiException.Kind;

/**
 * Prueba los modelos en orden: si uno está saturado o no responde, pasa al siguiente. En la capa gratuita de
 * Gemini cada modelo tiene su propia capacidad y es habitual que alguno devuelva 503 durante un rato.
 */
final class ModelFallback {

	private static final Logger log = LoggerFactory.getLogger(ModelFallback.class);

	/** Si todos los modelos están saturados, se espera un poco y se hace una segunda ronda (los picos son breves). */
	private static final int ROUNDS = 2;

	private static final Duration PAUSE_BETWEEN_ROUNDS = Duration.ofSeconds(3);

	/** Un intento de respuesta en streaming con un modelo concreto. */
	@FunctionalInterface
	interface StreamAttempt {

		String stream(String model, Consumer<String> onDelta);

	}

	private ModelFallback() {
	}

	static <T> T run(List<String> models, Function<String, T> call) {
		return run(models, call, PAUSE_BETWEEN_ROUNDS);
	}

	static <T> T run(List<String> models, Function<String, T> call, Duration pause) {
		if (models == null || models.isEmpty()) {
			throw new AiException(Kind.CONFIGURATION, "No hay ningún modelo de IA configurado");
		}
		AiException last = null;
		for (int round = 1; round <= ROUNDS; round++) {
			for (String model : models) {
				try {
					return call.apply(model);
				}
				catch (AiException ex) {
					if (!ex.isTransient()) {
						throw ex;
					}
					last = ex;
					log.warn("Modelo {} no disponible ({}), se prueba el siguiente", model, ex.kind());
				}
			}
			if (round < ROUNDS) {
				log.warn("Todos los modelos están saturados; nueva ronda en {} s", pause.toSeconds());
				sleep(pause);
			}
		}
		throw last;
	}

	/**
	 * Igual que {@link #run} para respuestas en streaming. Si un modelo se corta a mitad de la respuesta, se llama a
	 * {@code onRestart} (el cliente descarta el texto parcial) y el siguiente modelo responde desde el principio.
	 */
	static String stream(List<String> models, StreamAttempt attempt, Consumer<String> onDelta, Runnable onRestart) {
		return stream(models, attempt, onDelta, onRestart, PAUSE_BETWEEN_ROUNDS);
	}

	static String stream(List<String> models, StreamAttempt attempt, Consumer<String> onDelta, Runnable onRestart,
			Duration pause) {
		AtomicBoolean emitted = new AtomicBoolean();
		return run(models, model -> {
			if (emitted.getAndSet(false)) {
				onRestart.run();
			}
			return attempt.stream(model, delta -> {
				emitted.set(true);
				onDelta.accept(delta);
			});
		}, pause);
	}

	private static void sleep(Duration pause) {
		try {
			Thread.sleep(pause);
		}
		catch (InterruptedException ex) {
			Thread.currentThread().interrupt();
			throw new AiException(Kind.UNAVAILABLE, "Interrumpido esperando a la IA", ex);
		}
	}

}
