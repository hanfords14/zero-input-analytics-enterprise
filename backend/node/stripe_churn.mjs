import Stripe from 'stripe';

const stripe = new Stripe(process.env.STRIPE_KEY);

const WINDOW_DAYS = 7;
const WINDOW_SECONDS = WINDOW_DAYS * 24 * 60 * 60;

export async function planLevelChurnWeekOverWeek() {
  const now = Math.floor(Date.now() / 1000);
  const currentStart = now - WINDOW_SECONDS;
  const previousStart = now - (WINDOW_SECONDS * 2);

  const subs = await stripe.subscriptions.list({
    status: 'canceled',
    limit: 100,
  });

  const current = {};
  const previous = {};

  subs.data.forEach(sub => {
    if (!sub.canceled_at) return;

    const plan =
      sub.items.data[0]?.price?.nickname || 'unknown';

    if (sub.canceled_at >= currentStart) {
      current[plan] = (current[plan] || 0) + 1;
    } else if (sub.canceled_at >= previousStart) {
      previous[plan] = (previous[plan] || 0) + 1;
    }
  });

  return { current, previous };
}