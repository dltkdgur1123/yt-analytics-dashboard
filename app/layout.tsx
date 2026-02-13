import "./globals.css";
import type { ReactNode } from "react";
import Providers from "./providers";
import AuthButtons from "./components/AuthButtons";

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="ko">
      <body>
        <Providers>
          <div className="mx-auto max-w-5xl px-6 py-6">
            <header className="mb-6 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
              <div>
                <div className="text-xl font-bold">YT Analytics Dashboard</div>
                <div className="text-sm text-gray-600">
                  임시 로그인/로그아웃 버튼 (NextAuth)
                </div>
              </div>

              <AuthButtons />
            </header>

            {children}
          </div>
        </Providers>
      </body>
    </html>
  );
}
