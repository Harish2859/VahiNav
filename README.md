# PathSathi 🚗📍
**AI-Powered Travel Activity & Automated Trip Chain Logger**

### 🏆 Developed for SIH 2026 (Problem Statement: SIH25082)
**Organization:** Government of Kerala (KSCSTE-NATPAC)  
**Theme:** Transportation & Logistics

---

## 📖 Project Overview
NATPAC requires high-fidelity travel data for urban planning. Traditional manual surveys are slow, expensive, and cover only a fraction of the population. **PathSathi** solves this by turning every smartphone into a passive travel diary. 

The app automatically detects trip starts/ends, captures geographic breadcrumbs, and uses "Smart Nudges" to gather qualitative data (purpose, cost, companions) without user fatigue.

---

## 🛠️ Tech Stack
* **Mobile:** Flutter (Cross-platform)
* **Backend:** Node.js (Express)
* **Database:** PostgreSQL + PostGIS (Geospatial Analysis)
* **Auth & Messaging:** Firebase Auth & Cloud Messaging (FCM)
* **Mapping:** Leaflet.js / OpenStreetMap

---

## 📐 Milestone 1: Database Architecture (ER Diagram)

To accurately map a "Trip Chain" (e.g., Home → Work → Shop → Home), our database follows a hierarchical structure where raw GPS points (Breadcrumbs) are children of a specific Trip entity.



### **Entity Descriptions:**
* **User:** Stores demographic data and transport preferences.
* **Trip:** The primary container for a travel event (Start/End times, total distance).
* **Breadcrumbs:** Time-stamped GPS coordinates (`GEOGRAPHY` type) captured during an active trip.
* **SurveyData:** qualitative details captured via user nudges (Purpose, Cost, Companions).

> 📄 **Database setup instructions, schema details, and geospatial notes:** see [database/DATABASE.md](database/DATABASE.md)

---

## 📂 Repository Structure
```text
/path-sathi
├── /mobile_app           # Flutter source code
│   ├── /lib/sensors      # Activity Recognition & GPS logic
│   ├── /lib/background   # Headless background service
│   └── /lib/ui           # "Smart Nudge" Survey screens
├── /backend              # Node.js Express API
│   ├── /src/controllers  # Ingestion & Logic
│   ├── /src/models       # PostGIS schemas
│   └── /src/services     # FCM Notification triggers
├── /dashboard            # React/Leaflet Admin Panel
└── /database             # SQL migration files & PostGIS setup
    ├── schema.sql        # Full DB schema (tables, indexes, constraints)
    └── DATABASE.md       # Connection details & schema documentation


Since **Milestone 1** (the database) is the foundation, **Milestone 2** is the engine. This is where we build the **Flutter Background Service**.

The goal here is "Passive Tracking": the app must detect movement, start recording GPS, and stop when the user reaches a destination—all while the phone is in their pocket.

---

## 🟡 Milestone 2: The Flutter "Sensor" Core

In this phase, we move from the database to the device hardware. We need to handle three main challenges: **Permissions**, **Activity Recognition**, and **Background Execution**.

### 1. The Permission Strategy

Modern OSs (Android 13+ and iOS 16+) are very strict. To pass the SIH evaluation, your app must explicitly request:

* **Location:** "Always Allow" (Required for background).
* **Physical Activity:** To detect "In Vehicle" vs "Walking".
* **Notifications:** To send the "Nudge" survey.
* **Battery Optimization:** You must ask the user to "Disable Battery Optimization" for PathSathi, or the OS will kill your service after 10 minutes.

### 2. The Logic Flow (The State Machine)

The app shouldn't record GPS 24/7 (that kills the battery). It should follow this logic:

1. **Listener Mode:** The app listens to the **Activity Recognition API**.
2. **Trigger:** If activity = `IN_VEHICLE`, `ON_BICYCLE`, or `RUNNING`, the app transitions to **Tracking Mode**.
3. **Tracking Mode:** Wake up the GPS. Record a `Breadcrumb` (Lat, Long, Timestamp) every 50 meters.
4. **Dwell Detection:** If the user stays within a 50m radius for > 5 minutes, the app transitions to **Stop Mode**.
5. **Stop Mode:** Finalize the `Trip`, save it to local storage (Hive/SQLite), and attempt to sync with your Node.js server.

---

### 3. Recommended Flutter Plugins (2026 Stack)

| Function | Plugin | Why? |
| --- | --- | --- |
| **Background Service** | `flutter_background_service` | Runs a "Headless" Dart instance even if the app is swiped away. |
| **Activity Sensing** | `flutter_activity_recognition` | Connects to Google Fit/Apple Health sensors to detect movement types. |
| **Geospatial Tracking** | `geolocator` | High-accuracy GPS fetching with distance-based filtering. |
| **Local Buffer** | `isar` or `hive` | Stores breadcrumbs when the user is in a "No Signal" zone (e.g., Kerala forest/hills). |

---

### 4. Implementation Snippet: Requesting Permissions

Create a dedicated `PermissionService` class. This is the first thing the user sees.

```dart
import 'package:permission_handler/permission_handler.dart';

