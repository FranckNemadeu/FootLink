const getEmailFrom = () =>
  process.env.EMAIL_FROM || "FootLink <onboarding@resend.dev>";

const isEmailConfigured = Boolean(process.env.RESEND_API_KEY);

const sendEmail = async ({ to, subject, html, text }) => {
  if (!isEmailConfigured) {
    console.log(`[EMAIL DEV] ${subject} -> ${to}`);
    console.log(text);
    return { dev: true };
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
