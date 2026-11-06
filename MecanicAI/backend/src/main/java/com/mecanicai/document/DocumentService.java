package com.mecanicai.document;

import java.io.IOException;
import java.io.UncheckedIOException;
import java.sql.ResultSet;
import java.sql.SQLException;
import java.sql.Timestamp;
import java.time.Instant;
import java.time.LocalDate;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.UUID;

import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;

import org.springframework.http.HttpStatus;
import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.multipart.MultipartFile;

import com.mecanicai.common.AppException;
import com.mecanicai.config.AppProperties;
import com.mecanicai.usage.RateLimiter;
import com.mecanicai.user.UserService;
import com.mecanicai.vehicle.VehicleService;

/**
 * Documentación de los coches de las cuentas de Google: el permiso de circulación, la ITV, el seguro y las secciones
 * que cree el usuario, cada una con sus fotos o PDF. Como mucho {@code app.limits.max-documents} archivos entre todos
 * los coches del usuario. Los invitados no guardan nada aquí.
 */
@Service
public class DocumentService {

	/** Lo que pesa como mucho cada archivo (las fotos llegan ya reducidas desde el navegador). */
	static final int MAX_FILE_BYTES = 5 * 1024 * 1024;

	/** Secciones propias como mucho en cada coche. */
	static final int MAX_CUSTOM_SECTIONS = 10;

	static final int MAX_TITLE = 40;

	/** Subidas por usuario y minuto: cada una puede escribir varios MB en la base de datos. */
	private static final int UPLOADS_PER_MINUTE = 12;

	/** Fechas de caducidad razonables: más allá es un error al escribirla. */
	private static final LocalDate OLDEST_EXPIRY = LocalDate.of(2000, 1, 1);

	private static final int MAX_YEARS_AHEAD = 15;

	/** Nueva sección. Las fijas (todas menos CUSTOM) se crean una sola vez por coche: si ya existe, se devuelve. */
	public record SectionRequest(@NotNull UUID vehicleId, @NotNull DocumentKind kind, @Size(max = 80) String title) {
	}

	/**
	 * Cambios de una sección. {@code title}: solo en las propias. {@code expiresOn} y {@code reminder}: solo ITV y
	 * seguro (el aviso exige la fecha).
	 */
	public record SectionUpdate(@Size(max = 80) String title, LocalDate expiresOn, boolean reminder) {
	}

	public record DocumentFile(UUID id, String name, String contentType, int size, Instant createdAt) {
	}

	public record DocumentSection(UUID id, UUID vehicleId, DocumentKind kind, String title, LocalDate expiresOn,
			boolean reminder, List<DocumentFile> files, Instant createdAt) {
	}

	public record FileContent(String name, String contentType, byte[] content) {
	}

	private record SectionRow(UUID id, UUID vehicleId, DocumentKind kind, String title, LocalDate expiresOn,
			boolean reminder, Instant createdAt) {

		DocumentSection withFiles(List<DocumentFile> files) {
			return new DocumentSection(id, vehicleId, kind, title, expiresOn, reminder, List.copyOf(files), createdAt);
		}
	}

	private static final String SECTION_COLUMNS = "id, vehicle_id, kind, title, expires_on, reminder, created_at";

	private static final String FILE_COLUMNS = "id, section_id, file_name, content_type, size_bytes, created_at";

	private final JdbcClient jdbc;

	private final VehicleService vehicles;

	private final UserService users;

	private final RateLimiter rateLimiter;

	private final AppProperties props;

	public DocumentService(JdbcClient jdbc, VehicleService vehicles, UserService users, RateLimiter rateLimiter,
			AppProperties props) {
		this.jdbc = jdbc;
		this.vehicles = vehicles;
		this.users = users;
		this.rateLimiter = rateLimiter;
		this.props = props;
	}

	/** Secciones de todos los coches del usuario (en el orden en que se crearon) con sus archivos. */
	@Transactional(readOnly = true)
	public List<DocumentSection> list(UUID userId) {
		List<SectionRow> sections = jdbc
			.sql("SELECT " + SECTION_COLUMNS + " FROM document_section WHERE user_id = :user ORDER BY created_at, id")
			.param("user", userId)
			.query(DocumentService::mapSection)
			.list();
		Map<UUID, List<DocumentFile>> files = new LinkedHashMap<>();
		jdbc.sql("SELECT " + FILE_COLUMNS + " FROM document_file WHERE user_id = :user ORDER BY created_at, id")
			.param("user", userId)
			.query(rs -> {
				files.computeIfAbsent(rs.getObject("section_id", UUID.class), id -> new ArrayList<>()).add(mapFile(rs));
			});
		return sections.stream().map(s -> s.withFiles(files.getOrDefault(s.id(), List.of()))).toList();
	}

