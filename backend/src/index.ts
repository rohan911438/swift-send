import { start } from './app';
import { validateConfig } from './config';
import { secretRotationService } from './services/secretRotationService';

try {
  validateConfig();
  secretRotationService.start();
  start();
} catch (err) {
  console.error('Failed to start application:', err);
  process.exit(1);
}
