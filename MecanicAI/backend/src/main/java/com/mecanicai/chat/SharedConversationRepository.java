package com.mecanicai.chat;

import java.time.Instant;
import java.util.Optional;
import java.util.UUID;

import org.springframework.data.jpa.repository.JpaRepository;

public interface SharedConversationRepository extends JpaRepository<SharedConversation, String> {

	Optional<SharedConversation> findByConversationId(UUID conversationId);

	long deleteByConversationId(UUID conversationId);

	long deleteByExpiresAtBefore(Instant now);

}
