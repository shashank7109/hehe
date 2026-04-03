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

/*
const emailWorker = new Worker('email-queue', async job => {
    await sendEmail(job.data);
}, { connection });

emailWorker.on('completed', job => {
    console.log(`[BullMQ] Email job ${job.id} completed successfully.`);
});

emailWorker.on('failed', (job, err) => {
    console.log(`[BullMQ] Email job ${job.id} exhausted retries and failed: ${err.message}`);
});
*/

const enqueueEmail = async (emailData) => {
    console.log('[Mock Email Queue] Email suppressed due to Redis quota:', emailData.subject);
    return;
};

module.exports = { emailQueue, enqueueEmail };
