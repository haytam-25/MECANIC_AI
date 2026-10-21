package com.mecanicai.auth;

import java.nio.charset.StandardCharsets;
import java.time.Duration;
import java.time.Instant;
import java.util.Optional;
import java.util.UUID;

import javax.crypto.SecretKey;
import javax.crypto.spec.SecretKeySpec;

import org.springframework.security.oauth2.jose.jws.MacAlgorithm;
import org.springframework.security.oauth2.jwt.JwsHeader;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.security.oauth2.jwt.JwtClaimsSet;
import org.springframework.security.oauth2.jwt.JwtEncoderParameters;
import org.springframework.security.oauth2.jwt.JwtException;
import org.springframework.security.oauth2.jwt.JwtValidators;
import org.springframework.security.oauth2.jwt.NimbusJwtDecoder;
import org.springframework.security.oauth2.jwt.NimbusJwtEncoder;
import org.springframework.stereotype.Service;

import com.mecanicai.config.AppProperties;
import com.nimbusds.jose.jwk.source.ImmutableSecret;

/**
 * Emite y valida el token de sesión propio de MecanicAI (JWT firmado con HS256) que viaja en una cookie HttpOnly.
 */
@Service
public class JwtService {

	private static final String ISSUER = "mecanicai";

	/** Id del inicio de sesión (ver {@link SessionService}). */
	private static final String SESSION_CLAIM = "sid";

	private final NimbusJwtEncoder encoder;

	private final NimbusJwtDecoder decoder;

	private final Duration ttl;

	public JwtService(AppProperties props) {
		String secret = props.auth().jwtSecret();
		if (secret == null || secret.getBytes(StandardCharsets.UTF_8).length < 32) {
			throw new IllegalStateException(
					"Configura JWT_SECRET (app.auth.jwt-secret) con al menos 32 caracteres. Ej: openssl rand -base64 48");
		}
		SecretKey key = new SecretKeySpec(secret.getBytes(StandardCharsets.UTF_8), "HmacSHA256");
		this.encoder = new NimbusJwtEncoder(new ImmutableSecret<>(key));
		this.decoder = NimbusJwtDecoder.withSecretKey(key).macAlgorithm(MacAlgorithm.HS256).build();
		this.decoder.setJwtValidator(JwtValidators.createDefaultWithIssuer(ISSUER));
		this.ttl = Duration.ofDays(props.auth().sessionDays());
	}

	/** Token de un inicio de sesión nuevo. */
	public String issue(UUID userId) {
		return issue(userId, UUID.randomUUID());
	}

	/** Token del inicio de sesión {@code sessionId} (al renovarlo se mantiene, para poder revocarlo entero). */
	public String issue(UUID userId, UUID sessionId) {
		Instant now = Instant.now();
		JwtClaimsSet claims = JwtClaimsSet.builder()
			.issuer(ISSUER)
			.subject(userId.toString())
			.claim(SESSION_CLAIM, sessionId.toString())
			.issuedAt(now)
			.expiresAt(now.plus(ttl))
			.build();
		JwsHeader header = JwsHeader.with(MacAlgorithm.HS256).build();
		return encoder.encode(JwtEncoderParameters.from(header, claims)).getTokenValue();
	}

	public Optional<AuthUser> parse(String token) {
		try {
			Jwt jwt = decoder.decode(token);
			String sessionId = jwt.getClaimAsString(SESSION_CLAIM);
			return Optional.of(new AuthUser(UUID.fromString(jwt.getSubject()),
					sessionId != null ? UUID.fromString(sessionId) : null, jwt.getIssuedAt()));
		}
		catch (JwtException | IllegalArgumentException ex) {
			return Optional.empty();
		}
	}

}
