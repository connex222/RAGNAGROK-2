@echo off
title Ragnagrok server
cd /d "%~dp0"
where node >nul 2>nul
if errorlevel 1 (
  echo.
  echo Node.js is not installed.
  echo Download the LTS version from https://nodejs.org, install it, then double-click this file again.
  echo.
  pause
  exit /b
)
if not exist "node_modules\express\package.json" (
  echo First run: installing the game. This takes a minute...
  call npm install --omit=dev
  if errorlevel 1 (
    echo Dependency installation failed. Check your internet connection and try again.
    pause
    exit /b 1
  )
)
echo.
echo Starting Ragnagrok. Keep this window open while you play.
echo Close it to stop the game.
echo.
rem The server starts in a separate window so this launcher can check readiness.
start "Ragnagrok Server" cmd /k "node server\index.js"
set "GAME_READY="
for /l %%I in (1,1,30) do (
  if not defined GAME_READY (
    curl.exe -fsS --max-time 1 http://localhost:3000/healthz >nul 2>nul
    if not errorlevel 1 set "GAME_READY=1"
    if not defined GAME_READY timeout /t 1 /nobreak >nul
  )
)
if not defined GAME_READY (
  echo The server did not start. Check the Ragnagrok Server window for errors.
  pause
  exit /b 1
)
echo Ragnagrok is ready at http://localhost:3000
start "" http://localhost:3000
exit /b 0
