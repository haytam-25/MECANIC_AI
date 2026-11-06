package com.mecanicai.mail;

/** Un email listo para enviar: texto plano y la misma información en HTML. */
public record Email(String to, String subject, String text, String html) {
}
