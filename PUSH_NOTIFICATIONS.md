# Push Notifications Implementation (#77)

This document describes the push notification system for Swift Send, which enables real-time notifications for transfers and failures across web and mobile platforms.

## Overview

The push notification system uses **Firebase Cloud Messaging (FCM)** to deliver notifications to users on their registered devices. Notifications are sent automatically when:

- ✅ **Transfer Completed**: User receives a push notification when a transfer is successfully settled
- ✅ **Transfer Failed**: User receives a push notification when a transfer fails and funds are refunded

## Architecture

### Backend Components

1. **Firebase Admin SDK** (`backend/src/utils/fcmMessaging.ts`)
   - Initializes Firebase Admin SDK for server-side push sending
   - Handles single and multicast message delivery
   - Manages message formatting for web, iOS, and Android platforms

2. **Device Token Service** (`backend/src/modules/notifications/deviceTokenService.ts`)
   - In-memory storage for device tokens (should move to PostgreSQL in production)
   - Manages token registration, unregistration, and activation status
   - Tracks device metadata (platform, OS version, app version)

3. **Database Schema** (`backend/migrations/002_device_tokens.sql`)
   - `device_tokens` table: Stores user device tokens with metadata
   - `notification_delivery_logs` table: Tracks delivery status and FCM message IDs
   - Indexes for fast lookups by user and token

4. **Device Token Routes** (`backend/src/routes/deviceTokens.ts`)
   - `POST /device-tokens/register` - Register a new device token
   - `POST /device-tokens/unregister` - Unregister a device token
   - `GET /device-tokens` - List all active device tokens for authenticated user

5. **Notification Service Updates** (`backend/src/modules/notifications/notificationService.ts`)
   - Extended to send push notifications alongside in-app notifications
   - Handles multicast delivery to all user devices
   - Automatically deactivates failed tokens

### Frontend Components

1. **Firebase Messaging Service** (`src/services/firebaseMessaging.ts`)
   - Initializes Firebase SDK with environment configuration
   - Requests notification permissions from user
   - Handles foreground notification delivery
   - Manages FCM token retrieval

2. **Service Worker** (`public/firebase-messaging-sw.js`)
   - Handles incoming push notifications when app is in background
   - Displays system notifications
   - Routes notification clicks to relevant app pages (e.g., transfer details)
   - Supports deep linking for transfer-specific notifications

3. **useNotifications Hook** (`src/hooks/useNotifications.ts`)
   - React hook for managing notification setup
   - Requests permissions and registers device tokens with backend
   - Detects platform and collects OS/device metadata
   - Handles foreground notification display

4. **Notification Initializer Component** (`src/components/NotificationInitializer.tsx`)
   - Initializes push notifications when user is authenticated
   - Reads Firebase configuration from environment variables
   - Wraps notification setup logic

## Setup Instructions

### Backend Setup

1. **Create Firebase Project**
   ```
   1. Go to https://console.firebase.google.com
   2. Create a new project
   3. Enable Cloud Messaging
   4. Generate a service account key (Project Settings > Service Accounts)
   ```

2. **Install Dependencies**
   ```bash
   cd backend
   npm install firebase-admin
   ```

3. **Set Environment Variables**
   ```bash
   # .env or deployment configuration
   FIREBASE_PROJECT_ID=your-project-id
   FIREBASE_SERVICE_ACCOUNT_KEY='{"type":"service_account",...}'
   # OR use a file path:
   FIREBASE_SERVICE_ACCOUNT_KEY=/path/to/serviceAccountKey.json
   PUSH_NOTIFICATIONS_ENABLED=true
   ```

4. **Run Database Migration**
   ```bash
   npm run migrate  # Runs 002_device_tokens.sql
   ```

5. **Start Backend**
   ```bash
   npm run dev
   # Firebase will be initialized automatically if configured
   ```

### Frontend Setup

1. **Install Dependencies**
   ```bash
   npm install firebase
   ```

2. **Set Environment Variables** (`.env.local`)
   ```bash
   VITE_FIREBASE_API_KEY=your-api-key
   VITE_FIREBASE_AUTH_DOMAIN=your-project.firebaseapp.com
   VITE_FIREBASE_PROJECT_ID=your-project-id
   VITE_FIREBASE_STORAGE_BUCKET=your-bucket
   VITE_FIREBASE_MESSAGING_SENDER_ID=your-sender-id
   VITE_FIREBASE_APP_ID=your-app-id
   VITE_FIREBASE_VAPID_KEY=your-vapid-public-key
   VITE_API_BASE_URL=http://localhost:4000
   ```

3. **Generate VAPID Keys**
   ```
   1. Go to Firebase Console > Project Settings > Cloud Messaging
   2. Under "Web Push certificates", generate a new key pair
   3. Use the "Public key" as VITE_FIREBASE_VAPID_KEY
   ```

4. **Start Frontend**
   ```bash
   npm run dev
   # On first visit, browser will request notification permission
   ```

## API Endpoints

### Register Device Token
```http
POST /device-tokens/register
Content-Type: application/json
Authorization: Bearer <token>

{
  "token": "fcm_token_abc123xyz...",
  "platform": "web",
  "metadata": {
    "model": "Chrome",
    "osVersion": "Windows 10",
    "appVersion": "1.0.0"
  }
}

Response: 201 Created
{
  "id": "uuid",
  "platform": "web",
  "createdAt": "2026-04-27T10:00:00Z"
}
```

