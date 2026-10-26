import { createClient } from 'redis';
import { config } from '../../config/env';

export const redis = createClient({
  url: config.redis.url,
});

redis.on('error', () => {
  // Handled silently
});

(async () => {
  try {
    if (!redis.isOpen) {
      await redis.connect();
    }
  } catch {
    // Non-blocking fallback
  }
})();

export default redis;
