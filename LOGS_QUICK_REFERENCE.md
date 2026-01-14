# 🚀 Quick Logs Reference Card

## ✅ SUCCESS Logs (Sab Theek Hai)

```
✅ CONNECTION ESTABLISHED          → Device connected successfully
📱 DEVICE CONNECTED                → Device authenticated
🔑 DEVICE AUTHENTICATED            → Login successful
📍 LOCATION UPDATE                 → GPS data received
✅ DATABASE UPDATED                → Data saved to DB
✅ LOCATION SAVED                  → Location history saved
📡 WEBSOCKET BROADCAST             → Real-time update sent
📤 RESPONSE SENT                   → Reply sent to device
```

---

## ❌ ERROR Logs (Problem Hai)

```
❌ CONNECTION REJECTED             → Too many connections
❌ SOCKET ERROR                    → Network problem
❌ INVALID HEADER                  → Wrong protocol/data
❌ CRC VALIDATION FAILED           → Data corrupted
❌ DATABASE ERROR                  → DB save failed
❌ BUFFER TOO SHORT                → Incomplete data
❌ LOGIN FAILED                    → Authentication failed
❌ MAX ITERATIONS REACHED          → Processing stuck
```

---

## ⚠️ WARNING Logs (Dhyan Do)

```
⚠️ BUFFER OVERFLOW                 → Too much data
⚠️ NO DATA CONSUMED                → Can't process data
⚠️ UNSUPPORTED MESSAGE TYPE        → Unknown message
⏰ CONNECTION TIMEOUT               → Device not responding
🚨 ALERT                           → Device alarm triggered
```

---

## 📊 INFO Logs (Normal Activity)

```
🔌 NEW CONNECTION ATTEMPT          → Someone trying to connect
📦 DATA RECEIVED                   → Data arrived
📦 DECODING MESSAGE                → Processing data
🔍 DEVICE VARIANT DETECTED         → Device type identified
💓 HEARTBEAT                       → Device alive signal
🔧 COMMAND SENT                    → Command sent to device
```

---

## 🔍 Device Connection Flow

```
1. 🔌 NEW CONNECTION ATTEMPT       → Device trying to connect
2. ✅ CONNECTION ESTABLISHED       → TCP connection OK
3. 📦 DATA RECEIVED                → First data packet
4. 📦 DECODING MESSAGE             → Parsing data
5. 🔑 LOGIN MESSAGE DETECTED       → Login packet found
6. 🔑 LOGIN REQUEST RECEIVED       → IMEI extracted
7. 📱 DEVICE CONNECTED             → Device registered
8. 🔑 DEVICE AUTHENTICATED         → Login complete
9. 📤 RESPONSE SENT                → Confirmation sent
```

---

## 📍 GPS Data Flow

```
1. 📦 DATA RECEIVED                → GPS packet arrived
2. 📦 DECODING MESSAGE             → Parsing GPS data
3. 📍 GPS MESSAGE DETECTED         → GPS packet identified
4. 📍 PROCESSING LOCATION DATA     → Extracting coordinates
5. ✅ DATABASE UPDATED             → Device status updated
6. ✅ LOCATION SAVED               → History saved
7. 📡 WEBSOCKET BROADCAST          → Real-time update sent
8. 📍 LOCATION UPDATE              → Complete
```

---

## 🚨 Troubleshooting Quick Guide

### Device Not Connecting?
**Look for:**
```
❌ CONNECTION REJECTED
❌ SOCKET ERROR
⏰ CONNECTION TIMEOUT
```
**Fix:**
- Check firewall: `sudo ufw allow 5023`
- Check port: `netstat -an | grep 5023`
- Verify device IP configuration

---

### Device Connected But No GPS Data?
**Look for:**
```
✅ CONNECTION ESTABLISHED
📱 DEVICE CONNECTED
⚠️ NO DATA CONSUMED
❌ INVALID HEADER
```
**Fix:**
- Check device GPS signal
- Verify device protocol (GT06)
- Check device configuration

---

### GPS Data Not Saving?
**Look for:**
```
📍 LOCATION UPDATE
❌ DATABASE ERROR
❌ DATABASE SAVE ERROR
```
**Fix:**
- Check MongoDB connection
- Check disk space
- Verify device exists in DB

---

### Wrong Location Data?
**Look for:**
```
📍 PROCESSING LOCATION DATA
valid: false
satellites: 0
```
**Fix:**
- Device needs GPS signal
- Move device outside
- Wait for GPS fix

---

## 📝 Common Log Patterns

### Successful Device Session:
```
🔌 NEW CONNECTION ATTEMPT from 192.168.1.100:54321
✅ CONNECTION ESTABLISHED
📦 DATA RECEIVED { dataLength: 18 }
🔑 LOGIN MESSAGE DETECTED
📱 DEVICE CONNECTED: 123456789012345
📦 DATA RECEIVED { dataLength: 45 }
📍 GPS MESSAGE DETECTED
📍 LOCATION UPDATE: 123456789012345
✅ DATABASE UPDATED
✅ LOCATION SAVED
```

### Failed Connection:
```
🔌 NEW CONNECTION ATTEMPT from 192.168.1.100:54321
❌ SOCKET ERROR: Connection reset by peer
🔌 CONNECTION CLOSED
```

### Invalid Data:
```
📦 DATA RECEIVED { dataLength: 10 }
❌ INVALID HEADER: 0x1234
⚠️ NO DATA CONSUMED
```

---

## 🎯 Quick Commands

### View Real-time Logs:
```bash
# Linux/Mac
tail -f logs/app.log

# Windows
Get-Content logs\app.log -Wait
```

### Search Device Logs:
```bash
# Linux/Mac
grep "IMEI_HERE" logs/app.log

# Windows
Select-String -Path logs\app.log -Pattern "IMEI_HERE"
```

### Count Connections Today:
```bash
# Linux/Mac
grep "DEVICE CONNECTED" logs/app.log | grep "$(date +%Y-%m-%d)" | wc -l

# Windows
(Select-String -Path logs\app.log -Pattern "DEVICE CONNECTED").Count
```

### Find Errors:
```bash
# Linux/Mac
grep "ERROR" logs/error.log | tail -20

# Windows
Select-String -Path logs\error.log -Pattern "ERROR" | Select-Object -Last 20
```

---

## 📞 Emergency Checklist

- [ ] Server running? → `ps aux | grep node`
- [ ] Port listening? → `netstat -an | grep 5023`
- [ ] MongoDB connected? → Check startup logs
- [ ] Firewall open? → `sudo ufw status`
- [ ] Disk space? → `df -h`
- [ ] Recent errors? → `tail logs/error.log`
- [ ] Device online? → `curl http://localhost:3000/api/devices`

---

**Print this and keep it handy! 📋**
