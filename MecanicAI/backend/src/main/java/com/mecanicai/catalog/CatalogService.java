package com.mecanicai.catalog;

import java.io.IOException;
import java.io.InputStream;
import java.text.Normalizer;
import java.time.Year;
import java.time.ZoneId;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.HashSet;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Optional;
import java.util.Set;
import java.util.TreeSet;
import java.util.function.Function;
import java.util.stream.Collectors;

import org.springframework.core.io.ClassPathResource;
import org.springframework.stereotype.Service;

import com.mecanicai.config.AppProperties;
import com.mecanicai.vehicle.VehicleSpec;

import tools.jackson.core.type.TypeReference;
import tools.jackson.databind.json.JsonMapper;

/**
 * Catálogo de marcas y modelos (mercado español) cargado de {@code catalog/vehicles.json}.
 * Cada modelo tiene uno o varios rangos de años de venta, p. ej. {@code "1991-2004,2024-"}.
 */
@Service
public class CatalogService {

	private static final String CATALOG_FILE = "catalog/vehicles.json";

	public record YearRange(int from, Integer to) {

		/** Interpreta "1999-", "1991-2004" o "1991-2004,2024-". */
		static List<YearRange> parse(String spec) {
			List<YearRange> ranges = new ArrayList<>();
			for (String part : spec.split(",")) {
				String[] bounds = part.trim().split("-", -1);
				if (bounds.length != 2 || bounds[0].isBlank()) {
					throw new IllegalArgumentException("Rango de años no válido: " + spec);
				}
				int from = Integer.parseInt(bounds[0].trim());
				Integer to = bounds[1].isBlank() ? null : Integer.parseInt(bounds[1].trim());
				if (from < 1950 || (to != null && to < from)) {
					throw new IllegalArgumentException("Rango de años no válido: " + spec);
				}
				ranges.add(new YearRange(from, to));
			}
			return List.copyOf(ranges);
		}
	}

	public record Model(String id, String name, List<YearRange> ranges) {

		/** Años disponibles, del más reciente al más antiguo. */
		public List<Integer> years(int currentYear) {
			TreeSet<Integer> years = new TreeSet<>(Comparator.reverseOrder());
			for (YearRange range : ranges) {
				int to = range.to() == null ? currentYear : Math.min(range.to(), currentYear);
				for (int year = range.from(); year <= to; year++) {
					years.add(year);
				}
			}
			return List.copyOf(years);
		}

		public boolean coversYear(int year, int currentYear) {
			return years(currentYear).contains(year);
		}

		/** Ej.: "1999–hoy" o "1991–2004 · 2024–hoy". */
		public String yearsLabel() {
			return ranges.stream()
				.map(r -> r.from() + "–" + (r.to() == null ? "hoy" : r.to()))
				.collect(Collectors.joining(" · "));
		}
	}

	public record Brand(String id, String name, String abbr, boolean popular, List<Model> models,
			Map<String, Model> modelsById) {
	}

	private record RawBrand(String name, String abbr, Boolean popular, LinkedHashMap<String, String> models) {
	}

	private final List<Brand> brands;

	private final Map<String, Brand> brandsById;

	private final ZoneId zone;

	public CatalogService(JsonMapper jsonMapper, AppProperties props) throws IOException {
		this.zone = props.timezone();
		List<RawBrand> raw;
		try (InputStream in = new ClassPathResource(CATALOG_FILE).getInputStream()) {
			raw = jsonMapper.readValue(in, new TypeReference<List<RawBrand>>() {
			});
		}
		this.brands = raw.stream().map(CatalogService::toBrand).toList();
		this.brandsById = brands.stream().collect(Collectors.toMap(Brand::id, Function.identity(), (a, b) -> {
			throw new IllegalStateException("Marca duplicada en el catálogo: " + a.name());
		}, LinkedHashMap::new));
	}

	private static Brand toBrand(RawBrand raw) {
		Set<String> ids = new HashSet<>();
		List<Model> models = raw.models().entrySet().stream().map(entry -> {
			String id = slug(entry.getKey());
			if (!ids.add(id)) {
				throw new IllegalStateException("Modelo duplicado en " + raw.name() + ": " + entry.getKey());
			}
			return new Model(id, entry.getKey(), YearRange.parse(entry.getValue()));
		}).toList();
		Map<String, Model> modelsById = models.stream()
			.collect(Collectors.toMap(Model::id, Function.identity(), (a, b) -> a, LinkedHashMap::new));
		String abbr = raw.abbr() != null ? raw.abbr() : abbreviation(raw.name());
		return new Brand(slug(raw.name()), raw.name(), abbr, Boolean.TRUE.equals(raw.popular()), models, modelsById);
	}

	public List<Brand> brands() {
		return brands;
	}

	public Optional<Brand> brand(String brandId) {
		return Optional.ofNullable(brandsById.get(brandId));
	}

	public Optional<Model> model(String brandId, String modelId) {
		return brand(brandId).map(brand -> brand.modelsById().get(modelId));
	}

	/**
	 * El coche con los nombres del catálogo. Los ids los envía el navegador: si no existen en el catálogo se quitan y
	 * el coche se trata como escrito a mano (por su texto). Así nadie puede usar los ids de un coche conocido con otro
	 * nombre (por ejemplo, para que la respuesta de la IA a otro coche se guarde en caché como la de este).
	 */
	public VehicleSpec canonical(VehicleSpec spec) {
		Brand brand = spec.brandId() != null ? brandsById.get(spec.brandId()) : null;
		if (brand == null) {
			return spec.withCatalogNames(null, spec.brand(), null, spec.model());
		}
		Model model = spec.modelId() != null ? brand.modelsById().get(spec.modelId()) : null;
		return model == null ? spec.withCatalogNames(brand.id(), brand.name(), null, spec.model())
				: spec.withCatalogNames(brand.id(), brand.name(), model.id(), model.name());
	}

	public int currentYear() {
		return Year.now(zone).getValue();
	}

	/** "León" → "leon", "Serie 3" → "serie-3", "Lynk &amp; Co" → "lynk-co". */
	static String slug(String text) {
		String slug = Normalizer.normalize(text, Normalizer.Form.NFD)
			.replaceAll("\\p{M}", "")
			.toLowerCase(Locale.ROOT)
			.replaceAll("[^a-z0-9]+", "-")
			.replaceAll("(^-|-$)", "");
		return slug.isEmpty() ? "x" : slug;
	}

	/** Iniciales para el tapacubos de la marca: "Alfa Romeo" → "AR", "BMW" → "BMW", "Toyota" → "T". */
	static String abbreviation(String name) {
		String[] words = name.trim().split("[\\s/&-]+");
		if (words.length >= 2) {
			return (words[0].substring(0, 1) + words[1].substring(0, 1)).toUpperCase(Locale.ROOT);
		}
		return name.length() <= 3 ? name.toUpperCase(Locale.ROOT) : name.substring(0, 1).toUpperCase(Locale.ROOT);
	}

}
