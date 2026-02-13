import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";

// ✅ 가능하면 .env.local에 YT_CHANNEL_ID로 넣는 걸 추천
// 예: YT_CHANNEL_ID=UCcKA-YlHc-YrDs-MO8Bj0_w
const FALLBACK_CHANNEL_ID = process.env.YT_CHANNEL_ID || "UCcKA-YlHc-YrDs-MO8Bj0_w";

async function fetchChannelByMine(accessToken: string) {
  const url = "https://www.googleapis.com/youtube/v3/channels?part=snippet,statistics&mine=true";
  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  const data = await res.json();
  return { res, data };
}

async function fetchChannelById(accessToken: string, channelId: string) {
  const url = `https://www.googleapis.com/youtube/v3/channels?part=snippet,statistics&id=${channelId}`;
  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  const data = await res.json();
  return { res, data };
}

export async function GET() {
  const session = await getServerSession(authOptions);
  const accessToken = (session as any)?.accessToken;

  if (!accessToken) {
    return NextResponse.json({ error: "no access token" }, { status: 401 });
  }

  // 1) mine=true 시도
  const mine = await fetchChannelByMine(accessToken);
  let item = mine.data?.items?.[0];
  let source: "mine" | "fallback_id" = "mine";

  // 2) 비었으면 fallback 채널ID로 재시도
  if (!item) {
    const byId = await fetchChannelById(accessToken, FALLBACK_CHANNEL_ID);
    item = byId.data?.items?.[0];
    source = "fallback_id";

    if (!item) {
      return NextResponse.json(
        {
          error: "channel not found",
          mineStatus: mine.res.status,
          mineRaw: mine.data,
          fallbackChannelId: FALLBACK_CHANNEL_ID,
          byIdStatus: byId.res.status,
          byIdRaw: byId.data,
        },
        { status: 500 }
      );
    }
  }

  const channelId = item?.id ?? "";
  const title = item?.snippet?.title ?? "";
  const thumbnail =
    item?.snippet?.thumbnails?.medium?.url ??
    item?.snippet?.thumbnails?.default?.url ??
    "";

  const subscriberCount = item?.statistics?.subscriberCount ?? "0";
  const viewCount = item?.statistics?.viewCount ?? "0";
  const videoCount = item?.statistics?.videoCount ?? "0";

  return NextResponse.json(
    {
      channelId,
      title,
      thumbnail,
      subscriberCount,
      viewCount,
      videoCount,
      raw: item,
      source,
    },
    { status: 200 }
  );
}
