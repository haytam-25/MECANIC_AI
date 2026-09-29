package com.mecanicai.ai;

/**
 * Un turno de la conversación que se envía al modelo.
 */
public record AiMessage(Role role, String text) {

	public enum Role {

		USER, ASSISTANT

	}

	public static AiMessage user(String text) {
		return new AiMessage(Role.USER, text);
	}

	public static AiMessage assistant(String text) {
		return new AiMessage(Role.ASSISTANT, text);
	}

}
