"use client";

import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

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
  value: number; // 선택 metric 값
};

function formatNumber(n: number) {
  if (!Number.isFinite(n)) return "-";
  return new Intl.NumberFormat("ko-KR").format(n);
}

export default function VideoCompareChart(props: {
  items: VideoCompareItem[];
  metric: VideoMetricKey;
  onChangeMetric: (m: VideoMetricKey) => void;
  loading: boolean;
}) {
  const { items, metric, onChangeMetric, loading } = props;

  const chartData = items.map((it) => ({
    name: it.title.length > 18 ? `${it.title.slice(0, 18)}…` : it.title,
    fullTitle: it.title,
    value: it.value,
  }));

  return (
    <div className="rounded-xl border p-4">
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div>
          <div className="text-sm font-semibold">차트</div>
          <div className="text-xs text-gray-500">
            선택 지표: {METRIC_LABEL[metric]}
          </div>
        </div>

        <div className="flex flex-wrap gap-2">
          {(Object.keys(METRIC_LABEL) as VideoMetricKey[]).map((m) => {
            const active = metric === m;
            return (
              <button
                key={m}
                type="button"
                onClick={() => onChangeMetric(m)}
                className={[
                  "rounded-lg border px-3 py-1.5 text-xs font-medium transition",
                  active ? "bg-black text-white" : "bg-white text-gray-700",
                  loading ? "opacity-60" : "hover:bg-gray-50",
                ].join(" ")}
                disabled={loading}
                aria-pressed={active}
              >
                {METRIC_LABEL[m]}
              </button>
            );
          })}
        </div>
      </div>

      <div className="mt-4 h-[360px] w-full">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={chartData} margin={{ top: 8, right: 12, left: 8, bottom: 64 }}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis
              dataKey="name"
              angle={-20}
              textAnchor="end"
              interval={0}
              height={80}
            />
            <YAxis tickFormatter={(v) => formatNumber(Number(v))} />
            <Tooltip
              formatter={(v: any) => formatNumber(Number(v))}
              labelFormatter={(_, payload) =>
                payload?.[0]?.payload?.fullTitle ?? ""
              }
            />
            <Bar dataKey="value" />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
