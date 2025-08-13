FROM golang:1.24.6-alpine AS builder

WORKDIR /app

# Copy go mod and sum files
COPY go.mod go.sum ./

# Download dependencies
RUN go mod download

# Copy the source code
COPY . .

# Build the application with disabled CGO
RUN CGO_ENABLED=0 go build -ldflags="-s -w" -o gnam .

# Use alpine instead of scratch to support filesystem operations
FROM alpine:3.19

# Install CA certificates for HTTPS support
RUN apk --no-cache add ca-certificates

# Create directory for persistent data
RUN mkdir -p /data

# Copy binary from builder stage
COPY --from=builder /app/gnam /usr/local/bin/gnam
# Copy static files needed for the web UI
COPY --from=builder /app/static /static

# Set working directory for data persistence
WORKDIR /data

# Expose the port the service runs on
EXPOSE 8080

# Define volume for database persistence
VOLUME ["/data"]

# Run the binary
ENTRYPOINT ["gnam"]