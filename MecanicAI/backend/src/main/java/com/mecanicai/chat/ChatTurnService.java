package com.mecanicai.chat;

import java.util.ArrayList;
import java.util.List;
import java.util.UUID;

import org.springframework.stereotype.Service;
import org.springframework.web.servlet.mvc.method.annotation.SseEmitter;

import com.mecanicai.ai.AiChatRequest;
import com.mecanicai.ai.AiMessage;
import com.mecanicai.chat.ChatDtos.GuestChatRequest;
import com.mecanicai.chat.ChatDtos.MessageDto;
import com.mecanicai.chat.ChatDtos.StreamDone;
import com.mecanicai.chat.ChatService.TurnContext;
import com.mecanicai.common.AppException;
import com.mecanicai.config.AppProperties;
import com.mecanicai.config.AppProperties.PlanSettings;
import com.mecanicai.usage.UsageService;
import com.mecanicai.usage.UsageService.Reservation;
import com.mecanicai.user.User;
import com.mecanicai.user.UserService;
import com.mecanicai.vehicle.VehicleSpec;

/**
 * Orquesta cada turno del chat: comprueba el límite diario, guarda la pregunta, pide la respuesta a la IA en
 * streaming y guarda la respuesta (o devuelve el cupo si la IA falla).
 */
@Service
public class ChatTurnService {

	private final ChatService chats;

	private final ChatStreamer streamer;

	private final PromptBuilder prompts;

	private final UsageService usage;

	private final UserService users;

	private final AppProperties props;

	public ChatTurnService(ChatService chats, ChatStreamer streamer, PromptBuilder prompts, UsageService usage,
			UserService users, AppProperties props) {
		this.chats = chats;
		this.streamer = streamer;
		this.prompts = prompts;
		this.usage = usage;
		this.users = users;
		this.props = props;
	}

	public SseEmitter send(UUID userId, UUID conversationId, String content) {
		PlanSettings plan = planOf(userId);
		chats.requireOwned(userId, conversationId);
		Reservation reservation = consumeUserQuota(userId, plan);
		TurnContext context;
		try {
			context = chats.appendUserMessage(userId, conversationId, content);
		}
		catch (RuntimeException ex) {
			usage.refund(reservation);
			throw ex;
		}
		return streamForUser(context, plan, reservation);
	}

	/** Vuelve a pedir la respuesta a la última pregunta (tras un error de la IA). */
	public SseEmitter retry(UUID userId, UUID conversationId) {
		PlanSettings plan = planOf(userId);
		TurnContext context = chats.retryContext(userId, conversationId);
		Reservation reservation = consumeUserQuota(userId, plan);
		return streamForUser(context, plan, reservation);
	}

	/** Chat de invitado: nada se guarda en la base de datos y el historial lo envía el navegador. */
	public SseEmitter guest(GuestChatRequest body, String guestId, String ip) {
		VehicleSpec vehicle = body.vehicle().normalized();
		vehicle.validateYear(props.timezone());

		AppProperties.Guest guest = props.guest();
		Reservation byGuest = usage.consume(UsageService.guestSubject(guestId), guest.dailyMessages(),
				"Has usado tus %d mensajes gratis de hoy como invitado. Inicia sesión con Google para seguir (%d al día) y guardar tus conversaciones."
					.formatted(guest.dailyMessages(), props.plans().free().dailyMessages()));
		Reservation byIp;
		try {
			byIp = usage.consume(UsageService.ipSubject(ip), guest.dailyMessagesPerIp(),
					"Se ha alcanzado el límite de mensajes gratis de hoy desde tu conexión. Inicia sesión con Google para seguir.");
		}
		catch (AppException ex) {
			usage.refund(byGuest);
			throw ex;
		}

		List<AiMessage> history = new ArrayList<>();
		if (body.history() != null) {
			body.history()
				.forEach(turn -> history
					.add(turn.isUser() ? AiMessage.user(turn.content()) : AiMessage.assistant(turn.content())));
		}
		history.add(AiMessage.user(body.message().strip()));
		int max = props.ai().chat().historyMessages();
		List<AiMessage> recent = history.size() > max ? history.subList(history.size() - max, history.size()) : history;

		AiChatRequest request = prompts.build(vehicle, recent, props.plans().free());
		return streamer.stream(request, new ChatStreamer.Listener() {

			@Override
			public Object onComplete(String fullText) {
				return new StreamDone(null, null, null, byGuest.usage());
			}

			@Override
			public void onFailure(String partialText, boolean clientAborted) {
				if (!clientAborted || partialText.isBlank()) {
					usage.refund(byGuest);
					usage.refund(byIp);
				}
			}
		});
	}

	private SseEmitter streamForUser(TurnContext context, PlanSettings plan, Reservation reservation) {
		UUID conversationId = context.conversationId();
		AiChatRequest request = prompts.build(context.vehicle(), context.history(), plan);
		return streamer.stream(request, new ChatStreamer.Listener() {

			@Override
			public Object onComplete(String fullText) {
				MessageDto saved = chats.appendAssistantMessage(conversationId, fullText);
				return new StreamDone(saved.id(), conversationId, context.title(), reservation.usage());
			}

			@Override
			public void onFailure(String partialText, boolean clientAborted) {
				if (clientAborted && !partialText.isBlank()) {
					// El usuario pulsó "detener": se guarda lo que llegó a ver
					chats.appendAssistantMessage(conversationId, partialText);
				}
				else {
					usage.refund(reservation);
				}
			}
		});
	}

	private PlanSettings planOf(UUID userId) {
		User user = users.require(userId);
		return props.plans().of(user.getPlan());
	}

	private Reservation consumeUserQuota(UUID userId, PlanSettings plan) {
		return usage.consume(UsageService.userSubject(userId), plan.dailyMessages(),
				"Has alcanzado tu límite de %d mensajes de hoy. Vuelve mañana.".formatted(plan.dailyMessages()));
	}

}
