import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";

export async function GET() {
  const session = await getServerSession(authOptions);
  const accessToken = (session as any)?.accessToken;

  if (!accessToken) {
    return NextResponse.json({ error: "no access token" }, { status: 401 });
  }

  const res = await fetch(
    "https://www.googleapis.com/youtube/v3/channels?part=snippet,statistics&mine=true",
    {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    }
  );

  const data = await res.json();
  const ch = data?.items?.[0];

  if (!ch) {
    return NextResponse.json({ error: "channel not found", raw: data }, { status: 500 });
  }

  return NextResponse.json({
    channelId: ch.id,
    title: ch.snippet?.title,
    thumbnail: ch.snippet?.thumbnails?.medium?.url,
    subscriberCount: ch.statistics?.subscriberCount ?? "0",
    viewCount: ch.statistics?.viewCount ?? "0",
    videoCount: ch.statistics?.videoCount ?? "0",
  });
}
