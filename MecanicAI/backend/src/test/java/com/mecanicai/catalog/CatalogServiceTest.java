package com.mecanicai.catalog;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import java.util.List;

import org.junit.jupiter.api.BeforeAll;
import org.junit.jupiter.api.Test;

import com.mecanicai.TestProps;
import com.mecanicai.catalog.CatalogService.Model;
import com.mecanicai.catalog.CatalogService.YearRange;

import tools.jackson.databind.json.JsonMapper;

class CatalogServiceTest {

	private static CatalogService catalog;

	@BeforeAll
	static void load() throws Exception {
		catalog = new CatalogService(JsonMapper.builder().build(), TestProps.defaults());
	}

	@Test
	void everyBrandHasModelsAndUrlSafeIds() {
		assertThat(catalog.brands()).hasSizeGreaterThan(40);
		catalog.brands().forEach(brand -> {
			assertThat(brand.id()).matches("[a-z0-9-]+");
			assertThat(brand.models()).as(brand.name()).isNotEmpty();
			brand.models().forEach(model -> assertThat(model.id()).matches("[a-z0-9-]+"));
		});
		assertThat(catalog.brands()).filteredOn(CatalogService.Brand::popular).hasSizeGreaterThanOrEqualTo(12);
	}

	@Test
	void yearsAreListedFromNewestToOldest() {
		Model leon = catalog.model("seat", "leon").orElseThrow();
		List<Integer> years = leon.years(catalog.currentYear());
		assertThat(years.getFirst()).isEqualTo(catalog.currentYear());
		assertThat(years.getLast()).isEqualTo(1999);
		assertThat(years).contains(2016);
		assertThat(leon.yearsLabel()).isEqualTo("1999–hoy");
	}

	@Test
	void productionGapsAreRespected() {
		Model frontera = catalog.model("opel", "frontera").orElseThrow();
		int current = catalog.currentYear();
		assertThat(frontera.coversYear(2004, current)).isTrue();
		assertThat(frontera.coversYear(2010, current)).isFalse();
		assertThat(frontera.coversYear(2024, current)).isTrue();
		assertThat(frontera.yearsLabel()).isEqualTo("1991–2004 · 2024–hoy");
	}

	@Test
	void yearRangesAreParsedAndValidated() {
		assertThat(YearRange.parse("1991-2004,2024-")).containsExactly(new YearRange(1991, 2004),
				new YearRange(2024, null));
		assertThatThrownBy(() -> YearRange.parse("2004-1991")).isInstanceOf(IllegalArgumentException.class);
		assertThatThrownBy(() -> YearRange.parse("1991")).isInstanceOf(IllegalArgumentException.class);
	}

	@Test
	void slugsAndAbbreviations() {
		assertThat(CatalogService.slug("León")).isEqualTo("leon");
		assertThat(CatalogService.slug("Lynk & Co")).isEqualTo("lynk-co");
		assertThat(CatalogService.slug("Serie 2 Active / Gran Tourer")).isEqualTo("serie-2-active-gran-tourer");
		assertThat(CatalogService.abbreviation("Alfa Romeo")).isEqualTo("AR");
		assertThat(CatalogService.abbreviation("Mercedes-Benz")).isEqualTo("MB");
		assertThat(CatalogService.abbreviation("BMW")).isEqualTo("BMW");
		assertThat(CatalogService.abbreviation("Toyota")).isEqualTo("T");
		assertThat(catalog.brand("volkswagen").orElseThrow().abbr()).isEqualTo("VW");
		assertThat(catalog.brand("skoda")).isPresent();
		assertThat(catalog.brand("citroen")).isPresent();
	}

}
