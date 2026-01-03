# GPS Tracking Backend API Documentation

## Overview
Complete GPS tracking backend supporting GT06 and Teltonika devices with real-time location tracking, engine control, and comprehensive reporting.

## Base URL
```
http://localhost:3000/api
```

## Authentication
All protected endpoints require JWT token in Authorization header:
```
Authorization: Bearer <your_jwt_token>
```

---

## 🔐 AUTHENTICATION APIs

### Register User
```http
POST /auth/register
Content-Type: application/json

{
  "username": "john_doe",
  "email": "john@example.com", 
  "password": "password123",
  "name": "John Doe",
  "mobile": "1234567890",
  "role": "user"
}
```

### Login
```http
POST /auth/login
Content-Type: application/json

{
  "email": "john@example.com",
  "password": "password123"
}
```

### Get Current User
```http
GET /auth/me
Authorization: Bearer <token>
```

---

## 🔧 ADMIN DEVICE MANAGEMENT

### Get All Devices (Admin gets all, User gets assigned only)
```http
GET /admin/devices/
Authorization: Bearer <token>
```

### Add Device (Admin Only)
```http
POST /admin/devices/add
Authorization: Bearer <admin_token>
Content-Type: application/json

{
  "deviceId": "123456789012345",
  "imei": "123456789012345",
  "deviceType": "GT06",
  "vehicleName": "My Vehicle"
}
```

### Update Device (Admin Only)
```http
PUT /admin/devices/123456789012345
Authorization: Bearer <admin_token>
Content-Type: application/json

{
  "vehicleName": "Updated Vehicle Name",
  "deviceType": "TELTONIKA",
  "status": "active"
}
```

### Delete Device (Admin Only)
```http
DELETE /admin/devices/123456789012345
Authorization: Bearer <admin_token>
```

### Assign Device to User (Admin Only)
```http
PUT /admin/devices/assign/123456789012345
Authorization: Bearer <admin_token>
Content-Type: application/json

{
  "userId": "user_id_to_assign"
}

// To unassign device:
{
  "userId": null
}
```

### Bulk Assign Devices (Admin Only)
```http
PUT /admin/devices/bulk-assign
Authorization: Bearer <admin_token>
Content-Type: application/json

{
  "deviceIds": ["device1", "device2", "device3"],
  "userId": "user_id"
}

// To unassign multiple devices:
{
  "deviceIds": ["device1", "device2", "device3"],
  "userId": null
}
```

### Get Unassigned Devices (Admin Only)
```http
GET /admin/devices/unassigned
Authorization: Bearer <admin_token>
```

### Get Devices by User (Admin Only)
```http
GET /admin/devices/by-user/USER_ID
Authorization: Bearer <admin_token>
```

---

## 👤 ADMIN USER MANAGEMENT

### Get All Users (Admin Only)
```http
GET /admin/users/
Authorization: Bearer <admin_token>
```

### Register New User (Admin Only)
```http
POST /admin/users/register
Authorization: Bearer <admin_token>
Content-Type: application/json

{
  "username": "john_doe",
  "email": "john@example.com",
  "password": "password123",
  "name": "John Doe",
  "mobile": "1234567890"
}
```

### Update User (Admin Only)
```http
PUT /admin/users/USER_ID
Authorization: Bearer <admin_token>
Content-Type: application/json

{
  "username": "updated_username",
  "email": "updated@example.com",
  "name": "Updated Name",
  "mobile": "9876543210",
  "password": "new_password"
}
```

### Delete User (Admin Only)
```http
DELETE /admin/users/USER_ID
Authorization: Bearer <admin_token>

// Note: All devices assigned to this user will be unassigned automatically
```

---

## 📍 LOCATION TRACKING

### Get Live Location
```http
GET /locations/live/:deviceId
Authorization: Bearer <token>
```

### Get All Devices Live Locations
```http
GET /locations/live
Authorization: Bearer <token>
```

### Get Location History
```http
GET /locations/history/:deviceId?startDate=2024-01-01&endDate=2024-01-15&limit=100
Authorization: Bearer <token>
```

### Get Route Replay Data
```http
GET /locations/replay/:deviceId?date=2024-01-15
Authorization: Bearer <token>
```

### Get Device Locations
```http
GET /devices/:deviceId/locations?startDate=2024-01-01&endDate=2024-01-15&limit=1000
Authorization: Bearer <token>
```

### Get Device Route
```http
GET /devices/:deviceId/route?startTime=2024-01-15T00:00:00Z&endTime=2024-01-15T23:59:59Z
Authorization: Bearer <token>
```

---

## 🎛️ DEVICE CONTROL

### Send Command to Device
```http
POST /devices/:deviceId/commands
Authorization: Bearer <token>
Content-Type: application/json

// Engine Stop
{
  "type": "engineStop",
  "parameters": {
    "password": "123456"
  }
}

// Engine Resume
{
  "type": "engineResume",
  "parameters": {
    "password": "123456"
  }
}

// Custom Command
{
  "type": "customCommand",
  "parameters": {
    "command": "RESET"
  }
}
```

---

## 🚨 ALERTS MANAGEMENT

### Get Device Alerts Configuration
```http
GET /devices/:deviceId/alerts
Authorization: Bearer <token>
```

### Update Device Alerts Configuration
```http
PUT /devices/:deviceId/alerts
Authorization: Bearer <token>
Content-Type: application/json

{
  "overspeed": {
    "enabled": true,
    "threshold": 80
  },
  "geofence": {
    "enabled": true
  },
  "powerCut": {
    "enabled": true
  },
  "lowBattery": {
    "enabled": true,
    "threshold": 20
  },
  "sos": {
    "enabled": true
  },
  "offline": {
    "enabled": true,
    "timeout": 300
  }
}
```

