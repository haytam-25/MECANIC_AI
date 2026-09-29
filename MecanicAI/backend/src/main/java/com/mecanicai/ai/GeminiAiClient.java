package com.mecanicai.ai;

import java.time.Duration;
import java.util.EnumSet;
import java.util.List;
import java.util.Locale;
import java.util.Set;
import java.util.function.Consumer;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

import com.google.genai.Client;
import com.google.genai.ResponseStream;
import com.google.genai.errors.ApiException;
import com.google.genai.errors.GenAiIOException;
import com.google.genai.types.Content;
import com.google.genai.types.FinishReason;
import com.google.genai.types.GenerateContentConfig;
import com.google.genai.types.GenerateContentResponse;
import com.google.genai.types.HttpOptions;
import com.google.genai.types.HttpRetryOptions;
import com.google.genai.types.Part;
import com.google.genai.types.ThinkingConfig;
import com.google.genai.types.ThinkingLevel;
import com.mecanicai.ai.AiException.Kind;

/**
 * Cliente de la API de Gemini usando el SDK oficial de Google ({@code com.google.genai}).
 */
public class GeminiAiClient implements AiClient, AutoCloseable {

	private static final Logger log = LoggerFactory.getLogger(GeminiAiClient.class);

	private static final Set<FinishReason.Known> BLOCKED_REASONS = EnumSet.of(FinishReason.Known.SAFETY,
			FinishReason.Known.PROHIBITED_CONTENT, FinishReason.Known.BLOCKLIST, FinishReason.Known.SPII,
			FinishReason.Known.RECITATION);

	// Reintenta automáticamente los errores temporales (incluido el 429 de la capa gratuita)
	private static final HttpRetryOptions RETRY = HttpRetryOptions.builder()
		.attempts(2)
		.initialDelay(1.0)
		.maxDelay(2.0)
		.httpStatusCodes(List.of(429, 500, 503))
		.build();

	private final Client client;

	public GeminiAiClient(String apiKey, Duration timeout) {
		this.client = Client.builder().apiKey(apiKey).httpOptions(httpOptions(timeout)).build();
	}

	private static HttpOptions httpOptions(Duration timeout) {
		return HttpOptions.builder().timeout((int) timeout.toMillis()).retryOptions(RETRY).build();
	}

	@Override
	public String streamChat(AiChatRequest request, Consumer<String> onDelta, Runnable onRestart) {
		return ModelFallback.stream(request.models(), (model, deltas) -> streamChat(model, request, deltas), onDelta,
				onRestart);
	}

	private String streamChat(String model, AiChatRequest request, Consumer<String> onDelta) {
		GenerateContentConfig.Builder config = GenerateContentConfig.builder()
			.systemInstruction(Content.fromParts(Part.fromText(request.systemPrompt())))
			.temperature(request.temperature())
			.maxOutputTokens(request.maxOutputTokens());
		applyThinking(config, request.thinkingLevel());

		List<Content> contents = request.messages().stream().map(GeminiAiClient::toContent).toList();
		StringBuilder full = new StringBuilder();
		FinishReason lastFinishReason = null;
		try (ResponseStream<GenerateContentResponse> stream = client.models.generateContentStream(model, contents,
				config.build())) {
			for (GenerateContentResponse chunk : stream) {
				rejectIfPromptBlocked(chunk);
				FinishReason finishReason = chunk.finishReason();
				if (finishReason != null) {
					lastFinishReason = finishReason;
				}
				String text = chunk.text();
				if (text != null && !text.isEmpty()) {
					full.append(text);
					onDelta.accept(text);
				}
			}
		}
		catch (ApiException ex) {
			throw translate(ex, model);
		}
		catch (GenAiIOException ex) {
			throw networkError(ex, model);
		}

		if (full.isEmpty()) {
			if (lastFinishReason != null && BLOCKED_REASONS.contains(lastFinishReason.knownEnum())) {
				throw new AiException(Kind.BLOCKED, "Respuesta bloqueada por Gemini: " + lastFinishReason);
			}
			throw new AiException(Kind.EMPTY, "Gemini devolvió una respuesta vacía (" + lastFinishReason + ")");
		}
		return full.toString();
	}

	@Override
	public String generateJson(AiJsonRequest request) {
		return ModelFallback.run(request.models(), model -> generateJson(model, request));
	}

	private String generateJson(String model, AiJsonRequest request) {
		GenerateContentConfig.Builder config = GenerateContentConfig.builder()
			.systemInstruction(Content.fromParts(Part.fromText(request.systemPrompt())))
			.temperature(0.2f)
			.responseMimeType("application/json")
			.responseJsonSchema(request.jsonSchema());
		if (request.timeout() != null) {
			config.httpOptions(httpOptions(request.timeout()));
		}
		applyThinking(config, request.thinkingLevel());
		try {
			GenerateContentResponse response = client.models.generateContent(model, request.userPrompt(), config.build());
			rejectIfPromptBlocked(response);
			String text = response.text();
			if (text == null || text.isBlank()) {
				throw new AiException(Kind.EMPTY, "Gemini devolvió un JSON vacío");
			}
			return text;
		}
		catch (ApiException ex) {
			throw translate(ex, model);
		}
		catch (GenAiIOException ex) {
			throw networkError(ex, model);
		}
	}

	@Override
	public void close() {
		client.close();
	}

	private static Content toContent(AiMessage message) {
		String role = message.role() == AiMessage.Role.USER ? "user" : "model";
		return Content.builder().role(role).parts(Part.fromText(message.text())).build();
	}

	private static void applyThinking(GenerateContentConfig.Builder config, String level) {
		if (level == null || level.isBlank()) {
			return;
		}
		try {
			ThinkingLevel.Known known = ThinkingLevel.Known.valueOf(level.trim().toUpperCase(Locale.ROOT));
			config.thinkingConfig(ThinkingConfig.builder().thinkingLevel(known).build());
		}
		catch (IllegalArgumentException ex) {
			log.warn("Nivel de razonamiento desconocido '{}', se usa el del modelo", level);
		}
	}

	private static void rejectIfPromptBlocked(GenerateContentResponse response) {
		response.promptFeedback().flatMap(feedback -> feedback.blockReason()).ifPresent(reason -> {
			throw new AiException(Kind.BLOCKED, "Pregunta bloqueada por Gemini: " + reason);
		});
	}

	private static AiException networkError(GenAiIOException ex, String model) {
		// La causa real (timeout, conexión rechazada...) viene envuelta
		Throwable cause = ex.getCause() != null ? ex.getCause() : ex;
		String detail = "Error de red con Gemini (modelo %s): %s: %s".formatted(model, cause.getClass().getSimpleName(),
				cause.getMessage());
		log.warn(detail);
		return new AiException(Kind.UNAVAILABLE, detail, ex);
	}

	private static AiException translate(ApiException ex, String model) {
		String detail = "Gemini %d %s (modelo %s): %s".formatted(ex.code(), ex.status(), model, ex.message());
		Kind kind;
		if (ex.code() == 429 || ex.code() == 503) {
			kind = Kind.RATE_LIMITED;
		}
		else if (ex.code() == 401 || ex.code() == 403 || ex.code() == 404
				|| (ex.code() == 400 && String.valueOf(ex.message()).toLowerCase(Locale.ROOT).contains("api key"))) {
			kind = Kind.CONFIGURATION;
		}
		else {
			kind = Kind.UNAVAILABLE;
		}
		if (kind == Kind.RATE_LIMITED) {
			log.warn(detail);
		}
		else {
			log.error(detail);
		}
		return new AiException(kind, detail, ex);
	}

}
