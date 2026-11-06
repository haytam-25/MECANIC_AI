package com.mecanicai.document;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import java.nio.charset.StandardCharsets;
import java.util.Arrays;

import org.junit.jupiter.api.Test;

import com.mecanicai.common.AppException;

class FileTypesTest {

	private static byte[] bytes(int... values) {
		byte[] data = Arrays.copyOf(new byte[0], 16);
		for (int i = 0; i < values.length; i++) {
			data[i] = (byte) values[i];
		}
		return data;
	}

	private static byte[] ascii(String text) {
		return Arrays.copyOf(text.getBytes(StandardCharsets.US_ASCII), Math.max(16, text.length()));
	}

	@Test
	void recognisesPhotosAndPdfByTheirContent() {
		assertThat(FileTypes.detect(bytes(0xff, 0xd8, 0xff, 0xe0))).isEqualTo(FileTypes.JPEG);
		assertThat(FileTypes.detect(bytes(0x89, 'P', 'N', 'G', '\r', '\n', 0x1a, '\n'))).isEqualTo(FileTypes.PNG);
		assertThat(FileTypes.detect(ascii("RIFF\u0000\u0000\u0000\u0000WEBPVP8 "))).isEqualTo(FileTypes.WEBP);
		assertThat(FileTypes.detect(ascii("%PDF-1.7\n%âãÏÓ"))).isEqualTo(FileTypes.PDF);
	}

	@Test
	void rejectsAnythingElseWhateverItsName() {
		assertThat(FileTypes.detect(ascii("<html><script>alert(1)</script></html>"))).isNull();
		assertThat(FileTypes.detect(ascii("<svg xmlns=\"http://www.w3.org/2000/svg\"/>"))).isNull();
		assertThat(FileTypes.detect(ascii("MZ\u0090\u0000 ejecutable de Windows"))).isNull();
		assertThat(FileTypes.detect(ascii("RIFF\u0000\u0000\u0000\u0000AVI LIST"))).isNull();
		assertThat(FileTypes.detect(new byte[] { (byte) 0xff, (byte) 0xd8 })).isNull();
		assertThat(FileTypes.detect(null)).isNull();
	}

	@Test
	void fileNamesLoseFoldersAndOddCharactersAndGetTheRealExtension() {
		assertThat(DocumentService.cleanFileName("C:\\Users\\ana\\Seguro 2026.pdf", FileTypes.PDF))
			.isEqualTo("Seguro 2026.pdf");
		assertThat(DocumentService.cleanFileName("../../etc/passwd", FileTypes.PDF)).isEqualTo("passwd.pdf");
		assertThat(DocumentService.cleanFileName("itv\".html", FileTypes.JPEG)).isEqualTo("itv.jpg");
		assertThat(DocumentService.cleanFileName("IMG_2041.HEIC", FileTypes.JPEG)).isEqualTo("IMG_2041.jpg");
		assertThat(DocumentService.cleanFileName("", FileTypes.PNG)).isEqualTo("foto.png");
		assertThat(DocumentService.cleanFileName(null, FileTypes.PDF)).isEqualTo("documento.pdf");
		assertThat(DocumentService.cleanFileName("a".repeat(300) + ".pdf", FileTypes.PDF)).hasSize(104);
	}

	@Test
	void sectionTitlesAreTidiedAndMustExist() {
		assertThat(DocumentService.cleanTitle("  Tarjeta   de\ttransporte ")).isEqualTo("Tarjeta de transporte");
		assertThatThrownBy(() -> DocumentService.cleanTitle("   ")).isInstanceOf(AppException.class);
		assertThatThrownBy(() -> DocumentService.cleanTitle(null)).isInstanceOf(AppException.class);
		assertThatThrownBy(() -> DocumentService.cleanTitle("x".repeat(41))).isInstanceOf(AppException.class);
	}

}
