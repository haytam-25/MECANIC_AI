package com.mecanicai.catalog;

import java.time.Duration;
import java.util.List;

import jakarta.servlet.http.HttpServletRequest;

import org.springframework.http.CacheControl;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import com.mecanicai.auth.AuthUser;
import com.mecanicai.catalog.EngineSuggestionService.EngineSuggestions;
import com.mecanicai.common.AppException;
import com.mecanicai.usage.UsageService;

@RestController
@RequestMapping("/api/catalog")
public class CatalogController {

	private static final CacheControl CATALOG_CACHE = CacheControl.maxAge(Duration.ofHours(1)).cachePublic();

	private final CatalogService catalog;

	private final EngineSuggestionService engines;

	public CatalogController(CatalogService catalog, EngineSuggestionService engines) {
		this.catalog = catalog;
		this.engines = engines;
	}

	public record BrandDto(String id, String name, String abbr, boolean popular) {
	}

	public record ModelDto(String id, String name, List<Integer> years, String yearsLabel) {
	}

	@GetMapping("/brands")
	public ResponseEntity<List<BrandDto>> brands() {
		List<BrandDto> brands = catalog.brands()
			.stream()
			.map(b -> new BrandDto(b.id(), b.name(), b.abbr(), b.popular()))
			.toList();
		return ResponseEntity.ok().cacheControl(CATALOG_CACHE).body(brands);
	}

	@GetMapping("/brands/{brandId}/models")
	public ResponseEntity<List<ModelDto>> models(@PathVariable String brandId) {
		CatalogService.Brand brand = catalog.brand(brandId).orElseThrow(() -> AppException.notFound("Marca no encontrada"));
		int currentYear = catalog.currentYear();
		List<ModelDto> models = brand.models()
			.stream()
			.map(m -> new ModelDto(m.id(), m.name(), m.years(currentYear), m.yearsLabel()))
			.filter(m -> !m.years().isEmpty())
			.toList();
		return ResponseEntity.ok().cacheControl(CATALOG_CACHE).body(models);
	}

	@GetMapping("/engines")
	public EngineSuggestions engines(@RequestParam String brand, @RequestParam String model, @RequestParam int year,
			@AuthenticationPrincipal AuthUser user, HttpServletRequest request) {
		String clientKey = user != null ? UsageService.userSubject(user.id()) : UsageService.ipSubject(request.getRemoteAddr());
		return engines.suggest(brand, model, year, clientKey);
	}

}
