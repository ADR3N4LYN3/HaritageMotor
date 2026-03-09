.PHONY: build run test migrate-up migrate-down dev clean

DATABASE_URL ?= postgresql://heritage_motor:password@localhost:5432/heritage_motor?sslmode=disable
MIGRATIONS_DIR = internal/db/migrations

build:
	go build -o bin/api ./cmd/api

run: build
	./bin/api

dev:
	go run ./cmd/api

test:
	go test -v -race -timeout 60s ./...

test-integration:
	go test -v -race -timeout 120s ./internal/...

test-rls:
	go test -v -run TestRLS ./internal/db/...

test-coverage:
	go test -coverprofile=coverage.out ./...
	go tool cover -html=coverage.out -o coverage.html
	@echo "Coverage report: coverage.html"

migrate-up:
	migrate -path $(MIGRATIONS_DIR) -database "$(DATABASE_URL)" up

migrate-down:
	migrate -path $(MIGRATIONS_DIR) -database "$(DATABASE_URL)" down 1

migrate-create:
	@read -p "Migration name: " name; \
	migrate create -ext sql -dir $(MIGRATIONS_DIR) -seq $$name

clean:
	rm -rf bin/

docker-build:
	docker build -t heritage-motor .

docker-up:
	docker compose up -d

docker-down:
	docker compose down

docker-logs:
	docker compose logs -f api
