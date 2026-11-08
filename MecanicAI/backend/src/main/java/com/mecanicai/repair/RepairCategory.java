package com.mecanicai.repair;

import java.util.Optional;

import com.mecanicai.common.Enums;
import com.mecanicai.maintenance.MaintenanceItem;

/**
 * Lo que se puede apuntar en el Historial de reparaciones además de los elementos de mantenimiento
 * ({@link MaintenanceItem}): averías y otros trabajos del taller. Los nombres que ve el usuario están en el frontend.
 */
public enum RepairCategory {

	REVISION, ITV, MOTOR, EMBRAGUE, CAJA_CAMBIOS, ELECTRICIDAD, AIRE_ACONDICIONADO, ESCAPE, ALINEADO, CARROCERIA,
	OTRO;

	/** Si es un id válido de una reparación: un {@link MaintenanceItem} o una {@link RepairCategory}. */
	public static boolean isKnownType(String raw) {
		return MaintenanceItem.parse(raw).isPresent() || parse(raw).isPresent();
	}

	static Optional<RepairCategory> parse(String raw) {
		return Enums.parse(RepairCategory.class, raw);
	}

}
