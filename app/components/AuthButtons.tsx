"use client";

import { signIn, signOut, useSession } from "next-auth/react";

export default function AuthButtons() {
  const { data: session, status } = useSession();

  const loading = status === "loading";
  const authed = status === "authenticated";

  const userName = session?.user?.name ?? "";
  const userEmail = session?.user?.email ?? "";

  return (
    <div className="flex flex-wrap items-center gap-2">
      <div className="text-xs text-gray-600">
        {loading ? (
          <span>세션 확인 중...</span>
        ) : authed ? (
          <span>
            로그인됨:{" "}
            <span className="font-medium text-gray-900">
              {userName || userEmail || "사용자"}
            </span>
          </span>
        ) : (
          <span className="text-gray-500">로그아웃 상태</span>
        )}
      </div>

      {authed ? (
        <button
          type="button"
          onClick={() => signOut({ callbackUrl: "/" })}
          className="rounded-lg border px-3 py-1.5 text-xs font-medium hover:bg-gray-50"
        >
          로그아웃
        </button>
      ) : (
        <button
          type="button"
          onClick={() => signIn("google", { callbackUrl: "/" })}
          className="rounded-lg bg-black px-3 py-1.5 text-xs font-medium text-white hover:opacity-90"
        >
          Google 로그인
        </button>
      )}
    </div>
  );
}
