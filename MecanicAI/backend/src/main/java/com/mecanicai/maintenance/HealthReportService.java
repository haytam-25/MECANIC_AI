package com.mecanicai.maintenance;

import java.sql.Timestamp;
import java.time.Instant;
import java.util.List;
import java.util.Map;
import java.util.UUID;

import jakarta.validation.Valid;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;

import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.stereotype.Service;

import com.mecanicai.common.AppException;
import com.mecanicai.config.AppProperties;
import com.mecanicai.config.AppProperties.PlanSettings;
import com.mecanicai.usage.RateLimiter;
import com.mecanicai.usage.Usage;
import com.mecanicai.usage.UsageService;
import com.mecanicai.usage.UsageService.Reservation;
import com.mecanicai.user.UserService;
import com.mecanicai.vehicle.VehicleService;

import tools.jackson.databind.json.JsonMapper;

/**
 * Informes médicos: límite semanal (cuentas) o diario (invitados) y, solo con cuenta, el último informe de cada coche.
 * <p>
 * Solo cuenta el primer informe de cada coche: actualizar sus datos después es gratis (no gasta IA: el plan de
 * mantenimiento ya está en caché y el informe se calcula en el navegador). Los invitados no guardan nada: el servidor
 * solo cuenta los coches con informe de hoy.
 */
@Service
public class HealthReportService {

	/** Respuesta del formulario para un elemento, tal cual la escribe el usuario (el navegador la interpreta). */
	public record ItemAnswer(
			@NotNull @Pattern(regexp = "known|never|unknown") String kind,
			@NotNull @Size(max = 12) String km,
			@NotNull @Size(max = 8) String time,
			@NotNull @Pattern(regexp = "meses|años") String unit) {
	}

	/** {@code answers}: por id de {@link MaintenanceItem}. {@code timing}: solo si la IA no sabe si es correa o cadena. */
	public record ReportInput(
			@NotNull @Size(max = 12) String currentKm,
			@Pattern(regexp = "CORREA|CADENA|NO_SE") String timing,
			@NotNull @Size(max = 30) Map<@NotNull @Size(max = 40) String, @NotNull @Valid ItemAnswer> answers) {
	}

	public record SaveReportRequest(@NotNull UUID vehicleId, @NotNull @Valid ReportInput input) {
	}

	/** {@code vehicleId}: id del coche en el garaje del invitado (lo genera su navegador; cabe en usage_counter.subject). */
	public record GuestReportRequest(@NotNull @Pattern(regexp = "[A-Za-z0-9-]{1,48}") String vehicleId) {
	}

	public record SavedReport(UUID vehicleId, ReportInput input, Instant savedAt) {
	}

	/** {@code report} es null para los invitados. {@code usage}: informes de esta semana (invitados: de hoy). */
	public record ReportResult(SavedReport report, Usage usage) {
	}

	private final JdbcClient jdbc;

	private final JsonMapper jsonMapper;

	private final UsageService usage;

	private final UserService users;

	private final VehicleService vehicles;

	private final RateLimiter rateLimiter;

	private final AppProperties props;

	public HealthReportService(JdbcClient jdbc, JsonMapper jsonMapper, UsageService usage, UserService users,
			VehicleService vehicles, RateLimiter rateLimiter, AppProperties props) {
		this.jdbc = jdbc;
		this.jsonMapper = jsonMapper;
		this.usage = usage;
		this.users = users;
		this.vehicles = vehicles;
		this.rateLimiter = rateLimiter;
		this.props = props;
	}

	public static String userSubject(UUID userId) {
		return "reports:user:" + userId;
	}

	public static String guestSubject(String guestId) {
		return "reports:guest:" + guestId;
	}

	/** Marca de que ese coche del invitado ya tiene informe hoy (vale 1). */
	static String guestVehicleSubject(String guestId, String vehicleId) {
		return "reports:guest-car:" + guestId + ":" + vehicleId;
	}

	/** Último informe de cada coche del usuario, del más reciente al más antiguo. */
	public List<SavedReport> list(UUID userId) {
		return jdbc.sql("""
				SELECT vehicle_id, input_json, updated_at FROM health_report
				WHERE user_id = :user ORDER BY updated_at DESC""")
			.param("user", userId)
			.query((rs, row) -> new SavedReport(rs.getObject("vehicle_id", UUID.class),
					jsonMapper.readValue(rs.getString("input_json"), ReportInput.class),
					rs.getTimestamp("updated_at").toInstant()))
			.list();
	}

