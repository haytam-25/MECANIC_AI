package com.mecanicai.basket;

import java.util.List;

import jakarta.validation.Valid;

import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import com.mecanicai.auth.AuthUser;
import com.mecanicai.basket.BasketService.BasketItem;
import com.mecanicai.basket.BasketService.BasketItemRequest;
import com.mecanicai.basket.BasketService.BoughtRequest;

/** Cesta de la compra de cada coche: solo con cuenta (la de los invitados no sale del navegador). */
@RestController
@RequestMapping("/api/basket")
public class BasketController {

	private final BasketService basket;

	public BasketController(BasketService basket) {
		this.basket = basket;
	}

	@GetMapping
	public List<BasketItem> list(@AuthenticationPrincipal AuthUser user) {
		return basket.list(user.id());
	}

	@PostMapping
	public BasketItem add(@AuthenticationPrincipal AuthUser user, @Valid @RequestBody BasketItemRequest body) {
		return basket.add(user.id(), body);
	}

	/** Al cerrar el ticket: lo marcado como comprado sale de la cesta. */
	@PostMapping("/bought")
	public ResponseEntity<Void> bought(@AuthenticationPrincipal AuthUser user, @Valid @RequestBody BoughtRequest body) {
		basket.bought(user.id(), body.ids());
		return ResponseEntity.noContent().build();
	}

}
