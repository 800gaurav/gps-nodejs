# Complete Device Management API

## Base URL: http://localhost:3000/api/device-management

## Admin Features:
✅ Add new devices
✅ Update device details  
✅ Delete devices
✅ Assign devices to users
✅ Reassign devices (change user)
✅ Unassign devices
✅ Bulk assign multiple devices
✅ View all devices
✅ View unassigned devices
✅ View devices by user

## User Features:
✅ View only assigned devices

---

## 1. Get Devices (Role-based)

### Admin - All devices
```javascript
GET /api/device-management/
Headers: { "Authorization": "Bearer <admin_token>" }
```

### User - Only assigned devices
```javascript
GET /api/device-management/
Headers: { "Authorization": "Bearer <user_token>" }
```

## 2. Add Device (Admin Only)
```javascript
POST /api/device-management/add
Headers: {
  "Authorization": "Bearer <admin_token>",
  "Content-Type": "application/json"
}

Body:
{
  "deviceId": "123456789012345",
  "imei": "123456789012345",
  "deviceType": "GT06", // or "TELTONIKA"
  "vehicleName": "Vehicle 1"
}
```

## 3. Update Device (Admin Only)
```javascript
PUT /api/device-management/update/123456789012345
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

## 4. Assign Device to User (Admin Only)
```javascript
PUT /api/device-management/assign/123456789012345
Headers: {
  "Authorization": "Bearer <admin_token>",
  "Content-Type": "application/json"
}

Body:
{
  "userId": "user_id_to_assign" // or null to unassign
}
```

## 5. Bulk Assign Devices (Admin Only)
```javascript
PUT /api/device-management/bulk-assign
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

## 6. Get Unassigned Devices (Admin Only)
```javascript
GET /api/device-management/unassigned
Headers: { "Authorization": "Bearer <admin_token>" }
```

## 7. Get Devices by User (Admin Only)
```javascript
GET /api/device-management/by-user/USER_ID
Headers: { "Authorization": "Bearer <admin_token>" }
```

## 8. Get All Users with Device Count (Admin Only)
```javascript
GET /api/device-management/users
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
      "deviceCount": 3
    }
  ]
}
```

## 9. Delete Device (Admin Only)
```javascript
DELETE /api/device-management/123456789012345
Headers: { "Authorization": "Bearer <admin_token>" }
```

---

## Frontend Usage Examples

### React Admin Panel
```jsx
const AdminDevicePanel = () => {
  const [devices, setDevices] = useState([]);
  const [users, setUsers] = useState([]);
  const [unassignedDevices, setUnassignedDevices] = useState([]);

  // Add device
  const addDevice = async (deviceData) => {
    const response = await fetch('/api/device-management/add', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(deviceData)
    });
    return await response.json();
  };

  // Assign device
  const assignDevice = async (deviceId, userId) => {
    const response = await fetch(`/api/device-management/assign/${deviceId}`, {
      method: 'PUT',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ userId })
    });
    return await response.json();
  };

  // Bulk assign
  const bulkAssign = async (deviceIds, userId) => {
    const response = await fetch('/api/device-management/bulk-assign', {
      method: 'PUT',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ deviceIds, userId })
    });
    return await response.json();
  };

  // Update device
  const updateDevice = async (deviceId, updateData) => {
    const response = await fetch(`/api/device-management/update/${deviceId}`, {
      method: 'PUT',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(updateData)
    });
    return await response.json();
  };

  return (
    <div>
      {/* Admin device management UI */}
    </div>
  );
};
```

### User Device View
```jsx
const UserDeviceView = () => {
  const [myDevices, setMyDevices] = useState([]);

  useEffect(() => {
    fetchMyDevices();
  }, []);

  const fetchMyDevices = async () => {
    const response = await fetch('/api/device-management/', {
      headers: { 'Authorization': `Bearer ${token}` }
    });
    const data = await response.json();
    setMyDevices(data.devices);
  };

  return (
    <div>
      <h2>My Assigned Devices ({myDevices.length})</h2>
      {myDevices.map(device => (
        <div key={device._id}>
          <h3>{device.vehicleName}</h3>
          <p>Device ID: {device.deviceId}</p>
          <p>Type: {device.deviceType}</p>
          <p>Status: {device.status}</p>
        </div>
      ))}
    </div>
  );
};
```

---

## Complete Workflow

1. **Admin adds device** → Device created (unassigned)
2. **Admin assigns to user** → User can see device
3. **Admin can reassign** → Device moves to different user
4. **Admin can unassign** → Device becomes unassigned
5. **Admin can bulk assign** → Multiple devices to one user
6. **Admin can update** → Change device details
7. **Admin can delete** → Remove device completely

## Permission Summary

| Action | Admin | User |
|--------|-------|------|
| View all devices | ✅ | ❌ |
| View assigned devices | ✅ | ✅ |
| Add device | ✅ | ❌ |
| Update device | ✅ | ❌ |
| Delete device | ✅ | ❌ |
| Assign device | ✅ | ❌ |
| Bulk assign | ✅ | ❌ |