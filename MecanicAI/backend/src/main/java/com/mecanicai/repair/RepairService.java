package com.mecanicai.repair;

import java.sql.ResultSet;
import java.sql.SQLException;
import java.sql.Timestamp;
import java.time.Instant;
import java.time.LocalDate;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Locale;
import java.util.Set;
import java.util.UUID;

import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;

import org.springframework.http.HttpStatus;
import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import com.mecanicai.common.AppException;
import com.mecanicai.config.AppProperties;
import com.mecanicai.vehicle.VehicleService;

import tools.jackson.databind.json.JsonMapper;

/**
 * Historial de reparaciones de las cuentas de Google: lo que se le ha hecho a cada coche del garaje (con sus km, precio y
 * observaciones). Como mucho {@code app.limits.max-repairs} entre todos los coches del usuario.
 * <p>
 * Los invitados no guardan nada aquí: su diario vive en el navegador y pasa a la cuenta al iniciar sesión.
 */
@Service
public class RepairService {

	/** Lo que el usuario apunta. {@code types}: ids de {@link com.mecanicai.maintenance.MaintenanceItem} o {@link RepairCategory}. */
	public record RepairRequest(
			@NotNull UUID vehicleId,
			@NotNull LocalDate date,
			@NotNull @Min(0) @Max(2_000_000) Integer km,
			@NotNull @Size(min = 1, max = 12) List<@NotBlank @Size(max = 40) String> types,
			@Min(0) @Max(10_000_000) Integer priceCents,
			@Size(max = 80) String workshop,
			@Size(max = 1000) String notes) {
	}

	public record Repair(UUID id, UUID vehicleId, LocalDate date, int km, List<String> types, Integer priceCents,
			String workshop, String notes, Instant createdAt) {
	}

	/** Las fechas anteriores son con toda seguridad un error al escribirlas. */
	private static final LocalDate OLDEST = LocalDate.of(1950, 1, 1);

	private static final String SELECT = """
			SELECT id, vehicle_id, repair_date, km, types_json, price_cents, workshop, notes, created_at FROM repair""";

	private final JdbcClient jdbc;

	private final JsonMapper jsonMapper;

	private final VehicleService vehicles;

	private final AppProperties props;

	public RepairService(JdbcClient jdbc, JsonMapper jsonMapper, VehicleService vehicles, AppProperties props) {
		this.jdbc = jdbc;
		this.jsonMapper = jsonMapper;
		this.vehicles = vehicles;
		this.props = props;
	}

	/** Reparaciones de todos los coches del usuario, de la más reciente a la más antigua. */
	public List<Repair> list(UUID userId) {
		return jdbc.sql(SELECT + " WHERE user_id = :user ORDER BY repair_date DESC, created_at DESC")
			.param("user", userId)
			.query(this::map)
			.list();
	}

	@Transactional
	public Repair create(UUID userId, RepairRequest request) {
		Clean clean = validate(request);
		// Comprueba que el coche es suyo
		vehicles.require(userId, request.vehicleId());
		int max = props.limits().maxRepairs();
		int count = jdbc.sql("SELECT count(*) FROM repair WHERE user_id = :user")
			.param("user", userId)
			.query(Integer.class)
			.single();
		if (count >= max) {
			throw new AppException(HttpStatus.CONFLICT, "REPAIR_LIMIT",
					"Tu diario está lleno (máximo %d reparaciones entre todos tus coches). Borra alguna para apuntar otra."
						.formatted(max));
		}

		UUID id = UUID.randomUUID();
		Instant now = Instant.now();
		jdbc.sql("""
				INSERT INTO repair (id, user_id, vehicle_id, repair_date, km, types_json, price_cents, workshop, notes, created_at)
				VALUES (:id, :user, :vehicle, :date, :km, :types, :price, :workshop, :notes, :createdAt)""")
			.param("id", id)
			.param("user", userId)
			.param("vehicle", request.vehicleId())
			.param("date", request.date())
			.param("km", request.km())
			.param("types", jsonMapper.writeValueAsString(clean.types()))
			.param("price", request.priceCents())
			.param("workshop", clean.workshop())
			.param("notes", clean.notes())
			.param("createdAt", Timestamp.from(now))
			.update();
		return new Repair(id, request.vehicleId(), request.date(), request.km(), clean.types(), request.priceCents(),
				clean.workshop(), clean.notes(), now);
	}

	/** Corrige una reparación (el coche no cambia). */
	@Transactional
	public Repair update(UUID userId, UUID repairId, RepairRequest request) {
		Clean clean = validate(request);
		int updated = jdbc.sql("""
				UPDATE repair SET repair_date = :date, km = :km, types_json = :types, price_cents = :price,
				workshop = :workshop, notes = :notes
				WHERE id = :id AND user_id = :user AND vehicle_id = :vehicle""")
			.param("date", request.date())
			.param("km", request.km())
			.param("types", jsonMapper.writeValueAsString(clean.types()))
			.param("price", request.priceCents())
			.param("workshop", clean.workshop())
			.param("notes", clean.notes())
			.param("id", repairId)
			.param("user", userId)
			.param("vehicle", request.vehicleId())
			.update();
		if (updated == 0) {
			throw AppException.notFound("Reparación no encontrada");
		}
		return jdbc.sql(SELECT + " WHERE id = :id").param("id", repairId).query(this::map).single();
	}

	public void delete(UUID userId, UUID repairId) {
		int deleted = jdbc.sql("DELETE FROM repair WHERE id = :id AND user_id = :user")
			.param("id", repairId)
			.param("user", userId)
			.update();
		if (deleted == 0) {
			throw AppException.notFound("Reparación no encontrada");
		}
	}

	private Repair map(ResultSet rs, int row) throws SQLException {
		return new Repair(rs.getObject("id", UUID.class), rs.getObject("vehicle_id", UUID.class),
				rs.getObject("repair_date", LocalDate.class), rs.getInt("km"),
				List.of(jsonMapper.readValue(rs.getString("types_json"), String[].class)),
				rs.getObject("price_cents", Integer.class), rs.getString("workshop"), rs.getString("notes"),
				rs.getTimestamp("created_at").toInstant());
	}

	private record Clean(List<String> types, String workshop, String notes) {
	}

	private Clean validate(RepairRequest request) {
		LocalDate today = LocalDate.now(props.timezone());
		if (request.date().isAfter(today)) {
			throw AppException.badRequest("VALIDATION", "La fecha de la reparación no puede ser futura.");
		}
		if (request.date().isBefore(OLDEST)) {
			throw AppException.badRequest("VALIDATION", "Revisa la fecha de la reparación.");
		}
		Set<String> types = new LinkedHashSet<>();
		for (String raw : request.types()) {
			if (!RepairCategory.isKnownType(raw)) {
				throw AppException.badRequest("VALIDATION", "Tipo de reparación desconocido: " + raw);
			}
			types.add(raw.trim().toUpperCase(Locale.ROOT));
		}
		return new Clean(List.copyOf(types), blankToNull(request.workshop()), blankToNull(request.notes()));
	}

	private static String blankToNull(String text) {
		return text == null || text.isBlank() ? null : text.strip();
	}

}
