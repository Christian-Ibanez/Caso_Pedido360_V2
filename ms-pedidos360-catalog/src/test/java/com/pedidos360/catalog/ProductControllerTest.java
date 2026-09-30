package com.pedidos360.catalog;

import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.MockMvc;

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

@SpringBootTest(properties = "app.seed.enabled=false")
@AutoConfigureMockMvc
class ProductControllerTest {

	@Autowired
	MockMvc mvc;

	@Test
	void crudYReglaDeStock() throws Exception {
		String body = mvc.perform(post("/api/catalog/products").contentType(MediaType.APPLICATION_JSON).content("""
						{"sku":"PAN-900","name":"Pan amasado","category":"Panaderia","price":2200,"stock":5}
						"""))
				.andExpect(status().isCreated())
				.andExpect(jsonPath("$.active").value(true))
				.andReturn().getResponse().getContentAsString();
		long id = Long.parseLong(body.replaceAll(".*\"id\":(\\d+).*", "$1"));

		// SKU duplicado
		mvc.perform(post("/api/catalog/products").contentType(MediaType.APPLICATION_JSON).content("""
						{"sku":"PAN-900","name":"Otro","price":1,"stock":1}
						"""))
				.andExpect(status().isConflict());

		// PUT parcial: solo precio
		mvc.perform(put("/api/catalog/products/" + id).contentType(MediaType.APPLICATION_JSON).content("{\"price\":2500}"))
				.andExpect(status().isOk())
				.andExpect(jsonPath("$.price").value(2500))
				.andExpect(jsonPath("$.stock").value(5));

		// Aceptar pedido descuenta stock; si no alcanza es 409 y no descuenta nada
		stock("decrease", id, 3).andExpect(status().isOk()).andExpect(jsonPath("$[0].stock").value(2));
		stock("decrease", id, 3).andExpect(status().isConflict());
		mvc.perform(get("/api/catalog/products/" + id)).andExpect(jsonPath("$.stock").value(2));

		// Cancelar un pedido aceptado repone stock
		stock("increase", id, 3).andExpect(status().isOk()).andExpect(jsonPath("$[0].stock").value(5));

		mvc.perform(get("/api/catalog/products").param("q", "amasado"))
				.andExpect(status().isOk())
				.andExpect(jsonPath("$.length()").value(1));

		mvc.perform(delete("/api/catalog/products/" + id)).andExpect(status().isNoContent());
		mvc.perform(get("/api/catalog/products/" + id)).andExpect(status().isNotFound());
	}

	@Test
	void productoInvalidoEs400() throws Exception {
		mvc.perform(post("/api/catalog/products").contentType(MediaType.APPLICATION_JSON)
						.content("{\"sku\":\"\",\"name\":\"X\",\"price\":-1,\"stock\":1}"))
				.andExpect(status().isBadRequest());
	}

	private org.springframework.test.web.servlet.ResultActions stock(String op, long id, int qty) throws Exception {
		return mvc.perform(post("/api/catalog/products/stock/" + op).contentType(MediaType.APPLICATION_JSON)
				.content("{\"orderId\":1,\"items\":[{\"productId\":" + id + ",\"quantity\":" + qty + "}]}"));
	}
}
