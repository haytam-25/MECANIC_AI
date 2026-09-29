package com.mecanicai.user;

import java.time.Instant;
import java.util.UUID;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Table;

@Entity
@Table(name = "app_user")
public class User {

	@Id
	@GeneratedValue(strategy = GenerationType.UUID)
	private UUID id;

	@Column(name = "auth_subject", nullable = false, unique = true)
	private String authSubject;

	@Column(nullable = false)
	private String email;

	private String name;

	@Column(name = "avatar_url")
	private String avatarUrl;

	@Enumerated(EnumType.STRING)
	@Column(nullable = false)
	private Plan plan = Plan.FREE;

	@Column(name = "created_at", nullable = false)
	private Instant createdAt;

	@Column(name = "last_login_at", nullable = false)
	private Instant lastLoginAt;

	protected User() {
	}

	public User(String authSubject, String email, String name, String avatarUrl) {
		this.authSubject = authSubject;
		this.createdAt = Instant.now();
		updateProfile(email, name, avatarUrl);
	}

	/** Actualiza los datos que vienen de Google en cada inicio de sesión. */
	public void updateProfile(String email, String name, String avatarUrl) {
		this.email = truncate(email, 320);
		this.name = truncate(name, 200);
		this.avatarUrl = truncate(avatarUrl, 1000);
		this.lastLoginAt = Instant.now();
	}

	private static String truncate(String value, int max) {
		return value == null || value.length() <= max ? value : value.substring(0, max);
	}

	public UUID getId() {
		return id;
	}

	public String getAuthSubject() {
		return authSubject;
	}

	public String getEmail() {
		return email;
	}

	public String getName() {
		return name;
	}

	public String getAvatarUrl() {
		return avatarUrl;
	}

	public Plan getPlan() {
		return plan;
	}

	public Instant getCreatedAt() {
		return createdAt;
	}

	public Instant getLastLoginAt() {
		return lastLoginAt;
	}

}
