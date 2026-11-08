package com.mecanicai.common;

import static org.assertj.core.api.Assertions.assertThat;

import org.junit.jupiter.api.Test;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.HttpMediaTypeNotSupportedException;

class GlobalExceptionHandlerTest {

	private final GlobalExceptionHandler handler = new GlobalExceptionHandler();

	@Test
	void aBadRequestKeepsItsStatusInsteadOfBeingAServerError() {
		ResponseEntity<ApiError> response = handler
			.handleUnexpected(new HttpMediaTypeNotSupportedException("Content-Type 'text/plain' is not supported"));

		assertThat(response.getStatusCode()).isEqualTo(HttpStatus.UNSUPPORTED_MEDIA_TYPE);
		assertThat(response.getBody()).isNotNull();
		assertThat(response.getBody().code()).isEqualTo("BAD_REQUEST");
	}

	@Test
	void anythingElseIsAnInternalError() {
		ResponseEntity<ApiError> response = handler.handleUnexpected(new IllegalStateException("fallo de prueba"));

		assertThat(response.getStatusCode()).isEqualTo(HttpStatus.INTERNAL_SERVER_ERROR);
		assertThat(response.getBody()).isNotNull();
		assertThat(response.getBody().code()).isEqualTo("INTERNAL");
	}

}
