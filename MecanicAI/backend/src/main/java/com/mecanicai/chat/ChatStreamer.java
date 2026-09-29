package com.mecanicai.chat;

import java.io.IOException;
import java.time.Duration;
import java.util.Map;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.atomic.AtomicBoolean;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.DisposableBean;
import org.springframework.stereotype.Component;
import org.springframework.web.servlet.mvc.method.annotation.SseEmitter;

import com.mecanicai.ai.AiChatRequest;
import com.mecanicai.ai.AiClient;
import com.mecanicai.ai.AiException;
import com.mecanicai.chat.ChatDtos.StreamError;

import tools.jackson.databind.json.JsonMapper;

/**
 * Envía la respuesta de la IA al navegador en tiempo real con Server-Sent Events.
 * <p>
 * Eventos: {@code delta} ({"text": "..."}) por cada trozo, y al final {@code done} con los datos del mensaje
 * guardado o {@code error} ({"code", "message"}). Si la IA se corta a mitad y la respuesta se regenera con otro
 * modelo, el primer trozo nuevo lleva {@code "reset": true} para que el navegador descarte el texto anterior.
 * Cada respuesta se genera en un hilo virtual.
 */
@Component
public class ChatStreamer implements DisposableBean {

	private static final Logger log = LoggerFactory.getLogger(ChatStreamer.class);

	private static final Duration TIMEOUT = Duration.ofMinutes(5);

	/** Qué hacer con el resultado (guardar el mensaje, devolver el cupo...). */
	public interface Listener {

		/** La respuesta terminó bien; devuelve los datos del evento {@code done}. */
		Object onComplete(String fullText);

		/** La respuesta falló o el usuario la detuvo ({@code clientAborted}); {@code partialText} puede estar vacío. */
		void onFailure(String partialText, boolean clientAborted);

	}

	private static final class ClientGoneException extends RuntimeException {

		ClientGoneException(Throwable cause) {
			super(cause);
		}

	}

	private final ExecutorService executor = Executors.newVirtualThreadPerTaskExecutor();

	private final AiClient ai;

	private final JsonMapper jsonMapper;

	public ChatStreamer(AiClient ai, JsonMapper jsonMapper) {
		this.ai = ai;
		this.jsonMapper = jsonMapper;
	}

	public SseEmitter stream(AiChatRequest request, Listener listener) {
		SseEmitter emitter = new SseEmitter(TIMEOUT.toMillis());
		executor.execute(() -> run(emitter, request, listener));
		return emitter;
	}

	private void run(SseEmitter emitter, AiChatRequest request, Listener listener) {
		StringBuilder text = new StringBuilder();
		AtomicBoolean resetPending = new AtomicBoolean();
		try {
			ai.streamChat(request, delta -> {
				text.append(delta);
				boolean reset = resetPending.getAndSet(false);
				send(emitter, "delta", reset ? Map.of("text", delta, "reset", true) : Map.of("text", delta));
			}, () -> {
				text.setLength(0);
				resetPending.set(true);
			});
		}
		catch (ClientGoneException ex) {
			log.debug("El cliente cerró la conexión durante la respuesta");
			notifyFailure(listener, text, true);
			emitter.complete();
			return;
		}
		catch (AiException ex) {
			notifyFailure(listener, text, false);
			finishWithError(emitter, new StreamError(ex.kind().name(), ex.userMessage()));
			return;
		}
		catch (RuntimeException ex) {
			log.error("Error inesperado generando la respuesta", ex);
			notifyFailure(listener, text, false);
			finishWithError(emitter, new StreamError("INTERNAL", "Ha ocurrido un error. Inténtalo de nuevo."));
			return;
		}

		try {
			Object done = listener.onComplete(text.toString());
			send(emitter, "done", done);
			emitter.complete();
		}
		catch (ClientGoneException ex) {
			// La respuesta ya está guardada; el usuario la verá al volver a abrir la conversación
			emitter.complete();
		}
		catch (RuntimeException ex) {
			log.error("No se pudo guardar la respuesta", ex);
			finishWithError(emitter, new StreamError("INTERNAL", "No se pudo guardar la respuesta. Inténtalo de nuevo."));
		}
	}

	private void notifyFailure(Listener listener, StringBuilder text, boolean clientAborted) {
		try {
			listener.onFailure(text.toString(), clientAborted);
		}
		catch (RuntimeException ex) {
			log.error("Error al gestionar el fallo de la respuesta", ex);
		}
	}

	private void finishWithError(SseEmitter emitter, StreamError error) {
		try {
			send(emitter, "error", error);
		}
		catch (ClientGoneException ignored) {
			// El cliente ya no escucha
		}
		emitter.complete();
	}

	private void send(SseEmitter emitter, String event, Object data) {
		try {
			emitter.send(SseEmitter.event().name(event).data(jsonMapper.writeValueAsString(data)));
		}
		catch (IOException | IllegalStateException ex) {
			throw new ClientGoneException(ex);
		}
	}

	@Override
	public void destroy() {
		executor.shutdown();
	}

}
