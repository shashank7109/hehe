const { Queue, Worker } = require('bullmq');
const { sendEmail } = require('./emailService');

const IORedis = require('ioredis');

const connection = new IORedis(process.env.REDIS_URL || 'redis://127.0.0.1:6379', {
    maxRetriesPerRequest: null,
});

connection.on('error', (err) => {
    if (err.message && err.message.includes('max requests limit exceeded')) {
        console.error('[BullMQ] Upstash limit exceeded. Disconnecting queue connection.');
        connection.disconnect();
    }
});

const emailQueue = new Queue('email-queue', { connection });

emailQueue.on('error', (err) => {
    if (err.message && err.message.includes('max requests limit exceeded')) {
        // Suppress the large ReplyError stack trace
        return;
    }
    console.error('[BullMQ Queue Error]', err.message);
});

const cluster = require('cluster');
let emailWorker;

// Determine if this is the chosen worker for background jobs.
// By defaulting worker strictly to the Primary process (or strictly the FIRST child),
// it prevents both Node clusters from draining Redis limits, effectively cutting background bandwidth by half!
const shouldRunWorker = cluster.isPrimary || (cluster.isWorker && cluster.worker.id === 1);

if (shouldRunWorker) {
    emailWorker = new Worker('email-queue', async job => {
        await sendEmail(job.data);
    }, {
        connection,
        // Free-tier optimizations to prevent Redis limit depletion from useless polling loops:
        drainDelay: 15000,         // Wait 15 seconds before polling again if queue is empty (Default is 5s)
        stalledInterval: 300000,   // Check for stalled jobs every 5 minutes instead of every 30 seconds
        maxStalledCount: 1
    });

    emailWorker.on('completed', job => {
        console.log(`[BullMQ Worker ${cluster.worker ? cluster.worker.id : 'Primary'}] Email job ${job.id} completed successfully.`);
    });

    emailWorker.on('failed', (job, err) => {
        console.log(`[BullMQ Worker ${cluster.worker ? cluster.worker.id : 'Primary'}] Email job ${job.id} failed: ${err.message}`);
    });

    emailWorker.on('error', (err) => {
        if (err.message && err.message.includes('max requests limit exceeded')) return;
        console.error('[BullMQ Worker Error]', err.message);
    });
}

const enqueueEmail = async (emailData) => {
    console.log('[Mock Email Queue] Email suppressed due to Redis quota:', emailData.subject);
    return;
};

module.exports = { emailQueue, enqueueEmail };
