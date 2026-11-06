package com.mecanicai.document;

/**
 * Secciones de la documentación de un coche. Las tres fijas están en todos los coches (como mucho una de cada);
 * {@link #CUSTOM} son las que crea el usuario con el nombre que quiera.
 */
public enum DocumentKind {

	/** Permiso de circulación (España) o cédula (Argentina, Chile...). */
	CIRCULATION("el permiso de circulación", false),

	/** Inspección técnica: ITV (España), VTV / RTO (Argentina). */
	INSPECTION("la ITV", true),

	INSURANCE("el seguro obligatorio", true),

	CUSTOM(null, false);

	/** Cómo se nombra en una frase ("caduca la ITV"); null en las secciones propias, que usan su título. */
	private final String inSentence;

	/** Si tiene fecha de caducidad (y con ella, aviso por email). */
	private final boolean expires;

	DocumentKind(String inSentence, boolean expires) {
		this.inSentence = inSentence;
		this.expires = expires;
	}

	public String inSentence() {
		return inSentence;
	}

	public boolean expires() {
		return expires;
	}

}
