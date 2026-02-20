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

type Row = { name: string; value: number; fullName?: string };

function formatNumber(n: number) {
  if (!Number.isFinite(n)) return "-";
  return new Intl.NumberFormat("ko-KR").format(n);
}

export default function SimpleBarChart({
  title,
  rows,
  height = 360,
}: {
  title: string;
  rows: Row[];
  height?: number;
}) {
  const chartData = rows.map((r) => ({
    name: r.name.length > 18 ? `${r.name.slice(0, 18)}…` : r.name,
    fullName: r.fullName ?? r.name,
    value: r.value,
  }));

  return (
    <div className="rounded-xl border p-4">
      <div className="mb-2 flex items-center justify-between">
        <div className="text-sm font-semibold">{title}</div>
        <div className="text-xs text-gray-500">Bar Chart</div>
      </div>

      <div className="w-full" style={{ height }}>
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={chartData} margin={{ top: 8, right: 12, left: 8, bottom: 64 }}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="name" angle={-20} textAnchor="end" interval={0} height={80} />
            <YAxis tickFormatter={(v) => formatNumber(Number(v))} />
            <Tooltip
              formatter={(v: any) => formatNumber(Number(v))}
              labelFormatter={(_, payload) => payload?.[0]?.payload?.fullName ?? ""}
            />
            <Bar dataKey="value" />
          </BarChart>
        </ResponsiveContainer>
      </div>

      <div className="mt-2 text-[11px] text-gray-500">
        * 제목이 길어서 X축은 줄여 표시(툴팁으로 전체 제목 확인)
      </div>
    </div>
  );
}