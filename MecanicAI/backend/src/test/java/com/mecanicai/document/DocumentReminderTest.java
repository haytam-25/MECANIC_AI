package com.mecanicai.document;

import static org.assertj.core.api.Assertions.assertThat;

import java.time.LocalDate;
import java.util.UUID;

import org.junit.jupiter.api.Test;

import com.mecanicai.document.DocumentReminderService.Window;
import com.mecanicai.document.ReminderEmail.Reminder;
import com.mecanicai.mail.Email;

class DocumentReminderTest {

	private static final LocalDate TODAY = LocalDate.of(2026, 11, 6);

	private final Window window = Window.on(TODAY);

	@Test
	void remindersStartTwoMonthsBeforeAndStopOnTheDayItExpires() {
		assertThat(window.isDue(TODAY.plusMonths(2).plusDays(1), null)).isFalse();
		assertThat(window.isDue(TODAY.plusMonths(2), null)).isTrue();
		assertThat(window.isDue(TODAY.plusDays(20), null)).isTrue();
		assertThat(window.isDue(TODAY, null)).isTrue();
		assertThat(window.isDue(TODAY.minusDays(1), null)).isFalse();
	}

	@Test
	void thereIsOneReminderAWeek() {
		LocalDate expires = TODAY.plusDays(30);
		assertThat(window.isDue(expires, TODAY.minusDays(1))).isFalse();
		assertThat(window.isDue(expires, TODAY.minusDays(6))).isFalse();
		assertThat(window.isDue(expires, TODAY.minusDays(7))).isTrue();
		// Si un día no se pudo enviar, sale al siguiente
		assertThat(window.isDue(expires, TODAY.minusDays(9))).isTrue();
	}

	@Test
	void theEmailSaysWhatExpiresWhenAndLinksToTheCarDocuments() {
		UUID vehicle = UUID.fromString("7d1c6c3e-2f53-4a43-9a0e-5d4c0f5b1a11");
		Reminder reminder = new Reminder(UUID.randomUUID(), DocumentKind.INSPECTION, TODAY.plusDays(45), vehicle,
				"ana@example.com", "Ana García", "Seat", "León", "1234BCD");

		Email email = ReminderEmail.build(reminder, TODAY, "https://mecanicai.org/");

		assertThat(email.to()).isEqualTo("ana@example.com");
		assertThat(email.subject()).isEqualTo("La ITV de tu Seat León caduca en 45 días");
		assertThat(email.text()).startsWith("Hola, Ana:")
			.contains("La ITV de tu Seat León (1234BCD) caduca en 45 días: el 21 de diciembre de 2026.")
			.contains("https://mecanicai.org/coche/" + vehicle + "/documentos")
			.contains("cada semana");
		assertThat(email.html()).contains("href=\"https://mecanicai.org/coche/" + vehicle + "/documentos\"")
			.contains("La ITV caduca en 45 días");
	}

	@Test
	void theInsuranceExpiresTodayOrTomorrowAndNamesAreEscaped() {
		Reminder today = new Reminder(UUID.randomUUID(), DocumentKind.INSURANCE, TODAY, UUID.randomUUID(),
				"a@b.c", null, "Ford", "<Focus>", null);
		Email email = ReminderEmail.build(today, TODAY, "https://mecanicai.org");
		assertThat(email.subject()).isEqualTo("El seguro obligatorio de tu Ford <Focus> vence hoy");
		assertThat(email.text()).startsWith("Hola:");
		assertThat(email.html()).contains("Ford &lt;Focus&gt;").doesNotContain("<Focus>");

		Reminder tomorrow = new Reminder(UUID.randomUUID(), DocumentKind.INSURANCE, TODAY.plusDays(1),
				UUID.randomUUID(), "a@b.c", "Luis", "Ford", "Focus", null);
		assertThat(ReminderEmail.build(tomorrow, TODAY, "https://mecanicai.org").subject())
			.isEqualTo("El seguro obligatorio de tu Ford Focus vence mañana");
	}

}
