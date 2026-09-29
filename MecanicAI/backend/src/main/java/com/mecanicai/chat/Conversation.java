package com.mecanicai.chat;

import java.time.Instant;
import java.util.UUID;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.FetchType;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.Table;

import com.mecanicai.vehicle.Vehicle;

@Entity
@Table(name = "conversation")
public class Conversation {

	public static final String DEFAULT_TITLE = "Nueva consulta";

	@Id
	@GeneratedValue(strategy = GenerationType.UUID)
	private UUID id;

	@Column(name = "user_id", nullable = false)
	private UUID userId;

	@ManyToOne(fetch = FetchType.LAZY, optional = false)
	@JoinColumn(name = "vehicle_id", nullable = false)
	private Vehicle vehicle;

	@Column(nullable = false)
	private String title;

	@Column(name = "created_at", nullable = false)
	private Instant createdAt;

	@Column(name = "updated_at", nullable = false)
	private Instant updatedAt;

	protected Conversation() {
	}

	public Conversation(UUID userId, Vehicle vehicle) {
		this.userId = userId;
		this.vehicle = vehicle;
		this.title = DEFAULT_TITLE;
		this.createdAt = Instant.now();
		this.updatedAt = this.createdAt;
	}

	/** El título se genera a partir de la primera pregunta del usuario. */
	public void titleFrom(String firstMessage) {
		String clean = firstMessage.strip().replaceAll("\\s+", " ");
		this.title = clean.length() <= 60 ? clean : clean.substring(0, 59).strip() + "…";
	}

	public void touch() {
		this.updatedAt = Instant.now();
	}

	public UUID getId() {
		return id;
	}

	public UUID getUserId() {
		return userId;
	}

	public Vehicle getVehicle() {
		return vehicle;
	}

	public String getTitle() {
		return title;
	}

	public Instant getCreatedAt() {
		return createdAt;
	}

	public Instant getUpdatedAt() {
		return updatedAt;
	}

}
