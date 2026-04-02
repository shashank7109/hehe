const winston = require('winston');

// Determine if we're inside a cluster worker process natively (to tag logs with PIDs automatically)
const cluster = require('cluster');
const pid = process.pid;

const logFormat = winston.format.combine(
    winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
    winston.format.colorize(),
    winston.format.printf(({ timestamp, level, message }) => {
        // If running under cluster, prepend the Worker/Primary ID beautifully so it's transparent to the user.
        const processTag = cluster.isPrimary ? `[Primary:${pid}]` : `[Worker:${pid}]`;
        return `[${timestamp}] ${processTag} ${level}: ${message}`;
    })
);

const logger = winston.createLogger({
    level: 'info',
    format: logFormat,
    transports: [
        new winston.transports.Console()
    ],
});

// Creates a writable stream explicitly for Morgan HTTP requests to hook into so they automatically
// inherit the exact same Winston log formatting.
logger.stream = {
    write: function (message) {
        // Trim to strip out the trailing newline Morgan automatically injects
        logger.info(`[HTTP] ${message.trim()}`);
    }
};

module.exports = logger;
