package com.mecanicai.usage;

import java.time.InstantSource;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.atomic.AtomicInteger;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

/**
 * Límite de peticiones por minuto (contra las ráfagas), en memoria: basta con una sola instancia del backend.
 * Los límites diarios y semanales van en la base de datos ({@link UsageService}).
 */
@Component
public class RateLimiter {

	private record Window(long minute, AtomicInteger count) {
	}

	private final Map<String, Window> windows = new ConcurrentHashMap<>();

	private final InstantSource clock;

	@Autowired
	public RateLimiter() {
		this(InstantSource.system());
	}

	RateLimiter(InstantSource clock) {
		this.clock = clock;
	}

	/** Cuenta una petición de {@code key}; false si ya lleva {@code perMinute} en este minuto. */
	public boolean tryAcquire(String key, int perMinute) {
		if (perMinute <= 0) {
			return true;
		}
		long minute = currentMinute();
		Window window = windows.compute(key,
				(k, old) -> old == null || old.minute() != minute ? new Window(minute, new AtomicInteger()) : old);
		return window.count().incrementAndGet() <= perMinute;
	}

	/** Olvida los minutos ya pasados para que el mapa no crezca. */
	@Scheduled(fixedRate = 300_000)
	public void purge() {
		long minute = currentMinute();
		windows.values().removeIf(window -> window.minute() < minute);
	}

	private long currentMinute() {
		return clock.millis() / 60_000;
	}

}
