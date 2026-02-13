"use client";

import { useMemo, useState } from "react";
import VideoCompareChart, { METRIC_LABEL, type VideoCompareItem, type VideoMetricKey } from "../components/VideoCompareChart";

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

function formatNumber(n: unknown) {
  const num = typeof n === "string" ? Number(n) : (n as number);
  if (!Number.isFinite(num)) return "-";
  return new Intl.NumberFormat("ko-KR").format(num);
}

const METRICS: { key: VideoMetricKey; label: string }[] = [
  { key: "views", label: "조회수" },
  { key: "estimatedMinutesWatched", label: "시청시간(분)" },
  { key: "averageViewDuration", label: "평균 시청 지속(초)" },
  { key: "subscribersGained", label: "구독자 증가" },
  { key: "subscribersLost", label: "구독자 감소" },
];

export default function VideoComparePage() {
  const init = useMemo(() => calcRange(28), []);
  const [startDate, setStartDate] = useState(init.start);
  const [endDate, setEndDate] = useState(init.end);

  const [metric, setMetric] = useState<VideoMetricKey>("views");

  const [videoInput, setVideoInput] = useState("");
  const [selectedIds, setSelectedIds] = useState<string[]>([]);

  const [items, setItems] = useState<VideoCompareItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  // 디버그용: 실제 응답 저장
  const [debug, setDebug] = useState<any>(null);

  function applyInputIds() {
    const ids = videoInput
      .split(",")
      .map((v) => v.trim())
      .filter(Boolean);

    setSelectedIds(Array.from(new Set(ids)));
  }

  async function loadCompare() {
    if (!selectedIds.length) {
      setErr("영상 ID를 1개 이상 입력 후 [적용]을 눌러주세요.");
      return;
    }

    setLoading(true);
    setErr(null);

    try {
      const qs = new URLSearchParams({
        startDate,
        endDate,
        metrics: METRICS.map((m) => m.key).join(","),
        dimensions: "video",
        videoIds: selectedIds.join(","),
      });

      const res = await fetch(`/api/youtube/video-compare?${qs.toString()}`, { cache: "no-store" });
      const json = await res.json();

      setDebug(json);

      if (!res.ok || !json?.ok) {
        setItems([]);
        setErr(json?.raw?.error?.message ?? json?.error ?? `요청 실패 (${res.status})`);
        return;
      }

      const rawItems: VideoCompareItem[] = Array.isArray(json.items) ? json.items : [];
      setItems(rawItems);
    } catch (e: any) {
      setErr(e?.message ?? "알 수 없는 오류");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="mx-auto max-w-5xl px-6 py-10">
      <div className="flex flex-col gap-1">
        <h1 className="text-3xl font-bold">영상 레벨 멀티 비교</h1>
        <p className="text-sm text-gray-600">선택한 여러 영상의 지표를 한 번에 비교</p>
      </div>

      <section className="mt-8 rounded-xl border p-5">
        <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
          <div className="flex flex-wrap items-center gap-2">
            <label className="flex items-center gap-2 text-sm">
              시작
              <input className="rounded border px-2 py-1" type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
            </label>
            <label className="flex items-center gap-2 text-sm">
              종료
              <input className="rounded border px-2 py-1" type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} />
            </label>

            <button
              onClick={loadCompare}
              className="rounded-lg bg-black px-4 py-2 text-sm font-medium text-white disabled:opacity-60"
              disabled={loading}
            >
              {loading ? "불러오는 중..." : "비교 조회"}
            </button>
          </div>

          <div className="flex flex-col gap-2 md:w-[520px]">
            <div className="text-sm font-semibold">영상 ID 입력(쉼표로 구분)</div>
            <div className="flex gap-2">
              <input
                className="flex-1 rounded border px-3 py-2 text-sm"
                placeholder="영상ID1, 영상ID2, 영상ID3"
                value={videoInput}
                onChange={(e) => setVideoInput(e.target.value)}
              />
              <button onClick={applyInputIds} className="rounded bg-black px-4 py-2 text-sm font-medium text-white" type="button">
                적용
              </button>
            </div>
            {selectedIds.length ? <div className="text-xs text-gray-500">선택됨: {selectedIds.join(", ")}</div> : null}
          </div>
        </div>

        <div className="mt-5">
          <div className="text-sm font-semibold">비교 지표</div>
          <div className="mt-2 flex flex-wrap gap-2">
            {METRICS.map((m) => {
              const active = metric === m.key;
              return (
                <button
                  key={m.key}
                  type="button"
                  onClick={() => setMetric(m.key)}
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

        {err ? (
          <div className="mt-4 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">{err}</div>
        ) : null}

        {/* ✅ 차트 (여기서 무조건 렌더됨: items가 비어도 박스는 뜸) */}
        <div className="mt-6">
          <VideoCompareChart items={items} metric={metric} loading={loading} />
        </div>

        {/* ✅ 테이블 */}
        <div className="mt-4 overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead>
              <tr className="border-b">
                <th className="p-2 text-left">영상</th>
                <th className="p-2 text-right">{METRIC_LABEL[metric] ?? metric}</th>
              </tr>
            </thead>
            <tbody>
              {items.length ? (
                items.map((it, idx) => (
                  <tr key={`${it.videoId || "noid"}-${idx}`} className="border-b">
                    <td className="p-2">
                      <div className="flex items-center gap-3">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        {it.thumbnailUrl ? <img src={it.thumbnailUrl} alt="" className="h-10 w-16 rounded object-cover" /> : null}
                        <div>
                          <div className="font-medium">{it.title}</div>
                          <div className="text-[11px] text-gray-500">{it.videoId}</div>
                        </div>
                      </div>
                    </td>
                    <td className="p-2 text-right font-semibold">{formatNumber((it as any)[metric])}</td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td className="p-3 text-gray-500" colSpan={2}>
                    아직 데이터 없음 (영상 ID 입력 → “적용” → “비교 조회”)
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* ✅ 디버그(지금 차트 안 뜰 때 원인 1초 컷) */}
        <details className="mt-3 text-xs text-gray-600">
          <summary className="cursor-pointer">디버그: /api/youtube/video-compare 응답 보기</summary>
          <pre className="mt-2 max-h-[360px] overflow-auto rounded bg-gray-50 p-2">{JSON.stringify(debug, null, 2)}</pre>
        </details>
      </section>
    </main>
  );
}
