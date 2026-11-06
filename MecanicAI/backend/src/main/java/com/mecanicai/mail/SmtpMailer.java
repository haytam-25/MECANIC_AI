package com.mecanicai.mail;

import jakarta.mail.MessagingException;
import jakarta.mail.internet.MimeMessage;

import org.springframework.mail.MailPreparationException;
import org.springframework.mail.javamail.JavaMailSender;
import org.springframework.mail.javamail.MimeMessageHelper;

/** Envía por SMTP, con texto plano y HTML (cada programa de correo muestra el que prefiera). */
final class SmtpMailer implements Mailer {

	private final JavaMailSender sender;

	private final String from;

	SmtpMailer(JavaMailSender sender, String from) {
		this.sender = sender;
		this.from = from;
	}

	@Override
	public void send(Email email) {
		MimeMessage message = sender.createMimeMessage();
		try {
			MimeMessageHelper helper = new MimeMessageHelper(message, true, "UTF-8");
			helper.setFrom(from);
			helper.setTo(email.to());
			helper.setSubject(email.subject());
			helper.setText(email.text(), email.html());
		}
		catch (MessagingException ex) {
			throw new MailPreparationException(ex);
		}
		sender.send(message);
	}

}
