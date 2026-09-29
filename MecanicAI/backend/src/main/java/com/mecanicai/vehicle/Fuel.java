package com.mecanicai.vehicle;

import java.text.Normalizer;
import java.util.Locale;
import java.util.Map;
import java.util.Optional;

public enum Fuel {

	GASOLINA("Gasolina"),
	DIESEL("Diésel"),
	HIBRIDO("Híbrido"),
	HIBRIDO_ENCHUFABLE("Híbrido enchufable"),
	ELECTRICO("Eléctrico"),
	GLP("GLP"),
	GNC("GNC");

	private static final Map<String, Fuel> SYNONYMS = Map.ofEntries(Map.entry("GASOLINE", GASOLINA),
			Map.entry("PETROL", GASOLINA), Map.entry("HYBRID", HIBRIDO), Map.entry("HEV", HIBRIDO),
			Map.entry("MHEV", HIBRIDO), Map.entry("MICROHIBRIDO", HIBRIDO), Map.entry("PHEV", HIBRIDO_ENCHUFABLE),
			Map.entry("PLUG_IN_HYBRID", HIBRIDO_ENCHUFABLE), Map.entry("ELECTRIC", ELECTRICO),
			Map.entry("BEV", ELECTRICO), Map.entry("EV", ELECTRICO), Map.entry("LPG", GLP), Map.entry("CNG", GNC));

	private final String label;

	Fuel(String label) {
		this.label = label;
	}

	public String label() {
		return label;
	}

	/** Interpreta el combustible que devuelve la IA de forma tolerante ("Diésel", "phev", "electric"...). */
	public static Optional<Fuel> parse(String raw) {
		if (raw == null || raw.isBlank()) {
			return Optional.empty();
		}
		String key = Normalizer.normalize(raw.trim(), Normalizer.Form.NFD)
			.replaceAll("\\p{M}", "")
			.toUpperCase(Locale.ROOT)
			.replaceAll("[^A-Z]+", "_")
			.replaceAll("(^_|_$)", "");
		for (Fuel fuel : values()) {
			if (fuel.name().equals(key)) {
				return Optional.of(fuel);
			}
		}
		return Optional.ofNullable(SYNONYMS.get(key));
	}

}
