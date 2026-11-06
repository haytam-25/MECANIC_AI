package com.mecanicai.document;

import java.nio.charset.StandardCharsets;
import java.time.Duration;
import java.util.List;
import java.util.UUID;

import jakarta.validation.Valid;

import org.springframework.http.CacheControl;
import org.springframework.http.ContentDisposition;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.multipart.MultipartFile;

import com.mecanicai.auth.AuthUser;
import com.mecanicai.document.DocumentService.DocumentFile;
import com.mecanicai.document.DocumentService.DocumentSection;
import com.mecanicai.document.DocumentService.FileContent;
import com.mecanicai.document.DocumentService.SectionRequest;
import com.mecanicai.document.DocumentService.SectionUpdate;

/** Documentación de los coches: solo con cuenta (los invitados no pueden guardarla). */
@RestController
@RequestMapping("/api/documents")
public class DocumentController {

	private final DocumentService documents;

	public DocumentController(DocumentService documents) {
		this.documents = documents;
	}

	@GetMapping
	public List<DocumentSection> list(@AuthenticationPrincipal AuthUser user) {
		return documents.list(user.id());
	}

	@PostMapping("/sections")
	public DocumentSection createSection(@AuthenticationPrincipal AuthUser user,
			@Valid @RequestBody SectionRequest body) {
		return documents.createSection(user.id(), body);
	}

	@PutMapping("/sections/{id}")
	public DocumentSection updateSection(@AuthenticationPrincipal AuthUser user, @PathVariable UUID id,
			@Valid @RequestBody SectionUpdate body) {
		return documents.updateSection(user.id(), id, body);
	}

	@DeleteMapping("/sections/{id}")
	public ResponseEntity<Void> deleteSection(@AuthenticationPrincipal AuthUser user, @PathVariable UUID id) {
		documents.deleteSection(user.id(), id);
		return ResponseEntity.noContent().build();
	}

	@PostMapping(path = "/sections/{id}/files", consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
	public DocumentFile upload(@AuthenticationPrincipal AuthUser user, @PathVariable UUID id,
			@RequestParam("file") MultipartFile file) {
		return documents.addFile(user.id(), id, file);
	}

	/**
	 * El archivo tal cual, para verlo en el navegador. El tipo es el que se comprobó al subirlo (foto o PDF) y el
	 * contenido de un id no cambia nunca: el navegador puede guardarlo en caché.
	 */
	@GetMapping("/files/{id}")
	public ResponseEntity<byte[]> content(@AuthenticationPrincipal AuthUser user, @PathVariable UUID id) {
		FileContent file = documents.fileContent(user.id(), id);
		return ResponseEntity.ok()
			.contentType(MediaType.parseMediaType(file.contentType()))
			.contentLength(file.content().length)
			.header(HttpHeaders.CONTENT_DISPOSITION,
					ContentDisposition.inline().filename(file.name(), StandardCharsets.UTF_8).build().toString())
			.header("X-Content-Type-Options", "nosniff")
			.cacheControl(CacheControl.maxAge(Duration.ofDays(7)).cachePrivate())
			.body(file.content());
	}

	@DeleteMapping("/files/{id}")
	public ResponseEntity<Void> deleteFile(@AuthenticationPrincipal AuthUser user, @PathVariable UUID id) {
		documents.deleteFile(user.id(), id);
		return ResponseEntity.noContent().build();
	}

}
