package com.mecanicai.chat;

import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import jakarta.validation.Valid;

import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.servlet.mvc.method.annotation.SseEmitter;

import com.mecanicai.auth.SessionCookies;
import com.mecanicai.chat.ChatDtos.GuestChatRequest;

/**
 * Chat sin cuenta: pocos mensajes al día y sin historial guardado.
 */
@RestController
@RequestMapping("/api/guest")
public class GuestChatController {

	private final ChatTurnService turns;

	private final SessionCookies cookies;

	public GuestChatController(ChatTurnService turns, SessionCookies cookies) {
		this.turns = turns;
		this.cookies = cookies;
	}

	@PostMapping("/chat")
	public SseEmitter chat(@Valid @RequestBody GuestChatRequest body, HttpServletRequest request,
			HttpServletResponse response) {
		String guestId = cookies.guestId(request, response);
		response.setHeader("X-Accel-Buffering", "no");
		return turns.guest(body, guestId, request.getRemoteAddr());
	}

}
