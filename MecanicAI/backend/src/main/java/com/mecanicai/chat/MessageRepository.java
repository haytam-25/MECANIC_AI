package com.mecanicai.chat;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

import org.springframework.data.domain.Limit;
import org.springframework.data.jpa.repository.JpaRepository;

public interface MessageRepository extends JpaRepository<Message, Long> {

	List<Message> findByConversationIdOrderByIdAsc(UUID conversationId);

	List<Message> findByConversationIdOrderByIdDesc(UUID conversationId, Limit limit);

	Optional<Message> findFirstByConversationIdOrderByIdDesc(UUID conversationId);

	long countByConversationId(UUID conversationId);

}
