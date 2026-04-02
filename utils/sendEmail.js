const nodemailer = require('nodemailer');

const mailTransportUrl = process.env.RESEND_SMTP_URL || process.env.SMTP_URL;
const isUrlValue = (value) => /^smtps?:\/\//i.test(String(value || ''));

const createTransporter = () => {
  if (mailTransportUrl) {
    if (isUrlValue(mailTransportUrl)) {
      return nodemailer.createTransport(mailTransportUrl);
    }

    return nodemailer.createTransport({
      host: 'smtp.resend.com',
      port: 587,
      secure: false,
      auth: {
        user: 'resend',
        pass: mailTransportUrl,
      },
    });
  }

  return nodemailer.createTransport({
    host: process.env.SMTP_HOST || 'smtp.mailtrap.io',
    port: parseInt(process.env.SMTP_PORT, 10) || 587,
    secure: parseInt(process.env.SMTP_PORT, 10) === 465,
    auth: {
      user: process.env.SMTP_USER || 'placeholder_user',
      pass: process.env.SMTP_PASSWORD || 'placeholder_pass',
    },
  });
};

const sendEmail = async (options) => {
  const transporter = createTransporter();

  const defaultFrom = process.env.MAIL_FROM || process.env.SMTP_FROM || 'NOC Portal <noreply@rgipt.ac.in>';

  const mailOptions = {
    from: defaultFrom,
    to: options.email,
    subject: options.subject,
    text: options.message,
    html: options.html,
  };

  try {
    await transporter.sendMail(mailOptions);
    console.log(`Email sent to ${options.email}`);
  } catch (error) {
    console.error('Email sending failed: ', error);
  }
};

module.exports = sendEmail;
