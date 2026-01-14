# 📁 Project Structure - Simplified GPS Tracker

## 🎯 Kya Remove Kiya?

### ❌ Removed (backup_old_files mein hai)
- ✖️ User authentication system
- ✖️ Admin panel
- ✖️ User management
- ✖️ Complex device management
- ✖️ Alerts system
- ✖️ Reports system
- ✖️ Notifications
- ✖️ All test files
- ✖️ Setup scripts

### ✅ Kept (Working Code)
- ✅ Device CRUD (Add, List, Delete)
- ✅ Live GPS tracking
- ✅ Location history
- ✅ Engine lock/unlock commands
- ✅ WebSocket real-time updates
- ✅ GT06 protocol support

---

## 📂 Current Structure

```
gps-node/
│
├── 📁 models/                    # Database Models
│   ├── Device.js                # Simple device model (deviceId, imei, vehicleName, location)
│   └── Location.js              # Location history model
│
├── 📁 routes/                    # API Routes
│   ├── devices.js               # GET, POST, DELETE devices
│   ├── locations.js             # Live location & history
│   └── commands.js              # Engine lock/unlock
│
├── 📁 protocols/                 # GPS Protocol Handlers
│   ├── gpsProtocol.js           # Main GPS protocol handler
│   ├── gt06Decoder.js           # Decode GT06 messages
│   └── gt06Encoder.js           # Encode GT06 commands
│
├── 📁 config/                    # Configuration
│   └── database.js              # MongoDB connection
│
├── 📁 utils/                     # Utilities
│   └── logger.js                # Winston logger
│
├── 📁 public/                    # Frontend
│   └── index.html               # Simple dashboard
│
├── 📁 logs/                      # Log files
│   ├── app.log                  # Application logs
│   └── gps-protocol.log         # GPS protocol logs
│
├── 📁 backup_old_files/          # Old complex code (backup)
│
├── server.js                     # Main server file
├── package.json                  # Dependencies (simplified)
├── .env                          # Configuration
├── README.md                     # Documentation
└── QUICK_START.md               # Quick start guide
```

---

## 🔧 Core Files Explained

### 1. `server.js` - Main Server
```javascript
// Kya karta hai:
- Express server setup
- Socket.IO for real-time updates
- GPS server (port 5023) for GT06 devices
- Routes mount karta hai
- Error handling
```

### 2. `models/Device.js` - Device Model
```javascript
// Fields:
- deviceId: Unique device identifier
- imei: 15 digit IMEI number
- vehicleName: Car/vehicle name
- online: Device online hai ya nahi
- lastSeen: Last GPS data received time
- lastLatitude, lastLongitude: Last location
- speed: Current speed
- engineLocked: Engine locked hai ya nahi
- ignition: Ignition on/off
```

### 3. `models/Location.js` - Location Model
```javascript
// Fields:
- deviceId: Which device
- latitude, longitude: GPS coordinates
- speed, course, altitude: Movement data
- timestamp: When received
- address: Reverse geocoded address (optional)
```

### 4. `routes/devices.js` - Device APIs
```javascript
GET    /api/devices          // All devices
GET    /api/devices/:id      // Single device
POST   /api/devices          // Add device
PUT    /api/devices/:id      // Update device
DELETE /api/devices/:id      // Delete device
```

### 5. `routes/locations.js` - Location APIs
```javascript
GET /api/locations/live                    // All devices live location
GET /api/locations/live/:deviceId          // Single device live location
GET /api/locations/history/:deviceId       // Location history
```

### 6. `routes/commands.js` - Command APIs
```javascript
POST /api/commands/:deviceId               // Send command (engineStop/engineResume)
GET  /api/commands/:deviceId/status        // Get device status
```

### 7. `protocols/gpsProtocol.js` - GPS Handler
```javascript
// Kya karta hai:
- GT06 devices se TCP connection handle karta hai
- GPS data decode karta hai
- Database mein save karta hai
- WebSocket se real-time updates bhejta hai
- Commands encode karke device ko bhejta hai
```

### 8. `public/index.html` - Dashboard
```javascript
// Features:
- Device add karo (form)
- All devices list dekho
- Online/offline status
- Engine lock/unlock buttons
- Real-time updates (WebSocket)
- Auto refresh every 10 seconds
```

