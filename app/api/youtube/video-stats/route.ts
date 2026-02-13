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

async function fetchVideoAnalytics(params: {
  accessToken: string;
  channelId: string;
  startDate: string;
  endDate: string;
  metrics: string;
  videoId: string;
}) {
  const api = new URL("https://youtubeanalytics.googleapis.com/v2/reports");
  api.searchParams.set("ids", `channel==${params.channelId}`);
  api.searchParams.set("startDate", params.startDate);
  api.searchParams.set("endDate", params.endDate);
  api.searchParams.set("metrics", params.metrics);

  // ✅ 영상 1개씩 안정적으로 필터링
  api.searchParams.set("filters", `video==${params.videoId}`);

  const res = await fetch(api.toString(), {
    headers: {
      Authorization: `Bearer ${params.accessToken}`,
      Accept: "application/json",
    },
    cache: "no-store",
  });

  const data = await res.json();

  // YouTube Analytics 응답 rows는 보통 [[metric1, metric2, ...]] 형태
  const row = (data?.rows?.[0] ?? null) as number[] | null;

  return {
    ok: res.ok,
    status: res.status,
    requestUrl: api.toString(),
    videoId: params.videoId,
    row,
    raw: data,
  };
}

export async function GET(req: Request) {
  const session = await getServerSession(authOptions);
  const accessToken = (session as any)?.accessToken as string | undefined;

  if (!accessToken) {
    return NextResponse.json({ ok: false, error: "no access token" }, { status: 401 });
  }

  const url = new URL(req.url);

  const videoIdsParam = url.searchParams.get("videoIds") ?? "";
  const videoIds = videoIdsParam
    .split(",")
    .map((v) => v.trim())
    .filter(Boolean);

  if (videoIds.length === 0) {
    return NextResponse.json(
      { ok: false, error: "videoIds is required. ex) videoIds=abc,def" },
      { status: 400 }
    );
  }

  const end = url.searchParams.get("endDate")
    ? new Date(url.searchParams.get("endDate")!)
    : new Date();

  const start = url.searchParams.get("startDate")
    ? new Date(url.searchParams.get("startDate")!)
    : new Date(Date.now() - 28 * 86400000);

  const startDate = yyyy_mm_dd(start);
  const endDate = yyyy_mm_dd(end);

  // ✅ 비교에 쓸 기본 metrics
  const metrics =
    url.searchParams.get("metrics") ??
    "views,estimatedMinutesWatched,averageViewDuration,subscribersGained,subscribersLost";

  // 1) 채널ID 확보
  const ch = await getMyChannelId(accessToken);
  if (!ch.channelId) {
    return NextResponse.json(
      { ok: false, error: "채널 ID를 가져오지 못했습니다.", channelLookup: ch },
      { status: 400 }
    );
  }

  // 2) 영상별로 Analytics 호출
  // (너무 많이 고르면 느려질 수 있으니 우선 20개 제한 추천)
  const limited = videoIds.slice(0, 20);

  const results = await Promise.all(
    limited.map((videoId) =>
      fetchVideoAnalytics({
        accessToken,
        channelId: ch.channelId!,
        startDate,
        endDate,
        metrics,
        videoId,
      })
    )
  );

  // 하나라도 실패하면 ok=false로 내려주되, 결과는 같이 준다(디버깅 편함)
  const ok = results.every((r) => r.ok);

  return NextResponse.json(
    {
      ok,
      status: ok ? 200 : 207,
      startDate,
      endDate,
      metrics,
      requestedCount: videoIds.length,
      usedCount: limited.length,
      results,
    },
    { status: ok ? 200 : 207 }
  );
}
