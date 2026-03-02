-- =============================================================================
-- VahiNav (PathSathi) — PostgreSQL + PostGIS Database Schema
-- Milestone 1: Database Architecture
--
-- Run with:
--   psql -U postgres -h localhost -d vahinav_db -f schema.sql
--
-- NOTE: PostGIS uses (Longitude, Latitude) order — not (Lat, Lon).
--       Swapping these coordinates is the #1 cause of "trips in the ocean" bugs.
-- =============================================================================

-- Enable the PostGIS extension for geospatial support
CREATE EXTENSION IF NOT EXISTS postgis;

-- =============================================================================
-- TABLE: users
-- Stores registered app users and their travel preferences.
-- Every trip and survey response is ultimately owned by a user.
-- =============================================================================
CREATE TABLE IF NOT EXISTS users (
    id            SERIAL PRIMARY KEY,
    email         VARCHAR(255) NOT NULL UNIQUE,
    name          VARCHAR(255) NOT NULL,
    -- JSON object for user preferences, e.g. preferred transport mode, language
    preferences   JSONB        DEFAULT '{}'::jsonb,
    created_at    TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
    updated_at    TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE  users              IS 'Registered PathSathi users. Root entity of the Trip Chain.';
COMMENT ON COLUMN users.preferences  IS 'Flexible JSONB field for user-specific settings (preferred_mode, language, etc.).';

-- =============================================================================
-- TABLE: trips
-- The primary container for a single travel event.
-- One user can have many trips; each trip contains many breadcrumbs.
--
-- path_geometry uses GEOMETRY(LineString, 4326) so it can be used for
-- visualization and ST_Length / ST_AsGeoJSON calculations on the server.
-- =============================================================================
CREATE TABLE IF NOT EXISTS trips (
    id              SERIAL PRIMARY KEY,
    user_id         INTEGER      NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    start_time      TIMESTAMPTZ  NOT NULL,
    end_time        TIMESTAMPTZ,
    travel_mode     VARCHAR(50),   -- e.g. 'IN_VEHICLE', 'WALKING', 'ON_BICYCLE'
    trip_purpose    VARCHAR(100),  -- e.g. 'Work', 'Shopping', 'Recreation'
    -- Full route stored as a LineString; coordinates are (Longitude, Latitude)
    path_geometry   GEOMETRY(LineString, 4326),
    status          VARCHAR(20)  NOT NULL DEFAULT 'active',  -- 'active' | 'completed' | 'discarded'
    total_distance  NUMERIC(10, 2),  -- metres; application should update this via ST_Length after trip completes
    created_at      TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE  trips               IS 'A single travel event. Parent of breadcrumbs and survey_data.';
COMMENT ON COLUMN trips.path_geometry IS 'Complete route as a LineString. Coordinates: (Longitude, Latitude) — EPSG:4326.';
COMMENT ON COLUMN trips.status        IS 'Lifecycle state: active (recording), completed, or discarded.';

-- GIST index for fast spatial queries on trip paths (e.g. bounding-box searches)
CREATE INDEX IF NOT EXISTS idx_trips_path_geometry
    ON trips USING GIST (path_geometry);

-- B-tree index for frequent look-ups by user_id
CREATE INDEX IF NOT EXISTS idx_trips_user_id
    ON trips (user_id);

-- =============================================================================
-- TABLE: breadcrumbs
-- Individual GPS points recorded during an active trip.
-- This is the highest-volume table; spatial indexing is critical.
--
-- location uses GEOGRAPHY(Point, 4326) because:
--   - GEOGRAPHY operates in real-world metres (great for ST_DWithin distance queries).
--   - It automatically handles the curvature of the Earth, unlike flat GEOMETRY.
--   - Coordinates: (Longitude, Latitude) — EPSG:4326.
-- =============================================================================
CREATE TABLE IF NOT EXISTS breadcrumbs (
    id          SERIAL PRIMARY KEY,
    trip_id     INTEGER      NOT NULL REFERENCES trips(id) ON DELETE CASCADE,
    -- Store as GEOGRAPHY so distance/proximity queries use real-world metres
    -- Insert order: ST_MakePoint(longitude, latitude)
    location    GEOGRAPHY(Point, 4326) NOT NULL,
    speed       NUMERIC(6, 2),   -- metres per second
    recorded_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE  breadcrumbs          IS 'Time-stamped GPS waypoints captured during a trip. Child of trips.';
COMMENT ON COLUMN breadcrumbs.location IS 'GPS point as GEOGRAPHY. Insert via ST_MakePoint(longitude, latitude).';
COMMENT ON COLUMN breadcrumbs.speed    IS 'Device-reported speed in metres per second at the time of recording.';

-- GIST index is essential for ST_DWithin / ST_Distance queries on breadcrumbs
CREATE INDEX IF NOT EXISTS idx_breadcrumbs_location
    ON breadcrumbs USING GIST (location);

-- B-tree index for look-ups by trip_id (very common query pattern)
CREATE INDEX IF NOT EXISTS idx_breadcrumbs_trip_id
    ON breadcrumbs (trip_id);

-- =============================================================================
-- TABLE: survey_data
-- Qualitative trip details gathered via "Smart Nudge" notifications.
-- Linked to both the trip and the user for denormalised convenience.
-- =============================================================================
CREATE TABLE IF NOT EXISTS survey_data (
    id          SERIAL PRIMARY KEY,
    trip_id     INTEGER      NOT NULL REFERENCES trips(id) ON DELETE CASCADE,
    user_id     INTEGER      NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    cost        NUMERIC(8, 2),   -- Travel cost in INR
    companions  INTEGER,          -- Number of co-travellers
    notes       TEXT,             -- Free-text observations from the user
    created_at  TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
    updated_at  TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE  survey_data            IS 'Qualitative survey responses tied to a completed trip (Smart Nudge data).';
COMMENT ON COLUMN survey_data.cost       IS 'Total travel cost in Indian Rupees reported by the user.';
COMMENT ON COLUMN survey_data.companions IS 'Number of people travelling with the user (0 = solo).';

-- B-tree index for look-ups by trip_id and user_id
CREATE INDEX IF NOT EXISTS idx_survey_data_trip_id
    ON survey_data (trip_id);

CREATE INDEX IF NOT EXISTS idx_survey_data_user_id
    ON survey_data (user_id);