---

## 🔄 Data Flow

### 1. GPS Device → Server
```
GT06 Device (Port 5023)
    ↓
gpsProtocol.js (Decode)
    ↓
Save to MongoDB (Device + Location)
    ↓
Emit via WebSocket
    ↓
Dashboard Update
```

### 2. Command → GPS Device
```
Dashboard/API
    ↓
POST /api/commands/:deviceId
    ↓
gpsProtocol.js (Encode GT06 command)
    ↓
Send to Device via TCP
    ↓
Device Executes (Lock/Unlock)
```

### 3. Live Location Query
```
Dashboard/API
    ↓
GET /api/locations/live
    ↓
Query MongoDB (Device model)
    ↓
Return latest location data
```

---

## 🚀 How It Works

### Step 1: Server Start
```bash
npm start
→ MongoDB connect
→ HTTP server start (port 3000)
→ GPS server start (port 5023)
→ WebSocket ready
```

### Step 2: Add Device
```bash
POST /api/devices
→ Save to MongoDB
→ Device ready to receive GPS data
```

### Step 3: GPS Device Connects
```
Device connects to port 5023
→ Login packet received
→ Device identified by IMEI
→ Mark device as online
→ Start receiving location packets
```

### Step 4: Location Updates
```
Every 30 seconds (configurable):
→ Device sends GPS packet
→ Decode latitude, longitude, speed, etc.
→ Save to Location collection
→ Update Device last location
→ Emit WebSocket event
→ Dashboard updates automatically
```

### Step 5: Send Command
```
Click "Lock Engine" button
→ POST /api/commands/GT06_001
→ Encode GT06 command packet
→ Send to device via TCP
→ Device locks engine
→ Confirmation received
→ Update database
```

---

## 🎨 API Examples

### Add Device
```bash
curl -X POST http://localhost:3000/api/devices \
  -H "Content-Type: application/json" \
  -d '{
    "deviceId": "GT06_001",
    "imei": "123456789012345",
    "vehicleName": "My Car"
  }'
```

### Get Live Locations
```bash
curl http://localhost:3000/api/locations/live
```

### Lock Engine
```bash
curl -X POST http://localhost:3000/api/commands/GT06_001 \
  -H "Content-Type: application/json" \
  -d '{"command": "engineStop"}'
```

### Get History
```bash
curl "http://localhost:3000/api/locations/history/GT06_001?limit=100"
```

---

## 🔐 Security Note

⚠️ **Important**: Is simplified version mein koi authentication nahi hai!

Production mein use karne se pehle:
1. JWT authentication add karo
2. API rate limiting add karo
3. HTTPS use karo
4. Environment variables secure karo

---

## 📊 Database Schema

### Device Collection
```javascript
{
  _id: ObjectId,
  deviceId: "GT06_001",
  imei: "123456789012345",
  vehicleName: "My Car",
  online: true,
  lastSeen: ISODate("2024-01-15T10:30:00Z"),
  lastLatitude: 28.6139,
  lastLongitude: 77.2090,
  speed: 45,
  engineLocked: false,
  ignition: true,
  createdAt: ISODate,
  updatedAt: ISODate
}
```

### Location Collection
```javascript
{
  _id: ObjectId,
  deviceId: "GT06_001",
  latitude: 28.6139,
  longitude: 77.2090,
  speed: 45,
  course: 180,
  altitude: 200,
  satellites: 12,
  timestamp: ISODate("2024-01-15T10:30:00Z"),
  createdAt: ISODate
}
```

---

## 🎯 Summary

### Ye System Kya Kar Sakta Hai?
✅ GPS devices add/remove
✅ Real-time location tracking
✅ Location history store
✅ Engine lock/unlock remotely
✅ WebSocket live updates
✅ Simple web dashboard

### Ye System Kya NAHI Kar Sakta?
❌ User authentication
❌ Multi-user support
❌ Geofencing
❌ Alerts/notifications
❌ Reports generation
❌ Advanced analytics

### Perfect For:
- Learning GPS tracking
- Small personal projects
- Testing GT06 devices
- Prototype development
- Understanding GPS protocols

---

Bas! Simple aur clean! 🚀
