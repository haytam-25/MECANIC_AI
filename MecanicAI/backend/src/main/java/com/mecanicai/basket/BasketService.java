package com.mecanicai.basket;

import java.sql.ResultSet;
import java.sql.SQLException;
import java.sql.Timestamp;
import java.time.Instant;
import java.util.List;
import java.util.UUID;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;

import org.springframework.http.HttpStatus;
import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import com.mecanicai.common.AppException;
import com.mecanicai.config.AppProperties;
import com.mecanicai.user.UserService;
import com.mecanicai.vehicle.VehicleService;

/**
 * Cesta de las cuentas de Google: lo que el usuario apunta para comprar para cada coche del garaje (recambios,
 * aceite, herramientas…). Como mucho {@code app.limits.max-basket-items} entre todos los coches del usuario.
 * <p>
 * Los invitados no guardan nada aquí: su cesta vive en el navegador y pasa a la cuenta al iniciar sesión.
 */
@Service
public class BasketService {

	/** Lo que el usuario escribe para añadirlo a la cesta. */
	public record BasketItemRequest(@NotNull UUID vehicleId, @NotBlank @Size(max = MAX_TEXT) String text) {
	}

	/** Artículos comprados: salen de la cesta. */
	public record BoughtRequest(@NotNull @Size(min = 1, max = 200) List<@NotNull UUID> ids) {
	}

	public record BasketItem(UUID id, UUID vehicleId, String text, Instant createdAt) {
	}

	static final int MAX_TEXT = 120;

	private final JdbcClient jdbc;

	private final VehicleService vehicles;

	private final UserService users;

	private final AppProperties props;

	public BasketService(JdbcClient jdbc, VehicleService vehicles, UserService users, AppProperties props) {
		this.jdbc = jdbc;
		this.vehicles = vehicles;
		this.users = users;
		this.props = props;
	}

	/** Cesta de todos los coches del usuario, en el orden en que se añadió cada artículo. */
	public List<BasketItem> list(UUID userId) {
		return jdbc.sql("""
				SELECT id, vehicle_id, item_text, created_at FROM basket_item
				WHERE user_id = :user ORDER BY created_at, id""")
			.param("user", userId)
			.query(BasketService::map)
			.list();
	}

	@Transactional
	public BasketItem add(UUID userId, BasketItemRequest request) {
		String text = clean(request.text());
		// Uno a uno por usuario: si no, varias peticiones a la vez cuentan lo mismo y se pasan del tope
		users.lock(userId);
		// Comprueba que el coche es suyo
		vehicles.require(userId, request.vehicleId());
		int max = props.limits().maxBasketItems();
		int count = jdbc.sql("SELECT count(*) FROM basket_item WHERE user_id = :user")
			.param("user", userId)
			.query(Integer.class)
			.single();
		if (count >= max) {
			throw new AppException(HttpStatus.CONFLICT, "BASKET_LIMIT",
					"Tu cesta está llena (máximo %d artículos entre todos tus coches). Marca alguno como comprado para añadir otro."
						.formatted(max));
		}

		UUID id = UUID.randomUUID();
		Instant now = Instant.now();
		jdbc.sql("""
				INSERT INTO basket_item (id, user_id, vehicle_id, item_text, created_at)
				VALUES (:id, :user, :vehicle, :text, :createdAt)""")
			.param("id", id)
			.param("user", userId)
			.param("vehicle", request.vehicleId())
			.param("text", text)
			.param("createdAt", Timestamp.from(now))
			.update();
		return new BasketItem(id, request.vehicleId(), text, now);
	}

	/** Saca de la cesta los artículos comprados (los que ya no estén se ignoran). */
	public void bought(UUID userId, List<UUID> ids) {
		jdbc.sql("DELETE FROM basket_item WHERE user_id = :user AND id IN (:ids)")
			.param("user", userId)
			.param("ids", ids)
			.update();
	}

	/** Una sola línea: sin saltos ni espacios repetidos. */
	static String clean(String raw) {
		return raw.strip().replaceAll("\\s+", " ");
	}

	private static BasketItem map(ResultSet rs, int row) throws SQLException {
		return new BasketItem(rs.getObject("id", UUID.class), rs.getObject("vehicle_id", UUID.class),
				rs.getString("item_text"), rs.getTimestamp("created_at").toInstant());
	}

}
