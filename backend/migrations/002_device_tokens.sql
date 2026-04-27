-- Device tokens for push notifications
CREATE TABLE IF NOT EXISTS device_tokens (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id VARCHAR(255) NOT NULL,
  token TEXT NOT NULL UNIQUE,
  platform VARCHAR(50) NOT NULL CHECK (platform IN ('web', 'ios', 'android')),
  model VARCHAR(255),
  os_version VARCHAR(50),
  app_version VARCHAR(50),
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  last_used_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  CONSTRAINT fk_device_tokens_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- Index for fast lookup of active tokens by user
CREATE INDEX IF NOT EXISTS idx_device_tokens_user_active ON device_tokens(user_id, is_active);

-- Index for token lookup
CREATE INDEX IF NOT EXISTS idx_device_tokens_token ON device_tokens(token);

-- Notification delivery logs
CREATE TABLE IF NOT EXISTS notification_delivery_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  notification_id UUID NOT NULL,
  device_token_id UUID NOT NULL,
  status VARCHAR(50) NOT NULL CHECK (status IN ('sent', 'failed', 'skipped')),
  error_reason TEXT,
  fcm_message_id VARCHAR(255),
  sent_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  CONSTRAINT fk_notification_delivery_logs_device_token FOREIGN KEY (device_token_id) REFERENCES device_tokens(id) ON DELETE CASCADE
);

-- Index for notification delivery lookups
CREATE INDEX IF NOT EXISTS idx_notification_delivery_logs_notification ON notification_delivery_logs(notification_id);
CREATE INDEX IF NOT EXISTS idx_notification_delivery_logs_device_token ON notification_delivery_logs(device_token_id);
