# syntax=docker/dockerfile:1

# grph has no server side: the graph library in src/ is bundled into the visualizer
# and runs in the browser. This image checks, tests and builds the visualizer and
# serves it with nginx. The "dev" target runs the Vite dev server instead.

# ---- dependencies
FROM node:24.22.3-alpine AS deps
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci

# ---- dev: Vite with live reload; docker compose mounts the source into /app
FROM deps AS dev
EXPOSE 5173
CMD ["npm", "run", "dev", "--", "--host", "0.0.0.0", "--port", "5173", "--strictPort"]

# ---- build: the image only builds when type checks and tests pass
FROM deps AS build
COPY . .
RUN npm run typecheck && npm test && npm run build:ui

# ---- web: the built static site
FROM nginx:1.30.6-alpine AS web
COPY docker/nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/dist-ui /usr/share/nginx/html
EXPOSE 80
