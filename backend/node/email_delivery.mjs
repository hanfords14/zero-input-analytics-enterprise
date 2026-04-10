import sgMail from '@sendgrid/mail';

sgMail.setApiKey(process.env.SENDGRID_API_KEY);

export async function sendInsightEmail({ subject, text, html }) {
  const msg = {
    to: process.env.EMAIL_TO,
    from: process.env.EMAIL_FROM,
    subject,
    text,
    html,
  };

  await sgMail.send(msg);
}
``