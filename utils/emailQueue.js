const { sendEmail } = require('./emailService');

// BullMQ and ioredis have been formally terminated from this module to permanently
// prevent any possibility of Redis push attempts, exhausted quota errors, or queuing bugs.
// Emails are sent natively and synchronously.

const enqueueEmail = async (emailData) => {
    try {
        await sendEmail(emailData);
        console.log(`[Email Service] Dispatched directly: ${emailData.subject}`);
    } catch (err) {
        console.error('[Email Service] Failed to dispatch email natively:', err.message);
    }
};

// Export null emailQueue so files importing `const { emailQueue } = require(...)` do not crash.
module.exports = { emailQueue: null, enqueueEmail };
