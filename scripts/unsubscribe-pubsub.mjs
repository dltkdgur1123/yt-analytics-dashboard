import dotenv from "dotenv";
import path from "path";
dotenv.config({ path: path.resolve(process.cwd(), ".env.local") });

const HUB = "https://pubsubhubbub.appspot.com/subscribe";
const callback = `${process.env.NGROK_BASE_URL}/api/webhook/youtube`;
const topic = process.env.PUBSUB_TOPIC;

if (!callback || !topic) {
  console.error("Missing env. Need NGROK_BASE_URL, PUBSUB_TOPIC");
  console.error({ callback, topic });
  process.exit(1);
}

const form = new URLSearchParams();
form.set("hub.mode", "unsubscribe");
form.set("hub.callback", callback);
form.set("hub.topic", topic);

const res = await fetch(HUB, {
  method: "POST",
  headers: { "Content-Type": "application/x-www-form-urlencoded" },
  body: form.toString(),
});

console.log("Unsubscribe status:", res.status);
console.log(await res.text());
