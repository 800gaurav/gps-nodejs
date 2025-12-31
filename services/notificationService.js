const admin = require('firebase-admin');
const logger = require('../utils/logger');
const User = require('../models/User');

class NotificationService {
  constructor() {
    this.initialized = false;
    this.init();
  }

  init() {
    try {
      if (process.env.FIREBASE_SERVICE_ACCOUNT) {
        const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);
        
        admin.initializeApp({
          credential: admin.credential.cert(serviceAccount),
          projectId: serviceAccount.project_id
        });
        
        this.initialized = true;
        logger.info('Firebase Admin initialized for push notifications');
      } else {
        logger.warn('Firebase service account not configured');
      }
    } catch (error) {
      logger.error('Failed to initialize Firebase Admin:', error);
    }
  }

  async sendIgnitionNotification(deviceId, ignitionStatus, position) {
    if (!this.initialized) return false;

    try {
      // Get device owner
      const Device = require('../models/Device');
      const device = await Device.findOne({ deviceId }).populate('userId');
      
      if (!device || !device.userId) return false;

      // Get user's FCM tokens
      const fcmTokens = device.userId.fcmTokens || [];
      if (fcmTokens.length === 0) return false;

      const title = ignitionStatus ? 'Vehicle Started' : 'Vehicle Stopped';
      const body = `${device.vehicleName} ignition ${ignitionStatus ? 'turned ON' : 'turned OFF'}`;

      const message = {
        notification: {
          title,
          body,
          icon: 'ic_notification',
          sound: 'default'
        },
        data: {
          type: 'ignition',
          deviceId,
          ignitionStatus: ignitionStatus.toString(),
          latitude: position.latitude?.toString() || '0',
          longitude: position.longitude?.toString() || '0',
          timestamp: new Date().toISOString()
        },
        tokens: fcmTokens
      };

      const response = await admin.messaging().sendMulticast(message);
      
      logger.info('Push notification sent', {
        deviceId,
        ignitionStatus,
        successCount: response.successCount,
        failureCount: response.failureCount
      });

      return response.successCount > 0;
    } catch (error) {
      logger.error('Error sending push notification:', error);
      return false;
    }
  }

  async sendAlertNotification(deviceId, alertType, position) {
    if (!this.initialized) return false;

    try {
      const Device = require('../models/Device');
      const device = await Device.findOne({ deviceId }).populate('userId');
      
      if (!device || !device.userId) return false;

      const fcmTokens = device.userId.fcmTokens || [];
      if (fcmTokens.length === 0) return false;

      const alertMessages = {
        sos: 'SOS Alert!',
        overspeed: 'Overspeed Alert',
        powerCut: 'Power Cut Alert',
        lowBattery: 'Low Battery Alert',
        geofenceEnter: 'Geofence Entry',
        geofenceExit: 'Geofence Exit'
      };

      const title = alertMessages[alertType] || 'Vehicle Alert';
      const body = `${device.vehicleName}: ${title}`;

      const message = {
        notification: {
          title,
          body,
          icon: 'ic_alert',
          sound: 'default'
        },
        data: {
          type: 'alert',
          alertType,
          deviceId,
          latitude: position.latitude?.toString() || '0',
          longitude: position.longitude?.toString() || '0',
          timestamp: new Date().toISOString()
        },
        tokens: fcmTokens
      };

      const response = await admin.messaging().sendMulticast(message);
      
      logger.alert(deviceId, alertType, 'Push notification sent', {
        successCount: response.successCount,
        failureCount: response.failureCount
      });

      return response.successCount > 0;
    } catch (error) {
      logger.error('Error sending alert notification:', error);
      return false;
    }
  }

  async registerFCMToken(userId, token) {
    try {
      const user = await User.findById(userId);
      if (!user) return false;

      if (!user.fcmTokens) user.fcmTokens = [];
      
      // Remove existing token if present
      user.fcmTokens = user.fcmTokens.filter(t => t !== token);
      
      // Add new token
      user.fcmTokens.push(token);
      
      // Keep only last 5 tokens
      if (user.fcmTokens.length > 5) {
        user.fcmTokens = user.fcmTokens.slice(-5);
      }

      await user.save();
      
      logger.info('FCM token registered', { userId, tokenCount: user.fcmTokens.length });
      return true;
    } catch (error) {
      logger.error('Error registering FCM token:', error);
      return false;
    }
  }

  async removeFCMToken(userId, token) {
    try {
      const user = await User.findById(userId);
      if (!user) return false;

      if (user.fcmTokens) {
        user.fcmTokens = user.fcmTokens.filter(t => t !== token);
        await user.save();
      }

      return true;
    } catch (error) {
      logger.error('Error removing FCM token:', error);
      return false;
    }
  }
}

module.exports = new NotificationService();