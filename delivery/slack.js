
import fetch from 'node-fetch';
export async function sendSlack(msg){
 await fetch(process.env.SLACK_WEBHOOK,{method:'POST',body:JSON.stringify({text:msg})});
}
