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
if not exist node_modules (
  echo First run: installing the game. This takes a minute...
  call npm install --omit=dev
)
echo.
echo Starting Ragnagrok. Keep this window open while you play.
echo Close it to stop the game.
echo.
start "" http://localhost:3000
node server\index.js
pause
