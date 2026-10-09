package com.mecanicai.repair;

import static org.assertj.core.api.Assertions.assertThat;

import org.junit.jupiter.api.Test;

class RepairCategoryTest {

	@Test
	void maintenanceItemsAndRepairCategoriesAreValidTypes() {
		assertThat(RepairCategory.isKnownType("ACEITE")).isTrue();
		assertThat(RepairCategory.isKnownType("pastillas_freno")).isTrue();
		assertThat(RepairCategory.isKnownType("EMBRAGUE")).isTrue();
		assertThat(RepairCategory.isKnownType(" itv ")).isTrue();
	}

	@Test
	void unknownTypesAreRejected() {
		assertThat(RepairCategory.isKnownType("TURBO_MAGICO")).isFalse();
		assertThat(RepairCategory.isKnownType("")).isFalse();
		assertThat(RepairCategory.isKnownType(null)).isFalse();
	}

}
