import { config } from '../config';
import { logger } from '../logger';

export class SecretRotationService {
  private checkInterval: NodeJS.Timeout | null = null;

  start() {
    logger.info('Secret rotation monitor started');
    this.checkSecrets();
    // Check every 24 hours
    this.checkInterval = setInterval(() => this.checkSecrets(), 24 * 60 * 60 * 1000);
  }

  stop() {
    if (this.checkInterval) {
      clearInterval(this.checkInterval);
    }
  }

  private checkSecrets() {
    const lastRotated = new Date(config.secrets.lastRotatedAt);
    const now = new Date();
    const ageInDays = (now.getTime() - lastRotated.getTime()) / (1000 * 60 * 60 * 24);

    logger.debug({ ageInDays, interval: config.secrets.rotationIntervalDays }, 'Checking secret age');

    if (ageInDays >= config.secrets.rotationIntervalDays) {
      logger.warn(
        { ageInDays, lastRotatedAt: config.secrets.lastRotatedAt },
        'SECURITY WARNING: Secrets (JWT, Encryption Key) are past their rotation interval. Please rotate them soon.'
      );
    } else if (ageInDays >= config.secrets.rotationIntervalDays - 7) {
      logger.info(
        { daysRemaining: Math.ceil(config.secrets.rotationIntervalDays - ageInDays) },
        'Upcoming secret rotation requirement'
      );
    }
  }
}

export const secretRotationService = new SecretRotationService();
