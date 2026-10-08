package com.mecanicai.chat;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

import org.springframework.data.domain.Limit;
import org.springframework.data.jpa.repository.EntityGraph;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface ConversationRepository extends JpaRepository<Conversation, UUID> {

	@EntityGraph(attributePaths = "vehicle")
	List<Conversation> findByUserIdOrderByUpdatedAtDesc(UUID userId, Limit limit);

	@EntityGraph(attributePaths = "vehicle")
	Optional<Conversation> findByIdAndUserId(UUID id, UUID userId);

	/** Borra las conversaciones del usuario que no están entre las {@code keep} más recientes (y sus mensajes). */
	@Modifying(flushAutomatically = true)
	@Query(nativeQuery = true, value = """
			DELETE FROM conversation WHERE user_id = :userId AND id NOT IN (
				SELECT id FROM conversation WHERE user_id = :userId ORDER BY updated_at DESC, created_at DESC LIMIT :keep)""")
	int deleteAllButNewest(@Param("userId") UUID userId, @Param("keep") int keep);

}
