package com.mecanicai.usage;

import java.net.Inet4Address;
import java.net.Inet6Address;
import java.net.InetAddress;
import java.net.UnknownHostException;
import java.util.regex.Pattern;

/**
 * Agrupa las direcciones IP para los límites por conexión. Una IPv4 cuenta tal cual, pero con IPv6 cada cliente
 * suele tener un bloque /64 entero (millones de direcciones): se cuenta el bloque, no la dirección, para que no se
 * pueda saltar el límite cambiando de IP dentro de su propia red.
 */
public final class ClientNetwork {

	/** Solo literales IP (IPv4 o con ":"): así {@link InetAddress#getByName} nunca hace una consulta DNS. */
	private static final Pattern IP_LITERAL = Pattern.compile("\\d{1,3}(\\.\\d{1,3}){3}|[0-9a-fA-F.%]*:[0-9a-fA-F:.%]*");

	private ClientNetwork() {
	}

	/** "203.0.113.7" → "203.0.113.7"; "2001:db8:1:2:aaaa::1" → "2001:db8:1:2::/64". */
	public static String of(String remoteAddr) {
		if (remoteAddr == null || remoteAddr.isBlank() || !IP_LITERAL.matcher(remoteAddr).matches()) {
			return String.valueOf(remoteAddr);
		}
		try {
			InetAddress address = InetAddress.getByName(remoteAddr);
			// Una IPv4 escrita como IPv6 (::ffff:203.0.113.7) llega aquí ya convertida en Inet4Address
			if (address instanceof Inet4Address) {
				return address.getHostAddress();
			}
			if (address instanceof Inet6Address) {
				byte[] bytes = address.getAddress();
				StringBuilder prefix = new StringBuilder();
				for (int i = 0; i < 8; i += 2) {
					prefix.append(Integer.toHexString(((bytes[i] & 0xff) << 8) | (bytes[i + 1] & 0xff))).append(':');
				}
				return prefix.append(":/64").toString();
			}
		}
		catch (UnknownHostException ex) {
			// No era una IP válida: se usa tal cual
		}
		return remoteAddr;
	}

}
