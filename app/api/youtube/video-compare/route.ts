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

  return { ok: res.ok, status: res.status, channelId, raw: data };
}

/**
 * GET /api/youtube/video-compare
 * Query:
 *  - startDate=YYYY-MM-DD
 *  - endDate=YYYY-MM-DD
 *  - metrics=views,estimatedMinutesWatched,...
 *  - videoIds=ID1,ID2,ID3
 */
export async function GET(req: Request) {
  const session = await getServerSession(authOptions);
  const accessToken = (session as any)?.accessToken as string | undefined;

  if (!accessToken) {
    return NextResponse.json({ ok: false, error: "no access token" }, { status: 401 });
  }

  // 1) 내 채널 ID
  const ch = await getMyChannelId(accessToken);
  if (!ch.channelId) {
    return NextResponse.json(
      {
        ok: false,
        error: "채널 ID를 가져오지 못했습니다. 로그인 계정이 채널 소유자인지 확인하세요.",
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

  const metrics =
    url.searchParams.get("metrics") ??
    "views,estimatedMinutesWatched,averageViewDuration,subscribersGained,subscribersLost";

  const videoIdsRaw = url.searchParams.get("videoIds") ?? "";
  const videoIds = videoIdsRaw
    .split(",")
    .map((v) => v.trim())
    .filter(Boolean);

  if (videoIds.length === 0) {
    return NextResponse.json(
      { ok: false, error: "videoIds 가 필요합니다. 예: videoIds=abc,def" },
      { status: 400 }
    );
  }

  // 2) YouTube Analytics (dimensions=video 고정)
  const api = new URL("https://youtubeanalytics.googleapis.com/v2/reports");
  api.searchParams.set("ids", `channel==${ch.channelId}`);
  api.searchParams.set("startDate", startDate);
  api.searchParams.set("endDate", endDate);
  api.searchParams.set("metrics", metrics);
  api.searchParams.set("dimensions", "video");
  api.searchParams.set("sort", `-${videoIds.length ? metrics.split(",")[0] : "views"}`); // 기본 sort

  // 여러 영상 OR 필터: video==id1,id2,id3
  api.searchParams.set("filters", `video==${videoIds.join(",")}`);

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
      metrics,
      videoIds,
      requestUrl: api.toString(),
      data,
    },
    { status: res.status }
  );
}
