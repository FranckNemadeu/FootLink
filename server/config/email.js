const nodemailer = require("nodemailer");

const getEmailFrom = () =>
  process.env.EMAIL_FROM ||
  (process.env.SMTP_USER ? `FootLink <${process.env.SMTP_USER}>` : "FootLink <onboarding@resend.dev>");

const isSmtpConfigured = Boolean(
  process.env.SMTP_HOST &&
    process.env.SMTP_USER &&
    process.env.SMTP_PASS
);

const isResendConfigured = Boolean(process.env.RESEND_API_KEY);

const isEmailConfigured = isSmtpConfigured || isResendConfigured;

const sendSmtpEmail = async ({ to, subject, html, text }) => {
  const transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: Number(process.env.SMTP_PORT || 465),
    secure: String(process.env.SMTP_SECURE || "true") === "true",
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS,
    },
  });

  const result = await transporter.sendMail({
    from: getEmailFrom(),
    to,
    subject,
    html,
    text,
  });

  console.log(`[EMAIL SMTP SENT] ${subject} -> ${to}`);
  return result;
};

const sendEmail = async ({ to, subject, html, text }) => {
  if (!isEmailConfigured) {
    console.log(`[EMAIL DEV] ${subject} -> ${to}`);
    console.log(text);
    return { dev: true };
  }

  if (isSmtpConfigured) {
    return sendSmtpEmail({ to, subject, html, text });
  }

  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from: getEmailFrom(),
      to: Array.isArray(to) ? to : [to],
      subject,
      html,
      text,
    }),
  });

  if (!response.ok) {
    const body = await response.text();
    console.error(`[EMAIL ERROR] ${response.status} ${body}`);
    throw new Error(`Email non envoye: ${body}`);
  }

  const result = await response.json();
  console.log(`[EMAIL SENT] ${subject} -> ${to}`);
  return result;
};

module.exports = {
  isEmailConfigured,
  sendEmail,
};
