const IORedis = require('ioredis');

let isErrorLogged = false;

// Shared Fail-safe client
const redisClient = new IORedis(process.env.REDIS_URL || 'redis://127.0.0.1:6379', {
    maxRetriesPerRequest: null,
    retryStrategy(times) {
        // Prevent aggressive retry loops if Redis is completely down
        return Math.min(times * 1000, 5000);
    }
});

redisClient.on('error', (err) => {
    if (!isErrorLogged) {
        console.warn('[Redis] Connection inaccessible. Fallback to MongoDB is active.', err.message);
        isErrorLogged = true; // Prevent spamming console every reconnect attempt
    }
    if (err.message && err.message.includes('max requests limit exceeded')) {
        console.error('[Redis] Upstash limit exceeded. Disconnecting to prevent retry loops.');
        redisClient.disconnect();
    }
});

redisClient.on('ready', () => {
    isErrorLogged = false;
    console.log('[Redis] Cache Client Connected Successfully');
});

const getCache = async (key) => {
    try {
        if (redisClient.status !== 'ready') return null;
        const data = await redisClient.get(key);
        return data ? JSON.parse(data) : null;
    } catch (err) {
        console.warn(`[Redis] Failed to get cache for ${key}`);
        return null; // Graceful degradation to MongoDB
    }
};

const setCache = async (key, value, ttlSeconds = 300) => {
    try {
        if (redisClient.status !== 'ready') return false;
        await redisClient.setex(key, ttlSeconds, JSON.stringify(value));
        return true;
    } catch (err) {
        console.warn(`[Redis] Failed to set cache for ${key}`);
        return false; // Graceful degradation
    }
};

const delCache = async (key) => {
    try {
        if (redisClient.status !== 'ready') return false;
        await redisClient.del(key);
        return true;
    } catch (err) {
        console.warn(`[Redis] Failed to delete cache for ${key}`);
        return false;
    }
};

module.exports = {
    redisClient,
    getCache,
    setCache,
    delCache
};