### Unregister Device Token
```http
POST /device-tokens/unregister
Content-Type: application/json
Authorization: Bearer <token>

{
  "token": "fcm_token_abc123xyz..."
}

Response: 200 OK
{
  "message": "Device token unregistered"
}
```

### List Device Tokens
```http
GET /device-tokens
Authorization: Bearer <token>

Response: 200 OK
{
  "items": [
    {
      "id": "uuid",
      "platform": "web",
      "model": "Chrome",
      "osVersion": "Windows 10",
      "appVersion": "1.0.0",
      "createdAt": "2026-04-27T10:00:00Z",
      "lastUsedAt": "2026-04-27T10:00:00Z"
    }
  ]
}
```

## Notification Flow

### Transfer Settled Flow
```
1. Backend transfer settled event triggers
2. NotificationService.notifyTransferSettled() called
3. In-app notification created in database
4. Push notification sent to all active user devices via FCM
5. Frontend receives notification:
   - Background: Shows system notification
   - Foreground: Shows toast/in-app notification
6. User clicks notification → Navigates to transfer details
```

### Transfer Failed Flow
```
1. Backend transfer failed event triggers
2. NotificationService.notifyTransferFailed() called
3. In-app notification created
4. Push notification sent to all active user devices
5. Failed delivery tokens are deactivated
6. Frontend receives notification (same as above)
```

## Notification Payload Example

**Transfer Settled:**
```json
{
  "notification": {
    "title": "Transfer confirmed",
    "body": "$100.00 to John Doe completed successfully."
  },
  "data": {
    "type": "transfer_settled",
    "transferId": "transfer_123abc"
  }
}
```

**Transfer Failed:**
```json
{
  "notification": {
    "title": "Transfer failed",
    "body": "We could not deliver $75.00 to Bob Johnson. Your funds were returned to your wallet."
  },
  "data": {
    "type": "transfer_failed",
    "transferId": "transfer_456def"
  }
}
```

## Testing

### Backend Tests
```bash
# Run device token service tests
npm test -- deviceTokenService.test.ts

# Run notification service push tests
npm test -- notificationService.push.test.ts
```

### Manual Testing

1. **Register Device Token (Browser)**
   ```javascript
   const token = "fcm_token_from_browser";
   const response = await fetch('/device-tokens/register', {
     method: 'POST',
     credentials: 'include',
     headers: { 'Content-Type': 'application/json' },
     body: JSON.stringify({
       token,
       platform: 'web',
       metadata: {
         model: 'Chrome',
         osVersion: 'Windows 10'
       }
     })
   });
   ```

2. **Send Test Notification (Backend)**
   ```bash
   # Use Firebase Console or admin SDK
   # Message will be delivered to all active devices for the user
   ```

3. **Verify Notification Received**
   - Check browser notification pop-up
   - Check System Notifications
   - For mobile: Check native notification center

## Production Considerations

### Security
- ✅ Device tokens are validated with user JWT
- ✅ Device tokens are unique per device
- ⚠️ VAPID key should be kept private (backend only)
- ⚠️ Service account key should never be exposed

### Scalability
- Current implementation uses in-memory device token store
- **PRODUCTION**: Migrate to PostgreSQL (migration script included)
- Use message queuing (RabbitMQ, Bull) for high-volume notifications
- Consider Firebase's native rate limiting (~1,000 msg/sec per project)

### Reliability
- Failed tokens are automatically deactivated
- Multicast failures don't block notification service
- Graceful fallback if Firebase unavailable
- Delivery status tracking in database

### Performance
- Notifications sent asynchronously (non-blocking)
- Tokens indexed by user ID for fast lookups
- Pagination support for large notification lists

## Troubleshooting

### Notifications not delivering
1. Check Firebase project credentials
2. Verify VAPID key is correct
3. Ensure user has granted notification permission
4. Check browser console for errors
5. Verify device token was registered (`GET /device-tokens`)

### Service worker not loading
1. Ensure `public/firebase-messaging-sw.js` exists
2. Check browser Service Workers (DevTools > Application > Service Workers)
3. Clear browser cache and reload
4. Ensure domain is HTTPS (required for service workers)

### Device token registration fails
1. Verify user is authenticated (JWT token valid)
2. Check backend logs for CORS errors
3. Ensure Firebase SDK is initialized
4. Verify `VITE_FIREBASE_VAPID_KEY` is set

## Future Enhancements

- [ ] Notification preferences per user (opt-in/out per type)
- [ ] Scheduled notifications for batch processing
- [ ] Rich media notifications (images, actions)
- [ ] Notification templates for different languages
- [ ] Analytics dashboard (delivery rates, engagement)
- [ ] Support for SMS/Email via AWS SNS or Twilio
- [ ] Deep linking to specific transaction details
- [ ] Notification history/audit logs

## References

- [Firebase Cloud Messaging Documentation](https://firebase.google.com/docs/cloud-messaging)
- [Firebase Admin SDK (Node.js)](https://firebase.google.com/docs/admin/setup)
- [Firebase SDK (Web)](https://firebase.google.com/docs/web/setup)
- [Web Push API](https://developer.mozilla.org/en-US/docs/Web/API/Push_API)
- [Service Workers](https://developer.mozilla.org/en-US/docs/Web/API/Service_Worker_API)
