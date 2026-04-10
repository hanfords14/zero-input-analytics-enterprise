import fetch from 'node-fetch';

export async function sendSlackAlert({ severity, subject, text }) {
  if (!process.env.SLACK_WEBHOOK) {
    return;
  }

  const color =
    severity === 'HIGH' ? '#FF0000' :
    severity === 'MEDIUM' ? '#FFA500' :
    '#CCCCCC';

  const payload = {
    attachments: [
      {
        color,
        blocks: [
          {
            type: 'header',
            text: {
              type: 'plain_text',
              text: `🚨 ${severity} Alert`,
            },
          },
          {
            type: 'section',
            text: {
              type: 'mrkdwn',
              text: `*${subject}*`,
            },
          },
          {
            type: 'section',
            text: {
              type: 'mrkdwn',
              text,
            },
          },
        ],
      },
    ],
  };

  const res = await fetch(process.env.SLACK_WEBHOOK, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Slack webhook failed: ${body}`);
  }
}