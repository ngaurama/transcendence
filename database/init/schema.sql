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
    fortytwo_id VARCHAR(255) UNIQUE,
    oauth_provider VARCHAR(50) DEFAULT 'local', -- 'github', 'google', 'local', 'fortytwo'
    
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
    last_login_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    
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
    CHECK (oauth_provider IN ('local', 'google', 'github', 'fortytwo'))
);

CREATE TABLE user_sessions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    refresh_token VARCHAR(255) UNIQUE NOT NULL,
    expires_at DATETIME NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    last_used_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    ip_address VARCHAR(45),
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

CREATE TABLE friendship_status (
    status VARCHAR(20) PRIMARY KEY
);

INSERT OR IGNORE INTO friendship_status (status) VALUES 
('pending'), ('accepted'), ('blocked'), ('rejected');

CREATE TABLE friendships (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    requester_id INTEGER NOT NULL,
    addressee_id INTEGER NOT NULL,
    status VARCHAR(20) DEFAULT 'pending',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,

    FOREIGN KEY (requester_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (addressee_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (status) REFERENCES friendship_status(status),
    
    UNIQUE(requester_id, addressee_id),
    CHECK (requester_id != addressee_id)
);

CREATE TABLE friend_requests (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    from_user_id INTEGER NOT NULL,
    to_user_id INTEGER NOT NULL,
    status VARCHAR(20) DEFAULT 'pending',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,

    FOREIGN KEY (from_user_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (to_user_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (status) REFERENCES friendship_status(status),

    UNIQUE(from_user_id, to_user_id),
    CHECK (from_user_id != to_user_id)
);

CREATE TABLE user_presence (
    user_id INTEGER PRIMARY KEY,
    status VARCHAR(20) DEFAULT 'offline',
    current_game_id INTEGER,
    current_activity VARCHAR(100),
    last_seen_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,

    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    CHECK (status IN ('online', 'playing', 'away', 'offline'))
);

-- ============================================================================
-- 3. PONG GAME SYSTEM
-- ============================================================================

CREATE TABLE game_sessions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    tournament_id INTEGER, --nullable ofc
    player1_id INTEGER,
    player2_id INTEGER,
    end_reason TEXT DEFAULT 'normal', -- for abandoned or completed
    game_mode VARCHAR(20) DEFAULT 'online', -- 'online', 'local'
    
    -- Game state
    status VARCHAR(20) DEFAULT 'waiting', -- 'waiting', 'in_progress', 'completed', 'abandoned'
    winner_id INTEGER, -- nullable for abandoned games
    final_score_player1 INTEGER,
    final_score_player2 INTEGER,
    result VARCHAR(20), -- 'win', 'abandoned'
    
    -- Pong-specific settings (JSON)
    game_settings TEXT DEFAULT '{}', -- JSON: powerups_enabled, and so on
    
    -- Timing
    started_at DATETIME,
    ended_at DATETIME,
    -- duration_seconds INTEGER, -- calculated duration
    game_duration_ms INTEGER,
    
    -- Timestamps
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    
    FOREIGN KEY (tournament_id) REFERENCES tournaments(id) ON DELETE SET NULL,
    FOREIGN KEY (winner_id) REFERENCES users(id) ON DELETE SET NULL,
    FOREIGN KEY (player1_id) REFERENCES users(id) ON DELETE SET NULL,
    FOREIGN KEY (player2_id) REFERENCES users(id) ON DELETE SET NULL,
    FOREIGN KEY (winner_id) REFERENCES users(id) ON DELETE SET NULL,
    -- FOREIGN KEY (game_session_id) REFERENCES game_sessions(id),
    
    CHECK (status IN ('waiting', 'in_progress', 'completed', 'abandoned', 'cancelled')),
    CHECK (result IN ('win', 'abandoned') OR result IS NULL)
);

CREATE TABLE game_participants (

    -- might not even bother doing ai but for keeping some values in case we need moremodules
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    game_session_id INTEGER NOT NULL,
    user_id INTEGER, -- nullable for AI players
    player_number INTEGER NOT NULL, -- 1, 2
    is_ai BOOLEAN DEFAULT FALSE,
    ai_difficulty INTEGER, -- 1-10 for Pong
    
    score INTEGER DEFAULT 0,
    final_position INTEGER,

    -- Participation status
    joined_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    left_at DATETIME, -- for disconnections

    FOREIGN KEY (game_session_id) REFERENCES game_sessions(id) ON DELETE CASCADE,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL,
    
    UNIQUE(game_session_id, player_number),
    CHECK (player_number IN (1, 2)),
    CHECK (ai_difficulty IS NULL OR (ai_difficulty >= 1 AND ai_difficulty <= 10)),
    CHECK (NOT (user_id IS NULL AND is_ai = FALSE)),
    CHECK (NOT (user_id IS NOT NULL AND is_ai = TRUE))
);

-- ============================================================================
-- 4. TOURNAMENT SYSTEM (EVEN NUMBERS, MAX 16)
-- ============================================================================

CREATE TABLE tournaments (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name VARCHAR(200) NOT NULL,
    creator_id INTEGER NOT NULL,
    
    -- Tournament structure (even numbers only, max 16)
    type VARCHAR(50) DEFAULT 'single_elimination',
    max_participants INTEGER DEFAULT 8,
    current_participants INTEGER DEFAULT 0,
    
    -- Tournament state
    status VARCHAR(20) DEFAULT 'registration', -- 'registration', 'in_progress', 'completed', 'cancelled'
    winner_id INTEGER,
    current_round INTEGER DEFAULT 1,
    total_rounds INTEGER,
    
    -- Tournament settings (JSON)
    tournament_settings TEXT DEFAULT '{}',
    
    -- Scheduling
    registration_starts_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    registration_ends_at DATETIME,
    starts_at DATETIME,
    ends_at DATETIME,
    
    -- Timestamps
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    
    FOREIGN KEY (creator_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (winner_id) REFERENCES users(id) ON DELETE SET NULL,
    
    CHECK (status IN ('registration', 'in_progress', 'completed', 'cancelled')),
    CHECK (max_participants >= 4 AND max_participants <= 16),
    CHECK (max_participants % 2 = 0),
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
    final_position INTEGER,
    
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
    match_number INTEGER NOT NULL, -- Within the round ofc
    
    -- Players
    player1_id INTEGER, -- nulable for bye rounds
    player2_id INTEGER,
    
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
    
    -- Matchmaking preferences
    preferred_game_settings TEXT DEFAULT '{}', -- JSON
    max_wait_time_seconds INTEGER DEFAULT 300, -- 5 minutes default
    
    -- Queue state
    status VARCHAR(20) DEFAULT 'searching', -- 'searching', 'matched', 'cancelled'
    queue_joined_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    matched_with_user_id INTEGER,
    
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (matched_with_user_id) REFERENCES users(id) ON DELETE SET NULL,
    
    CHECK (status IN ('searching', 'matched', 'cancelled')),
    CHECK (max_wait_time_seconds > 0)
);

-- ============================================================================
-- 8. STATS & DASHBOARDS (ALL-TIME ONLY)
-- ============================================================================

CREATE TABLE user_game_stats (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    
    -- Basic stats
    games_played INTEGER DEFAULT 0,
    games_won INTEGER DEFAULT 0,
    games_lost INTEGER DEFAULT 0,
    
    -- Performance metrics
    total_playtime_seconds INTEGER DEFAULT 0,
    average_game_duration INTEGER, -- seconds
    longest_game_duration INTEGER, -- seconds
    shortest_game_duration INTEGER, -- seconds
    
    -- Streak tracking
    current_win_streak INTEGER DEFAULT 0,
    longest_win_streak INTEGER DEFAULT 0,
    current_loss_streak INTEGER DEFAULT 0,
    longest_loss_streak INTEGER DEFAULT 0,
    
    -- Tournament performance
    tournaments_played INTEGER DEFAULT 0,
    tournaments_won INTEGER DEFAULT 0,
    tournaments_top3 INTEGER DEFAULT 0,
    
    -- Pong-specific stats (JSON)
    pong_stats TEXT DEFAULT '{}',
    
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    
    UNIQUE(user_id),
    CHECK (games_played >= 0),
    CHECK (games_won >= 0),
    CHECK (games_lost >= 0),
    CHECK (tournaments_played >= 0)
);


CREATE TABLE detailed_game_stats (
    -- uhhh ill get back to this
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    game_session_id INTEGER NOT NULL,
    user_id INTEGER NOT NULL,
    
    -- Pong performance metrics
    pong_stats TEXT NOT NULL DEFAULT '{}',
    
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    
    FOREIGN KEY (game_session_id) REFERENCES game_sessions(id) ON DELETE CASCADE,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    
    UNIQUE(game_session_id, user_id)
);

-- ============================================================================
-- 9. PONG CUSTOMIZATION & POWER-UPS
-- ============================================================================

CREATE TABLE pong_customizations (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name VARCHAR(100) NOT NULL,
    display_name VARCHAR(200) NOT NULL,
    description TEXT,
    
    settings TEXT NOT NULL DEFAULT '{}',
    
    is_default BOOLEAN DEFAULT FALSE,
    is_public BOOLEAN DEFAULT TRUE,
    created_by_user_id INTEGER,
    
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    
    FOREIGN KEY (created_by_user_id) REFERENCES users(id) ON DELETE SET NULL,
    
    UNIQUE(name)
);

-- Pong power-up definitions
CREATE TABLE pong_powerups (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name VARCHAR(50) UNIQUE NOT NULL, -- 'multiball', 'speed', 'big_paddle'
    display_name VARCHAR(100) NOT NULL,
    description TEXT NOT NULL,
    effect_duration_ms INTEGER, -- NULL for instant effects
    rarity VARCHAR(20) DEFAULT 'common', -- 'common', 'rare', 'legendary'
    
    -- Visual properties
    color VARCHAR(7) DEFAULT '#FF0000',
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
CREATE INDEX idx_users_fortytwo_id ON users(fortytwo_id) WHERE fortytwo_id IS NOT NULL;
CREATE INDEX idx_users_active ON users(is_active);
CREATE INDEX idx_email_verification_tokens_token ON email_verification_tokens(token);

-- Session indexes
CREATE INDEX idx_user_sessions_token ON user_sessions(refresh_token);
CREATE INDEX idx_user_sessions_user ON user_sessions(user_id);
CREATE INDEX idx_user_sessions_expires ON user_sessions(expires_at);

-- Game indexes
CREATE INDEX idx_game_sessions_status ON game_sessions(status);
CREATE INDEX idx_game_sessions_tournament ON game_sessions(tournament_id) WHERE tournament_id IS NOT NULL;
CREATE INDEX idx_game_sessions_created ON game_sessions(created_at);

CREATE INDEX idx_game_participants_user ON game_participants(user_id) WHERE user_id IS NOT NULL;
CREATE INDEX idx_game_participants_session ON game_participants(game_session_id);

-- Tournament indexes
CREATE INDEX idx_tournaments_status ON tournaments(status);
CREATE INDEX idx_tournaments_creator ON tournaments(creator_id);

CREATE INDEX idx_tournament_participants_tournament ON tournament_participants(tournament_id);
CREATE INDEX idx_tournament_participants_user ON tournament_participants(user_id);

CREATE INDEX idx_tournament_matches_tournament ON tournament_matches(tournament_id);
CREATE INDEX idx_tournament_matches_round ON tournament_matches(tournament_id, round_number);
CREATE INDEX idx_tournament_matches_status ON tournament_matches(status);
CREATE INDEX idx_tournament_matches_game_session ON tournament_matches(game_session_id) WHERE game_session_id IS NOT NULL;

-- Friendship indexes
CREATE INDEX idx_friendships_requester ON friendships(requester_id);
CREATE INDEX idx_friendships_addressee ON friendships(addressee_id);
CREATE INDEX idx_friendships_status ON friendships(status);
CREATE INDEX idx_friend_requests_from ON friend_requests(from_user_id);
CREATE INDEX idx_friend_requests_to ON friend_requests(to_user_id);


-- Stats indexes
CREATE INDEX idx_user_game_stats_user ON user_game_stats(user_id);
CREATE INDEX idx_detailed_game_stats_session ON detailed_game_stats(game_session_id);
CREATE INDEX idx_detailed_game_stats_user ON detailed_game_stats(user_id);

-- Matchmaking indexes
CREATE INDEX idx_matchmaking_queue_status ON matchmaking_queue(status);

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
