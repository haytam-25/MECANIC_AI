package com.mecanicai.chat;

import org.springframework.http.CacheControl;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import com.mecanicai.chat.ChatDtos.SharedView;

/**
 * Lectura pública de una consulta compartida: no pide sesión, basta con el enlace.
 */
@RestController
@RequestMapping("/api/shared")
public class SharedController {

	private final ShareService shares;

	public SharedController(ShareService shares) {
		this.shares = shares;
	}

	@GetMapping("/{token}")
	public ResponseEntity<SharedView> view(@PathVariable String token) {
		// Sin caché: al dejar de compartir, el enlace deja de enseñar la consulta
		return ResponseEntity.ok().cacheControl(CacheControl.noStore()).body(shares.view(token));
	}

}
