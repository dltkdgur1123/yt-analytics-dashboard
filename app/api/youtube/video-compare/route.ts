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
  const res = await fetch("https://www.googleapis.com/youtube/v3/channels?part=id&mine=true", {
    headers: { Authorization: `Bearer ${accessToken}` },
    cache: "no-store",
  });
  const raw = await res.json();
  const channelId = raw?.items?.[0]?.id as string | undefined;
  return { ok: res.ok, status: res.status, channelId, raw };
}

async function fetchVideoMeta(accessToken: string, ids: string[]) {
  // YouTube Data API: videos.list
  // 최대 50개까지 가능. (우린 몇 개만 비교할 거라 OK)
  const api = new URL("https://www.googleapis.com/youtube/v3/videos");
  api.searchParams.set("part", "snippet");
  api.searchParams.set("id", ids.join(","));

  const res = await fetch(api.toString(), {
    headers: { Authorization: `Bearer ${accessToken}` },
    cache: "no-store",
  });

  const raw = await res.json();

  const map = new Map<string, { title: string; thumbnailUrl?: string; publishedAt?: string }>();
  for (const it of raw?.items ?? []) {
    const id = it?.id as string | undefined;
    const sn = it?.snippet;
    if (!id || !sn) continue;

    map.set(id, {
      title: sn.title ?? id,
      publishedAt: sn.publishedAt,
      thumbnailUrl: sn.thumbnails?.medium?.url ?? sn.thumbnails?.default?.url,
    });
  }

  return { ok: res.ok, status: res.status, raw, map };
}

export async function GET(req: Request) {
  const session = await getServerSession(authOptions);
  const accessToken = (session as any)?.accessToken as string | undefined;

  if (!accessToken) {
    return NextResponse.json({ ok: false, error: "로그인이 필요합니다.(no access token)" }, { status: 401 });
  }

  const url = new URL(req.url);

  const end = url.searchParams.get("endDate") ? new Date(url.searchParams.get("endDate")!) : new Date();
  const start = url.searchParams.get("startDate")
    ? new Date(url.searchParams.get("startDate")!)
    : new Date(Date.now() - 28 * 86400000);

  const startDate = yyyy_mm_dd(start);
  const endDate = yyyy_mm_dd(end);

  const metrics =
    url.searchParams.get("metrics") ??
    "views,estimatedMinutesWatched,averageViewDuration,subscribersGained,subscribersLost";

  // videoIds: "a,b,c"
  const videoIdsRaw = url.searchParams.get("videoIds") ?? "";
  const videoIds = videoIdsRaw
    .split(",")
    .map((v) => v.trim())
    .filter(Boolean);

  if (videoIds.length === 0) {
    return NextResponse.json({ ok: false, error: "videoIds가 비었습니다." }, { status: 400 });
  }

  // 1) 채널 ID
  const ch = await getMyChannelId(accessToken);
  if (!ch.channelId) {
    return NextResponse.json(
      { ok: false, error: "채널 ID를 가져오지 못했습니다.", raw: ch.raw },
      { status: 400 }
    );
  }

  // 2) Analytics API (dimensions=video)
  const api = new URL("https://youtubeanalytics.googleapis.com/v2/reports");
  api.searchParams.set("ids", `channel==${ch.channelId}`);
  api.searchParams.set("startDate", startDate);
  api.searchParams.set("endDate", endDate);
  api.searchParams.set("metrics", metrics);
  api.searchParams.set("dimensions", "video");

  // 핵심: 다중 video 필터
  // YouTube Analytics에서 일반적으로 "video==id1,id2,id3" 형태를 사용
  api.searchParams.set("filters", `video==${videoIds.join(",")}`);

  const res = await fetch(api.toString(), {
    headers: { Authorization: `Bearer ${accessToken}`, Accept: "application/json" },
    cache: "no-store",
  });

  const raw = await res.json();

  if (!res.ok) {
    return NextResponse.json(
      {
        ok: false,
        status: res.status,
        error: raw?.error?.message ?? "Analytics API 호출 실패",
        requestUrl: api.toString(),
        raw,
      },
      { status: res.status }
    );
  }

  // 3) rows -> items로 변환
  // raw.columnHeaders: [{name:"video",...},{name:"views",...}...]
  const headers: string[] = (raw?.columnHeaders ?? []).map((h: any) => String(h?.name ?? ""));
  const rows: any[] = raw?.rows ?? [];

  // 비디오 메타(제목/썸네일)
  const meta = await fetchVideoMeta(accessToken, videoIds);

  const items = rows.map((r) => {
    // r[0] = videoId, 이후는 metrics
    const videoId = String(r?.[0] ?? "");
    const m = meta.map.get(videoId);

    const obj: any = {
      videoId,
      title: m?.title ?? videoId,
      thumbnailUrl: m?.thumbnailUrl,
      publishedAt: m?.publishedAt,
    };

    // headers 기준으로 metrics 매핑
    // headers 예: ["video","views","estimatedMinutesWatched",...]
    for (let i = 1; i < headers.length; i++) {
      const key = headers[i];
      obj[key] = r?.[i];
    }

    return obj;
  });

  return NextResponse.json({
    ok: true,
    status: 200,
    requestUrl: api.toString(),
    startDate,
    endDate,
    metrics,
    items,
    raw, // 디버그용
    metaOk: meta.ok,
  });
}
