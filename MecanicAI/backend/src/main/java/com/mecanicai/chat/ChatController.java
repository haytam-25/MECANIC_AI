package com.mecanicai.chat;

import java.util.List;
import java.util.UUID;

import jakarta.servlet.http.HttpServletResponse;
import jakarta.validation.Valid;

import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.servlet.mvc.method.annotation.SseEmitter;

import com.mecanicai.auth.AuthUser;
import com.mecanicai.chat.ChatDtos.ConversationDetail;
import com.mecanicai.chat.ChatDtos.ConversationSummary;
import com.mecanicai.chat.ChatDtos.CreateConversationRequest;
import com.mecanicai.chat.ChatDtos.ImportRequest;
import com.mecanicai.chat.ChatDtos.SendMessageRequest;

@RestController
@RequestMapping("/api/conversations")
public class ChatController {

	private final ChatService chats;

	private final ChatTurnService turns;

	public ChatController(ChatService chats, ChatTurnService turns) {
		this.chats = chats;
		this.turns = turns;
	}

	@GetMapping
	public List<ConversationSummary> list(@AuthenticationPrincipal AuthUser user) {
		return chats.list(user.id());
	}

	@PostMapping
	public ConversationSummary create(@AuthenticationPrincipal AuthUser user,
			@Valid @RequestBody CreateConversationRequest body) {
		return chats.create(user.id(), body.vehicleId());
	}

	@PostMapping("/import")
	public ConversationSummary importGuest(@AuthenticationPrincipal AuthUser user,
			@Valid @RequestBody ImportRequest body) {
		return chats.importGuest(user.id(), body);
	}

	@GetMapping("/{id}")
	public ConversationDetail get(@AuthenticationPrincipal AuthUser user, @PathVariable UUID id) {
		return chats.get(user.id(), id);
	}

	@DeleteMapping("/{id}")
	public ResponseEntity<Void> delete(@AuthenticationPrincipal AuthUser user, @PathVariable UUID id) {
		chats.delete(user.id(), id);
		return ResponseEntity.noContent().build();
	}

	/** Envía una pregunta; la respuesta llega en streaming (text/event-stream). */
	@PostMapping("/{id}/messages")
	public SseEmitter send(@AuthenticationPrincipal AuthUser user, @PathVariable UUID id,
			@Valid @RequestBody SendMessageRequest body, HttpServletResponse response) {
		response.setHeader("X-Accel-Buffering", "no");
		return turns.send(user.id(), id, body.content());
	}

	@PostMapping("/{id}/retry")
	public SseEmitter retry(@AuthenticationPrincipal AuthUser user, @PathVariable UUID id,
			HttpServletResponse response) {
		response.setHeader("X-Accel-Buffering", "no");
		return turns.retry(user.id(), id);
	}

}
