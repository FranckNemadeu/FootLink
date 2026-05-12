const getEmailFrom = () =>
  process.env.EMAIL_FROM || "FootLink <onboarding@resend.dev>";

const sendEmail = async ({ to, subject, html, text }) => {
  if (!process.env.RESEND_API_KEY) {
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
    throw new Error(`Email non envoye: ${body}`);
  }

  return response.json();
};

module.exports = {
  sendEmail,
};
