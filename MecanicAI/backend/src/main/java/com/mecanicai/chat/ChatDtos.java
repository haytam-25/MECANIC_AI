package com.mecanicai.chat;

import java.time.Instant;
import java.util.List;
import java.util.UUID;

import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;

import com.fasterxml.jackson.annotation.JsonInclude;
import com.mecanicai.usage.Usage;
import com.mecanicai.vehicle.VehicleDto;
import com.mecanicai.vehicle.VehicleSpec;

/**
 * Peticiones y respuestas JSON del chat.
 */
public final class ChatDtos {

	/** Longitud máxima de una pregunta del usuario. */
	public static final int MAX_QUESTION = 4000;

	/** Longitud máxima de un mensaje del historial (las respuestas largas de la IA rondan los 16.000 caracteres). */
	public static final int MAX_TURN = 20000;

	/** Mensajes que se guardan como mucho de cada conversación de invitado al iniciar sesión. */
	public static final int MAX_IMPORT_MESSAGES = 60;

	private ChatDtos() {
	}

	public record ConversationSummary(UUID id, String title, VehicleDto vehicle, Instant updatedAt) {
	}

	public record MessageDto(Long id, String role, String content, Instant createdAt) {

		static MessageDto from(Message message) {
			return new MessageDto(message.getId(), message.getRole().name().toLowerCase(), message.getContent(),
					message.getCreatedAt());
		}
	}

	public record ConversationDetail(UUID id, String title, VehicleDto vehicle, List<MessageDto> messages) {
	}

	public record CreateConversationRequest(@NotNull UUID vehicleId) {
	}

	public record SendMessageRequest(@NotBlank @Size(max = MAX_QUESTION) String content) {
	}

	/** Un mensaje de una conversación que viene del navegador (modo invitado o importación). */
	public record ChatTurn(@NotNull @Pattern(regexp = "user|assistant") String role,
			@NotBlank @Size(max = MAX_TURN) String content) {

		boolean isUser() {
			return "user".equals(role);
		}
	}

	public record GuestChatRequest(@NotNull @Valid VehicleSpec vehicle, @Size(max = 40) List<@Valid ChatTurn> history,
			@NotBlank @Size(max = MAX_QUESTION) String message) {
	}

	/** Conversación hecha como invitado que se guarda al iniciar sesión (sus últimos mensajes). */
	public record ImportRequest(@NotNull @Valid VehicleSpec vehicle,
			@NotNull @Size(max = MAX_IMPORT_MESSAGES) List<@Valid ChatTurn> messages) {
	}

	/** Evento final del streaming. */
	@JsonInclude(JsonInclude.Include.NON_NULL)
	public record StreamDone(Long messageId, UUID conversationId, String title, Usage usage) {
	}

	public record StreamError(String code, String message) {
	}

}
