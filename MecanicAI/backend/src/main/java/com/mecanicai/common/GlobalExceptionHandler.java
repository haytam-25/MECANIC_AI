package com.mecanicai.common;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.http.converter.HttpMessageNotReadableException;
import org.springframework.validation.FieldError;
import org.springframework.web.ErrorResponse;
import org.springframework.web.HttpRequestMethodNotSupportedException;
import org.springframework.web.bind.MethodArgumentNotValidException;
import org.springframework.web.bind.MissingServletRequestParameterException;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;
import org.springframework.web.context.request.async.AsyncRequestNotUsableException;
import org.springframework.web.method.annotation.MethodArgumentTypeMismatchException;
import org.springframework.web.multipart.MaxUploadSizeExceededException;
import org.springframework.web.multipart.MultipartException;
import org.springframework.web.multipart.support.MissingServletRequestPartException;
import org.springframework.web.servlet.resource.NoResourceFoundException;

@RestControllerAdvice
public class GlobalExceptionHandler {

	private static final Logger log = LoggerFactory.getLogger(GlobalExceptionHandler.class);

	@ExceptionHandler(AppException.class)
	ResponseEntity<ApiError> handleApp(AppException ex) {
		return ResponseEntity.status(ex.status()).body(new ApiError(ex.code(), ex.getMessage(), ex.usage()));
	}

	@ExceptionHandler(MethodArgumentNotValidException.class)
	ResponseEntity<ApiError> handleValidation(MethodArgumentNotValidException ex) {
		FieldError field = ex.getBindingResult().getFieldError();
		String message = field != null ? field.getField() + ": " + field.getDefaultMessage() : "Datos no válidos";
		return ResponseEntity.badRequest().body(new ApiError("VALIDATION", message));
	}

	@ExceptionHandler({ HttpMessageNotReadableException.class, MissingServletRequestParameterException.class,
			MissingServletRequestPartException.class, MultipartException.class })
	ResponseEntity<ApiError> handleBadRequest(Exception ex) {
		return ResponseEntity.badRequest().body(new ApiError("BAD_REQUEST", "Petición mal formada"));
	}

	/** Archivo de la documentación por encima de spring.servlet.multipart.max-file-size. */
	@ExceptionHandler(MaxUploadSizeExceededException.class)
	ResponseEntity<ApiError> handleTooLarge(MaxUploadSizeExceededException ex) {
		return ResponseEntity.status(HttpStatus.PAYLOAD_TOO_LARGE)
			.body(new ApiError("FILE_TOO_LARGE", "El archivo pesa demasiado (máximo 5 MB)."));
	}

	@ExceptionHandler({ MethodArgumentTypeMismatchException.class, NoResourceFoundException.class })
	ResponseEntity<ApiError> handleNotFound(Exception ex) {
		return ResponseEntity.status(HttpStatus.NOT_FOUND).body(new ApiError("NOT_FOUND", "No encontrado"));
	}

	@ExceptionHandler(HttpRequestMethodNotSupportedException.class)
	ResponseEntity<ApiError> handleMethod(HttpRequestMethodNotSupportedException ex) {
		return ResponseEntity.status(HttpStatus.METHOD_NOT_ALLOWED).body(new ApiError("METHOD_NOT_ALLOWED", "Método no permitido"));
	}

	/** El usuario cerró la conexión (p. ej. pulsó "detener" durante una respuesta): no hay nada que responder. */
	@ExceptionHandler(AsyncRequestNotUsableException.class)
	void handleClientGone(AsyncRequestNotUsableException ex) {
		log.debug("Cliente desconectado: {}", ex.getMessage());
	}

	@ExceptionHandler(Exception.class)
	ResponseEntity<ApiError> handleUnexpected(Exception ex) {
		// El resto de errores de Spring por una petición incorrecta (p. ej. un Content-Type que no se admite) traen su
		// estado: no son fallos del servidor y no se registran como tales
		if (ex instanceof ErrorResponse error && error.getStatusCode().is4xxClientError()) {
			return ResponseEntity.status(error.getStatusCode()).body(new ApiError("BAD_REQUEST", "Petición no válida"));
		}
		log.error("Error inesperado", ex);
		return ResponseEntity.internalServerError().body(new ApiError("INTERNAL", "Error interno, inténtalo de nuevo"));
	}

}