class PermissionService {
  static Future<bool> requestAllPermissions() async {
    // 1. Request Location (Always)
    Map<Permission, PermissionStatus> statuses = await [
      Permission.locationAlways,
      Permission.activityRecognition,
      Permission.notification,
    ].request();

    // 2. Check if Battery Optimization is ignored (Critical for SIH)
    bool isBatteryOptimized = await Permission.ignoreBatteryOptimizations.isGranted;
    if (!isBatteryOptimized) {
      await Permission.ignoreBatteryOptimizations.request();
    }

    return statuses.values.every((status) => status.isGranted);
  }
}

```

---

### 5. Milestone 2 Checklist

To complete this milestone, you should be able to:

* [ ] Open the app and grant all 4 permissions.
* [ ] Start a "Foreground Service" (a persistent notification should appear in the status bar).
* [ ] Log GPS coordinates to the console/log file while the app is minimized.
* [ ] Detect when the user has stopped moving for a set period.

**Would you like me to write the code for the `BackgroundService` class that handles the "Start Trip" and "End Trip" logic?**


Since **Milestone 1** (the database) is the foundation, **Milestone 2** is the engine. This is where we build the **Flutter Background Service**.

The goal here is "Passive Tracking": the app must detect movement, start recording GPS, and stop when the user reaches a destination—all while the phone is in their pocket.

---

## 🟡 Milestone 2: The Flutter "Sensor" Core

In this phase, we move from the database to the device hardware. We need to handle three main challenges: **Permissions**, **Activity Recognition**, and **Background Execution**.

### 1. The Permission Strategy

Modern OSs (Android 13+ and iOS 16+) are very strict. To pass the SIH evaluation, your app must explicitly request:

* **Location:** "Always Allow" (Required for background).
* **Physical Activity:** To detect "In Vehicle" vs "Walking".
* **Notifications:** To send the "Nudge" survey.
* **Battery Optimization:** You must ask the user to "Disable Battery Optimization" for PathSathi, or the OS will kill your service after 10 minutes.

### 2. The Logic Flow (The State Machine)

The app shouldn't record GPS 24/7 (that kills the battery). It should follow this logic:

1. **Listener Mode:** The app listens to the **Activity Recognition API**.
2. **Trigger:** If activity = `IN_VEHICLE`, `ON_BICYCLE`, or `RUNNING`, the app transitions to **Tracking Mode**.
3. **Tracking Mode:** Wake up the GPS. Record a `Breadcrumb` (Lat, Long, Timestamp) every 50 meters.
4. **Dwell Detection:** If the user stays within a 50m radius for > 5 minutes, the app transitions to **Stop Mode**.
5. **Stop Mode:** Finalize the `Trip`, save it to local storage (Hive/SQLite), and attempt to sync with your Node.js server.

---

### 3. Recommended Flutter Plugins (2026 Stack)

| Function | Plugin | Why? |
| --- | --- | --- |
| **Background Service** | `flutter_background_service` | Runs a "Headless" Dart instance even if the app is swiped away. |
| **Activity Sensing** | `flutter_activity_recognition` | Connects to Google Fit/Apple Health sensors to detect movement types. |
| **Geospatial Tracking** | `geolocator` | High-accuracy GPS fetching with distance-based filtering. |
| **Local Buffer** | `isar` or `hive` | Stores breadcrumbs when the user is in a "No Signal" zone (e.g., Kerala forest/hills). |

---

### 4. Implementation Snippet: Requesting Permissions

Create a dedicated `PermissionService` class. This is the first thing the user sees.

```dart
import 'package:permission_handler/permission_handler.dart';

