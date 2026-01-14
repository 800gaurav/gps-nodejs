# 🚀 Quick Start Guide - Simple GPS Tracker

## Step 1: Dependencies Install Karo

```bash
npm install
```

## Step 2: .env File Check Karo

`.env` file mein ye settings honi chahiye:

```env
PORT=3000
MONGODB_URI=mongodb+srv://gauravsharmaa0111_db_user:eD7Ku7DXn4ZM3YJV@cluster0.yxvl5rv.mongodb.net/
GPS_PORT_GT06=5023
```

## Step 3: Server Start Karo

```bash
npm start
```

Ya development mode ke liye:

```bash
npm run dev
```

## Step 4: Dashboard Open Karo

Browser mein jao:
```
http://localhost:3000
```

## 🎯 Ab Kya Kar Sakte Ho?

### 1️⃣ Device Add Karo

Dashboard pe form fill karo:
- **Device ID**: GT06_001
- **IMEI**: 123456789012345 (15 digits)
- **Vehicle Name**: My Car

Ya API se:
```bash
curl -X POST http://localhost:3000/api/devices \
  -H "Content-Type: application/json" \
  -d "{\"deviceId\":\"GT06_001\",\"imei\":\"123456789012345\",\"vehicleName\":\"My Car\"}"
```

### 2️⃣ Live Location Dekho

Dashboard pe automatically dikhega ya API se:
```bash
curl http://localhost:3000/api/locations/live
```

### 3️⃣ Engine Lock/Unlock Karo

Dashboard pe button click karo ya API se:

**Lock Engine:**
```bash
curl -X POST http://localhost:3000/api/commands/GT06_001 \
  -H "Content-Type: application/json" \
  -d "{\"command\":\"engineStop\"}"
```

**Unlock Engine:**
```bash
curl -X POST http://localhost:3000/api/commands/GT06_001 \
  -H "Content-Type: application/json" \
  -d "{\"command\":\"engineResume\"}"
```

### 4️⃣ Location History Dekho

```bash
curl "http://localhost:3000/api/locations/history/GT06_001?limit=50"
```

## 📱 GT06 Device Configuration

Apne GPS device ko configure karo:

1. **Server IP**: Apna server IP (jahan ye code run ho raha hai)
2. **Port**: 5023
3. **Protocol**: GT06

SMS commands (device ke manual se check karo):
```
SERVER,123456,<your_server_ip>,5023#
```

## 🔍 Testing

### Health Check
```bash
curl http://localhost:3000/health
```

### API Documentation
```bash
curl http://localhost:3000/api
```

## 📂 Important Files

```
gps-node/
├── server.js              # Main server file
├── models/
│   ├── Device.js         # Device model (simple)
│   └── Location.js       # Location model
├── routes/
│   ├── devices.js        # Device CRUD APIs
│   ├── locations.js      # Location APIs
│   └── commands.js       # Command APIs
├── protocols/
│   ├── gpsProtocol.js    # GPS protocol handler
│   ├── gt06Decoder.js    # GT06 decoder
│   └── gt06Encoder.js    # GT06 encoder
└── public/
    └── index.html        # Dashboard
```

## ⚠️ Important Notes

1. **No Authentication**: Koi login/password nahi hai. Direct use karo!
2. **MongoDB Required**: MongoDB connection string `.env` mein hona chahiye
3. **Port 5023**: GPS devices ke liye port 5023 open hona chahiye
4. **Real-time Updates**: WebSocket se automatic updates milenge

## 🐛 Troubleshooting

### Server start nahi ho raha?
```bash
# Check MongoDB connection
# .env file check karo
```

### Device connect nahi ho raha?
```bash
# Port 5023 open hai ya nahi check karo
# Device configuration check karo
# Logs dekho: logs/gps-protocol.log
```

### Commands kaam nahi kar rahe?
```bash
# Device online hai ya nahi check karo
# Device password check karo (default: 123456)
```

## 📞 Support

Koi problem ho to:
1. Logs check karo: `logs/app.log` aur `logs/gps-protocol.log`
2. Health check karo: `http://localhost:3000/health`
3. Console output dekho

## ✅ Checklist

- [ ] Dependencies install kiye?
- [ ] .env file configure kiya?
- [ ] MongoDB connection working hai?
- [ ] Server start ho gaya?
- [ ] Dashboard open ho raha hai?
- [ ] Device add kar paye?
- [ ] GPS device configure kiya?

Sab ✅ ho gaya? Congratulations! 🎉

Ab aap GPS tracking kar sakte ho! 🚗📍
