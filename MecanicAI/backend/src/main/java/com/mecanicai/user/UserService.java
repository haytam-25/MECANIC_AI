package com.mecanicai.user;

import java.util.Optional;
import java.util.UUID;

import org.springframework.http.HttpStatus;
import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.annotation.Transactional;

import com.mecanicai.common.AppException;

@Service
public class UserService {

	private final UserRepository users;

	private final JdbcClient jdbc;

	public UserService(UserRepository users, JdbcClient jdbc) {
		this.users = users;
		this.jdbc = jdbc;
	}

	/** Crea el usuario la primera vez que inicia sesión, o actualiza su perfil en los siguientes accesos. */
	@Transactional
	public User upsertFromLogin(String subject, String email, String name, String avatarUrl) {
		User user = users.findByAuthSubject(subject).orElse(null);
		if (user == null) {
			return users.save(new User(subject, email, name, avatarUrl));
		}
		user.updateProfile(email, name, avatarUrl);
		return user;
	}

	@Transactional(readOnly = true)
	public Optional<User> find(UUID id) {
		return users.findById(id);
	}

	/** Usuario de la sesión actual; si ya no existe (cuenta borrada), la sesión deja de ser válida. */
	@Transactional(readOnly = true)
	public User require(UUID id) {
		return users.findById(id).orElseThrow(UserService::sessionExpired);
	}

	/**
	 * Bloquea al usuario hasta el final de la transacción actual. Lo usan las altas con tope por cuenta (coches,
	 * consultas, reparaciones, cesta): sin él, varias peticiones a la vez cuentan lo mismo y entre todas se pasan del
	 * tope. Si la cuenta ya no existe, la sesión deja de ser válida.
	 */
	@Transactional(propagation = Propagation.MANDATORY)
	public void lock(UUID id) {
		boolean exists = jdbc.sql("SELECT 1 FROM app_user WHERE id = :id FOR UPDATE")
			.param("id", id)
			.query(Integer.class)
			.optional()
			.isPresent();
		if (!exists) {
			throw sessionExpired();
		}
	}

	/** Borra la cuenta y, en cascada, sus vehículos, conversaciones y mensajes. */
	@Transactional
	public void delete(UUID id) {
		users.deleteById(id);
	}

	private static AppException sessionExpired() {
		return new AppException(HttpStatus.UNAUTHORIZED, "SESSION_EXPIRED", "Tu sesión ha caducado");
	}

}
