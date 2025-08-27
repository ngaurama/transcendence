#!/bin/bash
set -e

DB_PATH="/app/data/ft_transcendence.db"
INIT_FLAG="/app/data/.initialized"

echo "initializing ft_transcendence database..."

if [ -f "$INIT_FLAG" ] && [ -f "$DB_PATH" ]; then
    echo "database already initialized, skipping..."
    exec "$@"
fi

echo "ceating new database..."

sqlite3 "$DB_PATH" < /docker-entrypoint-initdb.d/schema.sql

if [ $? -eq 0 ]; then
    echo "schema created successfully"
else
    echo "schema creation failed"
    exit 1
fi

echo "inserting seed data..."
sqlite3 "$DB_PATH" < /docker-entrypoint-initdb.d/seed.sql

if [ $? -eq 0 ]; then
    echo "seed data inserted successfully"
else
    echo "seed data insertion failed"
    exit 1
fi

# made this for migration, even though ik we won't be technically needing it in this project, just change the schema bro
if [ -d "/docker-entrypoint-initdb.d/migrations" ]; then
    echo "running migrations..."
    for migration in /docker-entrypoint-initdb.d/migrations/*.sql; do
        if [ -f "$migration" ]; then
            echo "running migration: $(basename "$migration")"
            sqlite3 "$DB_PATH" < "$migration"
        fi
    done
fi

chmod 664 "$DB_PATH"
chown -R 1000:1000 /app/data

touch "$INIT_FLAG"
echo "$(date)" > "$INIT_FLAG"

echo "verifying database integrity..."
sqlite3 "$DB_PATH" "PRAGMA integrity_check;" | head -1

echo "database initialization complete!"
echo "   database path: $DB_PATH"
echo "   database size: $(du -h "$DB_PATH" | cut -f1)"
echo "   tables: $(sqlite3 "$DB_PATH" "SELECT COUNT(*) FROM sqlite_master WHERE type='table';")"
echo "   indexes: $(sqlite3 "$DB_PATH" "SELECT COUNT(*) FROM sqlite_master WHERE type='index';")"

exec "$@"