class PermissionService {
  static Future<bool> requestAllPermissions() async {
    // 1. Request Location (Always)
    Map<Permission, PermissionStatus> statuses = await [
      Permission.locationAlways,
      Permission.activityRecognition,
      Permission.notification,
    ].request();

    // 2. Check if Battery Optimization is ignored (Critical for SIH)
    bool isBatteryOptimized = await Permission.ignoreBatteryOptimizations.isGranted;
    if (!isBatteryOptimized) {
      await Permission.ignoreBatteryOptimizations.request();
    }

    return statuses.values.every((status) => status.isGranted);
  }
}

```

---

### 5. Milestone 2 Checklist

To complete this milestone, you should be able to:

* [ ] Open the app and grant all 4 permissions.
* [ ] Start a "Foreground Service" (a persistent notification should appear in the status bar).
* [ ] Log GPS coordinates to the console/log file while the app is minimized.
* [ ] Detect when the user has stopped moving for a set period.

**Would you like me to write the code for the `BackgroundService` class that handles the "Start Trip" and "End Trip" logic?**

## 🟠 Milestone 3: The Node.js API (The Intelligence Layer)

With your database ready and your Flutter app sensing motion, you need the **Node.js Backend** to act as the "Brain." This layer doesn't just store data; it reconstructs the user's travel journey and triggers the "Nudge."

### 1. Advanced API Architecture

In a high-fidelity tracking system, the app sends "telemetry batches" (collections of GPS points) rather than single points to save battery. Your API must handle these efficiently.

* **Ingestion Engine:** Use **Express.js** with `Zod` for strict schema validation.
* **Geospatial Logic:** Use `node-postgres` (pg) to interface with PostGIS.
* **Real-time Nudges:** Integrate **Firebase Admin SDK** to send high-priority push notifications when a trip status changes.

---

### 2. The "Trip Processor" Logic

This is where the magic happens. When a batch of points arrives, the server should run these PostGIS queries:

#### A. Storing the Path

Instead of just rows of points, you should store the entire trip as a `LINESTRING` for easier visualization on the NATPAC dashboard.

```sql
-- Convert multiple points into a single journey line
UPDATE trips 
SET path_geometry = (
    SELECT ST_MakeLine(location::geometry ORDER BY recorded_at)
    FROM breadcrumbs 
    WHERE trip_id = $1
)
WHERE id = $1;

```

#### B. Intelligent Stop Detection (The Nudge Trigger)

When the backend sees a new location point that is significantly far from the last one, but the user has now been stationary for >5 minutes, it calculates:

1. **Distance:** `ST_Distance` between Start and End points.
2. **Duration:** `end_time - start_time`.
3. **Trigger:** Send a "Nudge" via FCM: *"You've traveled 5km. What was the purpose of this trip?"*

---

### 3. Step-by-Step Backend Implementation

| Task | Detail |
| --- | --- |
| **Auth Middleware** | Verify JWT from Flutter app to ensure data belongs to the correct `user_id`. |
| **Telemetry Route** | `POST /api/v1/trips/sync`: Accepts a JSON array of breadcrumbs. |
| **Validation** | Ensure `lat` is between -90/90 and `long` between -180/180. |
| **FCM Service** | Logic to send `data` messages that wake up the Flutter app's background survey UI. |

---

### 4. Code Snippet: PostGIS Point Insertion (Node.js)

When the Flutter app sends a batch of coordinates, your Node.js service should insert them like this:

```javascript
const query = `
  INSERT INTO breadcrumbs (trip_id, location, speed, recorded_at)
  VALUES ($1, ST_SetSRID(ST_MakePoint($2, $3), 4326), $4, $5)
`;
// $2 = longitude, $3 = latitude
await pool.query(query, [tripId, lon, lat, speed, timestamp]);