	/**
	 * Guarda el informe como el último de ese coche. Solo cuenta para el límite semanal si el coche aún no tenía
	 * informe: actualizar los datos de uno que ya lo tiene es gratis.
	 */
	public ReportResult save(UUID userId, SaveReportRequest request) {
		validateItems(request.input());
		// Comprueba que el coche es suyo antes de gastar un informe
		vehicles.require(userId, request.vehicleId());
		int limit = planOf(userId).weeklyReports();
		boolean update = jdbc.sql("SELECT 1 FROM health_report WHERE vehicle_id = :vehicle")
			.param("vehicle", request.vehicleId())
			.query(Integer.class)
			.optional()
			.isPresent();
		Reservation reservation = update ? null : usage.consumeWeekly(userSubject(userId), limit,
				"Ya has hecho tus %d informes médicos de esta semana. Se renuevan el lunes.".formatted(limit));

		Instant now = Instant.now();
		try {
			jdbc.sql("""
					INSERT INTO health_report (vehicle_id, user_id, input_json, updated_at)
					VALUES (:vehicle, :user, :json, :updatedAt)
					ON CONFLICT (vehicle_id) DO UPDATE SET input_json = EXCLUDED.input_json, updated_at = EXCLUDED.updated_at""")
				.param("vehicle", request.vehicleId())
				.param("user", userId)
				.param("json", jsonMapper.writeValueAsString(request.input()))
				.param("updatedAt", Timestamp.from(now))
				.update();
		}
		catch (RuntimeException ex) {
			if (reservation != null) {
				usage.refund(reservation);
			}
			throw ex;
		}
		Usage current = reservation != null ? reservation.usage() : usage.peekWeekly(userSubject(userId), limit);
		return new ReportResult(new SavedReport(request.vehicleId(), request.input(), now), current);
	}

	/**
	 * Invitado: solo cuenta el informe (por su conexión y por su cookie); no se guarda nada. La conexión va primero:
	 * la cookie la elige el cliente (sin ella, cada petición es un invitado nuevo), así que, agotado el cupo de la
	 * conexión, no se crea ningún contador más. Si ese coche ya tiene informe hoy, no cuenta.
	 *
	 * @param vehicleId coche del garaje del invitado; null (versiones antiguas de la app) cuenta siempre
	 */
	public ReportResult guest(String guestId, String remoteAddr, String vehicleId) {
		AppProperties.Guest guest = props.guest();
		String network = "reports:" + UsageService.ipSubject(remoteAddr);
		rateLimiter.check(network, props.limits().guestReportsPerMinute());
		String vehicleSubject = vehicleId != null ? guestVehicleSubject(guestId, vehicleId) : null;
		if (vehicleSubject != null && usage.peek(vehicleSubject, 1).remaining() == 0) {
			return new ReportResult(null, usage.peek(guestSubject(guestId), guest.dailyReports()));
		}
		Reservation byIp = usage.consume(network, guest.dailyReportsPerIp(),
				"Se ha alcanzado el límite de informes médicos de hoy desde tu conexión. Inicia sesión con Google para seguir.");
		try {
			Reservation byGuest = usage.consume(guestSubject(guestId), guest.dailyReports(),
					"Ya has hecho tus %d informes médicos gratis de hoy como invitado. Inicia sesión con Google para seguir haciendo informes y tenerlos guardados."
						.formatted(guest.dailyReports()));
			if (vehicleSubject != null) {
				usage.consume(vehicleSubject, 1, "Ese coche ya tiene informe hoy");
			}
			return new ReportResult(null, byGuest.usage());
		}
		catch (AppException ex) {
			usage.refund(byIp);
			throw ex;
		}
	}

	private static void validateItems(ReportInput input) {
		for (String id : input.answers().keySet()) {
			if (MaintenanceItem.parse(id).isEmpty()) {
				throw AppException.badRequest("VALIDATION", "Elemento de mantenimiento desconocido: " + id);
			}
		}
	}

	private PlanSettings planOf(UUID userId) {
		return props.plans().of(users.require(userId).getPlan());
	}

}
