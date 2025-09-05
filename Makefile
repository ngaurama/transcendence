DOCKER_COMPOSE = docker-compose -f docker-compose.dev.yml
SCRIPT = ./add_host.sh

.DEFAULT_GOAL := help

help:
	@echo "Usage:"
	@echo "  make up        -> Run add_host.sh & docker-compose up -d"
	@echo "  make down      -> docker-compose down"
	@echo "  make restart   -> Restart all services"
	@echo "  make logs      -> Tail logs of all containers"
	@echo "  make rebuild   -> Rebuild all containers"
	@echo "  make ps        -> Show running containers"

up:
	@echo "Updating HOST in .env..."
	@$(SCRIPT)
	@echo "Starting containers..."
	@$(DOCKER_COMPOSE) up -d

down:
	@echo "Stopping containers..."
	@$(DOCKER_COMPOSE) down -v

restart:
	@echo "Restarting containers..."
	@$(MAKE) down
	@$(MAKE) up

reset:
	@echo "Resetting everything and starting again..."
	@$(DOCKER_COMPOSE) down --rmi all -v
	@$(MAKE) up

logs:
	@echo "Showing logs..."
	@$(DOCKER_COMPOSE) logs -f

rebuild:
	@echo "Rebuilding containers..."
	@$(DOCKER_COMPOSE) up -d --build

ps:
	@echo "Running containers:"
	@$(DOCKER_COMPOSE) ps

addhost:
	@echo "Updating .env with current IP..."
	@chmod +x ./add_host.sh
	@./add_host.sh

.PHONY: help up down restart reset logs ps rebuild addhost
