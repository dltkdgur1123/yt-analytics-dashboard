import { NextRequest, NextResponse } from "next/server";

function extractVideoIdFromAtom(xml: string): string | null {
  const m = xml.match(/<yt:videoId>([^<]+)<\/yt:videoId>/);
  return m?.[1] ?? null;
}

export async function GET(req: NextRequest) {
  const url = new URL(req.url);
  const challenge = url.searchParams.get("hub.challenge");
  const verifyToken = url.searchParams.get("hub.verify_token");
  const mode = url.searchParams.get("hub.mode");
  const topic = url.searchParams.get("hub.topic");

  console.log("[YouTube Webhook][GET]", {
    mode,
    hasChallenge: !!challenge,
    verifyToken,
    expected: process.env.YOUTUBE_PUBSUB_VERIFY_TOKEN,
    topic,
  });

  if (verifyToken !== process.env.YOUTUBE_PUBSUB_VERIFY_TOKEN) {
    return new NextResponse("forbidden", { status: 403 });
  }

  return new NextResponse(challenge ?? "missing challenge", { status: 200 });
}

export async function POST(req: NextRequest) {
  const xml = await req.text();
  const videoId = extractVideoIdFromAtom(xml);

  console.log("[YouTube Webhook][POST] received", {
    videoId,
    len: xml.length,
    head: xml.slice(0, 300),
  });

  return new NextResponse("ok", { status: 200 });
}
