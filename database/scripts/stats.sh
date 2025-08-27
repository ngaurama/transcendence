#!/bin/bash

DB_PATH="/app/data/ft_transcendence.db"

if [ ! -f "$DB_PATH" ]; then
    echo "database not found"
    exit 1
fi

echo "ft_transcendence Database Statistics"
echo "========================================"
echo

echo "database Information:"
echo "   path: $DB_PATH"
echo "   size: $(du -h "$DB_PATH" | cut -f1)"
echo "   last modified: $(stat -c %y "$DB_PATH" | cut -d. -f1)"
echo

echo "  schema Statistics:"
echo "   tables: $(sqlite3 "$DB_PATH" "SELECT COUNT(*) FROM sqlite_master WHERE type='table';")"
echo "   indexes: $(sqlite3 "$DB_PATH" "SELECT COUNT(*) FROM sqlite_master WHERE type='index';")"
echo "   triggers: $(sqlite3 "$DB_PATH" "SELECT COUNT(*) FROM sqlite_master WHERE type='trigger';")"
echo

echo " Data Statistics:"
echo "   Users: $(sqlite3 "$DB_PATH" "SELECT COUNT(*) FROM users;" 2>/dev/null || echo "0")"
echo "   Game Sessions: $(sqlite3 "$DB_PATH" "SELECT COUNT(*) FROM game_sessions;" 2>/dev/null || echo "0")"
echo "   Tournaments: $(sqlite3 "$DB_PATH" "SELECT COUNT(*) FROM tournaments;" 2>/dev/null || echo "0")"
echo "   Chat Messages: $(sqlite3 "$DB_PATH" "SELECT COUNT(*) FROM chat_messages;" 2>/dev/null || echo "0")"
echo "   Friendships: $(sqlite3 "$DB_PATH" "SELECT COUNT(*) FROM friendships;" 2>/dev/null || echo "0")"
echo

echo "game Types:"
sqlite3 "$DB_PATH" "SELECT '   ' || display_name || ': ' || 
    (SELECT COUNT(*) FROM game_sessions WHERE game_type_id = gt.id) || ' games played'
    FROM game_types gt;" 2>/dev/null

echo

RECENT_GAMES=$(sqlite3 "$DB_PATH" "SELECT COUNT(*) FROM game_sessions WHERE created_at > datetime('now', '-24 hours');" 2>/dev/null || echo "0")
if [ "$RECENT_GAMES" -gt 0 ]; then
    echo "recent Activity (last 24h):"
    echo "   Games played: $RECENT_GAMES"
fi

echo
echo "statistics complete!"