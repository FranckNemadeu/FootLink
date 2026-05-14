require("dotenv").config();

const { getEmailProvider, verifyEmailTransport } = require("../config/email");

const maskEmail = (value = "") => {
  const [name, domain] = value.split("@");
  if (!name || !domain) return Boolean(value);

  return `${name.slice(0, 2)}***@${domain}`;
};

const main = async () => {
  const config = {
    SMTP_HOST: Boolean(process.env.SMTP_HOST),
    SMTP_PORT: process.env.SMTP_PORT || "465",
    SMTP_SECURE: String(process.env.SMTP_SECURE || "true"),
    SMTP_USER: maskEmail(process.env.SMTP_USER),
    SMTP_PASS: Boolean(process.env.SMTP_PASS),
    EMAIL_FROM: Boolean(process.env.EMAIL_FROM),
    RESEND_API_KEY: Boolean(process.env.RESEND_API_KEY),
  };

  console.log("Configuration email:");
  console.log(config);
  console.log(`Provider utilise: ${getEmailProvider()}`);

  const result = await verifyEmailTransport();
  console.log("Verification:");
  console.log(result);

  if (!result.ok) {
    process.exitCode = 1;
  }
};

main().catch((err) => {
  console.error("Verification email echouee:");
  console.error({
    code: err.code,
    command: err.command,
    responseCode: err.responseCode,
    response: err.response,
    message: err.message,
  });
  process.exitCode = 1;
});