	@Transactional
	public DocumentSection createSection(UUID userId, SectionRequest request) {
		vehicles.require(userId, request.vehicleId());
		Instant now = Instant.now();
		if (request.kind() != DocumentKind.CUSTOM) {
			jdbc.sql("""
					INSERT INTO document_section (id, user_id, vehicle_id, kind, reminder, created_at)
					VALUES (:id, :user, :vehicle, :kind, FALSE, :now)
					ON CONFLICT (vehicle_id, kind) WHERE kind <> 'CUSTOM' DO NOTHING""")
				.param("id", UUID.randomUUID())
				.param("user", userId)
				.param("vehicle", request.vehicleId())
				.param("kind", request.kind().name())
				.param("now", Timestamp.from(now))
				.update();
			UUID id = jdbc.sql("SELECT id FROM document_section WHERE vehicle_id = :vehicle AND kind = :kind")
				.param("vehicle", request.vehicleId())
				.param("kind", request.kind().name())
				.query(UUID.class)
				.single();
			return section(userId, id);
		}

		String title = cleanTitle(request.title());
		// Uno a uno por usuario: si no, varias peticiones a la vez cuentan lo mismo y se pasan del tope
		users.lock(userId);
		int custom = jdbc
			.sql("SELECT count(*) FROM document_section WHERE vehicle_id = :vehicle AND kind = 'CUSTOM'")
			.param("vehicle", request.vehicleId())
			.query(Integer.class)
			.single();
		if (custom >= MAX_CUSTOM_SECTIONS) {
			throw new AppException(HttpStatus.CONFLICT, "SECTION_LIMIT",
					"Este coche ya tiene muchas secciones. Borra alguna que no uses para crear otra.");
		}
		UUID id = UUID.randomUUID();
		jdbc.sql("""
				INSERT INTO document_section (id, user_id, vehicle_id, kind, title, reminder, created_at)
				VALUES (:id, :user, :vehicle, 'CUSTOM', :title, FALSE, :now)""")
			.param("id", id)
			.param("user", userId)
			.param("vehicle", request.vehicleId())
			.param("title", title)
			.param("now", Timestamp.from(now))
			.update();
		return new DocumentSection(id, request.vehicleId(), DocumentKind.CUSTOM, title, null, false, List.of(), now);
	}

	/** Renombra una sección propia, o cambia la fecha de caducidad y el aviso de la ITV o el seguro. */
	@Transactional
	public DocumentSection updateSection(UUID userId, UUID sectionId, SectionUpdate update) {
		SectionRow current = requireSection(userId, sectionId);
		DocumentKind kind = current.kind();
		String title = kind == DocumentKind.CUSTOM ? cleanTitle(update.title()) : null;
		LocalDate expiresOn = kind.expires() ? update.expiresOn() : null;
		boolean reminder = kind.expires() && update.reminder();
		if (expiresOn != null) {
			LocalDate today = LocalDate.now(props.timezone());
			if (expiresOn.isBefore(OLDEST_EXPIRY) || expiresOn.isAfter(today.plusYears(MAX_YEARS_AHEAD))) {
				throw AppException.badRequest("VALIDATION", "Revisa la fecha de caducidad.");
			}
		}
		if (reminder && expiresOn == null) {
			throw AppException.badRequest("VALIDATION", "Pon la fecha de caducidad para activar el aviso.");
		}
		// Con otra fecha, los avisos empiezan de cero
		boolean newDate = !Objects.equals(current.expiresOn(), expiresOn);
		jdbc.sql("""
				UPDATE document_section SET title = :title, expires_on = :expires, reminder = :reminder,
				last_reminded_on = CASE WHEN :newDate THEN NULL ELSE last_reminded_on END
				WHERE id = :id AND user_id = :user""")
			.param("title", title)
			.param("expires", expiresOn)
			.param("reminder", reminder)
			.param("newDate", newDate)
			.param("id", sectionId)
			.param("user", userId)
			.update();
		return section(userId, sectionId);
	}

	/** Borra una sección propia con sus archivos (las fijas no se borran: se vacían borrando sus archivos). */
	@Transactional
	public void deleteSection(UUID userId, UUID sectionId) {
		SectionRow section = requireSection(userId, sectionId);
		if (section.kind() != DocumentKind.CUSTOM) {
			throw AppException.badRequest("VALIDATION", "Esta sección no se puede borrar.");
		}
		jdbc.sql("DELETE FROM document_section WHERE id = :id AND user_id = :user")
			.param("id", sectionId)
			.param("user", userId)
			.update();
	}

