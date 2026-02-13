"use client";

import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer } from "recharts";

export default function SimpleBarChart({
  title,
  rows,
}: {
  title: string;
  rows: { name: string; value: number }[];
}) {
  return (
    <div className="rounded-xl border p-4">
      <div className="mb-3 flex items-center justify-between">
        <div className="text-sm font-semibold">{title} (영상별 비교)</div>
        <div className="text-xs text-gray-500">Bar Chart</div>
      </div>

      <div style={{ width: "100%", height: 320 }}>
        <ResponsiveContainer>
          <BarChart data={rows}>
            <XAxis dataKey="name" hide />
            <YAxis />
            <Tooltip />
            <Bar dataKey="value" />
          </BarChart>
        </ResponsiveContainer>
      </div>

      <div className="mt-2 text-[11px] text-gray-500">
        * X축 제목은 길어서 숨김 처리(툴팁으로 확인)
      </div>
    </div>
  );
}