---

## 📊 REPORTS

### Generate Distance Report
```http
GET /locations/reports/:deviceId?type=distance&startDate=2024-01-01&endDate=2024-01-15
Authorization: Bearer <token>
```

### Generate Speed Report
```http
GET /locations/reports/:deviceId?type=speed&startDate=2024-01-01&endDate=2024-01-15
Authorization: Bearer <token>
```

### Get Device Statistics
```http
GET /devices/statistics
Authorization: Bearer <token>
```

---

## 🔌 WebSocket Events

Connect to WebSocket for real-time updates:
```javascript
const socket = io('http://localhost:3000');

// Join user room
socket.emit('join', { userId: 'your_user_id' });

// Listen for location updates
socket.on('locationUpdate', (data) => {
  console.log('New location:', data);
  // {
  //   deviceId: '123456789012345',
  //   position: {
  //     latitude: 28.6139,
  //     longitude: 77.2090,
  //     speed: 45,
  //     ignition: true,
  //     engineOn: true
  //   },
  //   timestamp: '2024-01-15T10:30:00Z'
  // }
});

// Listen for device alerts
socket.on('deviceAlert', (data) => {
  console.log('Device alert:', data);
});

// Listen for device status updates
socket.on('deviceStatusUpdate', (data) => {
  console.log('Device status:', data);
});

// Send device command
socket.emit('deviceCommand', {
  deviceId: '123456789012345',
  command: 'engineStop',
  parameters: { password: '123456' }
});

// Listen for command result
socket.on('commandResult', (data) => {
  console.log('Command result:', data);
});
```

---

## 📱 RESPONSE FORMATS

### Success Response
```json
{
  "success": true,
  "message": "Operation successful",
  "data": {
    // Response data
  }
}
```

### Error Response
```json
{
  "success": false,
  "message": "Error description",
  "error": "Detailed error message"
}
```

### Device Response
```json
{
  "_id": "device_id",
  "deviceId": "123456789012345",
  "imei": "123456789012345",
  "deviceType": "GT06",
  "vehicleName": "Vehicle 1",
  "userId": {
    "_id": "user_id",
    "username": "john_doe",
    "email": "john@example.com"
  },
  "status": "active",
  "online": true,
  "lastSeen": "2024-01-15T10:30:00Z"
}
```

### Location Response
```json
{
  "_id": "location_id",
  "deviceId": "123456789012345",
  "latitude": 28.6139,
  "longitude": 77.2090,
  "speed": 45,
  "course": 180,
  "altitude": 200,
  "engineOn": true,
  "ignition": true,
  "gpsValid": true,
  "satellites": 8,
  "timestamp": "2024-01-15T10:30:00Z",
  "address": "New Delhi, India"
}
```

---

## 🔧 DEVICE CONFIGURATION

### GT06 Devices
Configure your GT06 device with:
- **Server IP:** Your server IP address
- **Port:** 5023
- **Protocol:** GT06

### Teltonika Devices  
Configure your Teltonika device with:
- **Server IP:** Your server IP address
- **Port:** 5027
- **Protocol:** Teltonika AVL

---

## 🚀 QUICK START

1. **Start Server:**
```bash
npm start
```

2. **Create Admin User:**
```bash
npm run create-admin
```

3. **Login as Admin:**
```javascript
POST /api/auth/login
{
  "email": "admin@gps.com",
  "password": "admin123"
}
```

4. **Add Device:**
```javascript
POST /api/admin/devices/add
{
  "deviceId": "123456789012345",
  "imei": "123456789012345",
  "deviceType": "GT06",
  "vehicleName": "Test Vehicle"
}
```

5. **Register User:**
```javascript
POST /api/admin/users/register
{
  "username": "testuser",
  "email": "user@test.com",
  "password": "password123",
  "name": "Test User"
}
```

6. **Assign Device:**
```javascript
PUT /api/admin/devices/assign/123456789012345
{
  "userId": "user_id_from_step_5"
}
```

---

## 📋 PERMISSION SUMMARY

| Action | Admin | User |
|--------|-------|------|
| View all devices | ✅ | ❌ |
| View assigned devices | ✅ | ✅ |
| Add device | ✅ | ❌ |
| Update device | ✅ | ❌ |
| Delete device | ✅ | ❌ |
| Assign device | ✅ | ❌ |
| Register user | ✅ | ❌ |
| Update user | ✅ | ❌ |
| Delete user | ✅ | ❌ |
| View locations | ✅ | ✅ (assigned only) |
| Send commands | ✅ | ✅ (assigned only) |
| Configure alerts | ✅ | ✅ (assigned only) |
| Generate reports | ✅ | ✅ (assigned only) |

---

## 🔒 SECURITY FEATURES

- JWT-based authentication
- Password hashing with bcrypt
- Role-based access control
- Input validation and sanitization
- CORS protection
- Rate limiting
- Helmet security headers

---

## 🌐 DEPLOYMENT

### Requirements
- Node.js 16+
- MongoDB 4.4+
- Redis (optional)
- PostgreSQL (optional)
- Network access on ports 3000, 5023, 5027

### Environment Variables
```env
PORT=3000
MONGODB_URI=mongodb://localhost:27017/gps_tracker
JWT_SECRET=your_jwt_secret_key_here
GPS_PORT_GT06=5023
GPS_PORT_TELTONIKA=5027
```

### Production Setup
```bash
# Install dependencies
npm install

# Set environment variables
# Start MongoDB service
# Run server
npm start

# For production with PM2
npm install -g pm2
pm2 start server.js --name "gps-tracker"
```