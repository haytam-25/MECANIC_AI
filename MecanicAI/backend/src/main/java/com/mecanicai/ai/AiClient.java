package com.mecanicai.ai;

import java.util.function.Consumer;

/**
 * Proveedor de IA. Hoy: Gemini (y un modo demo). Mañana se puede añadir otro (p. ej. OpenAI para el plan PRO)
 * implementando esta interfaz, sin tocar el resto de la aplicación.
 */
public interface AiClient {

	/**
	 * Genera la respuesta del chat en streaming: llama a {@code onDelta} con cada trozo de texto y devuelve el
	 * texto completo. Si la respuesta se corta a mitad y se vuelve a generar con otro modelo, antes se llama a
	 * {@code onRestart} (hay que descartar lo recibido). Las excepciones que lance {@code onDelta} se propagan tal
	 * cual (sirven para cortar el stream).
	 */
	String streamChat(AiChatRequest request, Consumer<String> onDelta, Runnable onRestart);

	/** Genera una respuesta JSON que cumple el esquema indicado. */
	String generateJson(AiJsonRequest request);

	/** {@code true} si es el cliente de demostración (sin API key): sus resultados no se cachean. */
	default boolean isDemo() {
		return false;
	}

}
