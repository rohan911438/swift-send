import { deviceTokenService } from '../deviceTokenService';
import * as fcmMessaging from '../../../utils/fcmMessaging';

describe('DeviceTokenService', () => {
  beforeEach(() => {
    // Clear the device token service before each test
    (deviceTokenService as any).tokens.clear();
  });

  describe('registerDeviceToken', () => {
    it('should register a new device token', async () => {
      const userId = 'user123';
      const token = 'fcm_token_abc123';
      const platform = 'web';

      const result = await deviceTokenService.registerDeviceToken(userId, token, platform);

      expect(result).toMatchObject({
        userId,
        token,
        platform,
        isActive: true,
      });
      expect(result.id).toBeDefined();
      expect(result.createdAt).toBeInstanceOf(Date);
    });

    it('should update existing token if re-registered', async () => {
      const userId = 'user123';
      const token = 'fcm_token_abc123';

      const first = await deviceTokenService.registerDeviceToken(userId, token, 'web');
      const second = await deviceTokenService.registerDeviceToken(
        userId,
        token,
        'web',
        { appVersion: '2.0.0' },
      );

      expect(second.id).toBe(first.id);
      expect(second.appVersion).toBe('2.0.0');
      expect(second.lastUsedAt.getTime()).toBeGreaterThanOrEqual(first.lastUsedAt.getTime());
    });

    it('should handle token re-registration by different user', async () => {
      const token = 'fcm_token_abc123';

      const first = await deviceTokenService.registerDeviceToken('user1', token, 'web');
      const second = await deviceTokenService.registerDeviceToken('user2', token, 'web');

      expect(second.userId).toBe('user2');
      expect(first.id).toBe(second.id);
    });
  });

  describe('getActiveDeviceTokens', () => {
    it('should return active tokens for a user', async () => {
      const userId = 'user123';

      await deviceTokenService.registerDeviceToken(userId, 'token1', 'web');
      await deviceTokenService.registerDeviceToken(userId, 'token2', 'ios');
      await deviceTokenService.registerDeviceToken('user456', 'token3', 'android');

      const tokens = await deviceTokenService.getActiveDeviceTokens(userId);

      expect(tokens).toHaveLength(2);
      expect(tokens.map((t) => t.token)).toContain('token1');
      expect(tokens.map((t) => t.token)).toContain('token2');
    });

    it('should not return inactive tokens', async () => {
      const userId = 'user123';

      const token = await deviceTokenService.registerDeviceToken(userId, 'token1', 'web');
      await deviceTokenService.deactivateDeviceToken(token.token);

      const activeTokens = await deviceTokenService.getActiveDeviceTokens(userId);

      expect(activeTokens).toHaveLength(0);
    });
  });

  describe('unregisterDeviceToken', () => {
    it('should unregister a device token', async () => {
      const token = 'fcm_token_abc123';
      await deviceTokenService.registerDeviceToken('user123', token, 'web');

      const result = await deviceTokenService.unregisterDeviceToken(token);

      expect(result).toBe(true);

      const activeTokens = await deviceTokenService.getActiveDeviceTokens('user123');
      expect(activeTokens).toHaveLength(0);
    });

    it('should return false if token not found', async () => {
      const result = await deviceTokenService.unregisterDeviceToken('nonexistent');
      expect(result).toBe(false);
    });
  });

  describe('deactivateDeviceToken', () => {
    it('should deactivate a device token', async () => {
      const token = 'fcm_token_abc123';
      await deviceTokenService.registerDeviceToken('user123', token, 'web');

      const result = await deviceTokenService.deactivateDeviceToken(token);

      expect(result).toBe(true);

      const activeTokens = await deviceTokenService.getActiveDeviceTokens('user123');
      expect(activeTokens).toHaveLength(0);
    });

    it('should return false if token not found', async () => {
      const result = await deviceTokenService.deactivateDeviceToken('nonexistent');
      expect(result).toBe(false);
    });
  });
});

describe('Push Notification Integration', () => {
  beforeEach(() => {
    (deviceTokenService as any).tokens.clear();
    jest.clearAllMocks();
  });

  it('should send multicast push notification to all active devices', async () => {
    const sendMulticastSpy = jest
      .spyOn(fcmMessaging, 'sendMulticastPushNotification')
      .mockResolvedValue({
        successCount: 2,
        failedTokens: [],
      });

    const userId = 'user123';
    await deviceTokenService.registerDeviceToken(userId, 'token1', 'web');
    await deviceTokenService.registerDeviceToken(userId, 'token2', 'ios');

    const tokens = await deviceTokenService.getActiveTokenStrings(userId);
    expect(tokens).toHaveLength(2);

    const result = await fcmMessaging.sendMulticastPushNotification(
      tokens,
      'Transfer Complete',
      'Your $100 transfer to John was successful',
    );

    expect(result.successCount).toBe(2);
    expect(result.failedTokens).toHaveLength(0);
    expect(sendMulticastSpy).toHaveBeenCalled();
  });

  it('should deactivate failed tokens after failed notification', async () => {
    const userId = 'user123';
    const token1 = 'token1';
    const token2 = 'token2_invalid';

    await deviceTokenService.registerDeviceToken(userId, token1, 'web');
    await deviceTokenService.registerDeviceToken(userId, token2, 'ios');

    // Simulate failed delivery for token2
    jest.spyOn(fcmMessaging, 'sendMulticastPushNotification').mockResolvedValue({
      successCount: 1,
      failedTokens: [token2],
    });

    const tokens = await deviceTokenService.getActiveTokenStrings(userId);
    const result = await fcmMessaging.sendMulticastPushNotification(
      tokens,
      'Transfer Complete',
      'Your transfer was successful',
    );

    // Deactivate failed tokens
    for (const failedToken of result.failedTokens) {
      await deviceTokenService.deactivateDeviceToken(failedToken);
    }

    const activeTokens = await deviceTokenService.getActiveDeviceTokens(userId);
    expect(activeTokens).toHaveLength(1);
    expect(activeTokens[0].token).toBe(token1);
  });
});
