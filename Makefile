DOCKER_COMPOSE = docker-compose
SCRIPT_ADD_LAN = ./add_lan_ip.sh
SCRIPT_ADD_LAN_HOST = ./change_host_to_lan_ip.sh
SCRIPT_ADD_LOCAL_HOST = ./change_host_to_localhost.sh


all: up

up-dev:
	@echo "Updating HOST in .env..."
	@$(SCRIPT_ADD_LOCAL_HOST)
	@$(SCRIPT_ADD_LAN)
	@echo "Starting containers..."
	@$(DOCKER_COMPOSE) up -d

up:
	@echo "Updating HOST in .env..."
	@$(SCRIPT_ADD_LAN)
	@$(SCRIPT_ADD_LOCAL_HOST)
# 	@$(SCRIPT_ADD_LAN_HOST) # Use this line instead if you want to test with LAN IP
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
