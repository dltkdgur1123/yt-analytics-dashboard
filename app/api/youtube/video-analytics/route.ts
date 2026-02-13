// app/api/youtube/video-analytics/route.ts
import { NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
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

  return { ok: res.ok, status: res.status, channelId, raw: data };
}

function normalizeVideoIds(videoIdsRaw: string | null) {
  if (!videoIdsRaw) return [];
  return videoIdsRaw
    .split(",")
    .map((v) => v.trim())
    .filter(Boolean);
}

export async function GET(req: Request) {
  const session = await getServerSession(authOptions);
  const accessToken = (session as any)?.accessToken as string | undefined;

  if (!accessToken) {
    return NextResponse.json({ ok: false, status: 401, error: "no access token" }, { status: 401 });
  }

  const ch = await getMyChannelId(accessToken);
  if (!ch.channelId) {
    return NextResponse.json(
      {
        ok: false,
        status: 400,
        error: "채널 ID를 가져오지 못했습니다.",
        channelLookup: ch,
      },
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

  // ✅ 멀티 비교 기본 metrics (필요하면 프론트에서 metrics=...로 override 가능)
  const metrics =
    url.searchParams.get("metrics") ??
    "views,estimatedMinutesWatched,averageViewDuration,subscribersGained,subscribersLost";

  // ✅ 멀티 비교 핵심: dimensions=video (영상별로 1줄)
  // - 일별 + 영상별까지 보고싶으면 "day,video" 로 바꿔서 호출하면 됨.
  const dimensions = url.searchParams.get("dimensions") ?? "video";
  const sort = url.searchParams.get("sort") ?? (dimensions.includes("day") ? "day" : "");

  const videoIds = normalizeVideoIds(url.searchParams.get("videoIds"));

  const api = new URL("https://youtubeanalytics.googleapis.com/v2/reports");
  api.searchParams.set("ids", `channel==${ch.channelId}`);
  api.searchParams.set("startDate", startDate);
  api.searchParams.set("endDate", endDate);
  api.searchParams.set("metrics", metrics);
  api.searchParams.set("dimensions", dimensions);

  if (sort) api.searchParams.set("sort", sort);

  // ✅ 선택된 영상들만 비교하고 싶으면 filters=video==id1,id2,id3
  if (videoIds.length > 0) {
    api.searchParams.set("filters", `video==${videoIds.join(",")}`);
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
      channelId: ch.channelId,
      startDate,
      endDate,
      dimensions,
      metrics,
      filters: videoIds.length ? `video==${videoIds.join(",")}` : null,
      requestUrl: api.toString(),
      data,
    },
    { status: res.status }
  );
}
