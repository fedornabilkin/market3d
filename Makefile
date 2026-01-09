.PHONY: build up down logs restart clean help

# Default target
help:
	@echo "Available commands:"
	@echo "  make build    - Build all Docker images"
	@echo "  make up       - Start all containers"
	@echo "  make down     - Stop and remove all containers"
	@echo "  make logs     - View logs from all containers"
	@echo "  make restart  - Restart all containers"
	@echo "  make clean    - Stop, remove containers and images"

# Build all images
build:
	docker-compose build

# Start containers
up:
	docker-compose up -d

# Stop and remove containers
down:
	docker-compose down

# View logs
logs:
	docker-compose logs -f

# Restart containers
restart:
	docker-compose restart

# Clean up: stop, remove containers and images
clean:
	docker-compose down -v --rmi all
