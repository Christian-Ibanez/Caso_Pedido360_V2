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
                // Permitir cualquier usuario autenticado con el scope de la API
                .requestMatchers(HttpMethod.GET, "/api/data").hasAuthority(SCOPE)
                .requestMatchers("/api/orders", "/api/orders/**").hasAuthority(SCOPE)
                // Campana de notificaciones: cada usuario ve las suyas (el BFF agrega correo y roles del JWT)
                .requestMatchers("/api/notifications", "/api/notifications/**").hasAuthority(SCOPE)
                // Catalogo: movimientos de stock solo los hace ms-orders por la red interna
                .requestMatchers("/api/catalog/products/stock/**").denyAll()
                // Catalogo: todos ven productos (el cliente los necesita para pedir); solo Admin los edita
                .requestMatchers(HttpMethod.GET, "/api/catalog", "/api/catalog/**").authenticated()
                .requestMatchers(HttpMethod.POST, "/api/catalog", "/api/catalog/**").hasRole(ADMIN)
                .requestMatchers(HttpMethod.PUT, "/api/catalog", "/api/catalog/**").hasRole(ADMIN)
                .requestMatchers(HttpMethod.DELETE, "/api/catalog", "/api/catalog/**").hasRole(ADMIN)
                // Reporteria: solo Admin, solo lectura
                .requestMatchers(HttpMethod.GET, "/api/report", "/api/report/**").hasRole(ADMIN)
                // Administrador de RabbitMQ (ms-mqadmin): crear y eliminar colas, exchanges y bindings, solo Admin
                .requestMatchers("/api/mq/**").hasRole(ADMIN)
                // Auditoria: Admin o Auditor, solo lectura
                .requestMatchers(HttpMethod.GET, "/api/audit", "/api/audit/**").hasAnyRole(ADMIN, AUDITOR)
                // Todo lo demás se rechaza
                .anyRequest().denyAll()
            )
            // En lugar de Customizer.withDefaults(), usamos nuestro convertidor que incluye roles y scopes
            .oauth2ResourceServer(oauth2 -> oauth2
                .jwt(jwt -> jwt.jwtAuthenticationConverter(jwtAuthenticationConverter()))
            );

        return http.build();
    }

    // Mapea tanto "scp/scope" a SCOPE_ como "roles" a ROLE_
    private JwtAuthenticationConverter jwtAuthenticationConverter() {
        JwtGrantedAuthoritiesConverter defaultScopesConverter = new JwtGrantedAuthoritiesConverter();
        JwtGrantedAuthoritiesConverter rolesConverter = new JwtGrantedAuthoritiesConverter();
        authoritiesConverterRoleConfig(rolesConverter);

        JwtAuthenticationConverter jwtConverter = new JwtAuthenticationConverter();
        jwtConverter.setJwtGrantedAuthoritiesConverter(jwt -> {
            java.util.Collection<org.springframework.security.core.GrantedAuthority> authorities =
                    new java.util.ArrayList<>(defaultScopesConverter.convert(jwt));
            authorities.addAll(rolesConverter.convert(jwt));
            return authorities;
        });
        return jwtConverter;
    }

    private void authoritiesConverterRoleConfig(JwtGrantedAuthoritiesConverter converter) {
        converter.setAuthoritiesClaimName("roles");
        converter.setAuthorityPrefix("ROLE_");
    }
}