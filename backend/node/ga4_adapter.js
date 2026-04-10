
import { BetaAnalyticsDataClient } from '@google-analytics/data';
const client = new BetaAnalyticsDataClient({ credentials: JSON.parse(process.env.GA_CREDENTIALS_JSON) });
export async function fetchGA4(){
 const [response] = await client.runReport({
   property: `properties/${process.env.GA4_PROPERTY_ID}`,
   dateRanges: [{startDate: '7daysAgo', endDate: 'today'}],
   metrics: [{name: 'sessions'}]
 });
 return response.rows[0].metricValues[0].value;
}
