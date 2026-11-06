# 1. Build the frontend (React + Vite).
FROM node:22-alpine AS frontend
WORKDIR /src/frontend
COPY frontend/package.json frontend/package-lock.json ./
RUN npm ci
COPY frontend/ ./
RUN npm run build

# 2. Build the Go binary with the frontend embedded.
FROM golang:1.26-alpine AS backend
WORKDIR /src/backend
COPY backend/go.mod backend/go.sum ./
RUN go mod download
COPY backend/ ./
COPY --from=frontend /src/frontend/dist ./web/dist
RUN CGO_ENABLED=0 go build -trimpath -ldflags="-s -w" -o /openday .

# 3. Small final image: just the binary.
FROM alpine:3.22
RUN adduser -D -H -u 1000 openday && mkdir /data && chown openday:openday /data
COPY --from=backend /openday /usr/local/bin/openday
USER openday
ENV OPENDAY_ADDR=:8080 \
    OPENDAY_DB=/data/openday.db
VOLUME /data
EXPOSE 8080
HEALTHCHECK --interval=30s --timeout=3s CMD wget -qO- http://localhost:8080/api/health || exit 1
CMD ["openday"]
