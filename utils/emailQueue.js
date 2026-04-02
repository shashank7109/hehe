const { Queue, Worker } = require('bullmq');
const { sendEmail } = require('./emailService');

const IORedis = require('ioredis');

const connection = new IORedis(process.env.REDIS_URL || 'redis://127.0.0.1:6379', {
    maxRetriesPerRequest: null,
});

const emailQueue = new Queue('email-queue', { connection });

const emailWorker = new Worker('email-queue', async job => {
    await sendEmail(job.data);
}, { connection });

emailWorker.on('completed', job => {
    console.log(`[BullMQ] Email job ${job.id} completed successfully.`);
});

emailWorker.on('failed', (job, err) => {
    console.error(`[BullMQ] Email job ${job.id} exhausted retries and failed: ${err.message}`);
});

const enqueueEmail = async (emailData) => {
    try {
        await emailQueue.add('send-email', emailData, {
            attempts: 3,
            backoff: {
                type: 'exponential',
                delay: 2000
            }
        });
    } catch (error) {
        console.error('[BullMQ] Failed to enqueue email job:', error.message);
    }
};

module.exports = { emailQueue, enqueueEmail };
