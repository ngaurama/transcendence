DOCKER_COMPOSE = docker-compose
SCRIPT_ADD_LAN = ./add_lan_ip.sh

all: up

up:
	@echo "Updating LAN_IP in .env..."
	@$(SCRIPT_ADD_LAN)
	@echo "Starting containers..."
	@$(DOCKER_COMPOSE) up -d

down:
	@echo "Stopping containers..."
	@$(DOCKER_COMPOSE) down -v

reset:
	@echo "Resetting everything..."
	@$(DOCKER_COMPOSE) down -v && docker rmi $$(docker images -a -q)

logs:
	@echo "Showing logs..."
	@$(DOCKER_COMPOSE) logs -f

.PHONY: all up down reset logs
