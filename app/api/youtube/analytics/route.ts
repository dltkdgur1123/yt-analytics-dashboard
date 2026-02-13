import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "../../auth/[...nextauth]/route";


function yyyy_mm_dd(d: Date) {
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

async function getMyChannelId(accessToken: string) {
  const res = await fetch(
    "https://www.googleapis.com/youtube/v3/channels?part=id&mine=true",
    {
      headers: { Authorization: `Bearer ${accessToken}` },
      cache: "no-store",
    }
  );

  const data = await res.json();
  const channelId = data?.items?.[0]?.id as string | undefined;

  return { ok: res.ok, status: res.status, channelId };
}

export async function GET(req: Request) {
  const session = await getServerSession(authOptions);
  const accessToken = (session as any)?.accessToken;

  if (!accessToken) {
    return NextResponse.json({ error: "no access token" }, { status: 401 });
  }

  const ch = await getMyChannelId(accessToken);
  if (!ch.channelId) {
    return NextResponse.json(
      { error: "채널 ID를 가져오지 못했습니다." },
      { status: 400 }
    );
  }

  const url = new URL(req.url);

  const end = url.searchParams.get("endDate")
    ? new Date(url.searchParams.get("endDate")!)
    : new Date();

  const start = url.searchParams.get("startDate")
    ? new Date(url.searchParams.get("startDate")!)
    : new Date(Date.now() - 28 * 86400000);

  const startDate = yyyy_mm_dd(start);
  const endDate = yyyy_mm_dd(end);

  const metrics =
    url.searchParams.get("metrics") ??
    "views,estimatedMinutesWatched,averageViewDuration,subscribersGained,subscribersLost";

  const dimensions = url.searchParams.get("dimensions");
  const sort = url.searchParams.get("sort");
  const videoIds = url.searchParams.get("videoIds"); // 🔥 다중 영상

  const api = new URL("https://youtubeanalytics.googleapis.com/v2/reports");
  api.searchParams.set("ids", `channel==${ch.channelId}`);
  api.searchParams.set("startDate", startDate);
  api.searchParams.set("endDate", endDate);
  api.searchParams.set("metrics", metrics);

  if (dimensions) api.searchParams.set("dimensions", dimensions);
  if (sort) api.searchParams.set("sort", sort);

  // 🔥 영상 필터 처리
  if (videoIds) {
    const ids = videoIds
      .split(",")
      .map((v) => v.trim())
      .filter(Boolean)
      .join(",");
    api.searchParams.set("filters", `video==${ids}`);
  }

  const res = await fetch(api.toString(), {
    headers: {
      Authorization: `Bearer ${accessToken}`,
      Accept: "application/json",
    },
    cache: "no-store",
  });

  const data = await res.json();

  return NextResponse.json(
    {
      ok: res.ok,
      status: res.status,
      requestUrl: api.toString(),
      data,
    },
    { status: res.status }
  );
}
