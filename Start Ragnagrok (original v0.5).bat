@echo off
title RAGNAGROK server (original version)
cd /d "%~dp0"
set RAGNAGROK_RULES=v1
if not exist node_modules call npm install --omit=dev
start "" http://localhost:3000
node server\index.js
pause
