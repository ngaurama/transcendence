-- -- ============================================================================
-- -- GAME TYPES
-- -- ============================================================================

-- INSERT INTO game_types (name, display_name, max_players, min_players, supports_ai, has_powerups) VALUES
--     ('pong', 'Pong', 2, 2, TRUE, TRUE);

-- PRAGMA optimize;
-- PRAGMA analysis_limit = 1000;
-- PRAGMA cache_size = -64000; -- 64MB cache

-- -- ============================================================================
-- -- INITIAL DATA VALIDATION
-- -- ============================================================================

-- -- Verify game types were inserted correctly
-- SELECT 'Game Types:', COUNT(*) as count FROM game_types;

-- -- Show the structure we created
-- SELECT 'Tables created:', COUNT(*) as count FROM sqlite_master WHERE type='table';
-- SELECT 'Indexes created:', COUNT(*) as count FROM sqlite_master WHERE type='index';
-- SELECT 'Triggers created:', COUNT(*) as count FROM sqlite_master WHERE type='trigger';
