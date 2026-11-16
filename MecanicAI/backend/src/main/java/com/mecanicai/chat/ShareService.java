package com.mecanicai.chat;

import java.security.SecureRandom;
import java.time.Duration;
import java.time.Instant;
import java.util.Base64;
import java.util.List;
import java.util.UUID;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import com.mecanicai.chat.ChatDtos.ShareLink;
import com.mecanicai.chat.ChatDtos.SharedMessage;
import com.mecanicai.chat.ChatDtos.SharedVehicle;
import com.mecanicai.chat.ChatDtos.SharedView;
import com.mecanicai.common.AppException;
import com.mecanicai.user.UserService;

/**
 * Consultas compartidas con un enlace público (por ejemplo, para enviarlo por WhatsApp). Quien tiene el enlace lee la
 * conversación tal como estaba al compartirla, sin saber de quién es: no se enseñan el nombre ni la matrícula.
 */
@Service
public class ShareService {

	/** Lo que dura un enlace desde la última vez que se compartió (lo dice la política de privacidad). */
	static final Duration LINK_TTL = Duration.ofDays(30);

	private static final Logger log = LoggerFactory.getLogger(ShareService.class);

	private static final String EXPIRED = "Este enlace ha caducado o la consulta ya no se comparte";

	private final SecureRandom random = new SecureRandom();

	private final SharedConversationRepository shared;

	private final ConversationRepository conversations;

	private final MessageRepository messages;

	private final UserService users;

	public ShareService(SharedConversationRepository shared, ConversationRepository conversations,
			MessageRepository messages, UserService users) {
		this.shared = shared;
		this.conversations = conversations;
		this.messages = messages;
		this.users = users;
	}

	/**
	 * Crea el enlace de la consulta o, si ya lo tenía, lo pone al día: el mismo enlace enseña hasta el último mensaje
	 * de ahora y vuelve a durar {@link #LINK_TTL}.
	 */
	@Transactional
	public ShareLink share(UUID userId, UUID conversationId) {
		// Uno a uno por usuario: dos a la vez chocarían con el enlace único de la consulta
		users.lock(userId);
		requireOwned(userId, conversationId);
		Message last = messages.findFirstByConversationIdOrderByIdDesc(conversationId)
			.orElseThrow(() -> AppException.badRequest("NOTHING_TO_SHARE", "Esta consulta aún no tiene mensajes"));
		Instant expiresAt = Instant.now().plus(LINK_TTL);
		SharedConversation link = shared.findByConversationId(conversationId).map(existing -> {
			existing.renew(last.getId(), expiresAt);
			return existing;
		}).orElseGet(() -> shared.save(new SharedConversation(newToken(), conversationId, last.getId(), expiresAt)));
		return new ShareLink(link.getToken(), link.getExpiresAt());
	}

	@Transactional
	public void unshare(UUID userId, UUID conversationId) {
		requireOwned(userId, conversationId);
		shared.deleteByConversationId(conversationId);
	}

	/** Lo que ve quien abre el enlace. */
	@Transactional(readOnly = true)
	public SharedView view(String token) {
		SharedConversation link = shared.findById(token)
			.filter(found -> !found.isExpired(Instant.now()))
			.orElseThrow(() -> AppException.notFound(EXPIRED));
		Conversation conversation = conversations.findById(link.getConversationId())
			.orElseThrow(() -> AppException.notFound(EXPIRED));
		List<SharedMessage> history = messages
			.findByConversationIdAndIdLessThanEqualOrderByIdAsc(link.getConversationId(), link.getLastMessageId())
			.stream()
			.map(SharedMessage::from)
			.toList();
		return new SharedView(conversation.getTitle(), SharedVehicle.from(conversation.getVehicle().toSpec()), history,
				link.getExpiresAt());
	}

	@Scheduled(cron = "0 50 4 * * *", zone = "${app.timezone:Europe/Madrid}")
	@Transactional
	public void purgeExpired() {
		long deleted = shared.deleteByExpiresAtBefore(Instant.now());
		log.info("Enlaces de consultas compartidas ya caducados eliminados: {}", deleted);
	}

	/** Si la consulta no es del usuario, se responde como si no existiera. */
	private void requireOwned(UUID userId, UUID conversationId) {
		if (conversations.findByIdAndUserId(conversationId, userId).isEmpty()) {
			throw AppException.notFound("Conversación no encontrada");
		}
	}

	/** 128 bits al azar: el enlace no se puede adivinar. */
	private String newToken() {
		byte[] bytes = new byte[16];
		random.nextBytes(bytes);
		return Base64.getUrlEncoder().withoutPadding().encodeToString(bytes);
	}

}
