# Stage 1: Build Frontend
FROM node:22-alpine AS build-stage
WORKDIR /app
COPY package.json pnpm-lock.yaml* ./
RUN npm install -g pnpm && pnpm install
COPY . .
# Set production env for Vite
ENV VITE_ORDERS_API_BASE_URL=/api
ENV VITE_ORDERS_API_V1_URL=/api/v1
RUN pnpm build

# Stage 2: Production with Caddy
FROM caddy:2-alpine
WORKDIR /usr/share/caddy
COPY --from=build-stage /app/dist .
COPY Caddyfile /etc/caddy/Caddyfile
EXPOSE 80 443
