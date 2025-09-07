DOCKER_COMPOSE = docker-compose -f docker-compose.dev.yml
SCRIPT_PROD = ./add_host.sh
SCRIPT_DEV = ./remove_host.sh

up-dev:
	@touch .env.generated
	@echo "Updating HOST in .env..."
	@$(SCRIPT_DEV)
	@echo "Starting containers..."
	@$(DOCKER_COMPOSE) up -d

up-prod:
	@touch .env.generated
	@echo "Updating HOST in .env..."
	@$(SCRIPT_PROD)
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

addhost:
	@echo "Updating .env with current IP..."
	@chmod +x ./add_host.sh
	@./add_host.sh

.PHONY: help up down restart reset logs ps rebuild addhost
