const dns = require("dns");
const nodemailer = require("nodemailer");

if (typeof dns.setDefaultResultOrder === "function") {
  dns.setDefaultResultOrder("ipv4first");
}

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

const getEmailTimeoutMs = () => Number(process.env.EMAIL_TIMEOUT_MS || 12000);

const getSmtpFamily = () => {
  const family = Number(process.env.SMTP_FAMILY || 4);
  return family === 6 ? 6 : 4;
};

const resolveSmtpHost = async () => {
  const host = process.env.SMTP_HOST;
  const family = getSmtpFamily();

  if (!host || family !== 4) {
    return { host, servername: host };
  }

  const address = await dns.promises.lookup(host, { family: 4 });
  return {
    host: address.address,
    servername: host,
  };
};

const sendSmtpEmail = async ({ to, subject, html, text }) => {
  const transporter = await createSmtpTransporter();

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

const createSmtpTransporter = async () => {
  const smtpHost = await resolveSmtpHost();

  return nodemailer.createTransport({
    host: smtpHost.host,
    port: Number(process.env.SMTP_PORT || 465),
    secure: String(process.env.SMTP_SECURE || "true") === "true",
    family: getSmtpFamily(),
    connectionTimeout: getEmailTimeoutMs(),
    greetingTimeout: getEmailTimeoutMs(),
    socketTimeout: getEmailTimeoutMs(),
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS,
    },
    tls: {
      servername: smtpHost.servername,
    },
  });
};

const verifyEmailTransport = async () => {
  if (!isEmailConfigured) {
    return {
      ok: false,
      provider: "none",
      message:
        "Aucun fournisseur email configure. Ajoute SMTP_HOST, SMTP_USER et SMTP_PASS ou RESEND_API_KEY.",
    };
  }

  if (!isSmtpConfigured) {
    return {
      ok: true,
      provider: "resend",
      message: "Resend est configure. La verification SMTP est ignoree.",
    };
  }

  const transporter = await createSmtpTransporter();
  await transporter.verify();

  return {
    ok: true,
    provider: "smtp",
    message: "Connexion SMTP valide.",
  };
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

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), getEmailTimeoutMs());

  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    signal: controller.signal,
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
  clearTimeout(timeoutId);

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
  verifyEmailTransport,
};
