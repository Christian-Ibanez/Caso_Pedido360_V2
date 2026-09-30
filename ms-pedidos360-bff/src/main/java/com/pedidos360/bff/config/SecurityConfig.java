package com.pedidos360.bff.config;

import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.http.HttpMethod;
import org.springframework.security.config.Customizer;
import org.springframework.security.config.annotation.web.builders.HttpSecurity;
import org.springframework.security.config.http.SessionCreationPolicy;
import org.springframework.security.oauth2.server.resource.authentication.JwtAuthenticationConverter;
import org.springframework.security.oauth2.server.resource.authentication.JwtGrantedAuthoritiesConverter;
import org.springframework.security.web.SecurityFilterChain;

@Configuration
public class SecurityConfig {

    private static final String SCOPE = "SCOPE_access_as_user";
    // App roles de Entra ID (claim "roles" -> ROLE_Admin, ROLE_Auditor)
    private static final String ADMIN = "Admin";
    private static final String AUDITOR = "Auditor";

    @Bean
    SecurityFilterChain filterChain(HttpSecurity http) throws Exception {
        http
            .cors(Customizer.withDefaults())
            .csrf(csrf -> csrf.disable())
            .sessionManagement(session -> session.sessionCreationPolicy(SessionCreationPolicy.STATELESS))
            .authorizeHttpRequests(auth -> auth
                // Preflight CORS del navegador
                .requestMatchers(HttpMethod.OPTIONS, "/**").permitAll()
                // Permitir cualquier usuario autenticado
                .requestMatchers(HttpMethod.GET, "/api/data").authenticated()
                .requestMatchers("/api/orders", "/api/orders/**").authenticated()
                // Catalogo: movimientos de stock solo los hace ms-orders por la red interna
                .requestMatchers("/api/catalog/products/stock/**").denyAll()
                // Catalogo: todos ven productos (el cliente los necesita para pedir); solo Admin los edita
                .requestMatchers(HttpMethod.GET, "/api/catalog/**").authenticated()
                .requestMatchers(HttpMethod.POST, "/api/catalog/**").hasRole(ADMIN)
                .requestMatchers(HttpMethod.PUT, "/api/catalog/**").hasRole(ADMIN)
                .requestMatchers(HttpMethod.DELETE, "/api/catalog/**").hasRole(ADMIN)
                // Reporteria: solo Admin, solo lectura
                .requestMatchers(HttpMethod.GET, "/api/report/**").hasRole(ADMIN)
                // Auditoria: Admin o Auditor, solo lectura
                .requestMatchers(HttpMethod.GET, "/api/audit/**").hasAnyRole(ADMIN, AUDITOR)
                // Todo lo demás se rechaza
                .anyRequest().denyAll()
            )
            // CAMBIO: En lugar de Customizer.withDefaults(), usamos nuestro convertidor de roles
            .oauth2ResourceServer(oauth2 -> oauth2
                .jwt(jwt -> jwt.jwtAuthenticationConverter(jwtAuthenticationConverter()))
            );

        return http.build();
    }

    // MÉTODO NUEVO: Mapea la propiedad "roles" del JWT a GrantedAuthorities de Spring Security
    private JwtAuthenticationConverter jwtAuthenticationConverter() {
        JwtGrantedAuthoritiesConverter authoritiesConverter = new JwtGrantedAuthoritiesConverter();
        authoritiesConverter.setAuthoritiesClaimName("roles");
        authoritiesConverter.setAuthorityPrefix("ROLE_");

        JwtAuthenticationConverter jwtConverter = new JwtAuthenticationConverter();
        jwtConverter.setJwtGrantedAuthoritiesConverter(authoritiesConverter);
        return jwtConverter;
    }
}