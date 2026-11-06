package com.mecanicai.document;

import java.time.LocalDate;
import java.time.format.DateTimeFormatter;
import java.time.temporal.ChronoUnit;
import java.util.Locale;
import java.util.UUID;

import org.springframework.web.util.HtmlUtils;

import com.mecanicai.mail.Email;

/** Email de aviso de que la ITV o el seguro de un coche están a punto de caducar. */
final class ReminderEmail {

	/** Lo que hace falta para escribir el aviso de una sección. */
	record Reminder(UUID sectionId, DocumentKind kind, LocalDate expiresOn, UUID vehicleId, String email, String name,
			String brand, String model, String plate) {
	}

	private static final DateTimeFormatter DATE = DateTimeFormatter.ofPattern("d 'de' MMMM 'de' yyyy",
			Locale.of("es", "ES"));

	private ReminderEmail() {
	}

	static Email build(Reminder reminder, LocalDate today, String publicUrl) {
		long days = ChronoUnit.DAYS.between(today, reminder.expiresOn());
		String when = days <= 0 ? "hoy" : days == 1 ? "mañana" : "en " + days + " días";
		String verb = reminder.kind() == DocumentKind.INSURANCE ? "vence" : "caduca";
		String what = capitalize(reminder.kind().inSentence());
		String car = reminder.brand() + " " + reminder.model();
		String carWithPlate = reminder.plate() == null || reminder.plate().isBlank() ? car
				: car + " (" + reminder.plate() + ")";
		String date = DATE.format(reminder.expiresOn());
		String link = publicUrl.replaceAll("/+$", "") + "/coche/" + reminder.vehicleId() + "/documentos";
		String firstName = reminder.name() == null || reminder.name().isBlank() ? null
				: reminder.name().strip().split("\\s+")[0];
		String greeting = firstName == null ? "Hola:" : "Hola, " + firstName + ":";
		String advice = reminder.kind() == DocumentKind.INSURANCE
				? "Revisa la renovación con tu aseguradora: sin el seguro obligatorio en vigor no se puede circular."
				: "Pide cita con tiempo: en muchas estaciones hay semanas de espera.";
		String headline = "%s de tu %s %s %s".formatted(what, carWithPlate, verb, when);
		String footer = "Te avisamos cada semana durante los dos meses antes de que caduque. Si no quieres más avisos, "
				+ "desactívalo en la sección Documentación de tu coche.";

		String subject = "%s de tu %s %s %s".formatted(what, car, verb, when);
		String text = """
				%s

				%s: el %s.

				%s

				Tus documentos: %s

				%s

				— MecanicAI
				""".formatted(greeting, headline, date, advice, link, footer);
		String html = """
				<!DOCTYPE html>
				<html lang="es"><body style="margin:0;padding:24px 12px;background:#eef0f2;font-family:Arial,Helvetica,sans-serif;color:#1d2126">
				<table role="presentation" width="100%%" cellspacing="0" cellpadding="0"><tr><td align="center">
				<table role="presentation" width="100%%" cellspacing="0" cellpadding="0" style="max-width:520px;background:#ffffff;border-radius:14px;overflow:hidden">
				<tr><td style="height:6px;background:#ff7a1a"></td></tr>
				<tr><td style="padding:28px 28px 8px">
				<p style="margin:0 0 6px;font-size:12px;letter-spacing:.12em;text-transform:uppercase;color:#e0600a;font-weight:bold">Aviso de caducidad</p>
				<h1 style="margin:0 0 18px;font-size:22px;line-height:1.25">%s</h1>
				<p style="margin:0 0 14px;font-size:15px">%s</p>
				<p style="margin:0 0 18px;font-size:15px;line-height:1.5">%s: <strong>el %s</strong>.</p>
				<p style="margin:0 0 22px;font-size:15px;line-height:1.5">%s</p>
				<p style="margin:0 0 26px"><a href="%s" style="display:inline-block;padding:12px 22px;border-radius:999px;background:#ff7a1a;color:#1b0e03;font-weight:bold;text-decoration:none">Ver mis documentos</a></p>
				</td></tr>
				<tr><td style="padding:16px 28px 24px;border-top:1px solid #e6eaed;font-size:12px;line-height:1.5;color:#6b747d">%s<br>— MecanicAI</td></tr>
				</table></td></tr></table>
				</body></html>
				""".formatted(escape(what + " " + verb + " " + when), escape(greeting), escape(headline), escape(date), escape(advice), escape(link), escape(footer));
		return new Email(reminder.email(), subject, text, html);
	}

	private static String capitalize(String text) {
		return text.isEmpty() ? text : Character.toUpperCase(text.charAt(0)) + text.substring(1);
	}

	private static String escape(String text) {
		return HtmlUtils.htmlEscape(text, "UTF-8");
	}

}
