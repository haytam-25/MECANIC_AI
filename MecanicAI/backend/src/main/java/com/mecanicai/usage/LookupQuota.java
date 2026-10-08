package com.mecanicai.usage;

import java.util.ArrayList;
import java.util.List;
import java.util.Optional;

import org.springframework.stereotype.Component;

import com.mecanicai.common.AppException;
import com.mecanicai.config.AppProperties;
import com.mecanicai.usage.UsageService.Reservation;

/**
 * Cupo de las consultas cortas a la IA (motorizaciones y plan de mantenimiento) cuando no están en caché: por minuto
 * y por día para cada cliente y, si es un invitado, también un cupo diario entre todos los invitados.
 */
@Component
public class LookupQuota {

	/** Lo consumido; se devuelve con {@link #refund(Ticket)} si la IA no llega a responder. */
	public record Ticket(List<Reservation> reservations) {
	}

	private final UsageService usage;

	private final RateLimiter rateLimiter;

	private final AppProperties props;

	public LookupQuota(UsageService usage, RateLimiter rateLimiter, AppProperties props) {
		this.usage = usage;
		this.rateLimiter = rateLimiter;
		this.props = props;
	}

	/**
	 * @param kind      tipo de consulta ("engines", "maintenance"): cada uno tiene su cupo diario
	 * @param clientKey {@link UsageService#userSubject} o, para invitados, {@link UsageService#ipSubject}
	 * @return vacío si se ha superado algún límite
	 */
	public Optional<Ticket> acquire(String kind, String clientKey) {
		if (!rateLimiter.tryAcquire("lookups:" + clientKey, props.limits().lookupsPerMinute())) {
			return Optional.empty();
		}
		AppProperties.Engines settings = props.ai().engines();
		List<Reservation> taken = new ArrayList<>();
		try {
			taken.add(usage.consume(kind + ":" + clientKey, settings.dailyLookupsPerClient(), "Límite diario"));
			if (clientKey.startsWith("ip:")) {
				taken.add(usage.consume(kind + ":guests", settings.guestDailyLookupsTotal(), "Límite de invitados"));
			}
			return Optional.of(new Ticket(List.copyOf(taken)));
		}
		catch (AppException ex) {
			taken.forEach(usage::refund);
			return Optional.empty();
		}
	}

	public void refund(Ticket ticket) {
		ticket.reservations().forEach(usage::refund);
	}

}
