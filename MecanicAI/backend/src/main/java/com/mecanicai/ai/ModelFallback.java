package com.mecanicai.ai;

import java.time.Duration;
import java.time.Instant;
import java.time.InstantSource;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.atomic.AtomicBoolean;
import java.util.function.Consumer;
import java.util.function.Function;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

import com.mecanicai.ai.AiException.Kind;

/**
 * Prueba los modelos en orden: si uno está saturado o no responde, pasa al siguiente. En la capa gratuita de
 * Gemini cada modelo tiene su propia capacidad y es habitual que alguno devuelva 503 durante un rato o que se quede
 * sin cuota diaria (429).
 * <p>
 * El modelo que falla queda "en pausa" unos minutos: mientras tanto se prueba el último, para que cada pregunta no
 * tenga que chocar otra vez contra él antes de llegar a uno que responde.
 */
final class ModelFallback {

	private static final Logger log = LoggerFactory.getLogger(ModelFallback.class);

	/** Si todos los modelos están saturados, se espera un poco y se hace una segunda ronda (los picos son breves). */
	private static final int ROUNDS = 2;

	private static final Duration PAUSE_BETWEEN_ROUNDS = Duration.ofSeconds(3);

	/** Tiempo que un modelo que acaba de fallar pasa al final de la lista. */
	private static final Duration COOLDOWN = Duration.ofMinutes(2);

	/** Un intento de respuesta en streaming con un modelo concreto. */
	@FunctionalInterface
	interface StreamAttempt {

		String stream(String model, Consumer<String> onDelta);

	}

	private final Map<String, Instant> pausedUntil = new ConcurrentHashMap<>();

	private final Duration pauseBetweenRounds;

	private final Duration cooldown;

	private final InstantSource clock;

	ModelFallback() {
		this(PAUSE_BETWEEN_ROUNDS, COOLDOWN, InstantSource.system());
	}

	ModelFallback(Duration pauseBetweenRounds, Duration cooldown, InstantSource clock) {
		this.pauseBetweenRounds = pauseBetweenRounds;
		this.cooldown = cooldown;
		this.clock = clock;
	}

	<T> T run(List<String> models, Function<String, T> call) {
		if (models == null || models.isEmpty()) {
			throw new AiException(Kind.CONFIGURATION, "No hay ningún modelo de IA configurado");
		}
		AiException last = null;
		for (int round = 1; round <= ROUNDS; round++) {
			for (String model : inTryOrder(models)) {
				try {
					T result = call.apply(model);
					pausedUntil.remove(model);
					return result;
				}
				catch (AiException ex) {
					if (!ex.isTransient()) {
						throw ex;
					}
					last = ex;
					pausedUntil.put(model, clock.instant().plus(cooldown));
					log.warn("Modelo {} no disponible ({}), se prueba el siguiente", model, ex.kind());
				}
			}
			if (round < ROUNDS) {
				log.warn("Todos los modelos están saturados; nueva ronda en {} s", pauseBetweenRounds.toSeconds());
				sleep(pauseBetweenRounds);
			}
		}
		throw last;
	}

	/**
	 * Igual que {@link #run} para respuestas en streaming. Si un modelo se corta a mitad de la respuesta, se llama a
	 * {@code onRestart} (el cliente descarta el texto parcial) y el siguiente modelo responde desde el principio.
	 */
	String stream(List<String> models, StreamAttempt attempt, Consumer<String> onDelta, Runnable onRestart) {
		AtomicBoolean emitted = new AtomicBoolean();
		return run(models, model -> {
			if (emitted.getAndSet(false)) {
				onRestart.run();
			}
			return attempt.stream(model, delta -> {
				emitted.set(true);
				onDelta.accept(delta);
			});
		});
	}

	/** El orden configurado, pero con los modelos en pausa al final (se siguen probando si todos los demás fallan). */
	private List<String> inTryOrder(List<String> models) {
		Instant now = clock.instant();
		List<String> ready = new ArrayList<>(models.size());
		List<String> paused = new ArrayList<>();
		for (String model : models) {
			Instant until = pausedUntil.get(model);
			(until != null && until.isAfter(now) ? paused : ready).add(model);
		}
		ready.addAll(paused);
		return ready;
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
