const net = require('net');
const GT06Encoder = require('./protocols/gt06Encoder');

class GPSDeviceSimulator {
  constructor(imei, serverHost = 'localhost', serverPort = 5023) {
    this.imei = imei;
    this.serverHost = serverHost;
    this.serverPort = serverPort;
    this.socket = null;
    this.connected = false;
    this.authenticated = false;
    this.messageIndex = 1;
    
    // Real Delhi to Mumbai route coordinates
    this.route = [
      { lat: 28.6139, lng: 77.2090, name: 'Delhi' },
      { lat: 28.4595, lng: 77.0266, name: 'Gurgaon' },
      { lat: 27.1767, lng: 78.0081, name: 'Agra' },
      { lat: 26.2389, lng: 78.1677, name: 'Gwalior' },
      { lat: 23.2599, lng: 77.4126, name: 'Bhopal' },
      { lat: 21.1458, lng: 79.0882, name: 'Nagpur' },
      { lat: 20.5937, lng: 78.9629, name: 'Akola' },
      { lat: 19.0760, lng: 72.8777, name: 'Mumbai' }
    ];
    
    // Current position and movement
    this.currentRouteIndex = 0;
    this.currentLocation = {
      latitude: this.route[0].lat,
      longitude: this.route[0].lng,
      speed: 0,
      course: 0,
      satellites: 8,
      valid: true,
      altitude: 200
    };
    
    // Movement simulation
    this.movement = {
      isMoving: false,
      targetLat: this.route[0].lat,
      targetLng: this.route[0].lng,
      stepLat: 0,
      stepLng: 0,
      stepsRemaining: 0,
      maxSpeed: 80, // km/h
      acceleration: 2 // km/h per update
    };
    
    // Vehicle status
    this.status = {
      ignition: false,
      battery: 12.5,
      rssi: 25,
      armed: true,
      charge: true,
      fuel: 75,
      temperature: 25
    };
    
    this.intervals = {};
  }

