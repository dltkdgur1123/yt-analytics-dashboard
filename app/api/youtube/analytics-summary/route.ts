import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";

export async function GET(req: Request) {
  const session = await getServerSession(authOptions);
  const accessToken = (session as any)?.accessToken;

  if (!accessToken) {
    return NextResponse.json({ error: "no access token" }, { status: 401 });
  }

  const url = new URL(req.url);
  const days = Number(url.searchParams.get("days") ?? "28");

  // 날짜 계산 (YYYY-MM-DD)
  const end = new Date();
  const start = new Date();
  start.setDate(end.getDate() - Math.max(1, Math.min(365, days)));

  const toYMD = (d: Date) => d.toISOString().slice(0, 10);
  const startDate = toYMD(start);
  const endDate = toYMD(end);

  // YouTube Analytics API: reports.query
  // channel==MINE 는 OAuth 계정의 채널 기준
  const analyticsUrl =
    "https://youtubeanalytics.googleapis.com/v2/reports" +
    `?ids=channel==MINE` +
    `&startDate=${startDate}` +
    `&endDate=${endDate}` +
    `&metrics=views,estimatedMinutesWatched,averageViewDuration,subscribersGained,subscribersLost` +
    `&dimensions=day` +
    `&sort=day`;

  const res = await fetch(analyticsUrl, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });

  const data = await res.json();

  // 합계 계산(간단)
  // data.rows 예: [ ["2026-02-01", 123, 456, 78.9, 10, 2], ... ]
  const rows: any[] = data?.rows ?? [];
  let views = 0;
  let minutes = 0;
  let gained = 0;
  let lost = 0;

  for (const r of rows) {
    views += Number(r?.[1] ?? 0);
    minutes += Number(r?.[2] ?? 0);
    gained += Number(r?.[4] ?? 0);
    lost += Number(r?.[5] ?? 0);
  }

  const summary = {
    days,
    startDate,
    endDate,
    views,
    estimatedMinutesWatched: minutes,
    subscribersGained: gained,
    subscribersLost: lost,
    netSubscribers: gained - lost,
    // 참고로 avgViewDuration은 "평균"이라 합산이 아니라 별도 처리 필요(일단 raw로 넘김)
  };

  return NextResponse.json({ summary, raw: data }, { status: res.status });
}
