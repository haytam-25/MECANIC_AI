package com.mecanicai.ai;

import java.util.List;

/**
 * Petición de chat: modelos (en orden de preferencia), instrucciones de sistema e historial (el último mensaje es
 * siempre del usuario).
 */
public record AiChatRequest(List<String> models, String thinkingLevel, String systemPrompt, List<AiMessage> messages,
		float temperature, int maxOutputTokens) {
}
