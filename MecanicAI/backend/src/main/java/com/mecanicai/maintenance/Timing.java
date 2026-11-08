package com.mecanicai.maintenance;

import com.mecanicai.common.Enums;

/** Tipo de distribución del motor. */
public enum Timing {

	CORREA("Correa de distribución"),
	/** Correa que trabaja dentro del aceite (p. ej. 1.2 PureTech o 1.0 EcoBoost): muy sensible al aceite usado. */
	CORREA_EN_ACEITE("Correa de distribución (bañada en aceite)"),
	CADENA("Cadena de distribución"),
	/** Coches eléctricos. */
	NINGUNA(null),
	/** No se sabe: el usuario lo indica en el formulario. */
	DESCONOCIDA("Correa o cadena de distribución");

	private final String label;

	Timing(String label) {
		this.label = label;
	}

	/** Nombre del elemento "distribución" en el informe (null si no tiene). */
	public String label() {
		return label;
	}

	public static Timing parse(String raw) {
		return Enums.parse(Timing.class, raw).orElse(DESCONOCIDA);
	}

}
