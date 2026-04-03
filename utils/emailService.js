const { Resend } = require('resend');

// Initialize Resend automatically handling conventional SDK API keys, or safely
// extracting the 're_...' token if the user stored it previously as an SMTP URL.
let apiKey = process.env.RESEND_API_KEY || process.env.RESEND_SMTP_URL || process.env.SMTP_URL || '';
if (apiKey.includes('re_')) {
  apiKey = apiKey.match(/(re_[a-zA-Z0-9]+)/)?.[1] || apiKey;
}

const resend = new Resend(apiKey);
const defaultFrom = process.env.MAIL_FROM || process.env.SMTP_FROM || 'Acme <onboarding@resend.dev>';

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
 * Generic email sender utilizing native Resend SDK.
 * @param {{ to: string, subject: string, text?: string, html?: string }} options
 */
const sendEmail = async ({ to, email, subject, text, message, html }) => {
  const recipient = to || email;
  const body = text || message;

  if (!apiKey) {
    return console.error('[Resend SDK Error] Missing API Key. Set RESEND_API_KEY in .env.');
  }

  try {
    const { data, error } = await resend.emails.send({
      from: defaultFrom,
      to: typeof recipient === 'string' ? [recipient] : recipient,
      subject,
      text: body,
      html,
    });

    if (error) {
      return console.error('[Resend SDK Error] Email sending failed:', error.message);
    }

    console.log(`[Resend SDK] Email sent securely to ${recipient} (ID: ${data.id})`);
  } catch (err) {
    console.error('[Resend SDK] Critical failure connecting to Resend API:', err.message);
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
  } else if (status === 'COLLECTED') {
    subject = `NOC Collected — ${escapeHtml(companyName)}`;
    html = `
      <p>Dear ${safeName},</p>
      <p>This is to confirm that the hardcopy of your NOC for <strong>${safeCompany}</strong> has been collected by the TNP Office.</p>
      <p>No further action is required from your end.</p>
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

/**
 * Sends a notification email to the TNP Office when a student's NOC is approved
 * and ready for physical collection.
 * @param {{ tnpOfficeEmail: string, studentName: string, rollNumber: string, companyName: string }} options
 */
const sendTNPOfficeBroadcast = async ({ tnpOfficeEmail, studentName, rollNumber, companyName }) => {
  const safeName = escapeHtml(studentName || 'Student');
  const safeRoll = escapeHtml(rollNumber || 'N/A');
  const safeCompany = escapeHtml(companyName || 'the organization');

  const subject = `New NOC Ready for Collection — ${safeName} (${safeRoll})`;
  const html = `
    <p>Dear TNP Office,</p>
    <p>The NOC for the following student has been approved and is ready for physical collection:</p>
    <ul>
      <li><strong>Student Name:</strong> ${safeName}</li>
      <li><strong>Roll Number:</strong> ${safeRoll}</li>
      <li><strong>Company:</strong> ${safeCompany}</li>
    </ul>
    <p>Please arrange for the hardcopy to be collected at the earliest.</p>
    <p>Regards,<br/>Training &amp; Placement Cell</p>
  `;

  await sendEmail({ to: tnpOfficeEmail, subject, html });
};

module.exports = { sendEmail, sendNOCStatusEmail, sendTNPOfficeBroadcast };