```

> **Note:** PostGIS uses **(Longitude, Latitude)** order. Swapping these is the #1 cause of "trips in the middle of the ocean" bugs!

---

### 5. Milestone 3 Checklist

* [ ] **API Endpoint:** Successfully receives a JSON array of GPS points.
* [ ] **Database Verification:** Points are visible in the `breadcrumbs` table with correct Geometry types.
* [ ] **Nudge Logic:** A "Trip Completed" status in the DB successfully triggers a Firebase Push Notification to the device.
* [ ] **Distance Calculation:** Server-side logic correctly calculates total KM using `ST_Length(geography)`.

**Would you like me to write the `FCM Notification Service` in Node.js to handle the nudges, or should we move to Milestone 4 for the Admin Dashboard?**

[Smart Travel Data Collection App for NATPAC Demo](https://www.youtube.com/watch?v=EE9Q8NBRvRw)
This video showcases a similar project architecture using Flutter, Node.js, and PostgreSQL specifically for the NATPAC SIH problem statement, which will help you visualize the end-to-end flow.


## 🔵 Milestone 4: The NATPAC Analytics Dashboard (Admin)

This is the "Value Proposition" for the Government of Kerala. After collecting data from thousands of users, NATPAC scientists need a web-based command center to visualize and analyze travel patterns.

### 1. The Dashboard Architecture

* **Frontend:** React.js or Next.js (for a professional, fast UI).
* **Mapping Library:** **Leaflet.js** or **MapLibre GL** (Excellent for rendering thousands of GPS points without slowing down).
* **Data Visualization:** **Chart.js** or **Recharts** (To show modal splits: % of people using Bus vs. Car).

---

### 2. Key Features for NATPAC Scientists

#### A. Origin-Destination (O-D) Heatmaps

Instead of individual lines, show "Flow Density." This helps planners see where a new bus route or flyover is needed.

* **Logic:** Aggregate all `trips` where `start_time` is between 8:00 AM and 10:00 AM to visualize morning peak-hour traffic.

#### B. Modal Split Analytics

A pie chart showing how people are moving.

* **Query:** `SELECT travel_mode, COUNT(*) FROM trips GROUP BY travel_mode;`
* **Insight:** "Why is 70% of the population in Aluva using private cars instead of the Metro?"

#### C. Trip Chain Reconstruction

The ability to click on a "User ID" (anonymized) and see their full day:

* *Home (8:00 AM) ➔ Office (9:00 AM) ➔ Lunch (1:00 PM) ➔ Gym (6:00 PM) ➔ Home (8:00 PM).*

---

### 3. Implementation Step-by-Step

| Component | Task |
| --- | --- |
| **Geo-API** | Create a Node.js route `/api/v1/admin/spatial-data` that returns GeoJSON. |
| **Map View** | Integrate Leaflet and add a `TileLayer` from OpenStreetMap (OSM). |
| **Filters** | Add a sidebar to filter by **Date**, **Time of Day**, **District**, and **Purpose**. |
| **Export** | Build a "Download as CSV/Shapefile" button so scientists can import data into GIS software like QGIS. |

---

### 4. Code Snippet: Fetching GeoJSON for the Map (Node.js)

Your dashboard needs data in a format maps understand. PostGIS makes this easy:

```javascript
// Route to get all trip paths as GeoJSON
router.get('/map-paths', async (req, res) => {
  const query = `
    SELECT jsonb_build_object(
      'type', 'FeatureCollection',
      'features', jsonb_agg(ST_AsGeoJSON(t.*)::jsonb)
    )
    FROM (
      SELECT id, travel_mode, trip_purpose, 
             ST_Transform(path_geometry::geometry, 4326) as geom 
      FROM trips 
      WHERE status = 'completed'
    ) AS t;
  `;
  const result = await pool.query(query);
  res.json(result.rows[0].jsonb_build_object);
});

```

---

### 🏁 Final SIH Checklist (The "Winning" Factors)

To ensure your project stands out during the final hackathon presentation:

1. **Anonymization:** Ensure the dashboard shows `User_Alpha_1` instead of `Harish M`. Privacy is a huge concern for government apps.
2. **Offline Sync:** Demonstrate the app working in a "Tunnel" (No Internet) and syncing perfectly once the connection returns.
3. **Low Battery Impact:** Show a graph of battery usage; if it's under 5% for a full day of tracking, you've won.
4. **The "Kerala Context":** Use local place names (Kochi, Thiruvananthapuram) in your demo data to make it relatable to the NATPAC judges.

---

### **Where do we go from here?**

We have completed the 4 Milestones!

* **Would you like me to generate a "Project Pitch Deck" outline for your SIH presentation?**
* **Or do you want the full `package.json` and `pubspec.yaml` files to start installing the libraries?**