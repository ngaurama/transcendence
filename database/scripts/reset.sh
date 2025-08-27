#!/bin/bash

DB_PATH="/app/data/ft_transcendence.db"
INIT_FLAG="/app/data/.initialized"

echo "WARNING: This will completely reset the database!"
read -p "Are you sure? (y/N): " -n 1 -r
echo
if [[ ! $REPLY =~ ^[Yy]$ ]]; then
    echo "database reset cancelled"
    exit 1
fi

/app/scripts/backup.sh

echo "removing existing database..."
rm -f "$DB_PATH" "$INIT_FLAG"

echo "recreating database..."
sqlite3 "$DB_PATH" < /docker-entrypoint-initdb.d/schema.sql
sqlite3 "$DB_PATH" < /docker-entrypoint-initdb.d/seed.sql

touch "$INIT_FLAG"
echo "$(date)" > "$INIT_FLAG"

echo "fatabase reset complete!"
