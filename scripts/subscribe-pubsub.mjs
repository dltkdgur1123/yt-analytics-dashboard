import dotenv from "dotenv";
import path from "path";

// 🔑 .env.local을 확실하게 로드
dotenv.config({ path: path.resolve(process.cwd(), ".env.local") });

const HUB = "https://pubsubhubbub.appspot.com/subscribe";

const callback = `${process.env.NGROK_BASE_URL}/api/webhook/youtube?cb=${Date.now()}`;

const topic = process.env.PUBSUB_TOPIC;
const token = process.env.YOUTUBE_PUBSUB_VERIFY_TOKEN;

if (!callback || !topic || !token) {
  console.error("Missing env. Need NGROK_BASE_URL, PUBSUB_TOPIC, YOUTUBE_PUBSUB_VERIFY_TOKEN");
  console.error({ callback, topic, tokenPresent: !!token });
  process.exit(1);
}

const form = new URLSearchParams();
form.set("hub.mode", "subscribe");
form.set("hub.callback", callback);
form.set("hub.topic", topic);
form.set("hub.verify", "async");
form.set("hub.verify_token", token);

const res = await fetch(HUB, {
  method: "POST",
  headers: { "Content-Type": "application/x-www-form-urlencoded" },
  body: form.toString(),
});

console.log("Subscribe status:", res.status);
console.log(await res.text());