  // Calculate distance between two points (Haversine formula)
  calculateDistance(lat1, lng1, lat2, lng2) {
    const R = 6371; // Earth's radius in km
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLng = (lng2 - lng1) * Math.PI / 180;
    const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
              Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
              Math.sin(dLng/2) * Math.sin(dLng/2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
    return R * c;
  }

  // Calculate bearing between two points
  calculateBearing(lat1, lng1, lat2, lng2) {
    const dLng = (lng2 - lng1) * Math.PI / 180;
    const lat1Rad = lat1 * Math.PI / 180;
    const lat2Rad = lat2 * Math.PI / 180;
    const y = Math.sin(dLng) * Math.cos(lat2Rad);
    const x = Math.cos(lat1Rad) * Math.sin(lat2Rad) - Math.sin(lat1Rad) * Math.cos(lat2Rad) * Math.cos(dLng);
    let bearing = Math.atan2(y, x) * 180 / Math.PI;
    return (bearing + 360) % 360;
  }

  // Start journey to next destination
  startJourney() {
    if (this.currentRouteIndex >= this.route.length - 1) {
      console.log(`🏁 ${this.imei}: Journey completed! Reached ${this.route[this.route.length - 1].name}`);
      this.stopVehicle();
      return;
    }

    const nextDestination = this.route[this.currentRouteIndex + 1];
    const distance = this.calculateDistance(
      this.currentLocation.latitude, this.currentLocation.longitude,
      nextDestination.lat, nextDestination.lng
    );

    console.log(`🚗 ${this.imei}: Starting journey to ${nextDestination.name} (${distance.toFixed(1)} km)`);
    
    this.movement.isMoving = true;
    this.movement.targetLat = nextDestination.lat;
    this.movement.targetLng = nextDestination.lng;
    
    // Calculate steps for smooth movement (1 step per GPS update)
    const steps = Math.max(20, Math.floor(distance * 2)); // More steps for smoother movement
    this.movement.stepLat = (nextDestination.lat - this.currentLocation.latitude) / steps;
    this.movement.stepLng = (nextDestination.lng - this.currentLocation.longitude) / steps;
    this.movement.stepsRemaining = steps;
    
    // Calculate course
    this.currentLocation.course = this.calculateBearing(
      this.currentLocation.latitude, this.currentLocation.longitude,
      nextDestination.lat, nextDestination.lng
    );
    
    this.status.ignition = true;
  }

  // Update vehicle position and speed
  updateMovement() {
    if (!this.movement.isMoving || this.movement.stepsRemaining <= 0) {
      // Gradually slow down
      if (this.currentLocation.speed > 0) {
        this.currentLocation.speed = Math.max(0, this.currentLocation.speed - this.movement.acceleration * 2);
      }
      return;
    }

    // Move towards target
    this.currentLocation.latitude += this.movement.stepLat;
    this.currentLocation.longitude += this.movement.stepLng;
    this.movement.stepsRemaining--;
    
    // Realistic speed simulation
    const distanceToTarget = this.calculateDistance(
      this.currentLocation.latitude, this.currentLocation.longitude,
      this.movement.targetLat, this.movement.targetLng
    );
    
    // Speed based on distance and road conditions
    let targetSpeed;
    if (distanceToTarget > 50) {
      targetSpeed = this.movement.maxSpeed; // Highway speed
    } else if (distanceToTarget > 10) {
      targetSpeed = 60; // City outskirts
    } else if (distanceToTarget > 2) {
      targetSpeed = 40; // City roads
    } else {
      targetSpeed = 20; // Approaching destination
    }
    
    // Add some randomness for realistic driving
    targetSpeed += (Math.random() - 0.5) * 10;
    targetSpeed = Math.max(0, Math.min(targetSpeed, this.movement.maxSpeed));
    
    // Gradual acceleration/deceleration
    if (this.currentLocation.speed < targetSpeed) {
      this.currentLocation.speed = Math.min(targetSpeed, this.currentLocation.speed + this.movement.acceleration);
    } else if (this.currentLocation.speed > targetSpeed) {
      this.currentLocation.speed = Math.max(targetSpeed, this.currentLocation.speed - this.movement.acceleration);
    }
    
    // Update course with slight variations
    this.currentLocation.course = this.calculateBearing(
      this.currentLocation.latitude, this.currentLocation.longitude,
      this.movement.targetLat, this.movement.targetLng
    ) + (Math.random() - 0.5) * 10; // ±5 degree variation
    
    this.currentLocation.course = (this.currentLocation.course + 360) % 360;
    
    // Check if reached destination
    if (this.movement.stepsRemaining <= 0) {
      this.currentRouteIndex++;
      this.movement.isMoving = false;
      
      const destination = this.route[this.currentRouteIndex];
      console.log(`📍 ${this.imei}: Reached ${destination.name}`);
      
      // Stop for a while at destination
      setTimeout(() => {
        if (this.currentRouteIndex < this.route.length - 1) {
          this.startJourney();
        }
      }, 10000); // 10 second stop
    }
  }

  // Simulate realistic vehicle status changes
  updateVehicleStatus() {
    // Battery drain when ignition is on
    if (this.status.ignition) {
      this.status.battery = Math.max(11.0, this.status.battery - 0.001);
    } else {
      this.status.battery = Math.min(12.8, this.status.battery + 0.002);
    }
    
    // Fuel consumption based on speed
    if (this.currentLocation.speed > 0) {
      const consumption = this.currentLocation.speed * 0.001;
      this.status.fuel = Math.max(0, this.status.fuel - consumption);
    }
    
    // Signal strength variation
    this.status.rssi = 15 + Math.floor(Math.random() * 20);
    
    // Temperature variation
    this.status.temperature = 20 + Math.random() * 15;
    
    // GPS satellites (realistic variation)
    this.currentLocation.satellites = 6 + Math.floor(Math.random() * 6);
    
    // Altitude variation
    this.currentLocation.altitude = 150 + Math.random() * 100;
  }

  stopVehicle() {
    console.log(`🛑 ${this.imei}: Vehicle stopped`);
    this.movement.isMoving = false;
    this.status.ignition = false;
    this.currentLocation.speed = 0;
  }

  // Create GT06 messages (same as before but with updated location data)
  createLoginMessage() {
    const buffer = Buffer.alloc(18);
    let pos = 0;
    
    buffer.writeUInt16BE(0x7878, pos); pos += 2;
    buffer.writeUInt8(13, pos++);
    buffer.writeUInt8(0x01, pos++);
    const imeiHex = '0' + this.imei;
    Buffer.from(imeiHex, 'hex').copy(buffer, pos, 0, 8); pos += 8;
    buffer.writeUInt16BE(this.messageIndex++, pos); pos += 2;
    const crc = this.calculateCRC(buffer.slice(2, pos));
    buffer.writeUInt16BE(crc, pos); pos += 2;
    buffer.writeUInt8(0x0D, pos++);
    buffer.writeUInt8(0x0A, pos++);
    
    return buffer;
  }

  createHeartbeatMessage() {
    const buffer = Buffer.alloc(15);
    let pos = 0;
    
    buffer.writeUInt16BE(0x7878, pos); pos += 2;
    buffer.writeUInt8(10, pos++);
    buffer.writeUInt8(0x13, pos++);
    
    let statusByte = 0;
    if (this.status.armed) statusByte |= 0x01;
    if (this.status.ignition) statusByte |= 0x02;
    if (this.status.charge) statusByte |= 0x04;
    buffer.writeUInt8(statusByte, pos++);
    
    buffer.writeUInt16BE(Math.round(this.status.battery * 100), pos); pos += 2;
    buffer.writeUInt8(this.status.rssi, pos++);
    buffer.writeUInt16BE(this.messageIndex++, pos); pos += 2;
    const crc = this.calculateCRC(buffer.slice(2, pos));
    buffer.writeUInt16BE(crc, pos); pos += 2;
    buffer.writeUInt8(0x0D, pos++);
    buffer.writeUInt8(0x0A, pos++);
    
    return buffer;
  }

  createGPSMessage() {
    const buffer = Buffer.alloc(40);
    let pos = 0;
    
    buffer.writeUInt16BE(0x7878, pos); pos += 2;
    const lengthPos = pos++;
    buffer.writeUInt8(0x12, pos++);
    
    const now = new Date();
    buffer.writeUInt8(now.getFullYear() - 2000, pos++);
    buffer.writeUInt8(now.getMonth() + 1, pos++);
    buffer.writeUInt8(now.getDate(), pos++);
    buffer.writeUInt8(now.getHours(), pos++);
    buffer.writeUInt8(now.getMinutes(), pos++);
    buffer.writeUInt8(now.getSeconds(), pos++);
    
    buffer.writeUInt8(12, pos++);
    buffer.writeUInt8(this.currentLocation.satellites, pos++);
    
    const lat = Math.round(Math.abs(this.currentLocation.latitude) * 60 * 30000);
    buffer.writeUInt32BE(lat, pos); pos += 4;
    
    const lng = Math.round(Math.abs(this.currentLocation.longitude) * 60 * 30000);
    buffer.writeUInt32BE(lng, pos); pos += 4;
    
    buffer.writeUInt8(Math.round(this.currentLocation.speed), pos++);
    
    let flags = Math.round(this.currentLocation.course) & 0x03FF;
    if (this.currentLocation.valid) flags |= 0x1000;
    if (this.currentLocation.latitude < 0) flags |= 0x0400;
    if (this.currentLocation.longitude > 0) flags |= 0x0800;
    if (this.status.ignition) flags |= 0xC000;
    buffer.writeUInt16BE(flags, pos); pos += 2;
    
    // LBS data
    buffer.writeUInt16BE(404, pos); pos += 2;
    buffer.writeUInt8(45, pos++);
    buffer.writeUInt16BE(12345, pos); pos += 2;
    buffer.writeUIntBE(678901, pos, 3); pos += 3;
    buffer.writeUInt8(this.status.rssi, pos++);
    
    buffer.writeUInt8(pos - 3 + 4, lengthPos);
    
    buffer.writeUInt16BE(this.messageIndex++, pos); pos += 2;
    const crc = this.calculateCRC(buffer.slice(2, pos));
    buffer.writeUInt16BE(crc, pos); pos += 2;
    buffer.writeUInt8(0x0D, pos++);
    buffer.writeUInt8(0x0A, pos++);
    
    return buffer.slice(0, pos);
  }

  calculateCRC(data) {
    let crc = 0xFFFF;
    for (let i = 0; i < data.length; i++) {
      crc ^= data[i] & 0xFF;
      for (let j = 0; j < 8; j++) {
        if ((crc & 1) !== 0) {
          crc = (crc >>> 1) ^ 0x8408;
        } else {
          crc = crc >>> 1;
        }
      }
    }
    return (~crc) & 0xFFFF;
  }

  connect() {
    console.log(`🚗 GPS Device ${this.imei} connecting to ${this.serverHost}:${this.serverPort}`);
    
    this.socket = net.createConnection({
      host: this.serverHost,
      port: this.serverPort
    });

    this.socket.on('connect', () => {
      console.log(`✅ Connected! Sending login...`);
      this.connected = true;
      this.sendLogin();
    });

    this.socket.on('data', (data) => {
      console.log(`📥 Received ACK: ${data.toString('hex')}`);
      this.handleServerResponse(data);
    });

    this.socket.on('error', (err) => {
      console.error(`❌ Connection error: ${err.message}`);
    });

    this.socket.on('close', () => {
      console.log(`🔌 Connection closed`);
      this.connected = false;
      this.authenticated = false;
      this.clearIntervals();
    });
  }

  sendLogin() {
    const loginMsg = this.createLoginMessage();
    console.log(`📤 LOGIN: ${loginMsg.toString('hex')}`);
    this.socket.write(loginMsg);
  }

  handleServerResponse(data) {
    if (data.length >= 8 && data.readUInt16BE(0) === 0x7878) {
      const type = data.readUInt8(3);
      
      if (type === 0x01 && !this.authenticated) {
        console.log(`🔐 Login ACK received - authenticated!`);
        this.authenticated = true;
        this.startPeriodicMessages();
        
        // Start journey after authentication
        setTimeout(() => {
          this.startJourney();
        }, 5000);
      }
    }
  }

  startPeriodicMessages() {
    // Movement and status updates every 2 seconds
    this.intervals.movement = setInterval(() => {
      this.updateMovement();
      this.updateVehicleStatus();
    }, 2000);

    // Heartbeat every 30 seconds
    this.intervals.heartbeat = setInterval(() => {
      if (this.connected && this.authenticated) {
        const heartbeat = this.createHeartbeatMessage();
        console.log(`💓 ${this.imei} HEARTBEAT - Speed: ${this.currentLocation.speed.toFixed(1)} km/h, Battery: ${this.status.battery.toFixed(1)}V`);
        this.socket.write(heartbeat);
      }
    }, 30000);

    // GPS data every 5 seconds (realistic tracking)
    this.intervals.gps = setInterval(() => {
      if (this.connected && this.authenticated) {
        const gpsMsg = this.createGPSMessage();
        console.log(`📍 ${this.imei} GPS - Lat: ${this.currentLocation.latitude.toFixed(6)}, Lng: ${this.currentLocation.longitude.toFixed(6)}, Speed: ${this.currentLocation.speed.toFixed(1)} km/h, Course: ${this.currentLocation.course.toFixed(0)}°`);
        this.socket.write(gpsMsg);
      }
    }, 5000);
  }

  clearIntervals() {
    Object.values(this.intervals).forEach(interval => {
      if (interval) clearInterval(interval);
    });
    this.intervals = {};
  }

  disconnect() {
    console.log(`🛑 Disconnecting device ${this.imei}`);
    this.clearIntervals();
    if (this.socket) {
      this.socket.end();
    }
  }

  // Manual controls
  simulateAlarm() {
    console.log(`🚨 ${this.imei}: SOS alarm activated!`);
  }

  simulateEngineStop() {
    console.log(`🛑 ${this.imei}: Engine stopped manually`);
    this.stopVehicle();
  }

  simulateEngineStart() {
    console.log(`🚗 ${this.imei}: Engine started manually`);
    this.status.ignition = true;
    if (!this.movement.isMoving) {
      setTimeout(() => this.startJourney(), 2000);
    }
  }
}

module.exports = GPSDeviceSimulator;

// Usage example
if (require.main === module) {
  const devices = [
    new GPSDeviceSimulator('357803372674636'),
    new GPSDeviceSimulator('357803372674637'),
    new GPSDeviceSimulator('357803372674638')
  ];

  console.log('🚀 Starting GPS Device Simulator...');
  console.log('📱 Simulating 3 GPS devices');
  
  // Connect devices with delays
  devices.forEach((device, index) => {
    setTimeout(() => {
      device.connect();
    }, index * 5000);
  });

  // Simulate scenarios after 30 seconds
  setTimeout(() => {
    console.log('\n🎭 Starting scenario simulations...');
    devices[0].simulateAlarm();
    devices[1].simulateEngineStop();
  }, 30000);

  // Graceful shutdown
  process.on('SIGINT', () => {
    console.log('\n🛑 Shutting down simulator...');
    devices.forEach(device => device.disconnect());
    process.exit(0);
  });
}

module.exports = GPSDeviceSimulator;