const sendEmail = require('./utils/sendEmail');
const dotenv = require('dotenv');
dotenv.config();

const recipient = process.env.TEST_EMAIL || process.env.SMTP_USER;

if (!recipient) {
  console.error('Set TEST_EMAIL (or SMTP_USER for legacy SMTP) before running this script.');
  process.exit(1);
}

sendEmail({
  email: recipient,
  subject: 'NOC Portal Test Email',
  message: 'Testing nodemailer configuration.'
}).then(() => {
    console.log('Test Email Sent Successfully!');
    process.exit(0);
}).catch(err => {
    console.error('Test Email Failed:', err);
    process.exit(1);
});
