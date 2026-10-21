package com.mecanicai.auth;

import java.sql.Timestamp;
import java.time.Duration;
import java.time.Instant;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;

import com.mecanicai.config.AppProperties;

/**
 * Sesiones que siguen valiendo. El JWT por sí solo valdría hasta caducar aunque el usuario cerrase sesión o borrase
 * la cuenta; por eso en cada petición se comprueba que la cuenta existe y que ese inicio de sesión no se cerró
 * ({@code revoked_session}).
 */
@Service
public class SessionService {

	private static final Logger log = LoggerFactory.getLogger(SessionService.class);

	private final JdbcClient jdbc;

	private final Duration sessionTtl;

	public SessionService(JdbcClient jdbc, AppProperties props) {
		this.jdbc = jdbc;
		this.sessionTtl = Duration.ofDays(props.auth().sessionDays());
	}

	/** Si la cuenta del token existe y su inicio de sesión no se ha cerrado. */
	public boolean isActive(AuthUser user) {
		if (user.sessionId() == null) {
			// Token anterior a las sesiones revocables: vale hasta que /api/auth/me lo renueve (con sesión)
			return jdbc.sql("SELECT EXISTS (SELECT 1 FROM app_user WHERE id = :user)")
				.param("user", user.id())
				.query(Boolean.class)
				.single();
		}
		return jdbc.sql("""
				SELECT EXISTS (SELECT 1 FROM app_user WHERE id = :user)
					AND NOT EXISTS (SELECT 1 FROM revoked_session WHERE session_id = :session)""")
			.param("user", user.id())
			.param("session", user.sessionId())
			.query(Boolean.class)
			.single();
	}

	/**
	 * Cierra el inicio de sesión del token: deja de valer este token y cualquier otro de esa sesión (las renovaciones
	 * diarias mantienen el id). Se recuerda hasta que caduque el último token que pudo emitirse.
	 */
	public void revoke(AuthUser user) {
		if (user.sessionId() == null) {
			return;
		}
		jdbc.sql("""
				INSERT INTO revoked_session (session_id, expires_at) VALUES (:session, :expiresAt)
				ON CONFLICT DO NOTHING""")
			.param("session", user.sessionId())
			.param("expiresAt", Timestamp.from(Instant.now().plus(sessionTtl)))
			.update();
	}

	/** Las sesiones cerradas cuyos tokens ya han caducado no hace falta recordarlas. */
	@Scheduled(cron = "0 40 4 * * *", zone = "${app.timezone:Europe/Madrid}")
	public void purgeExpired() {
		int deleted = jdbc.sql("DELETE FROM revoked_session WHERE expires_at < :now")
			.param("now", Timestamp.from(Instant.now()))
			.update();
		log.info("Sesiones cerradas ya caducadas eliminadas: {}", deleted);
	}

}
