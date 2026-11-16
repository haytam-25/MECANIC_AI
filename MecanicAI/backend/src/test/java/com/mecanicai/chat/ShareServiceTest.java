package com.mecanicai.chat;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.BDDMockito.given;
import static org.mockito.BDDMockito.then;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;

import java.time.Duration;
import java.time.Instant;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

import org.junit.jupiter.api.Test;
import org.springframework.http.HttpStatus;

import com.mecanicai.chat.ChatDtos.ShareLink;
import com.mecanicai.chat.ChatDtos.SharedView;
import com.mecanicai.common.AppException;
import com.mecanicai.user.UserService;
import com.mecanicai.vehicle.Fuel;
import com.mecanicai.vehicle.Vehicle;
import com.mecanicai.vehicle.VehicleSpec;

class ShareServiceTest {

	private final SharedConversationRepository shared = mock(SharedConversationRepository.class);

	private final ConversationRepository conversations = mock(ConversationRepository.class);

	private final MessageRepository messages = mock(MessageRepository.class);

	private final ShareService service = new ShareService(shared, conversations, messages, mock(UserService.class));

	private final UUID userId = UUID.randomUUID();

	private final UUID conversationId = UUID.randomUUID();

	private final Conversation conversation = new Conversation(userId, new Vehicle(userId,
			new VehicleSpec("seat", "Seat", "ibiza", "Ibiza", 2015, "1.2 TSI", Fuel.GASOLINA, 90, "1234BCD")));

	@Test
	void sharingCreatesALinkThatLastsThirtyDaysAndCannotBeGuessed() {
		owned();
		lastMessageIs(7L);
		given(shared.findByConversationId(conversationId)).willReturn(Optional.empty());
		given(shared.save(any())).willAnswer(call -> call.getArgument(0));

		ShareLink link = service.share(userId, conversationId);

		// 16 bytes en Base64 para URL, sin relleno
		assertThat(link.token()).matches("[A-Za-z0-9_-]{22}");
		assertThat(Duration.between(Instant.now(), link.expiresAt())).isBetween(Duration.ofDays(29), Duration.ofDays(30));
		assertThat(service.share(userId, conversationId).token()).isNotEqualTo(link.token());
	}

	@Test
	void sharingAgainKeepsTheLinkAndShowsUpToTheNewLastMessage() {
		owned();
		lastMessageIs(9L);
		SharedConversation existing = new SharedConversation("abc", conversationId, 7L, Instant.now().plusSeconds(60));
		given(shared.findByConversationId(conversationId)).willReturn(Optional.of(existing));

		ShareLink link = service.share(userId, conversationId);

		assertThat(link.token()).isEqualTo("abc");
		assertThat(existing.getLastMessageId()).isEqualTo(9L);
		assertThat(link.expiresAt()).isAfter(Instant.now().plus(Duration.ofDays(29)));
		then(shared).should(never()).save(any());
	}

	@Test
	void someoneElsesConversationCannotBeSharedOrUnshared() {
		given(conversations.findByIdAndUserId(conversationId, userId)).willReturn(Optional.empty());

		assertThatThrownBy(() -> service.share(userId, conversationId)).isInstanceOf(AppException.class)
			.extracting(error -> ((AppException) error).status())
			.isEqualTo(HttpStatus.NOT_FOUND);
		assertThatThrownBy(() -> service.unshare(userId, conversationId)).isInstanceOf(AppException.class);
		then(shared).should(never()).save(any());
		then(shared).should(never()).deleteByConversationId(any());
	}

	@Test
	void aConversationWithoutMessagesCannotBeShared() {
		owned();
		given(messages.findFirstByConversationIdOrderByIdDesc(conversationId)).willReturn(Optional.empty());

		assertThatThrownBy(() -> service.share(userId, conversationId)).isInstanceOf(AppException.class)
			.extracting(error -> ((AppException) error).code())
			.isEqualTo("NOTHING_TO_SHARE");
	}

	@Test
	void theLinkShowsTheConversationUpToTheSharedMessageAndNeverThePlate() {
		given(shared.findById("abc")).willReturn(
				Optional.of(new SharedConversation("abc", conversationId, 7L, Instant.now().plusSeconds(60))));
		given(conversations.findById(conversationId)).willReturn(Optional.of(conversation));
		given(messages.findByConversationIdAndIdLessThanEqualOrderByIdAsc(conversationId, 7L))
			.willReturn(List.of(new Message(conversationId, Message.Role.USER, "Hace ruido al frenar"),
					new Message(conversationId, Message.Role.ASSISTANT, "Revisa las pastillas")));

		SharedView view = service.view("abc");

		assertThat(view.vehicle().brand()).isEqualTo("Seat");
		assertThat(view.vehicle().modelId()).isEqualTo("ibiza");
		assertThat(view.messages()).extracting("role").containsExactly("user", "assistant");
		assertThat(view.toString()).doesNotContain("1234BCD").doesNotContain(userId.toString());
	}

	@Test
	void anExpiredOrUnknownLinkIsNotFound() {
		given(shared.findById("viejo")).willReturn(
				Optional.of(new SharedConversation("viejo", conversationId, 7L, Instant.now().minusSeconds(1))));
		given(shared.findById("nada")).willReturn(Optional.empty());

		for (String token : List.of("viejo", "nada")) {
			assertThatThrownBy(() -> service.view(token)).isInstanceOf(AppException.class)
				.extracting(error -> ((AppException) error).status())
				.isEqualTo(HttpStatus.NOT_FOUND);
		}
		then(messages).shouldHaveNoInteractions();
	}

	private void owned() {
		given(conversations.findByIdAndUserId(conversationId, userId)).willReturn(Optional.of(conversation));
	}

	private void lastMessageIs(long id) {
		Message last = mock(Message.class);
		given(last.getId()).willReturn(id);
		given(messages.findFirstByConversationIdOrderByIdDesc(conversationId)).willReturn(Optional.of(last));
	}

}
