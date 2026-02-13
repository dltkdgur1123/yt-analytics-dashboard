// app/video-compare/page.tsx
"use client";

import { useEffect, useMemo, useState } from "react";

type VideoItem = {
  videoId: string;
  title: string;
  publishedAt?: string;
  thumbnailUrl?: string | null;
};

type YtAnalyticsResponse = {
  ok: boolean;
  status: number;
  requestUrl?: string;
  data?: any;
};

const METRIC_PRESETS = [
  { key: "views", label: "조회수" },
  { key: "estimatedMinutesWatched", label: "시청시간(분)" },
  { key: "averageViewDuration", label: "평균 시청 지속(초)" },
  { key: "subscribersGained", label: "구독자 증가" },
  { key: "subscribersLost", label: "구독자 감소" },
] as const;

function yyyymmdd(d: Date) {
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

function calcRange(days: number) {
  const end = new Date();
  const start = new Date(Date.now() - days * 86400000);
  return { start: yyyymmdd(start), end: yyyymmdd(end) };
}

function formatNumber(n: any) {
  if (n === undefined || n === null) return "-";
  const num = Number(n);
  if (!Number.isFinite(num)) return String(n);
  return new Intl.NumberFormat("ko-KR").format(num);
}

function formatSec(sec: any) {
  const n = Number(sec);
  if (!Number.isFinite(n)) return "-";
  const m = Math.floor(n / 60);
  const s = Math.floor(n % 60);
  return `${m}m ${s}s`;
}

export default function VideoComparePage() {
  const init = calcRange(28);

  const [startDate, setStartDate] = useState(init.start);
  const [endDate, setEndDate] = useState(init.end);

  const [videos, setVideos] = useState<VideoItem[]>([]);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [selectedMetrics, setSelectedMetrics] = useState<string[]>(
    METRIC_PRESETS.map((m) => m.key) // 기본 전부
  );

  const [loadingList, setLoadingList] = useState(false);
  const [loadingReport, setLoadingReport] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const [report, setReport] = useState<YtAnalyticsResponse | null>(null);

  // 영상ID -> 제목 매핑
  const idToTitle = useMemo(() => {
    const map = new Map<string, VideoItem>();
    for (const v of videos) map.set(v.videoId, v);
    return map;
  }, [videos]);

  // API에서 받은 rows를 테이블 친화 형태로 변환
  const table = useMemo(() => {
    const rows: any[] = report?.data?.data?.rows ?? report?.data?.rows ?? report?.data?.data?.data?.rows ?? [];
    const columnHeaders: any[] =
      report?.data?.data?.columnHeaders ??
      report?.data?.columnHeaders ??
      report?.data?.data?.data?.columnHeaders ??
      [];

    // 예상 형태: dimensions=video면 rows는 [ [videoId, metric1, metric2, ...], ... ]
    // columnHeaders 예: [{name:"video"}, {name:"views"}, ...]
    if (!Array.isArray(rows) || rows.length === 0) return { headers: [], rows: [] as any[] };

    const headers = columnHeaders.map((h: any) => h?.name).filter(Boolean);

    const out = rows.map((r) => {
      const obj: Record<string, any> = {};
      headers.forEach((h: string, idx: number) => {
        obj[h] = r[idx];
      });
      return obj;
    });

    return { headers, rows: out };
  }, [report]);

  async function loadVideos() {
    setLoadingList(true);
    setErr(null);
    try {
      const res = await fetch(`/api/youtube/videos?maxResults=20`, { cache: "no-store" });
      const json = await res.json();
      const items: VideoItem[] = json?.items ?? [];
      setVideos(items);

      // 기본 선택: 상위 3개
      if (items.length && selectedIds.length === 0) {
        setSelectedIds(items.slice(0, 3).map((v) => v.videoId));
      }
    } catch (e: any) {
      setErr(e?.message ?? "영상 목록 로드 실패");
    } finally {
      setLoadingList(false);
    }
  }

  async function loadReport() {
    if (selectedIds.length === 0) {
      setErr("비교할 영상을 1개 이상 선택해줘");
      return;
    }
    if (selectedMetrics.length === 0) {
      setErr("비교할 지표(metrics)를 1개 이상 선택해줘");
      return;
    }

    setLoadingReport(true);
    setErr(null);

    try {
      const qs = new URLSearchParams();
      qs.set("startDate", startDate);
      qs.set("endDate", endDate);
      qs.set("dimensions", "video");
      qs.set("metrics", selectedMetrics.join(","));
      qs.set("videoIds", selectedIds.join(","));

      const res = await fetch(`/api/youtube/video-analytics?${qs.toString()}`, { cache: "no-store" });
      const json: YtAnalyticsResponse = await res.json();
      setReport({ ...json });

      if (!res.ok) {
        setErr(`Analytics 실패: ${json?.data?.error?.message ?? json?.status ?? res.status}`);
      }
    } catch (e: any) {
      setErr(e?.message ?? "리포트 로드 실패");
    } finally {
      setLoadingReport(false);
    }
  }

  useEffect(() => {
    loadVideos();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function toggleSelectVideo(id: string) {
    setSelectedIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  }

  function toggleMetric(key: string) {
    setSelectedMetrics((prev) => (prev.includes(key) ? prev.filter((x) => x !== key) : [...prev, key]));
  }

  return (
    <main className="mx-auto max-w-5xl px-6 py-10">
      <div className="flex flex-col gap-1">
        <h1 className="text-3xl font-bold">영상 레벨 멀티 비교</h1>
        <p className="text-sm text-gray-600">선택한 여러 영상의 지표를 한 번에 비교</p>
      </div>

      <section className="mt-6 rounded-xl border p-5">
        <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
          <div className="flex flex-wrap items-center gap-3">
            <label className="flex items-center gap-2 text-sm">
              시작
              <input className="rounded border px-2 py-1" type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
            </label>
            <label className="flex items-center gap-2 text-sm">
              종료
              <input className="rounded border px-2 py-1" type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} />
            </label>

            <button
              onClick={loadReport}
              disabled={loadingReport}
              className="rounded-lg bg-black px-4 py-2 text-sm font-medium text-white disabled:opacity-60"
            >
              {loadingReport ? "불러오는 중..." : "비교 조회"}
            </button>
          </div>

          <div className="text-xs text-gray-500">
            {report?.requestUrl ? (
              <details>
                <summary className="cursor-pointer">디버그: requestUrl</summary>
                <div className="mt-2 break-all rounded-lg border bg-gray-50 p-2">{report.requestUrl}</div>
              </details>
            ) : null}
          </div>
        </div>

        {err ? (
          <div className="mt-4 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">{err}</div>
        ) : null}

        {/* Metrics 선택 */}
        <div className="mt-5">
          <div className="text-sm font-semibold">비교 지표</div>
          <div className="mt-2 flex flex-wrap gap-2">
            {METRIC_PRESETS.map((m) => {
              const active = selectedMetrics.includes(m.key);
              return (
                <button
                  key={m.key}
                  type="button"
                  onClick={() => toggleMetric(m.key)}
                  className={[
                    "rounded-full border px-3 py-1.5 text-xs font-medium transition",
                    active ? "bg-black text-white" : "bg-white text-gray-700",
                  ].join(" ")}
                >
                  {m.label}
                </button>
              );
            })}
          </div>
        </div>

        {/* Video 선택 */}
        <div className="mt-6">
          <div className="flex items-center justify-between">
            <div className="text-sm font-semibold">비교할 영상 선택</div>
            <button
              type="button"
              onClick={loadVideos}
              className="rounded-lg border px-3 py-1.5 text-xs font-medium hover:bg-gray-50"
              disabled={loadingList}
            >
              {loadingList ? "로딩..." : "목록 새로고침"}
            </button>
          </div>

          <div className="mt-3 grid grid-cols-1 gap-2 md:grid-cols-2">
            {videos.map((v) => {
              const active = selectedIds.includes(v.videoId);
              return (
                <button
                  key={v.videoId}
                  type="button"
                  onClick={() => toggleSelectVideo(v.videoId)}
                  className={[
                    "flex items-center gap-3 rounded-xl border p-3 text-left transition",
                    active ? "border-black bg-gray-50" : "bg-white hover:bg-gray-50",
                  ].join(" ")}
                >
                  {v.thumbnailUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={v.thumbnailUrl} alt="" className="h-14 w-24 rounded-lg object-cover" />
                  ) : (
                    <div className="h-14 w-24 rounded-lg bg-gray-200" />
                  )}

                  <div className="min-w-0 flex-1">
                    <div className="truncate text-sm font-semibold">{v.title}</div>
                    <div className="mt-1 text-[11px] text-gray-500">
                      {v.publishedAt ? new Date(v.publishedAt).toLocaleString("ko-KR") : "-"}
                    </div>
                    <div className="mt-1 text-[11px] text-gray-400">{v.videoId}</div>
                  </div>

                  <div className={["text-xs font-semibold", active ? "text-black" : "text-gray-400"].join(" ")}>
                    {active ? "선택됨" : "선택"}
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        {/* 결과 테이블 */}
        <div className="mt-8">
          <div className="text-sm font-semibold">비교 결과</div>

          <div className="mt-3 overflow-x-auto rounded-xl border">
            <table className="w-full border-collapse text-sm">
              <thead className="bg-gray-50">
                <tr className="text-left">
                  <th className="whitespace-nowrap border-b p-3">영상</th>
                  {selectedMetrics.map((m) => (
                    <th key={m} className="whitespace-nowrap border-b p-3">
                      {METRIC_PRESETS.find((x) => x.key === m)?.label ?? m}
                    </th>
                  ))}
                </tr>
              </thead>

              <tbody>
                {table.rows.length === 0 ? (
                  <tr>
                    <td className="p-3 text-gray-500" colSpan={1 + selectedMetrics.length}>
                      아직 데이터 없음 (영상 선택 후 “비교 조회”)
                    </td>
                  </tr>
                ) : (
                  table.rows.map((r: any, idx: number) => {
                    const vid = String(r.video ?? r.videoId ?? "");
                    const meta = idToTitle.get(vid);
                    return (
                      <tr key={`${vid}-${idx}`} className="border-t">
                        <td className="p-3">
                          <div className="font-semibold">{meta?.title ?? vid}</div>
                          <div className="mt-1 text-[11px] text-gray-400">{vid}</div>
                        </td>

                        {selectedMetrics.map((m) => {
                          const val = r[m];
                          const isAvg = m === "averageViewDuration";
                          return (
                            <td key={m} className="p-3">
                              <span className="font-medium">
                                {isAvg ? formatSec(val) : formatNumber(val)}
                              </span>
                            </td>
                          );
                        })}
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>

          <p className="mt-3 text-xs text-gray-500">
            * 비교 결과는 YouTube Analytics 보고서 기준이며, 선택한 지표(metrics)와 dimensions=video 조합으로 산출됩니다.
          </p>
        </div>
      </section>
    </main>
  );
}
