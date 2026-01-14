# GPS Tracking Backend - Simplified

Simple GPS tracking backend for GT06 devices.

## Features

- **User Management** - Simple registration with username, email, password, name, mobile
- **Device Management** - Add/manage GPS devices
- **Live Location Tracking** - Real-time GPS location updates
- **Engine Control** - Lock/unlock engine remotely
- **Location History** - Store and retrieve historical location data
- **Route Replay** - Replay vehicle routes for any date
- **Reports** - Generate distance, speed, and usage reports
- **Real-time Updates** - WebSocket support for live updates

## Quick Setup

1. Install dependencies:
```bash
npm install
```

2. Set up MongoDB database

3. Configure environment variables in `.env`:
```
PORT=3000
MONGODB_URI=mongodb://localhost:27017/gps_tracker
JWT_SECRET=your_jwt_secret_key_here
GPS_PORT_GT06=5023
```

4. Create admin user:
```bash
npm run create-admin
```

5. Start the server:
```bash
npm start
```

## Default Admin Login
- Username: `admin`
- Password: `admin123`
- Email: `admin@gps.com`

## API Endpoints

### Authentication
- `POST /api/auth/register` - Register new user (username, email, password, name, mobile)
- `POST /api/auth/login` - User login
- `GET /api/auth/me` - Get current user info

### Device Management
- `GET /api/devices` - Get user devices
- `POST /api/devices` - Add new device
- `PUT /api/devices/:id` - Update device
- `DELETE /api/devices/:id` - Delete device
- `POST /api/devices/:deviceId/commands` - Send command to device

### Location Tracking
- `GET /api/locations/live/:deviceId` - Get live location
- `GET /api/locations/live` - Get all devices live locations
- `GET /api/locations/history/:deviceId` - Get location history
- `GET /api/locations/replay/:deviceId` - Get replay data
- `GET /api/locations/reports/:deviceId` - Generate reports

## Device Configuration

### GT06 Devices
Configure your GT06 device to send data to:
- Server IP: Your server IP
- Port: 5023

## User Roles

- **Admin**: Can manage all users and devices
- **User**: Can only manage their own devices

## Usage

1. Create admin user using `npm run create-admin`
2. Login as admin and register users
3. Users can add their GPS devices
4. Configure devices to send data to your server
5. Monitor live locations and control engines through API
6. Generate reports and replay routes as needed

## WebSocket Events

- `locationUpdate` - Real-time location updates
- Connect to `/` namespace for live updates

## Development

Run in development mode:
```bash
npm run dev
```