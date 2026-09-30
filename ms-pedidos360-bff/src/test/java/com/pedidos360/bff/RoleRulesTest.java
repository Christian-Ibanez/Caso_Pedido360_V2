package com.pedidos360.bff;

import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.RequestBuilder;
import org.springframework.test.web.servlet.request.MockHttpServletRequestBuilder;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.jwt;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/**
 * Reglas por rol de catalogo, reporteria y auditoria.
 * Aqui no hay micros levantados: si la regla deja pasar, el proxy falla al conectar (eso prueba que no hubo 401/403).
 */
@SpringBootTest
@AutoConfigureMockMvc
class RoleRulesTest {

	@Autowired
	private MockMvc mvc;

	@Test
	void catalogoLecturaParaTodosEdicionSoloAdmin() throws Exception {
		assertPasses(get("/api/catalog/products").with(role("Customer")));
		mvc.perform(post("/api/catalog/products").with(role("Operator")).contentType("application/json").content("{}"))
				.andExpect(status().isForbidden());
		mvc.perform(put("/api/catalog/products/1").with(role("Customer")).contentType("application/json").content("{}"))
				.andExpect(status().isForbidden());
		assertPasses(put("/api/catalog/products/1").with(role("Admin")).contentType("application/json").content("{}"));
	}

	@Test
	void movimientosDeStockNoSeExponen() throws Exception {
		mvc.perform(post("/api/catalog/products/stock/decrease").with(role("Admin")).contentType("application/json").content("{}"))
				.andExpect(status().isForbidden());
	}

	@Test
	void reportesSoloAdmin() throws Exception {
		mvc.perform(get("/api/report/kpis").with(role("Operator"))).andExpect(status().isForbidden());
		mvc.perform(get("/api/report/kpis")).andExpect(status().isUnauthorized());
		assertPasses(get("/api/report/kpis").with(role("Admin")));
	}

	@Test
	void auditoriaAdminOAuditorYSoloLectura() throws Exception {
		mvc.perform(get("/api/audit/events").with(role("Customer"))).andExpect(status().isForbidden());
		mvc.perform(delete("/api/audit/events/1").with(role("Admin"))).andExpect(status().isForbidden());
		assertPasses(get("/api/audit/events").with(role("Auditor")));
		assertPasses(get("/api/audit/events").with(role("Admin")));
	}

	private static org.springframework.test.web.servlet.request.RequestPostProcessor role(String role) {
		return jwt().jwt(j -> j.claim("preferred_username", "test@pedidos360.cl"))
				.authorities(new SimpleGrantedAuthority("ROLE_" + role));
	}

	private void assertPasses(MockHttpServletRequestBuilder request) {
		int status;
		try {
			status = mvc.perform((RequestBuilder) request).andReturn().getResponse().getStatus();
		} catch (Exception connectionRefused) {
			return;
		}
		assertThat(status).isNotIn(401, 403);
	}
}
