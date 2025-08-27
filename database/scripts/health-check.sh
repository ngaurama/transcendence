#!/bin/bash

DB_PATH="/app/data/ft_transcendence.db"

if [ ! -f "$DB_PATH" ]; then
    echo "database file not found"
    exit 1
fi

if ! sqlite3 "$DB_PATH" "SELECT 1;" >/dev/null 2>&1; then
    echo "database not accessible"
    exit 1
fi

TABLES=("users" "game_types" "game_sessions" "tournaments")
for table in "${TABLES[@]}"; do
    if ! sqlite3 "$DB_PATH" "SELECT name FROM sqlite_master WHERE type='table' AND name='$table';" | grep -q "$table"; then
        echo "required table '$table' not found"
        exit 1
    fi
done

GAME_TYPES_COUNT=$(sqlite3 "$DB_PATH" "SELECT COUNT(*) FROM game_types;")
if [ "$GAME_TYPES_COUNT" -lt 2 ]; then
    echo "seed data not found or incomplete"
    exit 1
fi

echo "Database health check passed!!! YIPEEE"
exit 0
