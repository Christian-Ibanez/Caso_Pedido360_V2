package com.pedidos360.catalog.config;

import com.pedidos360.catalog.model.Product;
import com.pedidos360.catalog.repository.ProductRepository;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;

import java.util.List;
import java.util.Set;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.*;

class SampleDataLoaderTest {

	@Test
	@SuppressWarnings("unchecked")
	void agregaSoloLosSkuQueFaltan() {
		ProductRepository repository = mock(ProductRepository.class);
		Set<String> existentes = Set.of("PAN-001", "PAN-002", "PAS-001", "PAS-002", "CAF-001", "CAF-002", "SAN-001");
		when(repository.existsBySku(anyString())).thenAnswer(inv -> existentes.contains(inv.getArgument(0, String.class)));

		int agregados = SampleDataLoader.seedMissing(repository);

		ArgumentCaptor<List<Product>> captor = ArgumentCaptor.forClass(List.class);
		verify(repository).saveAll(captor.capture());
		List<String> skus = captor.getValue().stream().map(Product::getSku).toList();
		assertThat(agregados).isEqualTo(SampleDataLoader.SAMPLE.size() - existentes.size());
		assertThat(skus).doesNotContainAnyElementsOf(existentes).contains("PAN-007", "SAN-003", "BEB-004");
		assertThat(captor.getValue()).allSatisfy(p -> assertThat(p.getActive()).isTrue());
	}

	@Test
	void noGuardaNadaSiYaEstaTodo() {
		ProductRepository repository = mock(ProductRepository.class);
		when(repository.existsBySku(anyString())).thenReturn(true);

		assertThat(SampleDataLoader.seedMissing(repository)).isZero();
		verify(repository, never()).saveAll(any());
	}
}
