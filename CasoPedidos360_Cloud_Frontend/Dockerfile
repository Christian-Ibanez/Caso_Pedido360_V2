# Etapa 1: Construcción (Build)
FROM node:20-alpine AS build

# Establecer el directorio de trabajo
WORKDIR /app

# Copiar los archivos de dependencias
COPY package*.json ./

# Instalar las dependencias
RUN npm install

# Copiar el resto del código del proyecto
COPY . .

# Construir la aplicación para producción
RUN npm run build

# Etapa 2: Servidor Web (Nginx)
FROM nginx:alpine

# Copiar los archivos estáticos generados por Vite en la etapa anterior
COPY --from=build /app/dist /usr/share/nginx/html

# Sobrescribir la configuración por defecto de Nginx para soportar Single Page Applications (SPA)
RUN echo 'server { \
    listen       80; \
    listen  [::]:80; \
    server_name  localhost; \
    \
    location / { \
        root   /usr/share/nginx/html; \
        index  index.html index.htm; \
        # Redirigir todas las peticiones no encontradas al index.html para que el enrutador de React (o MSAL) funcione \
        try_files $uri $uri/ /index.html; \
    } \
    \
    error_page   500 502 503 504  /50x.html; \
    location = /50x.html { \
        root   /usr/share/nginx/html; \
    } \
}' > /etc/nginx/conf.d/default.conf

# Exponer el puerto 80 dentro del contenedor
EXPOSE 80

# Comando para iniciar Nginx
CMD ["nginx", "-g", "daemon off;"]
