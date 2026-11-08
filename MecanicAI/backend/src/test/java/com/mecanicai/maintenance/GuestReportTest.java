package com.mecanicai.maintenance;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.anyInt;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.BDDMockito.given;
import static org.mockito.BDDMockito.then;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;

import java.time.LocalDate;
import java.time.OffsetDateTime;
import java.util.UUID;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

import com.mecanicai.TestProps;
import com.mecanicai.common.AppException;
import com.mecanicai.maintenance.HealthReportService.ReportResult;
import com.mecanicai.usage.RateLimiter;
import com.mecanicai.usage.Usage;
import com.mecanicai.usage.UsageService;
import com.mecanicai.usage.UsageService.Reservation;

/** Informes médicos de invitado: solo se cuentan (por conexión, por cookie y una vez por coche y día). */
class GuestReportTest {

	private static final OffsetDateTime TOMORROW = OffsetDateTime.now().plusDays(1);

	private final UsageService usage = mock(UsageService.class);

	// El resto de dependencias no intervienen en los informes de invitado
	private final HealthReportService reports = new HealthReportService(null, null, usage, null, null,
			new RateLimiter(), TestProps.defaults());

	private final String guestId = UUID.randomUUID().toString();

	private final String network = "reports:" + UsageService.ipSubject("203.0.113.7");

	private final Reservation byIp = new Reservation(network, LocalDate.now(), Usage.of(1, 6, TOMORROW));

	private final Reservation byGuest = new Reservation(HealthReportService.guestSubject(guestId), LocalDate.now(),
			Usage.of(1, 2, TOMORROW));

	@BeforeEach
	void nothingCountedYet() {
		given(usage.peek(anyString(), anyInt())).willReturn(Usage.of(0, 2, TOMORROW));
		given(usage.consume(eq(network), anyInt(), anyString())).willReturn(byIp);
		given(usage.consume(eq(HealthReportService.guestSubject(guestId)), anyInt(), anyString())).willReturn(byGuest);
	}

	@Test
	void aNewCarCountsOnce() {
		ReportResult result = reports.guest(guestId, "203.0.113.7", "local-1");

		assertThat(result.usage()).isEqualTo(byGuest.usage());
		then(usage).should(never()).refund(byIp);
		then(usage).should(never()).refund(byGuest);
	}

	@Test
	void aCarCountedMeanwhileByAnotherRequestGivesBothQuotasBack() {
		given(usage.consume(eq(HealthReportService.guestVehicleSubject(guestId, "local-1")), eq(1), anyString()))
			.willThrow(AppException.quotaExceeded(Usage.of(1, 1, TOMORROW), "Ese coche ya tiene informe hoy"));

		ReportResult result = reports.guest(guestId, "203.0.113.7", "local-1");

		assertThat(result.report()).isNull();
		then(usage).should().refund(byGuest);
		then(usage).should().refund(byIp);
	}

}
