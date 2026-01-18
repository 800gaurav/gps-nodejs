#!/bin/bash
echo "🧪 GPS Tracker API Testing Script"
echo "================================="

BASE_URL="http://localhost:3000"

echo ""
echo "1️⃣ Testing Health Check..."
curl -s "$BASE_URL/health" | jq '.'

echo ""
echo "2️⃣ Testing API Documentation..."
curl -s "$BASE_URL/api" | jq '.title'

echo ""
echo "3️⃣ Adding Test Device..."
curl -s -X POST "$BASE_URL/api/devices" \
  -H "Content-Type: application/json" \
  -d '{
    "deviceId": "123456789012345",
    "imei": "123456789012345", 
    "vehicleName": "Test Vehicle"
  }' | jq '.'

echo ""
echo "4️⃣ Getting All Devices..."
curl -s "$BASE_URL/api/devices" | jq '.'

echo ""
echo "5️⃣ Getting Live Locations..."
curl -s "$BASE_URL/api/locations/live" | jq '.'

echo ""
echo "6️⃣ Testing Engine Stop Command..."
curl -s -X POST "$BASE_URL/api/commands/123456789012345" \
  -H "Content-Type: application/json" \
  -d '{
    "command": "engineStop",
    "password": "123456"
  }' | jq '.'

echo ""
echo "7️⃣ Testing Engine Resume Command..."
curl -s -X POST "$BASE_URL/api/commands/123456789012345" \
  -H "Content-Type: application/json" \
  -d '{
    "command": "engineResume", 
    "password": "123456"
  }' | jq '.'

echo ""
echo "8️⃣ Getting Device Status..."
curl -s "$BASE_URL/api/commands/123456789012345/status" | jq '.'

echo ""
echo "9️⃣ Testing GPS Debug..."
curl -s "$BASE_URL/api/gps/debug" | jq '.gpsServer'

echo ""
echo "🔟 Testing Location History..."
curl -s "$BASE_URL/api/locations/history/123456789012345?limit=5" | jq '.'

echo ""
echo "✅ API Testing Complete!"