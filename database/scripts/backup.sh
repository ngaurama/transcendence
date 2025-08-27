#!/bin/bash

DB_PATH="/app/data/ft_transcendence.db"
BACKUP_DIR="/app/data/backups"
TIMESTAMP=$(date +"%Y%m%d_%H%M%S")
BACKUP_FILE="$BACKUP_DIR/transcendence_backup_$TIMESTAMP.db"

mkdir -p "$BACKUP_DIR"

echo "creating database backup..."

sqlite3 "$DB_PATH" ".backup '$BACKUP_FILE'"

if [ $? -eq 0 ]; then
    echo "backup created: $BACKUP_FILE"
    echo "Backup size: $(du -h "$BACKUP_FILE" | cut -f1)"
    
    ls -t "$BACKUP_DIR"/transcendence_backup_*.db | tail -n +6 | xargs -r rm
    echo "Old backups cleaned up"
else
    echo "bckup failed"
    exit 1
fi
