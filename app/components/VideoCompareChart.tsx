"use client";

import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

export type VideoMetricKey =
  | "views"
  | "estimatedMinutesWatched"
  | "averageViewDuration"
  | "subscribersGained"
  | "subscribersLost";

export const METRIC_LABEL: Record<VideoMetricKey, string> = {
  views: "조회수",
  estimatedMinutesWatched: "시청시간(분)",
  averageViewDuration: "평균 시청 지속(초)",
  subscribersGained: "구독자 증가",
  subscribersLost: "구독자 감소",
};

export type VideoCompareItem = {
  videoId: string;
  title: string;
  publishedAt?: string;
  thumbnailUrl?: string;

  // API가 내려주는 metric 필드들 (숫자/문자열 가능)
  views?: number | string;
  estimatedMinutesWatched?: number | string;
  averageViewDuration?: number | string;
  subscribersGained?: number | string;
  subscribersLost?: number | string;
};

function toNumber(v: unknown) {
  const n = typeof v === "string" ? Number(v) : (v as number);
  return Number.isFinite(n) ? n : 0;
}

function formatNumber(n: number) {
  if (!Number.isFinite(n)) return "-";
  return new Intl.NumberFormat("ko-KR").format(n);
}

export default function VideoCompareChart(props: {
  items: VideoCompareItem[];
  metric: VideoMetricKey;
  loading: boolean;
}) {
  const { items, metric, loading } = props;

  const chartData = items.map((it, idx) => {
    const value = toNumber((it as any)[metric]);
    return {
      key: `${it.videoId || "noid"}-${idx}`,
      name: it.title?.length > 18 ? `${it.title.slice(0, 18)}…` : it.title,
      fullTitle: it.title,
      value,
    };
  });

  return (
    <div className="rounded-xl border p-4">
      <div className="flex items-center justify-between">
        <div>
          <div className="text-sm font-semibold">차트</div>
          <div className="text-xs text-gray-500">선택 지표: {METRIC_LABEL[metric]}</div>
        </div>
        {loading ? <div className="text-xs text-gray-500">불러오는 중...</div> : null}
      </div>

      <div className="mt-4 h-[360px] w-full">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={chartData} margin={{ top: 8, right: 12, left: 8, bottom: 64 }}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="name" angle={-20} textAnchor="end" interval={0} height={80} />
            <YAxis tickFormatter={(v) => formatNumber(Number(v))} />
            <Tooltip
              formatter={(v: any) => formatNumber(Number(v))}
              labelFormatter={(_, payload) => payload?.[0]?.payload?.fullTitle ?? ""}
            />
            <Bar dataKey="value" />
          </BarChart>
        </ResponsiveContainer>
      </div>

      {!loading && items.length === 0 ? (
        <div className="mt-2 text-xs text-gray-500">표시할 데이터가 없어요. (로그인/영상ID/API 응답 확인)</div>
      ) : null}
    </div>
  );
}
