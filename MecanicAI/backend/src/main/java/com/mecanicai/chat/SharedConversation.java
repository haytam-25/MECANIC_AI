package com.mecanicai.chat;

import java.time.Instant;
import java.util.UUID;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.Table;

/**
 * Enlace público de una consulta. Enseña la conversación hasta el mensaje que era el último al compartirla.
 */
@Entity
@Table(name = "shared_conversation")
public class SharedConversation {

	@Id
	private String token;

	@Column(name = "conversation_id", nullable = false)
	private UUID conversationId;

	@Column(name = "last_message_id", nullable = false)
	private long lastMessageId;

	@Column(name = "created_at", nullable = false)
	private Instant createdAt;

	@Column(name = "expires_at", nullable = false)
	private Instant expiresAt;

	protected SharedConversation() {
	}

	public SharedConversation(String token, UUID conversationId, long lastMessageId, Instant expiresAt) {
		this.token = token;
		this.conversationId = conversationId;
		this.lastMessageId = lastMessageId;
		this.createdAt = Instant.now();
		this.expiresAt = expiresAt;
	}

	/** Se vuelve a compartir: el mismo enlace enseña hasta el mensaje indicado y dura hasta la nueva fecha. */
	public void renew(long lastMessageId, Instant expiresAt) {
		this.lastMessageId = lastMessageId;
		this.expiresAt = expiresAt;
	}

	public boolean isExpired(Instant now) {
		return !expiresAt.isAfter(now);
	}

	public String getToken() {
		return token;
	}

	public UUID getConversationId() {
		return conversationId;
	}

	public long getLastMessageId() {
		return lastMessageId;
	}

	public Instant getExpiresAt() {
		return expiresAt;
	}

}