	@Transactional
	public DocumentFile addFile(UUID userId, UUID sectionId, MultipartFile upload) {
		rateLimiter.check("documents:" + userId, UPLOADS_PER_MINUTE);
		byte[] data = read(upload);
		if (data.length == 0) {
			throw AppException.badRequest("VALIDATION", "El archivo está vacío.");
		}
		if (data.length > MAX_FILE_BYTES) {
			throw new AppException(HttpStatus.PAYLOAD_TOO_LARGE, "FILE_TOO_LARGE",
					"El archivo pesa demasiado (máximo %d MB).".formatted(MAX_FILE_BYTES / (1024 * 1024)));
		}
		String type = FileTypes.detect(data);
		if (type == null) {
			throw AppException.badRequest("UNSUPPORTED_FILE", "Solo se pueden guardar fotos (JPG, PNG o WebP) o PDF.");
		}

		users.lock(userId);
		requireSection(userId, sectionId);
		int count = jdbc.sql("SELECT count(*) FROM document_file WHERE user_id = :user")
			.param("user", userId)
			.query(Integer.class)
			.single();
		if (count >= props.limits().maxDocuments()) {
			// Sin la cifra: la app no la muestra
			throw new AppException(HttpStatus.CONFLICT, "DOCUMENT_LIMIT",
					"Ya no caben más documentos en tu cuenta. Borra alguno que no necesites para subir otro.");
		}

		UUID id = UUID.randomUUID();
		Instant now = Instant.now();
		String name = cleanFileName(upload.getOriginalFilename(), type);
		jdbc.sql("""
				INSERT INTO document_file (id, user_id, section_id, file_name, content_type, size_bytes, content, created_at)
				VALUES (:id, :user, :section, :name, :type, :size, :content, :now)""")
			.param("id", id)
			.param("user", userId)
			.param("section", sectionId)
			.param("name", name)
			.param("type", type)
			.param("size", data.length)
			.param("content", data)
			.param("now", Timestamp.from(now))
			.update();
		return new DocumentFile(id, name, type, data.length, now);
	}

	@Transactional(readOnly = true)
	public FileContent fileContent(UUID userId, UUID fileId) {
		return jdbc.sql("SELECT file_name, content_type, content FROM document_file WHERE id = :id AND user_id = :user")
			.param("id", fileId)
			.param("user", userId)
			.query((rs, row) -> new FileContent(rs.getString("file_name"), rs.getString("content_type"),
					rs.getBytes("content")))
			.optional()
			.orElseThrow(() -> AppException.notFound("Documento no encontrado"));
	}

	public void deleteFile(UUID userId, UUID fileId) {
		int deleted = jdbc.sql("DELETE FROM document_file WHERE id = :id AND user_id = :user")
			.param("id", fileId)
			.param("user", userId)
			.update();
		if (deleted == 0) {
			throw AppException.notFound("Documento no encontrado");
		}
	}

	/** Nombre limpio para guardarlo y descargarlo: sin carpetas ni caracteres raros y con la extensión de su tipo. */
	static String cleanFileName(String original, String type) {
		String name = original == null ? "" : original.replaceAll(".*[/\\\\]", "");
		name = name.replaceAll("[\\p{Cntrl}\"<>|*?:]", "").strip();
		int dot = name.lastIndexOf('.');
		String base = (dot > 0 ? name.substring(0, dot) : name).strip();
		if (base.isEmpty()) {
			base = FileTypes.PDF.equals(type) ? "documento" : "foto";
		}
		if (base.length() > 100) {
			base = base.substring(0, 100).strip();
		}
		return base + "." + FileTypes.extension(type);
	}

	static String cleanTitle(String raw) {
		String title = raw == null ? "" : raw.replaceAll("\\s+", " ").replaceAll("\\p{Cntrl}", "").strip();
		if (title.isEmpty()) {
			throw AppException.badRequest("VALIDATION", "Ponle un nombre a la sección.");
		}
		if (title.length() > MAX_TITLE) {
			throw AppException.badRequest("VALIDATION",
					"El nombre de la sección es muy largo (máximo %d letras).".formatted(MAX_TITLE));
		}
		return title;
	}

	private DocumentSection section(UUID userId, UUID sectionId) {
		List<DocumentFile> files = jdbc
			.sql("SELECT " + FILE_COLUMNS + " FROM document_file WHERE section_id = :section AND user_id = :user"
					+ " ORDER BY created_at, id")
			.param("section", sectionId)
			.param("user", userId)
			.query((rs, row) -> mapFile(rs))
			.list();
		return requireSection(userId, sectionId).withFiles(files);
	}

	private SectionRow requireSection(UUID userId, UUID sectionId) {
		return jdbc.sql("SELECT " + SECTION_COLUMNS + " FROM document_section WHERE id = :id AND user_id = :user")
			.param("id", sectionId)
			.param("user", userId)
			.query(DocumentService::mapSection)
			.optional()
			.orElseThrow(() -> AppException.notFound("Sección no encontrada"));
	}

	private static byte[] read(MultipartFile upload) {
		try {
			return upload.getBytes();
		}
		catch (IOException ex) {
			throw new UncheckedIOException(ex);
		}
	}

	private static SectionRow mapSection(ResultSet rs, int row) throws SQLException {
		return new SectionRow(rs.getObject("id", UUID.class), rs.getObject("vehicle_id", UUID.class),
				DocumentKind.valueOf(rs.getString("kind")), rs.getString("title"),
				rs.getObject("expires_on", LocalDate.class), rs.getBoolean("reminder"),
				rs.getTimestamp("created_at").toInstant());
	}

	private static DocumentFile mapFile(ResultSet rs) throws SQLException {
		return new DocumentFile(rs.getObject("id", UUID.class), rs.getString("file_name"), rs.getString("content_type"),
				rs.getInt("size_bytes"), rs.getTimestamp("created_at").toInstant());
	}

}
