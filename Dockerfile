# ---- build ----
FROM node:22-slim AS build
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY . .
RUN npm run build

# ---- run ----
FROM node:22-slim
WORKDIR /app
ENV NODE_ENV=production \
    PORT=3000 \
    HOSTNAME=0.0.0.0 \
    DATABASE_PATH=/data/app.db \
    NODE_OPTIONS=--disable-warning=ExperimentalWarning
COPY --from=build /app/.next/standalone ./
COPY --from=build /app/.next/static ./.next/static
COPY --from=build /app/public* ./public/
# Your data lives in /data. Attach a persistent volume/disk there.
# (Runs as root because most hosts mount volumes owned by root.)
RUN mkdir -p /data
EXPOSE 3000
CMD ["node", "server.js"]
