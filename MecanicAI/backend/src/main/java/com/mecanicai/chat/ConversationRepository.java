package com.mecanicai.chat;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

import org.springframework.data.domain.Limit;
import org.springframework.data.jpa.repository.EntityGraph;
import org.springframework.data.jpa.repository.JpaRepository;

public interface ConversationRepository extends JpaRepository<Conversation, UUID> {

	@EntityGraph(attributePaths = "vehicle")
	List<Conversation> findByUserIdOrderByUpdatedAtDesc(UUID userId, Limit limit);

	@EntityGraph(attributePaths = "vehicle")
	Optional<Conversation> findByIdAndUserId(UUID id, UUID userId);

}
