package com.mecanicai.ai;

/**
 * Fallo al hablar con el proveedor de IA, con un mensaje apto para mostrar al usuario.
 */
public class AiException extends RuntimeException {

	public enum Kind {

		/** Límite de peticiones del proveedor (p. ej. la capa gratuita de Gemini). */
		RATE_LIMITED("La IA está saturada ahora mismo. Espera unos segundos y vuelve a intentarlo."),
		/** Error temporal de red o del proveedor. */
		UNAVAILABLE("No he podido conectar con la IA. Inténtalo de nuevo en un momento."),
		/** El proveedor bloqueó la respuesta por sus filtros de seguridad. */
		BLOCKED("No puedo responder a eso. Prueba a reformular la pregunta sobre tu coche."),
		/** Respuesta vacía. */
		EMPTY("La IA no ha devuelto ninguna respuesta. Inténtalo de nuevo."),
		/** Error de configuración (API key, modelo...). Se registra en el log con detalle. */
		CONFIGURATION("El servicio de IA no está bien configurado. Avisa al administrador.");

		private final String userMessage;

		Kind(String userMessage) {
			this.userMessage = userMessage;
		}

		public String userMessage() {
			return userMessage;
		}

	}

	private final Kind kind;

	public AiException(Kind kind, String detail, Throwable cause) {
		super(detail, cause);
		this.kind = kind;
	}

	public AiException(Kind kind, String detail) {
		this(kind, detail, null);
	}

	public Kind kind() {
		return kind;
	}

	/** Errores pasajeros (saturación, red): tiene sentido reintentar o probar otro modelo. */
	public boolean isTransient() {
		return kind == Kind.RATE_LIMITED || kind == Kind.UNAVAILABLE;
	}

	public String userMessage() {
		return kind.userMessage();
	}

}
