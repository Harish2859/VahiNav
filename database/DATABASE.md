# VahiNav (PathSathi) — Database Setup Guide

## Connection Details

| Parameter | Value |
|-----------|-------|
| **Host** | `localhost` |
| **Port** | `5432` |
| **Database** | `vahinav_db` |
| **User** | `postgres` |
| **Password** | `<your-password>` |

> ⚠️ **Security Note:** Never hardcode credentials in source code or commit them to version control. Use environment variables (e.g. a `.env` file loaded via `dotenv`) and keep `.env` in `.gitignore`. The connection details above are for local development reference only — always set a strong password in any shared or production environment.

---

## Migration Instructions

### Option A — Docker (Recommended)

The easiest way to run the database is with [Docker](https://docs.docker.com/get-docker/) and
[Docker Compose](https://docs.docker.com/compose/install/).  The `postgis/postgis` image ships
with PostgreSQL **and** the PostGIS extension pre-installed, so the `CREATE EXTENSION postgis`
statement in `schema.sql` will always succeed.

1. **Set a strong password** (optional — defaults to `changeme` for local dev):

   ```bash
   export POSTGRES_PASSWORD=mysecretpassword
   ```

2. **Start the database** from the repository root:

   ```bash
   docker compose up -d
   ```

   On first run Docker will:
   - Pull `postgis/postgis:16-3.4`
   - Create the `vahinav_db` database
   - Automatically apply `database/schema.sql` via the `docker-entrypoint-initdb.d` mechanism

3. **Verify the tables were created:**

   ```bash
   docker compose exec db psql -U postgres -d vahinav_db -c "\dt"
   ```

   Expected output:
   ```
    Schema |    Name     | Type  |  Owner
   --------+-------------+-------+----------
    public | breadcrumbs | table | postgres
    public | survey_data | table | postgres
    public | trips       | table | postgres
    public | users       | table | postgres
   ```

4. **Verify PostGIS is enabled:**

   ```bash
   docker compose exec db psql -U postgres -d vahinav_db -c "SELECT PostGIS_Version();"
   ```

5. **Stop the database** when you are done:

   ```bash
   docker compose down
   ```

   Add `-v` to also remove the persistent volume (destroys all data):

   ```bash
   docker compose down -v
   ```

---

### Option B — Manual PostgreSQL Install

> ⚠️ PostGIS must be installed **before** running `schema.sql`.  If you skip this step you will
> get: `ERROR: extension "postgis" is not available`.

#### Ubuntu / Debian

```bash
sudo apt-get update
sudo apt-get install -y postgresql postgresql-contrib postgis postgresql-16-postgis-3
```

> **Note:** The package name `postgresql-16-postgis-3` is specific to PostgreSQL 16.
> Run `apt-cache search 'postgresql-.*-postgis'` to find the correct package for your
> installed PostgreSQL version.

#### macOS (Homebrew)

```bash
brew install postgresql@16 postgis
```

#### Windows

Use the [EnterpriseDB PostgreSQL installer](https://www.enterprisedb.com/downloads/postgres-postgresql-downloads)
and tick **PostGIS** in the *Stack Builder* wizard that launches after installation.

#### Apply the schema

1. **Create the database** (if it does not already exist):

   ```bash
   createdb -U postgres vahinav_db
   ```

2. **Run the schema file:**

   ```bash
   psql -U postgres -h localhost -d vahinav_db -f database/schema.sql
   ```

3. **Verify the tables were created:**

   ```bash
   psql -U postgres -h localhost -d vahinav_db -c "\dt"
   ```

   Expected output:
   ```
    Schema |    Name     | Type  |  Owner
   --------+-------------+-------+----------
    public | breadcrumbs | table | postgres
    public | survey_data | table | postgres
    public | trips       | table | postgres
    public | users       | table | postgres
   ```

4. **Verify PostGIS is enabled:**

   ```bash
   psql -U postgres -h localhost -d vahinav_db -c "SELECT PostGIS_Version();"
   ```

---

## Schema Documentation

### Trip Chain Concept

The database models a **Trip Chain** — a sequence of travel legs that make up a person's full day of movement:

```
users
  └── trips            (one user → many trips)
        ├── breadcrumbs  (one trip → many GPS waypoints)
        └── survey_data  (one trip → one survey response)
```

### Table Descriptions

#### `users`
Stores registered PathSathi users and their transport preferences.

| Column | Type | Description |
|--------|------|-------------|
| `id` | `SERIAL` | Auto-incremented primary key |
| `email` | `VARCHAR(255)` | Unique login identifier |
| `name` | `VARCHAR(255)` | Display name |
| `preferences` | `JSONB` | Flexible key-value settings (preferred mode, language, etc.) |
| `created_at` | `TIMESTAMPTZ` | Record creation time (IST-aware) |
| `updated_at` | `TIMESTAMPTZ` | Last modification time (IST-aware) |

#### `trips`
The primary container for a single travel event — from trip start to stop detection.

| Column | Type | Description |
|--------|------|-------------|
| `id` | `SERIAL` | Auto-incremented primary key |
| `user_id` | `INTEGER` | Foreign key → `users.id` (CASCADE delete) |
| `start_time` | `TIMESTAMPTZ` | When movement was detected |
| `end_time` | `TIMESTAMPTZ` | When dwell/stop was detected (nullable while active) |
| `travel_mode` | `VARCHAR(50)` | `IN_VEHICLE`, `WALKING`, `ON_BICYCLE`, etc. |
| `trip_purpose` | `VARCHAR(100)` | `Work`, `Shopping`, `Recreation`, etc. |
| `path_geometry` | `GEOMETRY(LineString, 4326)` | Full route as a LineString — **(Longitude, Latitude)** |
| `status` | `VARCHAR(20)` | `active` \| `completed` \| `discarded` |
| `total_distance` | `NUMERIC(10,2)` | Route length in metres (computed via `ST_Length`) |
| `created_at` | `TIMESTAMPTZ` | Record creation time |
| `updated_at` | `TIMESTAMPTZ` | Last modification time |

#### `breadcrumbs`
High-frequency GPS waypoints captured at ~50 m intervals during an active trip. This is the most write-heavy table.

| Column | Type | Description |
|--------|------|-------------|
| `id` | `SERIAL` | Auto-incremented primary key |
| `trip_id` | `INTEGER` | Foreign key → `trips.id` (CASCADE delete) |
| `location` | `GEOGRAPHY(Point, 4326)` | GPS point — **(Longitude, Latitude)** |
| `speed` | `NUMERIC(6,2)` | Device-reported speed in m/s |
| `recorded_at` | `TIMESTAMPTZ` | Timestamp of the GPS fix |

#### `survey_data`
Qualitative trip metadata captured via "Smart Nudge" push notifications after a trip completes.

| Column | Type | Description |
|--------|------|-------------|
| `id` | `SERIAL` | Auto-incremented primary key |
| `trip_id` | `INTEGER` | Foreign key → `trips.id` (CASCADE delete) |
| `user_id` | `INTEGER` | Foreign key → `users.id` (CASCADE delete) |
| `cost` | `NUMERIC(8,2)` | Travel cost in INR |
| `companions` | `INTEGER` | Number of co-travellers (0 = solo) |
| `notes` | `TEXT` | Free-text observations from the user |
| `created_at` | `TIMESTAMPTZ` | Record creation time |
| `updated_at` | `TIMESTAMPTZ` | Last modification time |

---

## Geospatial Data Model

### Why `GEOGRAPHY` for breadcrumbs?

`GEOGRAPHY(Point, 4326)` is used for the `breadcrumbs.location` column because:

- Distances are calculated in **real-world metres** by default (great for `ST_DWithin` proximity queries).
- Handles the curvature of the Earth correctly — critical for long routes across Kerala.
- Uses **EPSG:4326** (WGS84), the same coordinate system as device GPS output.

### Why `GEOMETRY` for trip paths?

`GEOMETRY(LineString, 4326)` is used for `trips.path_geometry` because:

- Better suited for **visualization** and aggregation (e.g. `ST_AsGeoJSON` for the dashboard).
- Supports `ST_Transform` to project into local coordinate systems (e.g. UTM zone 43N for Kerala).
- Required by some PostGIS aggregation functions that reconstruct a LineString from breadcrumbs.

### Coordinate Order

> **PostGIS always uses (Longitude, Latitude) order — not (Lat, Lon).**

When inserting breadcrumbs from the Flutter app or Node.js API, always use:

```sql
ST_SetSRID(ST_MakePoint(longitude, latitude), 4326)
```

Swapping longitude and latitude is the #1 cause of trips appearing in the middle of the ocean.

---

## Indexes

| Index | Table | Column | Type | Purpose |
|-------|-------|--------|------|---------|
| `idx_trips_path_geometry` | `trips` | `path_geometry` | GIST | Fast spatial bounding-box queries on trip routes |
| `idx_trips_user_id` | `trips` | `user_id` | B-tree | Fast lookup of all trips belonging to a user |
| `idx_breadcrumbs_location` | `breadcrumbs` | `location` | GIST | Fast `ST_DWithin` / `ST_Distance` geospatial queries |
| `idx_breadcrumbs_trip_id` | `breadcrumbs` | `trip_id` | B-tree | Fast lookup of all waypoints for a given trip |
| `idx_survey_data_trip_id` | `survey_data` | `trip_id` | B-tree | Fast lookup of survey responses for a trip |
| `idx_survey_data_user_id` | `survey_data` | `user_id` | B-tree | Fast lookup of all survey responses for a user |
