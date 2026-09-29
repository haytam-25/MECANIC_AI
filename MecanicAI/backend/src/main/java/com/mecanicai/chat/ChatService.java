package com.mecanicai.chat;

import java.util.ArrayList;
import java.util.Collections;
import java.util.List;
import java.util.UUID;

import org.springframework.data.domain.Limit;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import com.mecanicai.ai.AiMessage;
import com.mecanicai.chat.ChatDtos.ChatTurn;
import com.mecanicai.chat.ChatDtos.ConversationDetail;
import com.mecanicai.chat.ChatDtos.ConversationSummary;
import com.mecanicai.chat.ChatDtos.ImportRequest;
import com.mecanicai.chat.ChatDtos.MessageDto;
import com.mecanicai.common.AppException;
import com.mecanicai.config.AppProperties;
import com.mecanicai.vehicle.Vehicle;
import com.mecanicai.vehicle.VehicleDto;
import com.mecanicai.vehicle.VehicleService;
import com.mecanicai.vehicle.VehicleSpec;

/**
 * Operaciones de base de datos de las conversaciones (cada método es una transacción).
 */
@Service
public class ChatService {

	private static final int MAX_CONVERSATIONS = 100;

	private final ConversationRepository conversations;

	private final MessageRepository messages;

	private final VehicleService vehicles;

	private final int historyMessages;

	public ChatService(ConversationRepository conversations, MessageRepository messages, VehicleService vehicles,
			AppProperties props) {
		this.conversations = conversations;
		this.messages = messages;
		this.vehicles = vehicles;
		this.historyMessages = props.ai().chat().historyMessages();
	}

	/** Lo necesario para pedir la siguiente respuesta a la IA. */
	public record TurnContext(UUID conversationId, String title, VehicleSpec vehicle, List<AiMessage> history) {
	}

	@Transactional(readOnly = true)
	public List<ConversationSummary> list(UUID userId) {
		return conversations.findByUserIdOrderByUpdatedAtDesc(userId, Limit.of(MAX_CONVERSATIONS))
			.stream()
			.map(ChatService::summary)
			.toList();
	}

	@Transactional
	public ConversationSummary create(UUID userId, UUID vehicleId) {
		Vehicle vehicle = vehicles.require(userId, vehicleId);
		return summary(conversations.save(new Conversation(userId, vehicle)));
	}

	@Transactional(readOnly = true)
	public ConversationDetail get(UUID userId, UUID conversationId) {
		Conversation conversation = require(userId, conversationId);
		List<MessageDto> history = messages.findByConversationIdOrderByIdAsc(conversationId)
			.stream()
			.map(MessageDto::from)
			.toList();
		return new ConversationDetail(conversation.getId(), conversation.getTitle(),
				VehicleDto.from(conversation.getVehicle()), history);
	}

	@Transactional
	public void delete(UUID userId, UUID conversationId) {
		conversations.delete(require(userId, conversationId));
	}

	/** Guarda en la cuenta la conversación que el usuario tuvo como invitado. */
	@Transactional
	public ConversationSummary importGuest(UUID userId, ImportRequest request) {
		Vehicle vehicle = vehicles.create(userId, request.vehicle());
		Conversation conversation = conversations.save(new Conversation(userId, vehicle));
		request.messages()
			.stream()
			.filter(ChatTurn::isUser)
			.findFirst()
			.ifPresent(first -> conversation.titleFrom(first.content()));
		for (ChatTurn turn : request.messages()) {
			Message.Role role = turn.isUser() ? Message.Role.USER : Message.Role.ASSISTANT;
			messages.save(new Message(conversation.getId(), role, turn.content()));
		}
		return summary(conversation);
	}

	@Transactional(readOnly = true)
	public void requireOwned(UUID userId, UUID conversationId) {
		require(userId, conversationId);
	}

	@Transactional
	public TurnContext appendUserMessage(UUID userId, UUID conversationId, String content) {
		Conversation conversation = require(userId, conversationId);
		if (messages.findFirstByConversationIdOrderByIdDesc(conversationId).isEmpty()) {
			conversation.titleFrom(content);
		}
		messages.save(new Message(conversationId, Message.Role.USER, content.strip()));
		conversation.touch();
		return context(conversation);
	}

	/** Contexto para reintentar la respuesta de la última pregunta (si falló la IA). */
	@Transactional(readOnly = true)
	public TurnContext retryContext(UUID userId, UUID conversationId) {
		Conversation conversation = require(userId, conversationId);
		Message last = messages.findFirstByConversationIdOrderByIdDesc(conversationId)
			.orElseThrow(() -> AppException.badRequest("NOTHING_TO_RETRY", "No hay ninguna pregunta que reintentar"));
		if (last.getRole() != Message.Role.USER) {
			throw AppException.badRequest("NOTHING_TO_RETRY", "La última pregunta ya tiene respuesta");
		}
		return context(conversation);
	}

	@Transactional
	public MessageDto appendAssistantMessage(UUID conversationId, String content) {
		Message saved = messages.save(new Message(conversationId, Message.Role.ASSISTANT, content));
		conversations.findById(conversationId).ifPresent(Conversation::touch);
		return MessageDto.from(saved);
	}

	private Conversation require(UUID userId, UUID conversationId) {
		return conversations.findByIdAndUserId(conversationId, userId)
			.orElseThrow(() -> AppException.notFound("Conversación no encontrada"));
	}

	private TurnContext context(Conversation conversation) {
		List<Message> recent = new ArrayList<>(
				messages.findByConversationIdOrderByIdDesc(conversation.getId(), Limit.of(historyMessages)));
		Collections.reverse(recent);
		List<AiMessage> history = recent.stream()
			.map(m -> m.getRole() == Message.Role.USER ? AiMessage.user(m.getContent())
					: AiMessage.assistant(m.getContent()))
			.toList();
		return new TurnContext(conversation.getId(), conversation.getTitle(), conversation.getVehicle().toSpec(),
				history);
	}

	private static ConversationSummary summary(Conversation conversation) {
		return new ConversationSummary(conversation.getId(), conversation.getTitle(),
				VehicleDto.from(conversation.getVehicle()), conversation.getUpdatedAt());
	}

}
