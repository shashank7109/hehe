const nodemailer = require('nodemailer');

const mailTransportUrl = process.env.RESEND_SMTP_URL || process.env.SMTP_URL;
const isUrlValue = (value) => /^smtps?:\/\//i.test(String(value || ''));

const createTransporter = () => {
  if (mailTransportUrl) {
    if (isUrlValue(mailTransportUrl)) {
      return nodemailer.createTransport(mailTransportUrl);
    }

    // Support users pasting a Resend API key into RESEND_SMTP_URL.
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
    host: process.env.SMTP_HOST,
    port: parseInt(process.env.SMTP_PORT, 10),
    secure: parseInt(process.env.SMTP_PORT, 10) === 465,
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASSWORD,
    },
  });
};

// Singleton transporter — created once on startup, reused for every email
const transporter = createTransporter();

const defaultFrom = process.env.MAIL_FROM || process.env.SMTP_FROM;

/**
 * Escapes user-supplied content to prevent XSS in HTML emails.
 */
const escapeHtml = (str) =>
  String(str || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');

/**
 * Generic email sender.
 * @param {{ to: string, subject: string, text?: string, html?: string }} options
 */
const sendEmail = async ({ to, email, subject, text, message, html }) => {
  const recipient = to || email;
  const body = text || message;
  try {
    await transporter.sendMail({
      from: defaultFrom,
      to: recipient,
      subject,
      text: body,
      html,
    });
    console.log(`Email sent to ${recipient}`);
  } catch (err) {
    console.error('Email sending failed:', err.message);
  }
};

/**
 * Sends a formatted NOC status update email to a student.
 * All user-supplied fields are HTML-escaped to prevent XSS.
 */
const sendNOCStatusEmail = async ({ studentEmail, studentName, companyName, newStatus, remarks, actionByRole }) => {
  // Escape all untrusted values before injecting into HTML
  const safeName = escapeHtml(studentName || 'Student');
  const safeCompany = escapeHtml(companyName || 'your organization');
  const safeRemarks = remarks ? `<p><strong>Remarks:</strong> ${escapeHtml(remarks)}</p>` : '';
  const status = String(newStatus || '').toUpperCase();

  let subject = 'NOC Status Update';
  let html = `<p>Dear ${safeName},</p><p>Your NOC application status has been updated.</p>${safeRemarks}`;

  if (status === 'UNDER_REVIEW_HEAD') {
    subject = `NOC Update: Department Cleared for ${escapeHtml(companyName)}`;
    html = `
      <p>Dear ${safeName},</p>
      <p>Your NOC requisition for <strong>${safeCompany}</strong> has been verified and cleared by your Department Officer.</p>
      <p>It has now been forwarded to the <strong>TNP Head</strong> for final approval.</p>
      ${safeRemarks}
      <p>Regards,<br/>Training &amp; Placement Cell</p>
    `;
  } else if (status === 'READY_FOR_COLLECTION') {
    subject = `NOC Approved: Ready for Collection — ${escapeHtml(companyName)}`;
    html = `
      <p>Dear ${safeName},</p>
      <p>Congratulations! Your NOC for <strong>${safeCompany}</strong> has been officially approved by the TNP Head.</p>
      <p>Your document is now <strong>ready for collection</strong>. Please visit the TNP cell to collect your hardcopy.</p>
      ${safeRemarks}
      <p>Regards,<br/>Training &amp; Placement Cell</p>
    `;
  } else if (status.includes('REJECTED')) {
    const safeActor = escapeHtml(actionByRole || 'Approver');
    subject = `NOC Requisition Declined — ${escapeHtml(companyName)}`;
    html = `
      <p>Dear ${safeName},</p>
      <p>We regret to inform you that your NOC requisition for <strong>${safeCompany}</strong> has been declined by the <strong>${safeActor}</strong>.</p>
      ${safeRemarks || '<p><strong>Reason/Remarks:</strong> Not specified.</p>'}
      <p>Regards,<br/>Training &amp; Placement Cell</p>
    `;
  }

  await sendEmail({ to: studentEmail, subject, html });
};

module.exports = { sendEmail, sendNOCStatusEmail };
