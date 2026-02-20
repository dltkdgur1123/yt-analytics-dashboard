"use client";

import { useEffect, useMemo, useState } from "react";
import SimpleBarChart from "./SimpleBarChart"; // ✅ AnalyticsChart.tsx -> SimpleBarChart.tsx로 바꿨다고 했으니 이걸로 사용

type MetricKey =
  | "views"
  | "estimatedMinutesWatched"
  | "averageViewDuration"
  | "subscribersGained"
  | "subscribersLost";

const METRIC_LABEL: Record<MetricKey, string> = {
  views: "조회수",
  estimatedMinutesWatched: "시청시간(분)",
  averageViewDuration: "평균 시청 지속(초)",
  subscribersGained: "구독자 증가",
  subscribersLost: "구독자 감소",
};

const DEFAULT_METRICS =
  "views,estimatedMinutesWatched,averageViewDuration,subscribersGained,subscribersLost";

function formatNumber(n: number | null | undefined) {
  if (n === null || n === undefined) return "-";
  if (!Number.isFinite(n)) return "-";
  return new Intl.NumberFormat("ko-KR").format(n);
}

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

type VideoItem = {
  id: string;
  title: string;
  publishedAt?: string;
  thumbnailUrl?: string;
};

async function fetchVideoList(): Promise<VideoItem[]> {
  const res = await fetch("/api/youtube/videos", { cache: "no-store" });
  if (!res.ok) return [];
  const json = await res.json();

  const items = (json?.items ?? []) as any[];

  return items
    .map((v) => ({
      id: v.id,
      title: v.title ?? v.snippet?.title ?? v.id,
      publishedAt: v.publishedAt ?? v.snippet?.publishedAt,
      thumbnailUrl:
        v.thumbnailUrl ??
        v.snippet?.thumbnails?.medium?.url ??
        v.snippet?.thumbnails?.default?.url,
    }))
    .filter((v) => typeof v.id === "string" && v.id.trim().length > 0);
}

