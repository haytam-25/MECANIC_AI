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
import com.mecanicai.usage.Usage;
import com.mecanicai.usage.UsageService;
import com.mecanicai.usage.UsageService.Reservation;
import com.mecanicai.user.UserService;
import com.mecanicai.vehicle.VehicleService;

import tools.jackson.databind.json.JsonMapper;

/**
 * Informes médicos: límite semanal (invitados y cuentas) y, solo con cuenta, el último informe de cada coche.
 * <p>
 * Los invitados no guardan nada: el servidor solo cuenta cuántos informes han hecho esta semana.
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

	public record SavedReport(UUID vehicleId, ReportInput input, Instant savedAt) {
	}

	/** {@code report} es null para los invitados. {@code usage}: informes de esta semana. */
	public record ReportResult(SavedReport report, Usage usage) {
	}

	private final JdbcClient jdbc;

	private final JsonMapper jsonMapper;

	private final UsageService usage;

	private final UserService users;

	private final VehicleService vehicles;

	private final AppProperties props;

	public HealthReportService(JdbcClient jdbc, JsonMapper jsonMapper, UsageService usage, UserService users,
			VehicleService vehicles, AppProperties props) {
		this.jdbc = jdbc;
		this.jsonMapper = jsonMapper;
		this.usage = usage;
		this.users = users;
		this.vehicles = vehicles;
		this.props = props;
	}

	public static String userSubject(UUID userId) {
		return "reports:user:" + userId;
	}

	public static String guestSubject(String guestId) {
		return "reports:guest:" + guestId;
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

	/** Cuenta un informe de la semana y lo guarda como el último de ese coche. */
	public ReportResult save(UUID userId, SaveReportRequest request) {
		validateItems(request.input());
		// Comprueba que el coche es suyo antes de gastar un informe
		vehicles.require(userId, request.vehicleId());
		int limit = planOf(userId).weeklyReports();
		Reservation reservation = usage.consumeWeekly(userSubject(userId), limit,
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
			usage.refund(reservation);
			throw ex;
		}
		return new ReportResult(new SavedReport(request.vehicleId(), request.input(), now), reservation.usage());
	}

	/** Invitado: solo cuenta el informe (por su cookie y por su conexión); no se guarda nada. */
	public ReportResult guest(String guestId, String remoteAddr) {
		AppProperties.Guest guest = props.guest();
		Reservation byGuest = usage.consumeWeekly(guestSubject(guestId), guest.weeklyReports(),
				"Ya has hecho tus %d informes médicos gratis de esta semana como invitado. Inicia sesión con Google para hacer hasta %d a la semana y tenerlos guardados."
					.formatted(guest.weeklyReports(), props.plans().free().weeklyReports()));
		try {
			usage.consumeWeekly("reports:" + UsageService.ipSubject(remoteAddr), guest.weeklyReportsPerIp(),
					"Se ha alcanzado el límite de informes médicos de esta semana desde tu conexión. Inicia sesión con Google para seguir.");
		}
		catch (AppException ex) {
			usage.refund(byGuest);
			throw ex;
		}
		return new ReportResult(null, byGuest.usage());
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
