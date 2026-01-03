# Complete Admin Management APIs

## Base URLs:
- **Device Management:** `/api/admin/devices`
- **User Management:** `/api/admin/users`

---

## 🔧 DEVICE MANAGEMENT (Admin Only)

### 1. Get All Devices
```javascript
GET /api/admin/devices/
Headers: { "Authorization": "Bearer <admin_token>" }

Response:
{
  "success": true,
  "devices": [
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
      "status": "active"
    }
  ],
  "count": 1
}
```

### 2. Add Device
```javascript
POST /api/admin/devices/add
Headers: {
  "Authorization": "Bearer <admin_token>",
  "Content-Type": "application/json"
}

Body:
{
  "deviceId": "123456789012345",
  "imei": "123456789012345",
  "deviceType": "GT06", // or "TELTONIKA"
  "vehicleName": "My Vehicle"
}
```

### 3. Update Device
```javascript
PUT /api/admin/devices/123456789012345
Headers: {
  "Authorization": "Bearer <admin_token>",
  "Content-Type": "application/json"
}

Body:
{
  "vehicleName": "Updated Vehicle Name",
  "deviceType": "TELTONIKA",
  "status": "active"
}
```

### 4. Delete Device
```javascript
DELETE /api/admin/devices/123456789012345
Headers: { "Authorization": "Bearer <admin_token>" }
```

### 5. Assign Device to User
```javascript
PUT /api/admin/devices/assign/123456789012345
Headers: {
  "Authorization": "Bearer <admin_token>",
  "Content-Type": "application/json"
}

Body:
{
  "userId": "user_id_to_assign" // or null to unassign
}
```

### 6. Bulk Assign Devices
```javascript
PUT /api/admin/devices/bulk-assign
Headers: {
  "Authorization": "Bearer <admin_token>",
  "Content-Type": "application/json"
}

Body:
{
  "deviceIds": ["device1", "device2", "device3"],
  "userId": "user_id" // or null to unassign all
}
```

### 7. Get Unassigned Devices
```javascript
GET /api/admin/devices/unassigned
Headers: { "Authorization": "Bearer <admin_token>" }
```

### 8. Get Devices by User
```javascript
GET /api/admin/devices/by-user/USER_ID
Headers: { "Authorization": "Bearer <admin_token>" }
```

---

## 👤 USER MANAGEMENT (Admin Only)

### 1. Get All Users
```javascript
GET /api/admin/users/
Headers: { "Authorization": "Bearer <admin_token>" }

Response:
{
  "success": true,
  "users": [
    {
      "_id": "user_id",
      "username": "john_doe",
      "email": "john@example.com",
      "name": "John Doe",
      "mobile": "1234567890",
      "role": "user",
      "deviceCount": 3
    }
  ]
}
```

### 2. Register New User
```javascript
POST /api/admin/users/register
Headers: {
  "Authorization": "Bearer <admin_token>",
  "Content-Type": "application/json"
}

Body:
{
  "username": "john_doe",
  "email": "john@example.com",
  "password": "password123",
  "name": "John Doe",
  "mobile": "1234567890"
}
```

### 3. Update User
```javascript
PUT /api/admin/users/USER_ID
Headers: {
  "Authorization": "Bearer <admin_token>",
  "Content-Type": "application/json"
}

Body:
{
  "username": "updated_username",
  "email": "updated@example.com",
  "name": "Updated Name",
  "mobile": "9876543210",
  "password": "new_password" // optional
}
```

### 4. Delete User
```javascript
DELETE /api/admin/users/USER_ID
Headers: { "Authorization": "Bearer <admin_token>" }

// Note: All devices assigned to this user will be unassigned automatically
```

---

## 👥 USER DEVICE ACCESS

### User Gets Only Assigned Devices
```javascript
GET /api/admin/devices/
Headers: { "Authorization": "Bearer <user_token>" }

// User will only see devices assigned to them
```

---

## 🎯 Complete Workflow Examples

### JavaScript/Fetch Examples

```javascript
const API_BASE = 'http://localhost:3000/api';
const token = localStorage.getItem('adminToken');

// Add Device
const addDevice = async (deviceData) => {
  const response = await fetch(`${API_BASE}/admin/devices/add`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(deviceData)
  });
  return await response.json();
};

// Register User
const registerUser = async (userData) => {
  const response = await fetch(`${API_BASE}/admin/users/register`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(userData)
  });
  return await response.json();
};

// Assign Device to User
const assignDevice = async (deviceId, userId) => {
  const response = await fetch(`${API_BASE}/admin/devices/assign/${deviceId}`, {
    method: 'PUT',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ userId })
  });
  return await response.json();
};

// Assign Multiple Devices
const bulkAssignDevices = async (deviceIds, userId) => {
  const response = await fetch(`${API_BASE}/admin/devices/bulk-assign`, {
    method: 'PUT',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ deviceIds, userId })
  });
  return await response.json();
};

// Remove Device Assignment (Unassign)
const unassignDevice = async (deviceId) => {
  const response = await fetch(`${API_BASE}/admin/devices/assign/${deviceId}`, {
    method: 'PUT',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ userId: null })
  });
  return await response.json();
};
```

### React Admin Panel Example

```jsx
const AdminPanel = () => {
  const [devices, setDevices] = useState([]);
  const [users, setUsers] = useState([]);
  const [unassignedDevices, setUnassignedDevices] = useState([]);

  // Fetch all data
  const fetchData = async () => {
    const [devicesRes, usersRes, unassignedRes] = await Promise.all([
      fetch('/api/admin/devices/', { headers: { 'Authorization': `Bearer ${token}` } }),
      fetch('/api/admin/users/', { headers: { 'Authorization': `Bearer ${token}` } }),
      fetch('/api/admin/devices/unassigned', { headers: { 'Authorization': `Bearer ${token}` } })
    ]);

    setDevices((await devicesRes.json()).devices);
    setUsers((await usersRes.json()).users);
    setUnassignedDevices((await unassignedRes.json()).devices);
  };

  useEffect(() => {
    fetchData();
  }, []);

  return (
    <div>
      <h1>Admin Panel</h1>
      
      {/* Device Management */}
      <section>
        <h2>Devices ({devices.length})</h2>
        <h3>Unassigned ({unassignedDevices.length})</h3>
        {/* Device list and assignment UI */}
      </section>

      {/* User Management */}
      <section>
        <h2>Users ({users.length})</h2>
        {/* User list and management UI */}
      </section>
    </div>
  );
};
```

---

## ✅ Permission Summary

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
| View all users | ✅ | ❌ |

## 🚀 Ready to Use!

सभी APIs तैयार हैं। Admin complete control रखता है और users को सिर्फ assigned devices दिखती हैं।