export default function VideoComparison() {
  const init = useMemo(() => calcRange(28), []);
  const [startDate, setStartDate] = useState(init.start);
  const [endDate, setEndDate] = useState(init.end);

  const [metric, setMetric] = useState<MetricKey>("views");

  const [videoInput, setVideoInput] = useState("");
  const [selected, setSelected] = useState<string[]>([]);

  const [videoListRaw, setVideoListRaw] = useState<VideoItem[]>([]);
  const [loadingList, setLoadingList] = useState(false);

  const [loading, setLoading] = useState(false);
  const [errMsg, setErrMsg] = useState<string | null>(null);

  // server response
  const [raw, setRaw] = useState<any>(null);

  // ✅ 1) 영상 목록 dedupe (id 기준) -> key 충돌 방지
  const videoList = useMemo(() => {
    const map = new Map<string, VideoItem>();
    for (const v of videoListRaw) {
      if (!v?.id) continue;
      if (!map.has(v.id)) map.set(v.id, v);
    }
    return Array.from(map.values());
  }, [videoListRaw]);

  // ✅ 선택된 영상의 표시용 정보
  const selectedInfo = useMemo(() => {
    const map = new Map(videoList.map((v) => [v.id, v]));
    return selected.map((id) => map.get(id) ?? { id, title: id });
  }, [selected, videoList]);

  // ✅ 서버 결과 -> rows
  const rows = useMemo(() => {
    if (!raw?.results) return [];

    const metrics = String(raw?.metrics ?? DEFAULT_METRICS)
      .split(",")
      .map((s: string) => s.trim())
      .filter(Boolean) as MetricKey[];

    const metricIndex = metrics.indexOf(metric);

    return (raw.results as any[])
      .map((r) => {
        const id = String(r.videoId ?? "");
        const value =
          Array.isArray(r.row) && metricIndex >= 0
            ? Number(r.row[metricIndex])
            : null;

        const info = selectedInfo.find((v) => v.id === id);
        return {
          videoId: id,
          title: info?.title ?? id,
          value,
          ok: r.ok,
          status: r.status,
        };
      })
      .filter((x) => x.videoId) // id 없는 건 제거
      .sort(
        (a, b) => Number(b.value ?? -Infinity) - Number(a.value ?? -Infinity)
      );
  }, [raw, metric, selectedInfo]);

  // ✅ 목록 불러오기
  useEffect(() => {
    (async () => {
      setLoadingList(true);
      try {
        const list = await fetchVideoList();
        setVideoListRaw(list);
      } finally {
        setLoadingList(false);
      }
    })();
  }, []);

  function toggleSelect(id: string) {
    const safeId = String(id ?? "").trim();
    if (!safeId) return;

    setSelected((prev) => {
      if (prev.includes(safeId)) return prev.filter((x) => x !== safeId);
      if (prev.length >= 10) return prev;
      return [...prev, safeId];
    });
  }

  function applyManualIds() {
    const ids = videoInput
      .split(",")
      .map((v) => v.trim())
      .filter(Boolean);

    const uniq = Array.from(new Set(ids)).slice(0, 10);
    setSelected(uniq);
  }

  async function load() {
    if (selected.length === 0) return;

    setLoading(true);
    setErrMsg(null);

    try {
      const qs = new URLSearchParams({
        startDate,
        endDate,
        metrics: DEFAULT_METRICS,
        videoIds: selected.join(","),
      });

      const res = await fetch(`/api/youtube/video-stats?${qs.toString()}`, {
        cache: "no-store",
      });
      const json = await res.json();
      setRaw(json);

      if (!res.ok && json?.error) setErrMsg(String(json.error));
      else if (json?.ok === false)
        setErrMsg("일부 영상 조회가 실패했어요(상태/권한/영상ID 확인).");
    } catch (e: any) {
      setErrMsg(e?.message ?? "알 수 없는 오류");
    } finally {
      setLoading(false);
    }
  }

  return (
    <section className="mt-10 rounded-xl border p-5">
      <div className="flex flex-col gap-1">
        <h2 className="text-xl font-bold">영상 레벨 멀티 비교</h2>
        <p className="text-sm text-gray-600">
          여러 영상을 선택하고, 같은 기간/지표로 비교합니다.
        </p>
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-2">
        <label className="flex items-center gap-2 text-sm">
          시작
          <input
            className="rounded border px-2 py-1"
            type="date"
            value={startDate}
            onChange={(e) => setStartDate(e.target.value)}
          />
        </label>

        <label className="flex items-center gap-2 text-sm">
          종료
          <input
            className="rounded border px-2 py-1"
            type="date"
            value={endDate}
            onChange={(e) => setEndDate(e.target.value)}
          />
        </label>

        <button
          onClick={load}
          className="rounded bg-black px-4 py-2 text-sm font-medium text-white disabled:opacity-60"
          disabled={loading || selected.length === 0}
        >
          {loading ? "불러오는 중..." : "비교 조회"}
        </button>

        <span className="text-xs text-gray-500">
          선택: {selected.length}/10
        </span>
      </div>

      <div className="mt-4 flex flex-wrap gap-2">
        {(Object.keys(METRIC_LABEL) as MetricKey[]).map((k) => {
          const active = metric === k;
          return (
            <button
              key={k} // ✅ key OK
              type="button"
              onClick={() => setMetric(k)}
              className={[
                "rounded-full border px-3 py-1 text-xs font-medium transition",
                active
                  ? "bg-black text-white"
                  : "bg-white text-gray-700 hover:bg-gray-50",
              ].join(" ")}
            >
              {METRIC_LABEL[k]}
            </button>
          );
        })}
      </div>

      {errMsg ? (
        <div className="mt-4 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">
          {errMsg}
        </div>
      ) : null}

      {/* ✅ 수동 입력 */}
      <div className="mt-6 rounded-lg border p-4">
        <div className="text-sm font-semibold">영상 ID 직접 입력</div>
        <div className="mt-2 flex gap-2">
          <input
            className="flex-1 rounded border px-3 py-2 text-sm"
            placeholder="영상ID1, 영상ID2, 영상ID3"
            value={videoInput}
            onChange={(e) => setVideoInput(e.target.value)}
          />
          <button
            onClick={applyManualIds}
            className="rounded bg-gray-900 px-4 py-2 text-sm text-white"
            type="button"
          >
            적용
          </button>
        </div>
      </div>

      {/* ✅ 영상 목록 */}
      <div className="mt-6 rounded-lg border p-4">
        <div className="flex items-center justify-between">
          <div className="text-sm font-semibold">비교할 영상 선택</div>
          <button
            type="button"
            onClick={() => setSelected([])}
            className="rounded border px-3 py-1 text-xs hover:bg-gray-50"
          >
            선택 초기화
          </button>
        </div>

        {loadingList ? (
          <div className="mt-3 text-sm text-gray-500">
            영상 목록 불러오는 중...
          </div>
        ) : videoList.length === 0 ? (
          <div className="mt-3 text-sm text-gray-500">
            영상 목록 API(/api/youtube/videos)가 없거나 실패했어요. 위 “직접 입력”을
            사용하면 됩니다.
          </div>
        ) : (
          <div className="mt-3 grid grid-cols-1 gap-3 md:grid-cols-2">
            {videoList.slice(0, 30).map((v, idx) => {
              const vid = v.id?.trim();
              if (!vid) return null;

              const isOn = selected.includes(vid);

              return (
                <button
                  key={vid} // ✅ 안정적인 고유 key (dedupe 했기 때문에 OK)
                  type="button"
                  onClick={() => toggleSelect(vid)}
                  className={[
                    "flex items-center gap-3 rounded-xl border p-3 text-left transition",
                    isOn
                      ? "border-black bg-gray-50"
                      : "bg-white hover:bg-gray-50",
                  ].join(" ")}
                >
                  <div className="h-12 w-20 overflow-hidden rounded bg-gray-200">
                    {v.thumbnailUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={v.thumbnailUrl}
                        alt=""
                        className="h-full w-full object-cover"
                      />
                    ) : null}
                  </div>

                  <div className="flex-1">
                    <div className="line-clamp-1 text-sm font-medium">
                      {v.title}
                    </div>
                    <div className="mt-1 text-[11px] text-gray-500">
                      {v.publishedAt ?? "-"}
                    </div>
                    <div className="mt-1 text-[11px] text-gray-400">{vid}</div>
                  </div>

                  <div className="text-xs font-semibold">
                    {isOn ? "선택됨" : "선택"}
                  </div>
                </button>
              );
            })}
          </div>
        )}
      </div>

      {/* ✅ 결과 */}
      <div className="mt-6 rounded-lg border p-4">
        <div className="text-sm font-semibold">비교 결과</div>

        {rows.length === 0 ? (
          <div className="mt-3 text-sm text-gray-500">
            아직 데이터 없음 (영상 선택 후 “비교 조회”)
          </div>
        ) : (
          <>
            <div className="mt-4">
              <SimpleBarChart
                title={METRIC_LABEL[metric]}
                rows={rows.map((r) => ({ name: r.title, value: r.value ?? 0 }))}
              />
            </div>

            <div className="mt-4 overflow-x-auto">
              <table className="min-w-full text-sm">
                <thead>
                  <tr className="border-b">
                    <th className="p-2 text-left">영상</th>
                    <th className="p-2 text-right">{METRIC_LABEL[metric]}</th>
                    <th className="p-2 text-right">상태</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((r) => (
                    <tr key={r.videoId} className="border-b">
                      <td className="p-2">
                        <div className="font-medium">{r.title}</div>
                        <div className="text-[11px] text-gray-400">
                          {r.videoId}
                        </div>
                      </td>
                      <td className="p-2 text-right font-semibold">
                        {formatNumber(r.value)}
                      </td>
                      <td className="p-2 text-right text-xs text-gray-500">
                        {r.ok ? "OK" : `FAIL(${r.status})`}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <details className="mt-3 text-xs text-gray-600">
              <summary className="cursor-pointer">
                디버그: 원본 응답 보기
              </summary>
              <pre className="mt-2 overflow-auto rounded bg-gray-50 p-2">
{JSON.stringify(raw, null, 2)}
              </pre>
            </details>
          </>
        )}
      </div>
    </section>
  );
}