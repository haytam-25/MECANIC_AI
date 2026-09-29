package com.mecanicai.user;

import java.util.Optional;
import java.util.UUID;

import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import com.mecanicai.common.AppException;

@Service
public class UserService {

	private final UserRepository users;

	public UserService(UserRepository users) {
		this.users = users;
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
		return users.findById(id)
			.orElseThrow(() -> new AppException(HttpStatus.UNAUTHORIZED, "SESSION_EXPIRED", "Tu sesión ha caducado"));
	}

	/** Borra la cuenta y, en cascada, sus vehículos, conversaciones y mensajes. */
	@Transactional
	public void delete(UUID id) {
		users.deleteById(id);
	}

}
