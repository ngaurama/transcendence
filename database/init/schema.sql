PRAGMA foreign_keys = ON;
PRAGMA journal_mode = WAL;
PRAGMA synchronous = NORMAL;

-- ============================================================================
-- 1. USERS & AUTHENTICATION
-- ============================================================================

CREATE TABLE users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    username VARCHAR(50) UNIQUE,
    email VARCHAR(255) UNIQUE,
    password_hash VARCHAR(255), -- nullable for OAuth-only and guest users
    display_name VARCHAR(100) NOT NULL,
    avatar_url VARCHAR(500) DEFAULT '/avatars/default.png',
    is_guest BOOLEAN DEFAULT FALSE,
    
    -- OAuth integration
    google_id VARCHAR(255) UNIQUE,
    github_id VARCHAR(255) UNIQUE,
    oauth_provider VARCHAR(50) DEFAULT 'local', -- 'github', 'google', 'local'
    
    -- 2FA
    totp_secret VARCHAR(255), -- encrypted TOTP secret
    totp_enabled BOOLEAN DEFAULT FALSE,
    backup_codes TEXT, -- JSON array of backup codes
    
    -- Account status
    is_active BOOLEAN DEFAULT TRUE,
    is_verified BOOLEAN DEFAULT FALSE,
    email_verified_at DATETIME,
    
    -- GDPR compliance
    data_anonymized BOOLEAN DEFAULT FALSE,
    deletion_requested_at DATETIME,
    anonymization_requested_at DATETIME,
    
    -- Timestamps
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    last_login_at DATETIME,
    
    -- Constraints
    CHECK (
        (is_guest = TRUE AND username IS NULL AND email IS NULL) OR 
        (is_guest = FALSE AND username IS NOT NULL AND email IS NOT NULL)
    ),
    CHECK (
        (is_guest = TRUE) OR 
        (is_guest = FALSE AND username != '' AND length(username) >= 3)
    ),
    CHECK (
        (is_guest = TRUE) OR 
        (is_guest = FALSE AND email != '' AND email LIKE '%@%')
    ),
    CHECK (display_name != '' AND length(display_name) >= 2),
    CHECK (oauth_provider IN ('local', 'google', 'github'))
);

