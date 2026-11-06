package com.mecanicai.document;

import java.nio.charset.StandardCharsets;
import java.util.Arrays;

/**
 * Qué tipo de archivo es de verdad, mirando sus primeros bytes (no lo que diga el navegador, que lo decide el
 * nombre). Solo se aceptan fotos JPEG, PNG o WebP y PDF: así nunca se guarda ni se sirve HTML, SVG o un ejecutable
 * disfrazado de documento.
 */
final class FileTypes {

	static final String JPEG = "image/jpeg";

	static final String PNG = "image/png";

	static final String WEBP = "image/webp";

	static final String PDF = "application/pdf";

	private static final byte[] PNG_SIGNATURE = { (byte) 0x89, 'P', 'N', 'G', '\r', '\n', 0x1a, '\n' };

	private FileTypes() {
	}

	/** Tipo MIME del archivo, o null si no es ninguno de los admitidos. */
	static String detect(byte[] data) {
		if (data == null || data.length < 12) {
			return null;
		}
		if ((data[0] & 0xff) == 0xff && (data[1] & 0xff) == 0xd8 && (data[2] & 0xff) == 0xff) {
			return JPEG;
		}
		if (Arrays.equals(data, 0, PNG_SIGNATURE.length, PNG_SIGNATURE, 0, PNG_SIGNATURE.length)) {
			return PNG;
		}
		if (ascii(data, 0, 4).equals("RIFF") && ascii(data, 8, 12).equals("WEBP")) {
			return WEBP;
		}
		if (ascii(data, 0, 5).equals("%PDF-")) {
			return PDF;
		}
		return null;
	}

	/** Extensión para el nombre del archivo cuando el original no trae una que encaje. */
	static String extension(String type) {
		return switch (type) {
			case JPEG -> "jpg";
			case PNG -> "png";
			case WEBP -> "webp";
			default -> "pdf";
		};
	}

	private static String ascii(byte[] data, int from, int to) {
		return new String(data, from, to - from, StandardCharsets.US_ASCII);
	}

}
