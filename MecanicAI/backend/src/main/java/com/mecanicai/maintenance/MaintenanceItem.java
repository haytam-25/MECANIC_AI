package com.mecanicai.maintenance;

import java.util.Locale;
import java.util.Optional;

import com.mecanicai.vehicle.Fuel;

/**
 * Elementos que revisa el "informe médico", con su explicación y sus intervalos de cambio habituales. La IA puede
 * ajustar los intervalos a cada coche (ver {@link MaintenancePlanService}); estos son los que se usan si no.
 * <p>
 * {@code critical}: afecta a la seguridad o, si falla, puede romper el motor.
 */
public enum MaintenanceItem {

	ACEITE("Aceite y filtro de aceite", "Lubrica el motor. Con el aceite viejo el motor se desgasta mucho más rápido.",
			false),
	FILTRO_AIRE("Filtro de aire", "Si está sucio, el motor respira peor: gasta más y rinde menos.", false),
	FILTRO_HABITACULO("Filtro de habitáculo (polen)",
			"Limpia el aire que entra al interior y evita malos olores y que se empañen los cristales.", false),
	FILTRO_COMBUSTIBLE("Filtro de combustible", "Retiene la suciedad del combustible y protege los inyectores.", false),
	BUJIAS("Bujías", "Encienden la mezcla. Gastadas provocan tirones, fallos de encendido y más consumo.", false),
	DISTRIBUCION("Distribución", "Sincroniza las piezas del motor. Si la correa se rompe, puede destrozar el motor.",
			true),
	CORREA_ACCESORIOS("Correa de accesorios",
			"Mueve el alternador, el aire acondicionado y a veces la bomba de agua y la dirección.", false),
	LIQUIDO_FRENOS("Líquido de frenos",
			"Absorbe humedad con el tiempo y el coche frena peor: se cambia por tiempo, no por kilómetros.", true),
	PASTILLAS_FRENO("Pastillas de freno", "Se gastan al frenar. Si se acaban, frenas peor y se dañan los discos.",
			true),
	DISCOS_FRENO("Discos de freno", "Se desgastan y se deforman: vibraciones al frenar y distancias más largas.", true),
	NEUMATICOS("Neumáticos",
			"Con poco dibujo o la goma vieja (más de 5-6 años) agarran mucho menos, sobre todo en mojado.", true),
	REFRIGERANTE("Líquido refrigerante",
			"Evita que el motor se caliente o se congele y protege el circuito de la corrosión.", false),
	BATERIA("Batería de 12 V", "Suele durar 4-5 años y avisa poco: es la causa más habitual de quedarse tirado.",
			false),
	AMORTIGUADORES("Amortiguadores", "Gastados alargan la frenada y el coche se vuelve inestable en curvas.", true),
	ESCOBILLAS("Escobillas del limpiaparabrisas", "Con la goma cuarteada no limpian y bajo la lluvia ves mucho peor.",
			false);

	/** Cada cuántos km y/o meses se cambia (null = no depende de eso). */
	public record Interval(Integer km, Integer months) {
	}

	/** Lo poco importante se revisa con manga ancha: cada 4 años, sin contar km, diga lo que diga la IA. */
	static final Interval MINOR_INTERVAL = new Interval(null, 48);

	private final String label;

	private final String description;

	private final boolean critical;

	MaintenanceItem(String label, String description, boolean critical) {
		this.label = label;
		this.description = description;
		this.critical = critical;
	}

	public String label() {
		return label;
	}

	public String description() {
		return description;
	}

	public boolean critical() {
		return critical;
	}

	/** Poco importante (no afecta a la seguridad ni al motor): siempre {@link #MINOR_INTERVAL}. */
	public boolean minor() {
		return this == FILTRO_HABITACULO || this == ESCOBILLAS;
	}

	/**
	 * Intervalo habitual para ese combustible, o null si el elemento no existe en ese tipo de coche (p. ej. aceite en
	 * un eléctrico). Con el combustible desconocido se asume un coche de combustión.
	 */
	public Interval defaultInterval(Fuel fuel) {
		boolean electric = fuel == Fuel.ELECTRICO;
		boolean electrified = electric || fuel == Fuel.HIBRIDO || fuel == Fuel.HIBRIDO_ENCHUFABLE;
		return switch (this) {
			case ACEITE -> electric ? null : new Interval(15_000, 12);
			case FILTRO_AIRE -> electric ? null : new Interval(30_000, 24);
			case FILTRO_HABITACULO -> MINOR_INTERVAL;
			case FILTRO_COMBUSTIBLE -> electric ? null
					: fuel == Fuel.DIESEL ? new Interval(30_000, 24) : new Interval(60_000, 48);
			case BUJIAS -> electric || fuel == Fuel.DIESEL ? null
					: fuel == Fuel.GLP || fuel == Fuel.GNC ? new Interval(30_000, 24) : new Interval(60_000, 48);
			// Correa de distribución (la cadena no tiene cambio programado)
			case DISTRIBUCION -> electric ? null : new Interval(120_000, 72);
			case CORREA_ACCESORIOS -> electric ? null : new Interval(90_000, 60);
			case LIQUIDO_FRENOS -> new Interval(null, 24);
			// Los electrificados frenan mucho con el motor (frenada regenerativa) y gastan menos frenos
			case PASTILLAS_FRENO -> new Interval(electrified ? 70_000 : 40_000, null);
			case DISCOS_FRENO -> new Interval(electrified ? 120_000 : 80_000, null);
			case NEUMATICOS -> new Interval(electric ? 35_000 : 40_000, 60);
			case REFRIGERANTE -> new Interval(100_000, 60);
			case BATERIA -> new Interval(null, 60);
			case AMORTIGUADORES -> new Interval(80_000, null);
			case ESCOBILLAS -> MINOR_INTERVAL;
		};
	}

	/**
	 * Si entra en el plan cuando la IA no da una lista propia. El filtro de combustible solo en diésel (en muchos
	 * gasolina va dentro del depósito y no se cambia) y las bujías solo si se sabe que no es diésel.
	 */
	public boolean includedByDefault(Fuel fuel) {
		if (defaultInterval(fuel) == null) {
			return false;
		}
		return switch (this) {
			case FILTRO_COMBUSTIBLE -> fuel == Fuel.DIESEL;
			case BUJIAS -> fuel != null;
			default -> true;
		};
	}

	public static Optional<MaintenanceItem> parse(String raw) {
		if (raw == null || raw.isBlank()) {
			return Optional.empty();
		}
		try {
			return Optional.of(valueOf(raw.trim().toUpperCase(Locale.ROOT)));
		}
		catch (IllegalArgumentException ex) {
			return Optional.empty();
		}
	}

}
