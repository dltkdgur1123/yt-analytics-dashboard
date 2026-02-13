@echo off
setlocal enabledelayedexpansion

cd /d "%~dp0"

echo.
echo ================================
echo   Next.js Local Dev Bootstrap
echo ================================
echo.

REM 1) Node 설치 여부 확인
where node >nul 2>nul
if errorlevel 1 (
  echo [ERROR] Node.js가 설치되어 있지 않습니다.
  echo         Node 20 LTS 설치 후 다시 실행하세요.
  pause
  exit /b 1
)

echo [OK] Node: 
node -v
echo.

REM 2) 의존성 설치 (lockfile 있으면 npm ci 우선)
if exist package-lock.json (
  echo [STEP] npm ci 실행...
  call npm ci
) else (
  echo [STEP] npm install 실행...
  call npm install
)

if errorlevel 1 (
  echo [ERROR] 의존성 설치 실패
  pause
  exit /b 1
)

echo.
REM 3) .env.local 자동 생성 (없을 때만)
if not exist .env.local (
  if exist .env.example (
    echo [STEP] .env.example -> .env.local 복사
    copy /y .env.example .env.local >nul
  ) else (
    echo [STEP] .env.local 생성 (빈 파일)
    type nul > .env.local
  )
  echo [INFO] .env.local을 열어서 필요한 값(키/URL)을 채워주세요.
)

echo.
REM 4) Turbopack panic 회피용 옵션 (webpack으로 dev 실행)
set NEXT_DISABLE_TURBOPACK=1

REM 5) 캐시 문제 자주나면 아래 2줄 주석 해제해서 사용
REM rmdir /s /q .next 2>nul
REM rmdir /s /q node_modules 2>nul

echo [STEP] dev 서버 실행...
call npm run dev

endlocal
