package com.mecanicai.usage;

import static org.assertj.core.api.Assertions.assertThat;

import org.junit.jupiter.api.Test;

class ClientNetworkTest {

	@Test
	void anIpv4CountsOnItsOwn() {
		assertThat(ClientNetwork.of("203.0.113.7")).isEqualTo("203.0.113.7");
	}

	@Test
	void ipv6AddressesOfTheSameNetworkShareTheirSlash64() {
		String one = ClientNetwork.of("2001:db8:1:2:aaaa:bbbb:cccc:1");
		String other = ClientNetwork.of("2001:0db8:0001:0002::ffff");
		assertThat(one).isEqualTo("2001:db8:1:2::/64").isEqualTo(other);
		assertThat(ClientNetwork.of("2001:db8:1:3::1")).isNotEqualTo(one);
	}

	@Test
	void anIpv4WrittenAsIpv6IsTheIpv4() {
		assertThat(ClientNetwork.of("::ffff:203.0.113.7")).isEqualTo("203.0.113.7");
	}

	@Test
	void somethingThatIsNotAnIpIsLeftAsIsWithoutLookingItUp() {
		assertThat(ClientNetwork.of("dead")).isEqualTo("dead");
		assertThat(ClientNetwork.of("example.com")).isEqualTo("example.com");
		assertThat(ClientNetwork.of(null)).isEqualTo("null");
	}

}
