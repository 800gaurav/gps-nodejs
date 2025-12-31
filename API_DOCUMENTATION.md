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

## API Endpoints

### Authentication

#### Register User
```http
POST /auth/register
Content-Type: application/json

{
  "username": "john_doe",
  "email": "john@example.com", 
  "password": "password123",
  "role": "user"
}
```

**Response:**
```json
{
  "token": "jwt_token_here",
  "user": {
    "id": "user_id",
    "username": "john_doe",
    "email": "john@example.com",
    "role": "user"
  }
}
```

#### Login
```http
POST /auth/login
Content-Type: application/json

{
  "email": "john@example.com",
  "password": "password123"
}
```

#### Get Current User
```http
GET /auth/me
Authorization: Bearer <token>
```

### Device Management

#### Get User Devices
```http
GET /devices
Authorization: Bearer <token>
```

**Response:**
```json
[
  {
    "_id": "device_id",
    "deviceId": "123456789012345",
    "imei": "123456789012345", 
    "deviceType": "GTO6",
    "protocol": 5027,
    "vehicleName": "Vehicle-2345",
    "userId": "user_id",
    "isActive": true,
    "engineLocked": false,
    "lastSeen": "2024-01-15T10:30:00Z"
  }
]
```

#### Add New Device
```http
POST /devices
Authorization: Bearer <token>
Content-Type: application/json

{
  "deviceId": "123456789012345",
  "imei": "123456789012345",
  "deviceType": "GTO6",
  "protocol": 5027,
  "vehicleName": "My Vehicle"
}
```

#### Update Device
```http
PUT /devices/:id
Authorization: Bearer <token>
Content-Type: application/json

{
  "vehicleName": "Updated Vehicle Name",
  "isActive": true
}
```

#### Delete Device
```http
DELETE /devices/:id
Authorization: Bearer <token>
```

#### Engine Control
```http
POST /devices/:deviceId/engine/lock
Authorization: Bearer <token>
```

```http
POST /devices/:deviceId/engine/unlock
Authorization: Bearer <token>
```

### Location Tracking

#### Get Live Location
```http
GET /locations/live/:deviceId
Authorization: Bearer <token>
```

**Response:**
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
  "device": {
    "vehicleName": "My Vehicle",
    "deviceType": "GTO6",
    "engineLocked": false
  }
}
```

#### Get All Devices Live Locations
```http
GET /locations/live
Authorization: Bearer <token>
```

#### Get Location History
```http
GET /locations/history/:deviceId?startDate=2024-01-01&endDate=2024-01-15&limit=100
Authorization: Bearer <token>
```

#### Get Route Replay Data
```http
GET /locations/replay/:deviceId?date=2024-01-15
Authorization: Bearer <token>
```

#### Generate Reports
```http
GET /locations/reports/:deviceId?type=distance&startDate=2024-01-01&endDate=2024-01-15
Authorization: Bearer <token>
```

**Report Types:**
- `distance` - Total distance traveled
- `speed` - Speed statistics (avg, max, min)
- `default` - Total records count

**Distance Report Response:**
```json
{
  "totalDistance": "125.45"
}
```

**Speed Report Response:**
```json
{
  "avgSpeed": 45.2,
  "maxSpeed": 80,
  "minSpeed": 0
}
```

## WebSocket Events

Connect to WebSocket for real-time updates:
```javascript
const socket = io('http://localhost:3000');

socket.on('locationUpdate', (data) => {
  console.log('New location:', data);
});
```

### Events:
- `locationUpdate` - Real-time GPS location updates

## Device Configuration

### GT06 Devices (Protocol 5027)
Configure your GT06 device with:
- **Server IP:** Your server IP address
- **Port:** 5027
- **Protocol:** GT06

### Teltonika Devices (Protocol 2023)  
Configure your Teltonika device with:
- **Server IP:** Your server IP address
- **Port:** 2023
- **Protocol:** Teltonika AVL

## Error Responses

All endpoints return appropriate HTTP status codes:

- `200` - Success
- `201` - Created
- `400` - Bad Request
- `401` - Unauthorized
- `403` - Forbidden
- `404` - Not Found
- `500` - Internal Server Error

**Error Response Format:**
```json
{
  "message": "Error description"
}
```

## Rate Limiting

API endpoints are rate-limited to prevent abuse. Current limits:
- Authentication endpoints: 5 requests per minute
- Other endpoints: 100 requests per minute

## Testing

Use the included test client to simulate GPS devices:

```bash
node test-devices.js
```

This will create simulated GT06 and Teltonika devices that send test GPS data.

## Database Schema

### Users Collection
```javascript
{
  username: String,
  email: String,
  password: String (hashed),
  role: String, // 'admin' or 'user'
  isActive: Boolean,
  createdAt: Date,
  updatedAt: Date
}
```

### Devices Collection
```javascript
{
  deviceId: String,
  imei: String,
  deviceType: String, // 'GTO6' or 'TELTONIKA'
  protocol: Number, // 5027 or 2023
  vehicleName: String,
  userId: ObjectId,
  isActive: Boolean,
  engineLocked: Boolean,
  lastSeen: Date,
  createdAt: Date,
  updatedAt: Date
}
```

### Locations Collection
```javascript
{
  deviceId: String,
  latitude: Number,
  longitude: Number,
  speed: Number,
  course: Number,
  altitude: Number,
  engineOn: Boolean,
  ignition: Boolean,
  gpsValid: Boolean,
  satellites: Number,
  timestamp: Date,
  address: String,
  createdAt: Date,
  updatedAt: Date
}
```

## Security Features

- JWT-based authentication
- Password hashing with bcrypt
- Role-based access control
- Input validation and sanitization
- CORS protection
- Rate limiting

## Deployment

### Requirements
- Node.js 16+
- MongoDB 4.4+
- Network access on ports 3000, 5027, 2023

### Environment Variables
```env
PORT=3000
MONGODB_URI=mongodb://localhost:27017/gps_tracker
JWT_SECRET=your_jwt_secret_key_here
GPS_PORT_5027=5027
GPS_PORT_2023=2023
```

### Production Setup
1. Install dependencies: `npm install`
2. Set environment variables
3. Start MongoDB service
4. Run: `npm start`

For production deployment, consider using PM2:
```bash
npm install -g pm2
pm2 start server.js --name "gps-tracker"
```