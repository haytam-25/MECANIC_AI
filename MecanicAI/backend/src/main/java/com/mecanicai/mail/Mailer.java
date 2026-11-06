package com.mecanicai.mail;

/** Envía emails. Ver {@link MailConfig}: por SMTP si está configurado; si no, solo los escribe en el log. */
public interface Mailer {

	/** Lanza una excepción si no se pudo enviar. */
	void send(Email email);

}
