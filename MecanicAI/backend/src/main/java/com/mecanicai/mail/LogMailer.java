package com.mecanicai.mail;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

/** Sin SMTP configurado (desarrollo): el email se escribe en el log en vez de enviarse. */
final class LogMailer implements Mailer {

	private static final Logger log = LoggerFactory.getLogger(LogMailer.class);

	@Override
	public void send(Email email) {
		log.info("Email sin enviar (no hay MAIL_HOST) a {} · {}\n{}", email.to(), email.subject(), email.text());
	}

}
