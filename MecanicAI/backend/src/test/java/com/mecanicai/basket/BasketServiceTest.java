package com.mecanicai.basket;

import static org.assertj.core.api.Assertions.assertThat;

import org.junit.jupiter.api.Test;

class BasketServiceTest {

	@Test
	void theTextIsKeptOnASingleLine() {
		assertThat(BasketService.clean("  Aceite   5W30\n 5 litros ")).isEqualTo("Aceite 5W30 5 litros");
		assertThat(BasketService.clean("Filtro de aire")).isEqualTo("Filtro de aire");
	}

}
