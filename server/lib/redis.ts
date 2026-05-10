import { createClient, type RedisClientType } from 'redis';

let client: RedisClientType | null = null;
let connectionAttempted = false;

export async function getRedis() {
  if (client?.isOpen) {
    return client;
  }

  if (connectionAttempted) {
    return null;
  }

  connectionAttempted = true;

  if (!process.env.REDIS_URL) {
    return null;
  }

  try {
    client = createClient({
      url: process.env.REDIS_URL,
      socket: {
        connectTimeout: 800,
        reconnectStrategy: false,
      },
    });

    client.on('error', (error) => {
      console.warn('Redis connection error:', error.message);
    });

    await client.connect();
    return client;
  } catch (error) {
    console.warn('Redis unavailable:', error instanceof Error ? error.message : error);
    client = null;
    return null;
  }
}

export async function closeRedis() {
  if (client?.isOpen) {
    await client.quit();
  }

  client = null;
  connectionAttempted = false;
}
