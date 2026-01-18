@echo off
echo 🧪 GPS Tracker API Testing Script
echo =================================

set BASE_URL=http://localhost:3000

echo.
echo 1️⃣ Testing Health Check...
curl -s "%BASE_URL%/health"

echo.
echo 2️⃣ Adding Test Device...
curl -s -X POST "%BASE_URL%/api/devices" -H "Content-Type: application/json" -d "{\"deviceId\":\"123456789012345\",\"imei\":\"123456789012345\",\"vehicleName\":\"Test Vehicle\"}"

echo.
echo 3️⃣ Getting All Devices...
curl -s "%BASE_URL%/api/devices"

echo.
echo 4️⃣ Getting Live Locations...
curl -s "%BASE_URL%/api/locations/live"

echo.
echo 5️⃣ Testing Engine Stop Command...
curl -s -X POST "%BASE_URL%/api/commands/123456789012345" -H "Content-Type: application/json" -d "{\"command\":\"engineStop\",\"password\":\"123456\"}"

echo.
echo 6️⃣ Testing Engine Resume Command...
curl -s -X POST "%BASE_URL%/api/commands/123456789012345" -H "Content-Type: application/json" -d "{\"command\":\"engineResume\",\"password\":\"123456\"}"

echo.
echo 7️⃣ Getting Device Status...
curl -s "%BASE_URL%/api/commands/123456789012345/status"

echo.
echo 8️⃣ Testing GPS Debug...
curl -s "%BASE_URL%/api/gps/debug"

echo.
echo ✅ API Testing Complete!
pause