CREATE TABLE user_sessions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    refresh_token VARCHAR(255) UNIQUE NOT NULL,
    expires_at DATETIME NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    last_used_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    ip_address VARCHAR(45), -- IPv6 compatible
    user_agent TEXT,
    
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE TABLE password_reset_tokens (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    token VARCHAR(255) UNIQUE NOT NULL,
    expires_at DATETIME NOT NULL,
    used_at DATETIME,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE TABLE email_verification_tokens (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    token VARCHAR(255) UNIQUE NOT NULL,
    expires_at DATETIME NOT NULL,
    used_at DATETIME,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- ============================================================================
-- 2. FRIENDS & SOCIAL SYSTEM
-- ============================================================================

CREATE TABLE friendships (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    requester_id INTEGER NOT NULL,
    addressee_id INTEGER NOT NULL,
    status VARCHAR(20) DEFAULT 'pending', -- 'pending', 'accepted', 'blocked'
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    
    FOREIGN KEY (requester_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (addressee_id) REFERENCES users(id) ON DELETE CASCADE,
    
    UNIQUE(requester_id, addressee_id),
    CHECK (requester_id != addressee_id),
    CHECK (status IN ('pending', 'accepted', 'blocked'))
);

CREATE TABLE user_presence (
    user_id INTEGER PRIMARY KEY,
    status VARCHAR(20) DEFAULT 'offline', -- 'online', 'playing', 'away', 'offline'
    current_game_id INTEGER,
    current_activity VARCHAR(100), -- 'Playing Pong', etc.
    last_seen_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    CHECK (status IN ('online', 'playing', 'away', 'offline'))
);

-- ============================================================================
-- 3. GAME SYSTEM FOUNDATION
-- ============================================================================

CREATE TABLE game_types (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name VARCHAR(50) UNIQUE NOT NULL, -- 'pong', 'any other games if we're implementing that'
    display_name VARCHAR(100) NOT NULL,
    max_players INTEGER NOT NULL DEFAULT 2,
    min_players INTEGER NOT NULL DEFAULT 2,
    supports_ai BOOLEAN DEFAULT FALSE,
    has_powerups BOOLEAN DEFAULT FALSE,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    
    CHECK (max_players >= min_players),
    CHECK (min_players >= 2)
);

CREATE TABLE game_sessions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    game_type_id INTEGER NOT NULL,
    tournament_id INTEGER, -- nullable for casual games
    
    -- Game state
    status VARCHAR(20) DEFAULT 'waiting', -- 'waiting', 'in_progress', 'completed', 'abandoned'
    winner_id INTEGER, -- nullable for draws/abandoned games
    result VARCHAR(20), -- 'win', 'draw', 'abandoned'
    
    -- Timing
    started_at DATETIME,
    ended_at DATETIME,
    duration_seconds INTEGER, -- calculated duration
    
    -- Game-specific settings (JSON)
    game_settings TEXT DEFAULT '{}', -- JSON: time controls, powerups, difficulty, etc.
    max_players INTEGER DEFAULT 2,
    
    -- Timestamps
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    
    FOREIGN KEY (game_type_id) REFERENCES game_types(id),
    FOREIGN KEY (tournament_id) REFERENCES tournaments(id) ON DELETE SET NULL,
    FOREIGN KEY (winner_id) REFERENCES users(id) ON DELETE SET NULL,
    
    CHECK (status IN ('waiting', 'in_progress', 'completed', 'abandoned')),
    CHECK (result IN ('win', 'draw', 'abandoned') OR result IS NULL)
);

CREATE TABLE game_participants (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    game_session_id INTEGER NOT NULL,
    user_id INTEGER, -- nullable for AI players
    player_number INTEGER NOT NULL, -- 1, 2 (no more multiplayer)
    is_ai BOOLEAN DEFAULT FALSE,
    ai_difficulty INTEGER, -- 1-10 for Pong
    ai_engine VARCHAR(50), -- 'custom_pong_ai', etc.
    
    -- Player-specific stats for this game
    score INTEGER DEFAULT 0,
    final_position INTEGER, -- 1st or 2nd place
    
    -- Participation status
    joined_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    left_at DATETIME, -- for disconnections
    
    FOREIGN KEY (game_session_id) REFERENCES game_sessions(id) ON DELETE CASCADE,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL,
    
    -- CHECK (
    --     (user_id IS NOT NULL AND is_ai = FALSE) OR 
    --     (user_id IS NULL AND is_ai = TRUE) OR
    --     (user_id IS NOT NULL AND is_ai = TRUE)
    -- )
    UNIQUE(game_session_id, player_number),
    CHECK (player_number IN (1, 2)),
    CHECK (ai_difficulty IS NULL OR (ai_difficulty >= 1 AND ai_difficulty <= 20)),
    CHECK (NOT (user_id IS NULL AND is_ai = FALSE)), -- AI players must have is_ai = TRUE
    CHECK (NOT (user_id IS NOT NULL AND is_ai = TRUE)) -- Human players must have is_ai = FALSE
);

-- ============================================================================
-- 4. TOURNAMENT SYSTEM (EVEN NUMBERS, MAX 64)
-- ============================================================================

CREATE TABLE tournaments (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name VARCHAR(200) NOT NULL,
    game_type_id INTEGER NOT NULL,
    creator_id INTEGER NOT NULL,
    
    -- Tournament structure (even numbers only, max 64)
    type VARCHAR(50) DEFAULT 'single_elimination', -- only single_elimination for now
    max_participants INTEGER DEFAULT 8,
    current_participants INTEGER DEFAULT 0,
    
    -- Tournament state
    status VARCHAR(20) DEFAULT 'registration', -- 'registration', 'in_progress', 'completed', 'cancelled'
    winner_id INTEGER,
    current_round INTEGER DEFAULT 1,
    total_rounds INTEGER, -- calculated based on participants
    
    -- Tournament settings (JSON)
    tournament_settings TEXT DEFAULT '{}', -- JSON for game-specific tournament rules
    
    -- Scheduling
    registration_starts_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    registration_ends_at DATETIME,
    starts_at DATETIME,
    ends_at DATETIME,
    
    -- Timestamps
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    
    FOREIGN KEY (game_type_id) REFERENCES game_types(id),
    FOREIGN KEY (creator_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (winner_id) REFERENCES users(id) ON DELETE SET NULL,
    
    CHECK (status IN ('registration', 'in_progress', 'completed', 'cancelled')),
    CHECK (max_participants >= 4 AND max_participants <= 64),
    CHECK (max_participants % 2 = 0), -- Even numbers only
    CHECK (current_participants >= 0),
    CHECK (current_participants <= max_participants),
    CHECK (current_round >= 1)
);

CREATE TABLE tournament_participants (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    tournament_id INTEGER NOT NULL,
    user_id INTEGER NOT NULL,
    
    -- Bracket position
    seed_number INTEGER,
    bracket_position INTEGER, -- Position in bracket (1 to max_participants)
    current_round INTEGER DEFAULT 1,
    is_eliminated BOOLEAN DEFAULT FALSE,
    eliminated_in_round INTEGER,
    final_position INTEGER, -- 1st, 2nd, 3rd, etc.
    
    -- Registration
    registered_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    
    FOREIGN KEY (tournament_id) REFERENCES tournaments(id) ON DELETE CASCADE,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    
    UNIQUE(tournament_id, user_id),
    UNIQUE(tournament_id, bracket_position),
    CHECK (current_round >= 1),
    CHECK (eliminated_in_round >= 1 OR eliminated_in_round IS NULL)
);

CREATE TABLE tournament_matches (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    tournament_id INTEGER NOT NULL,
    
    -- Match identification
    round_number INTEGER NOT NULL,
    match_number INTEGER NOT NULL, -- Within the round
    
    -- Players
    player1_id INTEGER, -- Can be NULL for bye rounds
    player2_id INTEGER, -- Can be NULL for bye rounds
    
    -- Match state
    status VARCHAR(20) DEFAULT 'pending', -- 'pending', 'in_progress', 'completed', 'abandoned'
    winner_id INTEGER, -- NULL if not completed
    
    -- Game session reference (once created)
    game_session_id INTEGER,
    
    -- Timestamps
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    started_at DATETIME,
    completed_at DATETIME,
    
    FOREIGN KEY (tournament_id) REFERENCES tournaments(id) ON DELETE CASCADE,
    FOREIGN KEY (player1_id) REFERENCES users(id) ON DELETE SET NULL,
    FOREIGN KEY (player2_id) REFERENCES users(id) ON DELETE SET NULL,
    FOREIGN KEY (winner_id) REFERENCES users(id) ON DELETE SET NULL,
    FOREIGN KEY (game_session_id) REFERENCES game_sessions(id) ON DELETE SET NULL,
    
    CHECK (round_number >= 1),
    CHECK (match_number >= 1),
    CHECK (status IN ('pending', 'in_progress', 'completed', 'abandoned')),
    CHECK (NOT (player1_id IS NULL AND player2_id IS NULL)) -- At least one player
);

CREATE TABLE matchmaking_queue (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    game_type_id INTEGER NOT NULL,
    
    -- Matchmaking preferences
    preferred_game_settings TEXT DEFAULT '{}', -- JSON
    skill_rating INTEGER DEFAULT 1000, -- ELO-like system
    max_wait_time_seconds INTEGER DEFAULT 300, -- 5 minutes default
    
    -- Queue state
    status VARCHAR(20) DEFAULT 'searching', -- 'searching', 'matched', 'cancelled'
    queue_joined_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    matched_with_user_id INTEGER,
    
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (game_type_id) REFERENCES game_types(id),
    FOREIGN KEY (matched_with_user_id) REFERENCES users(id) ON DELETE SET NULL,
    
    CHECK (status IN ('searching', 'matched', 'cancelled')),
    CHECK (skill_rating >= 0),
    CHECK (max_wait_time_seconds > 0)
);

-- ============================================================================
-- 7. CHAT SYSTEM
-- ============================================================================

CREATE TABLE chat_channels (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    type VARCHAR(20) NOT NULL, -- 'direct', 'tournament', 'game'
    name VARCHAR(200),
    
    -- Channel settings
    is_private BOOLEAN DEFAULT TRUE,
    max_participants INTEGER DEFAULT 2,
    
    -- Associated entities
    tournament_id INTEGER,
    game_session_id INTEGER,
    
    -- Channel state
    is_active BOOLEAN DEFAULT TRUE,
    
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    
    FOREIGN KEY (tournament_id) REFERENCES tournaments(id) ON DELETE CASCADE,
    FOREIGN KEY (game_session_id) REFERENCES game_sessions(id) ON DELETE CASCADE,
    
    CHECK (type IN ('direct', 'tournament', 'game')),
    CHECK (max_participants >= 2)
);

CREATE TABLE chat_participants (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    channel_id INTEGER NOT NULL,
    user_id INTEGER NOT NULL,
    
    -- Participation settings
    role VARCHAR(20) DEFAULT 'member', -- 'admin', 'member'
    is_muted BOOLEAN DEFAULT FALSE,
    joined_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    left_at DATETIME,
    
    FOREIGN KEY (channel_id) REFERENCES chat_channels(id) ON DELETE CASCADE,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    
    UNIQUE(channel_id, user_id),
    CHECK (role IN ('admin', 'member'))
);

CREATE TABLE chat_messages (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    channel_id INTEGER NOT NULL,
    sender_id INTEGER NOT NULL,
    
    -- Message content
    message_type VARCHAR(20) DEFAULT 'text', -- 'text', 'game_invite', 'system', 'tournament_update'
    content TEXT NOT NULL,
    metadata TEXT DEFAULT '{}', -- JSON for game invites, system messages, etc.
    
    -- Message status
    is_edited BOOLEAN DEFAULT FALSE,
    edited_at DATETIME,
    is_deleted BOOLEAN DEFAULT FALSE,
    deleted_at DATETIME,
    
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    
    FOREIGN KEY (channel_id) REFERENCES chat_channels(id) ON DELETE CASCADE,
    FOREIGN KEY (sender_id) REFERENCES users(id) ON DELETE CASCADE,
    
    CHECK (message_type IN ('text', 'game_invite', 'system', 'tournament_update')),
    CHECK (content != '')
);

CREATE TABLE user_blocks (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    blocker_id INTEGER NOT NULL,
    blocked_id INTEGER NOT NULL,
    reason VARCHAR(500),
    
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    
    FOREIGN KEY (blocker_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (blocked_id) REFERENCES users(id) ON DELETE CASCADE,
    
    UNIQUE(blocker_id, blocked_id),
    CHECK (blocker_id != blocked_id)
);

-- ============================================================================
-- 8. STATS & DASHBOARDS (ALL-TIME ONLY)
-- ============================================================================

CREATE TABLE user_game_stats (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    game_type_id INTEGER NOT NULL,
    
    -- Basic stats
    games_played INTEGER DEFAULT 0,
    games_won INTEGER DEFAULT 0,
    games_lost INTEGER DEFAULT 0,
    games_drawn INTEGER DEFAULT 0,
    
    -- Performance metrics
    total_playtime_seconds INTEGER DEFAULT 0,
    average_game_duration INTEGER, -- seconds
    longest_game_duration INTEGER, -- seconds
    shortest_game_duration INTEGER, -- seconds
    
    -- Skill metrics (all-time only)
    current_rating INTEGER DEFAULT 1000, -- ELO-like
    peak_rating INTEGER DEFAULT 1000,
    lowest_rating INTEGER DEFAULT 1000,
    
    -- Streak tracking
    current_win_streak INTEGER DEFAULT 0,
    longest_win_streak INTEGER DEFAULT 0,
    current_loss_streak INTEGER DEFAULT 0,
    longest_loss_streak INTEGER DEFAULT 0,
    
    -- Tournament performance
    tournaments_played INTEGER DEFAULT 0,
    tournaments_won INTEGER DEFAULT 0,
    tournaments_top3 INTEGER DEFAULT 0,
    
    -- Game-specific stats (JSON)
    game_specific_stats TEXT DEFAULT '{}',
    
    -- Last updated
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (game_type_id) REFERENCES game_types(id),
    
    UNIQUE(user_id, game_type_id),
    CHECK (games_played >= 0),
    CHECK (games_won >= 0),
    CHECK (games_lost >= 0),
    CHECK (games_drawn >= 0),
    CHECK (current_rating >= 0),
    CHECK (tournaments_played >= 0)
);

CREATE TABLE detailed_game_stats (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    game_session_id INTEGER NOT NULL,
    user_id INTEGER NOT NULL,
    
    -- Performance metrics (JSON based on game type)
    game_specific_stats TEXT NOT NULL DEFAULT '{}',
    -- Pong: {"paddle_hits": 45, "perfect_returns": 12, "powerups_collected": 8, "max_ball_speed": 180}
    
    -- Rating change for this game
    rating_before INTEGER,
    rating_after INTEGER,
    rating_change INTEGER, -- can be negative
    
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    
    FOREIGN KEY (game_session_id) REFERENCES game_sessions(id) ON DELETE CASCADE,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    
    UNIQUE(game_session_id, user_id)
);

-- Global leaderboard (all-time only)
CREATE TABLE leaderboards (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    game_type_id INTEGER NOT NULL,
    
    -- Leaderboard data (JSON) - top 100 players
    rankings TEXT NOT NULL, -- JSON array of {user_id, username, rating, games_played, win_rate}
    
    -- Metadata
    last_updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    player_count INTEGER DEFAULT 0, -- Total players with stats for this game type
    
    FOREIGN KEY (game_type_id) REFERENCES game_types(id),
    
    UNIQUE(game_type_id),
    CHECK (player_count >= 0)
);

-- ============================================================================
-- 9. GAME CUSTOMIZATION & POWER-UPS
-- ============================================================================

CREATE TABLE game_customizations (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    game_type_id INTEGER NOT NULL,
    name VARCHAR(100) NOT NULL,
    display_name VARCHAR(200) NOT NULL,
    description TEXT,
    
    -- Customization data (JSON)
    settings TEXT NOT NULL DEFAULT '{}',
    -- Pong: {"powerups_enabled": true, "powerup_spawn_score": 3, "available_powerups": ["multiball", "speed", "big_paddle"], "ball_speed_multiplier": 1.0}
    
    -- Availability
    is_default BOOLEAN DEFAULT FALSE,
    is_public BOOLEAN DEFAULT TRUE,
    created_by_user_id INTEGER,
    
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    
    FOREIGN KEY (game_type_id) REFERENCES game_types(id),
    FOREIGN KEY (created_by_user_id) REFERENCES users(id) ON DELETE SET NULL,
    
    UNIQUE(game_type_id, name)
);

-- Pong power-up definitions
CREATE TABLE pong_powerups (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name VARCHAR(50) UNIQUE NOT NULL, -- 'multiball', 'speed', 'big_paddle', 'unstoppable', 'freeze'
    display_name VARCHAR(100) NOT NULL,
    description TEXT NOT NULL,
    effect_duration_ms INTEGER, -- NULL for instant effects
    rarity VARCHAR(20) DEFAULT 'common', -- 'common', 'rare', 'legendary'
    
    -- Visual properties
    color VARCHAR(7) DEFAULT '#FF0000', -- Hex color
    icon_path VARCHAR(200),
    
    -- Game balance
    is_active BOOLEAN DEFAULT TRUE,
    
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    
    CHECK (rarity IN ('common', 'rare', 'legendary')),
    CHECK (effect_duration_ms > 0 OR effect_duration_ms IS NULL)
);

-- ============================================================================
-- PERFORMANCE INDEXES
-- ============================================================================

-- User indexes
CREATE INDEX idx_users_email ON users(email);
CREATE INDEX idx_users_username ON users(username);
CREATE INDEX idx_users_google_id ON users(google_id) WHERE google_id IS NOT NULL;
CREATE INDEX idx_users_github_id ON users(github_id) WHERE github_id IS NOT NULL;
CREATE INDEX idx_users_active ON users(is_active);
CREATE INDEX idx_email_verification_tokens_token ON email_verification_tokens(token);

-- Session indexes
CREATE INDEX idx_user_sessions_token ON user_sessions(refresh_token);
CREATE INDEX idx_user_sessions_user ON user_sessions(user_id);
CREATE INDEX idx_user_sessions_expires ON user_sessions(expires_at);

-- Game indexes
CREATE INDEX idx_game_sessions_status ON game_sessions(status);
CREATE INDEX idx_game_sessions_type ON game_sessions(game_type_id);
CREATE INDEX idx_game_sessions_tournament ON game_sessions(tournament_id) WHERE tournament_id IS NOT NULL;
CREATE INDEX idx_game_sessions_created ON game_sessions(created_at);

CREATE INDEX idx_game_participants_user ON game_participants(user_id) WHERE user_id IS NOT NULL;
CREATE INDEX idx_game_participants_session ON game_participants(game_session_id);

-- Tournament indexes
CREATE INDEX idx_tournaments_status ON tournaments(status);
CREATE INDEX idx_tournaments_type ON tournaments(game_type_id);
CREATE INDEX idx_tournaments_creator ON tournaments(creator_id);

CREATE INDEX idx_tournament_participants_tournament ON tournament_participants(tournament_id);
CREATE INDEX idx_tournament_participants_user ON tournament_participants(user_id);

CREATE INDEX idx_tournament_matches_tournament ON tournament_matches(tournament_id);
CREATE INDEX idx_tournament_matches_round ON tournament_matches(tournament_id, round_number);
CREATE INDEX idx_tournament_matches_status ON tournament_matches(status);
CREATE INDEX idx_tournament_matches_game_session ON tournament_matches(game_session_id) WHERE game_session_id IS NOT NULL;

-- Chat indexes
CREATE INDEX idx_chat_messages_channel ON chat_messages(channel_id);
CREATE INDEX idx_chat_messages_sender ON chat_messages(sender_id);
CREATE INDEX idx_chat_messages_created ON chat_messages(created_at);
CREATE INDEX idx_chat_messages_type ON chat_messages(message_type);

CREATE INDEX idx_chat_participants_channel ON chat_participants(channel_id);
CREATE INDEX idx_chat_participants_user ON chat_participants(user_id);

-- Friendship indexes
CREATE INDEX idx_friendships_requester ON friendships(requester_id);
CREATE INDEX idx_friendships_addressee ON friendships(addressee_id);
CREATE INDEX idx_friendships_status ON friendships(status);

-- Stats indexes
CREATE INDEX idx_user_game_stats_user ON user_game_stats(user_id);
CREATE INDEX idx_user_game_stats_type ON user_game_stats(game_type_id);
CREATE INDEX idx_user_game_stats_rating ON user_game_stats(current_rating);

CREATE INDEX idx_detailed_game_stats_session ON detailed_game_stats(game_session_id);
CREATE INDEX idx_detailed_game_stats_user ON detailed_game_stats(user_id);

-- Matchmaking indexes
CREATE INDEX idx_matchmaking_queue_status ON matchmaking_queue(status);
CREATE INDEX idx_matchmaking_queue_type ON matchmaking_queue(game_type_id);
CREATE INDEX idx_matchmaking_queue_rating ON matchmaking_queue(skill_rating);

-- ============================================================================
-- UPDATE TRIGGERS
-- ============================================================================

-- Auto-update timestamps
CREATE TRIGGER update_users_timestamp 
    AFTER UPDATE ON users
    BEGIN
        UPDATE users SET updated_at = CURRENT_TIMESTAMP WHERE id = NEW.id;
    END;

CREATE TRIGGER update_game_sessions_timestamp 
    AFTER UPDATE ON game_sessions
    BEGIN
        UPDATE game_sessions SET updated_at = CURRENT_TIMESTAMP WHERE id = NEW.id;
    END;

CREATE TRIGGER update_tournaments_timestamp 
    AFTER UPDATE ON tournaments
    BEGIN
        UPDATE tournaments SET updated_at = CURRENT_TIMESTAMP WHERE id = NEW.id;
    END;

CREATE TRIGGER update_friendships_timestamp 
    AFTER UPDATE ON friendships
    BEGIN
        UPDATE friendships SET updated_at = CURRENT_TIMESTAMP WHERE id = NEW.id;
    END;

CREATE TRIGGER update_user_presence_timestamp 
    AFTER UPDATE ON user_presence
    BEGIN
        UPDATE user_presence SET updated_at = CURRENT_TIMESTAMP WHERE user_id = NEW.user_id;
    END;

CREATE TRIGGER update_tournament_participant_count
AFTER INSERT ON tournament_participants
BEGIN
    UPDATE tournaments 
    SET current_participants = (
        SELECT COUNT(*) 
        FROM tournament_participants 
        WHERE tournament_id = NEW.tournament_id
    )
    WHERE id = NEW.tournament_id;
END;

CREATE TRIGGER delete_tournament_participant_count
AFTER DELETE ON tournament_participants
BEGIN
    UPDATE tournaments 
    SET current_participants = (
        SELECT COUNT(*) 
        FROM tournament_participants 
        WHERE tournament_id = OLD.tournament_id
    )
    WHERE id = OLD.tournament_id;
END;
