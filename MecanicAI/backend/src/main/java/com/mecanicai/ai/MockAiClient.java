package com.mecanicai.ai;

import java.util.List;
import java.util.function.Consumer;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

/**
 * Cliente de demostración para desarrollar sin API key: responde con un texto de ejemplo en streaming.
 */
public class MockAiClient implements AiClient {

	private static final Pattern VEHICLE_LINE = Pattern.compile("^VEHÍCULO: (.+)$", Pattern.MULTILINE);

	private static final Pattern TOKEN = Pattern.compile("\\S+\\s*");

	private static final String DEMO_ENGINES = """
			{"engines": [
			  {"name": "1.0 Turbo", "fuel": "GASOLINA", "powerCv": 95},
			  {"name": "1.5 Turbo", "fuel": "GASOLINA", "powerCv": 130},
			  {"name": "1.6 TDI", "fuel": "DIESEL", "powerCv": 115},
			  {"name": "1.8 Hybrid", "fuel": "HIBRIDO", "powerCv": 140}
			]}""";

	@Override
	public String streamChat(AiChatRequest request, Consumer<String> onDelta, Runnable onRestart) {
		Matcher vehicle = VEHICLE_LINE.matcher(request.systemPrompt());
		String vehicleLabel = vehicle.find() ? vehicle.group(1) : "coche";
		List<AiMessage> messages = request.messages();
		String question = messages.isEmpty() ? "" : messages.getLast().text();
		if (question.length() > 160) {
			question = question.substring(0, 160) + "…";
		}

		String reply = """
				🔧 **Modo demo**: todavía no hay una API key de Gemini configurada, así que esta respuesta es de ejemplo.

				Me has preguntado sobre tu **%s**: «%s»

				Con la IA activada recibirías:
				1. **Causas probables**, de más a menos frecuentes en este modelo.
				2. **Cómo comprobarlo** paso a paso y con qué herramientas.
				3. **Gravedad**: si puedes seguir circulando o es mejor parar.
				4. **Coste orientativo** en taller.

				Para activarla, añade `GEMINI_API_KEY` en `backend/.env` y reinicia el backend.""".formatted(vehicleLabel,
				question);

		Matcher tokens = TOKEN.matcher(reply);
		while (tokens.find()) {
			onDelta.accept(tokens.group());
			sleep();
		}
		return reply;
	}

	@Override
	public String generateJson(AiJsonRequest request) {
		return DEMO_ENGINES;
	}

	@Override
	public boolean isDemo() {
		return true;
	}

	private static void sleep() {
		try {
			Thread.sleep(25);
		}
		catch (InterruptedException ex) {
			Thread.currentThread().interrupt();
		}
	}

}
