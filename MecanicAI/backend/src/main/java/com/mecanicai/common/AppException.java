package com.mecanicai.common;

import org.springframework.http.HttpStatus;

import com.mecanicai.usage.Usage;

/**
 * Error de negocio que se devuelve al frontend como {@link ApiError} con el estado HTTP indicado.
 */
public class AppException extends RuntimeException {

	private final HttpStatus status;

	private final String code;

	private final Usage usage;

	public AppException(HttpStatus status, String code, String message) {
		this(status, code, message, null);
	}

	public AppException(HttpStatus status, String code, String message, Usage usage) {
		super(message);
		this.status = status;
		this.code = code;
		this.usage = usage;
	}

	public static AppException notFound(String message) {
		return new AppException(HttpStatus.NOT_FOUND, "NOT_FOUND", message);
	}

	public static AppException badRequest(String code, String message) {
		return new AppException(HttpStatus.BAD_REQUEST, code, message);
	}

	public static AppException quotaExceeded(Usage usage, String message) {
		return new AppException(HttpStatus.TOO_MANY_REQUESTS, "QUOTA_EXCEEDED", message, usage);
	}

	public HttpStatus status() {
		return status;
	}

	public String code() {
		return code;
	}

	public Usage usage() {
		return usage;
	}

}
