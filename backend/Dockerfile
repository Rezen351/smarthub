FROM golang:1.23-alpine AS builder
WORKDIR /src
RUN apk add --no-cache git
COPY go.mod go.sum* ./
RUN go mod download
COPY . .
RUN CGO_ENABLED=0 go build -trimpath -ldflags="-s -w" -o /out/smarthub ./cmd/server

FROM alpine:3.20
WORKDIR /app
RUN addgroup -S app && adduser -S app -G app
COPY --from=builder /out/smarthub /app/smarthub
COPY --from=builder /src/migrations /app/migrations
USER app
EXPOSE 3000
ENTRYPOINT ["/app/smarthub"]
