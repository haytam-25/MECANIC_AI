package com.mecanicai.chat;

import static org.assertj.core.api.Assertions.assertThat;

import java.util.ArrayList;
import java.util.List;

import org.junit.jupiter.api.Test;

import com.mecanicai.ai.AiMessage;
import com.mecanicai.vehicle.Fuel;
import com.mecanicai.vehicle.VehicleSpec;

class PromptBuilderTest {

	@Test
	void systemPromptDescribesTheVehicle() {
		VehicleSpec leon = new VehicleSpec("seat", "SEAT", "leon", "León", 2016, "1.6 TDI", Fuel.DIESEL, 115, null);
		assertThat(PromptBuilder.systemPrompt(leon))
			.contains("VEHÍCULO: SEAT León (2016) · 1.6 TDI · 115 CV · Diésel")
			.contains("motorización 1.6 TDI · 115 CV · Diésel");

		VehicleSpec unknownEngine = new VehicleSpec(null, "Dacia", null, "Sandero", 2012, null, null, null, null);
		assertThat(PromptBuilder.systemPrompt(unknownEngine)).contains("VEHÍCULO: Dacia Sandero (2012)\n")
			.contains("motorización desconocida");
	}

	@Test
	void thePlateIsNeverSentToTheAi() {
		VehicleSpec leon = new VehicleSpec("seat", "SEAT", "leon", "León", 2016, "1.6 TDI", Fuel.DIESEL, 115,
				"1234BCD");
		assertThat(PromptBuilder.systemPrompt(leon)).doesNotContain("1234BCD");
	}

	@Test
	void mergesConsecutiveRolesAndStartsWithTheUser() {
		List<AiMessage> normalized = PromptBuilder.normalize(List.of(AiMessage.assistant("¡Hola!"),
				AiMessage.user("Me hace un ruido"), AiMessage.user("al frenar"), AiMessage.assistant("¿Desde cuándo?"),
				AiMessage.user("  "), AiMessage.user("Una semana")));

		assertThat(normalized).containsExactly(AiMessage.user("Me hace un ruido\n\nal frenar"),
				AiMessage.assistant("¿Desde cuándo?"), AiMessage.user("Una semana"));
	}

	@Test
	void dropsTheOldestMessagesWhenTheHistoryIsTooLong() {
		String big = "x".repeat(PromptBuilder.MAX_HISTORY_CHARS / 2);
		List<AiMessage> normalized = PromptBuilder.normalize(List.of(AiMessage.user(big), AiMessage.assistant(big),
				AiMessage.user(big), AiMessage.assistant("ok"), AiMessage.user("última pregunta")));

		assertThat(normalized.getFirst().role()).isEqualTo(AiMessage.Role.USER);
		assertThat(normalized.getLast()).isEqualTo(AiMessage.user("última pregunta"));
		assertThat(normalized.stream().mapToInt(m -> m.text().length()).sum())
			.isLessThanOrEqualTo(PromptBuilder.MAX_HISTORY_CHARS);
	}

	@Test
	void manyMessagesOfTheSameRoleCannotSkipTheLimit() {
		// El historial del invitado lo envía su navegador: 19 mensajes seguidos suyos se unirían en uno solo
		List<AiMessage> history = new ArrayList<>();
		for (int i = 0; i < 19; i++) {
			history.add(AiMessage.user("x".repeat(20_000)));
		}
		history.add(AiMessage.user("¿Qué le pasa a mi coche?"));

		List<AiMessage> normalized = PromptBuilder.normalize(history);

		assertThat(normalized).hasSize(1);
		assertThat(normalized.getFirst().text()).endsWith("¿Qué le pasa a mi coche?")
			.hasSizeLessThanOrEqualTo(PromptBuilder.MAX_HISTORY_CHARS);
	}

}
