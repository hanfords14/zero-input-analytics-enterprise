import fs from 'fs';
import path from 'path';

// Load environment variables
import 'dotenv/config';

// Stripe + Email helpers
import { planLevelChurnWeekOverWeek } from '../backend/node/stripe_churn.mjs';
import { sendInsightEmail } from '../backend/node/email_delivery.mjs';

/* =========================
   Deduplication helpers
   ========================= */

const STATE_DIR = path.resolve('state');
const STATE_FILE = path.join(STATE_DIR, 'last_insight.json');

function loadLastInsight() {
  try {
    return JSON.parse(fs.readFileSync(STATE_FILE, 'utf8'));
  } catch {
    return {};
  }
}

function saveLastInsight(insight) {
  if (!fs.existsSync(STATE_DIR)) {
    fs.mkdirSync(STATE_DIR, { recursive: true });
  }
  fs.writeFileSync(STATE_FILE, JSON.stringify(insight, null, 2));
}

function fingerprintInsight(items) {
  return items
    .map(i => `${i.plan}:${i.current}:${i.previous}`)
    .sort()
    .join('|');
}

/* =========================
   Severity scoring
   ========================= */

function severityForChurn({ current, previous, pct }) {
  if (current >= 5 || pct >= 300) {
    return 'HIGH';
  }

  if (current >= 2 && pct >= 100) {
    return 'MEDIUM';
  }

  return 'LOW';
}

/* =========================
   Alert configuration
   ========================= */

const CHURN_ALERT_THRESHOLD = 2;

/* =========================
   Worker entrypoint
   ========================= */

async function runWorker() {
  const { current, previous } = await planLevelChurnWeekOverWeek();

  const comparisons = Object.entries(current).map(([plan, count]) => {
    const prev = previous[plan] || 0;
    const delta = count - prev;
    const pct =
      prev === 0
        ? count > 0
          ? 100
          : 0
        : Math.round((delta / prev) * 100);

    const severity = severityForChurn({
      current: count,
      previous: prev,
      pct,
    });

    return {
      plan,
      current: count,
      previous: prev,
      delta,
      pct,
      severity,
    };
  });

  // Only alert on meaningful increases
  const significant = comparisons.filter(
    c =>
      c.current >= CHURN_ALERT_THRESHOLD &&
      c.delta > 0 &&
      c.severity !== 'LOW'
  );

  // Quiet week → nothing to do
  if (significant.length === 0) {
    return;
  }

  // Deduplication
  const lastInsight = loadLastInsight();
  const fingerprint = fingerprintInsight(significant);

  if (lastInsight.fingerprint === fingerprint) {
    return;
  }

  // Build email
  const lines = significant.map(
    s =>
      `• ${s.plan}: ${s.current} cancellations (${s.pct}% WoW, was ${s.previous}) — Severity: ${s.severity}`
  );

  const highestSeverity = significant.some(s => s.severity === 'HIGH')
    ? 'HIGH'
    : 'MEDIUM';

  const subject = `🚨 ${highestSeverity} churn increase detected (${significant.length} plans)`;

  const text = `
What changed:
${lines.join('\n')}

Why this matters:
Churn increased compared to last week, which often signals pricing,
onboarding issues, or product regressions.

What to check:
• Recent product changes
• Onboarding flows
• Payment failures

Confidence: High (Stripe week‑over‑week churn)
`;

  const html = `
<p><strong>What changed</strong></p>
<ul>
  ${significant
    .map(
      s =>
        `<li><strong>${s.plan}</strong>: ${s.current} cancellations (${s.pct}% WoW, was ${s.previous}) — <em>${s.severity}</em></li>`
    )
    .join('')}
</ul>

<p><strong>Why this matters</strong></p>
<p>Churn increased compared to last week, which often signals pricing,
onboarding, or product issues.</p>

<p><strong>What to check</strong></p>
<ul>
  <li>Recent product changes</li>
  <li>Onboarding flows</li>
  <li>Payment failures</li>
</ul>

<p><strong>Confidence</strong>: High (Stripe week‑over‑week churn)</p>
`;

  await sendInsightEmail({ subject, text, html });

  saveLastInsight({
    fingerprint,
    sentAt: new Date().toISOString(),
  });
}

/* =========================
   Safe execution
   ========================= */

runWorker().catch(err => {
  console.error('❌ Worker failed:', err);
  process.exit(1);
});