# GPS Device Testing Guide

Mock GPS device simulator banaya gaya hai jo real GT06 device jaisa data send karta hai.

## 🚀 Quick Start

### 1. Basic Device Test
```bash
node test/testGpsSimulator.js basic
```
- Simple device connection
- Login message
- Location updates every 10 seconds

### 2. Moving Vehicle Test
```bash
node test/testGpsSimulator.js moving
```
- Engine start
- Speed 60 km/h
- GPS coordinates change
- Location updates every 5 seconds

### 3. Engine Control Test
```bash
node test/testGpsSimulator.js engine
```
- Engine start/stop cycle
- Speed changes
- Ignition status changes

### 4. Multiple Devices Test
```bash
node test/testGpsSimulator.js multiple
```
- 3 different devices
- Different locations
- Some moving, some stationary

### 5. Interactive Mode
```bash
node test/testGpsSimulator.js interactive
```
- Manual control
- Real-time commands
- Engine start/stop
- Speed control

## 🔧 Raw Packet Testing

### Send Pre-defined Packets
```bash
node test/rawPacketSender.js
```

### Interactive Raw Mode
```bash
node test/rawPacketSender.js interactive
```

Commands:
- `login` - Send login packet
- `location` - Send location packet  
- `heartbeat` - Send heartbeat
- Custom hex string - Send raw packet

## 📊 Test Data Generated

### Device Info
- **IMEI**: 123456789012345 (basic)
- **IMEI**: 123456789012346 (moving)
- **IMEI**: 123456789012347 (engine test)

### GPS Data
- **Location**: Delhi (28.6139, 77.2090)
- **Speed**: 0-200 km/h
- **Course**: 0-360 degrees
- **Ignition**: ON/OFF
- **ACC**: ON/OFF

### GT06 Protocol Features
- ✅ Login messages
- ✅ Location reports
- ✅ Heartbeat packets
- ✅ Engine status
- ✅ Speed data
- ✅ GPS coordinates
- ✅ Ignition detection
- ✅ ACC status

## 🧪 Testing Commands

### Add Device First
```bash
curl -X POST http://localhost:3000/api/devices \
  -H "Content-Type: application/json" \
  -d '{
    "deviceId": "GT06_001",
    "imei": "123456789012345",
    "vehicleName": "Test Car"
  }'
```

### Check Live Location
```bash
curl http://localhost:3000/api/locations/live
```

### Send Engine Command
```bash
curl -X POST http://localhost:3000/api/commands/GT06_001 \
  -H "Content-Type: application/json" \
  -d '{"command": "engineStop"}'
```

## 📱 Real Device Simulation

Mock device ye sab simulate karta hai:
- **Real GT06 protocol packets**
- **Proper CRC calculation**
- **Login sequence**
- **Location reporting**
- **Heartbeat messages**
- **Engine status**
- **Speed changes**
- **GPS coordinate updates**

## 🔍 Debug Mode

Server console mein ye dikhega:
```
========== RAW GPS DATA RECEIVED ==========
Connection: 127.0.0.1:54321
Device IMEI: 123456789012345
Data Length: 25
HEX: 787811010123456789012345001a040d0a
HEX (formatted): 78 78 11 01 01 23 45 67 89 01 23 45 00 1a 04 0d 0a
==========================================
```

## 🎯 Usage Examples

### Test Scenario 1: Basic Connection
1. Start server: `npm start`
2. Add device via API
3. Run: `node test/testGpsSimulator.js basic`
4. Check live location API

### Test Scenario 2: Moving Vehicle
1. Start server
2. Add device
3. Run: `node test/testGpsSimulator.js moving`
4. Watch location changes in real-time

### Test Scenario 3: Engine Commands
1. Start server
2. Add device
3. Run: `node test/testGpsSimulator.js interactive`
4. Send engine stop command via API
5. Check device response

## 🚨 Troubleshooting

### Connection Issues
- Check server is running on port 5023
- Check firewall settings
- Verify MongoDB connection

### No Location Updates
- Device must be added via API first
- Check IMEI matches
- Verify GPS protocol handler

### Command Not Working
- Check device is connected
- Verify command format
- Check server logs

## 📈 Performance Testing

Multiple devices ke liye:
```bash
# Terminal 1
node test/testGpsSimulator.js multiple

# Terminal 2  
node test/testGpsSimulator.js moving

# Terminal 3
node test/testGpsSimulator.js engine
```

Ye 6+ devices simultaneously test karega!