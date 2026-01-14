# Simple GPS Tracker - GT06 Protocol

Ek simple aur clean GPS tracking system. Koi authentication nahi, seedha device add karo aur track karo!

## 🚀 Features

- ✅ Device add/delete karo
- ✅ Live GPS location dekho
- ✅ Engine lock/unlock commands bhejo
- ✅ Location history dekho
- ✅ Real-time WebSocket updates

## 📦 Installation

```bash
npm install
```

## ⚙️ Configuration

`.env` file mein ye settings rakho:

```env
PORT=3000
MONGODB_URI=your_mongodb_connection_string
GPS_PORT_GT06=5023
```

## 🏃 Start Server

```bash
npm start
```

Ya development mode ke liye:

```bash
npm run dev
```

## 📡 API Endpoints

### Devices

**Get all devices**
```
GET /api/devices
```

**Add new device**
```
POST /api/devices
Body: {
  "deviceId": "GT06_001",
  "imei": "123456789012345",
  "vehicleName": "My Car"
}
```

**Delete device**
```
DELETE /api/devices/:id
```

### Live Location

**Get all devices live location**
```
GET /api/locations/live
```

**Get specific device location**
```
GET /api/locations/live/:deviceId
```

**Get location history**
```
GET /api/locations/history/:deviceId?startDate=2024-01-01&endDate=2024-01-31&limit=100
```

### Commands

**Send engine command**
```
POST /api/commands/:deviceId
Body: {
  "command": "engineStop",  // ya "engineResume"
  "password": "123456"
}
```

**Get device status**
```
GET /api/commands/:deviceId/status
```

## 🔌 WebSocket Events

Connect to `http://localhost:3000` for real-time updates:

```javascript
const socket = io('http://localhost:3000');

socket.on('locationUpdate', (data) => {
  console.log('New location:', data);
});

socket.on('deviceStatusUpdate', (data) => {
  console.log('Device status:', data);
});
```

## 📱 Device Configuration

Apne GT06 device ko configure karo:

- **Server IP**: Your server IP
- **Port**: 5023
- **Protocol**: GT06

## 🧪 Testing

### Add Device
```bash
curl -X POST http://localhost:3000/api/devices \
  -H "Content-Type: application/json" \
  -d '{
    "deviceId": "GT06_001",
    "imei": "123456789012345",
    "vehicleName": "Test Car"
  }'
```

### Get Live Location
```bash
curl http://localhost:3000/api/locations/live
```

### Lock Engine
```bash
curl -X POST http://localhost:3000/api/commands/GT06_001 \
  -H "Content-Type: application/json" \
  -d '{"command": "engineStop"}'
```

## 📂 Project Structure

```
gps-node/
├── models/
│   ├── Device.js          # Device model (simple)
│   └── Location.js        # Location model
├── routes/
│   ├── devices.js         # Device CRUD
│   ├── locations.js       # Location tracking
│   └── commands.js        # Device commands
├── protocols/
│   ├── gpsProtocol.js     # GPS protocol handler
│   ├── gt06Decoder.js     # GT06 decoder
│   └── gt06Encoder.js     # GT06 encoder
├── config/
│   └── database.js        # MongoDB connection
├── utils/
│   └── logger.js          # Logger
├── server.js              # Main server file
└── .env                   # Configuration
```

## 🎯 Quick Start Example

1. Server start karo:
```bash
npm start
```

2. Device add karo:
```bash
curl -X POST http://localhost:3000/api/devices \
  -H "Content-Type: application/json" \
  -d '{"deviceId":"GT06_001","imei":"123456789012345","vehicleName":"My Car"}'
```

3. Live location dekho:
```bash
curl http://localhost:3000/api/locations/live
```

4. Engine lock karo:
```bash
curl -X POST http://localhost:3000/api/commands/GT06_001 \
  -H "Content-Type: application/json" \
  -d '{"command":"engineStop"}'
```

## 📊 API Documentation

Server start karne ke baad visit karo:
```
http://localhost:3000/api
```

## ❤️ Simple & Clean

- ❌ No authentication
- ❌ No user management
- ❌ No complex features
- ✅ Sirf GPS tracking
- ✅ Device management
- ✅ Engine control

Bas itna hi! Simple aur working! 🚀
