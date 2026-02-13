import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "../../auth/[...nextauth]/route";

export async function GET(req: Request) {
  const session = await getServerSession(authOptions);
  const accessToken = (session as any)?.accessToken as string | undefined;

  if (!accessToken) {
    return NextResponse.json({ error: "no access token" }, { status: 401 });
  }

  const url = new URL(req.url);
  const maxResults = url.searchParams.get("maxResults") ?? "25";
  const pageToken = url.searchParams.get("pageToken") ?? "";

  // ✅ 업로드한 내 영상 목록: search endpoint (forMine=true)
  const api = new URL("https://www.googleapis.com/youtube/v3/search");
  api.searchParams.set("part", "snippet");
  api.searchParams.set("forMine", "true");
  api.searchParams.set("type", "video");
  api.searchParams.set("order", "date");
  api.searchParams.set("maxResults", maxResults);
  if (pageToken) api.searchParams.set("pageToken", pageToken);

  const res = await fetch(api.toString(), {
    headers: {
      Authorization: `Bearer ${accessToken}`,
      Accept: "application/json",
    },
    cache: "no-store",
  });

  const data = await res.json();

  if (!res.ok) {
    return NextResponse.json(
      {
        error: "YouTube videos list failed",
        status: res.status,
        requestUrl: api.toString(),
        data,
      },
      { status: res.status }
    );
  }

  const items =
    (data?.items ?? [])
      .map((it: any) => {
        const id = it?.id?.videoId as string | undefined;
        const sn = it?.snippet;
        if (!id || !sn) return null;

        const thumb =
          sn?.thumbnails?.medium?.url ??
          sn?.thumbnails?.default?.url ??
          sn?.thumbnails?.high?.url ??
          null;

        return {
          id,
          title: sn?.title ?? "(no title)",
          publishedAt: sn?.publishedAt ?? "",
          thumbnailUrl: thumb ?? undefined,
        };
      })
      .filter(Boolean) ?? [];

  return NextResponse.json(
    {
      ok: true,
      requestUrl: api.toString(),
      nextPageToken: data?.nextPageToken ?? null,
      items,
    },
    { status: 200 }
  );
}
