package com.mecanicai.mail;

import java.util.Properties;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.mail.javamail.JavaMailSenderImpl;
import org.springframework.util.StringUtils;

import com.mecanicai.config.AppProperties;

/**
 * Correo saliente con la configuración de {@code app.mail}: por SMTP (STARTTLS en el puerto 587 y similares, TLS
 * directo en el 465) o, sin {@code MAIL_HOST}, solo en el log.
 */
@Configuration
public class MailConfig {

	private static final Logger log = LoggerFactory.getLogger(MailConfig.class);

	private static final String TIMEOUT_MS = "15000";

	@Bean
	Mailer mailer(AppProperties props) {
		AppProperties.Mail mail = props.mail();
		if (!mail.configured()) {
			log.warn("MAIL_HOST no está configurado: los avisos por email solo se escriben en el log");
			return new LogMailer();
		}
		JavaMailSenderImpl sender = new JavaMailSenderImpl();
		sender.setHost(mail.host());
		sender.setPort(mail.port());
		sender.setDefaultEncoding("UTF-8");
		boolean auth = StringUtils.hasText(mail.username());
		if (auth) {
			sender.setUsername(mail.username());
			sender.setPassword(mail.password());
		}
		Properties javaMail = sender.getJavaMailProperties();
		javaMail.put("mail.smtp.auth", String.valueOf(auth));
		if (mail.port() == 465) {
			javaMail.put("mail.smtp.ssl.enable", "true");
		}
		else {
			javaMail.put("mail.smtp.starttls.enable", "true");
			javaMail.put("mail.smtp.starttls.required", "true");
		}
		javaMail.put("mail.smtp.connectiontimeout", TIMEOUT_MS);
		javaMail.put("mail.smtp.timeout", TIMEOUT_MS);
		javaMail.put("mail.smtp.writetimeout", TIMEOUT_MS);
		return new SmtpMailer(sender, mail.from());
	}

}
