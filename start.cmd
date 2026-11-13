@echo off
chcp 65001 >nul
title دفتر الشانكس
cd /d "%~dp0"

rem The harness shell may export this; it forces Electron into plain Node mode.
set "ELECTRON_RUN_AS_NODE="

echo %CD% | findstr /I "OneDrive" >nul
if not errorlevel 1 (
  echo.
  echo [!] المشروع جوه فولدر OneDrive.
  echo     Electron بيرفض يشتغل من OneDrive على بعض الأجهزة.
  echo     انسخ المشروع لفولدر محلي ^(مثال: C:\ChunkTrainer^) وشغّله من هناك.
  echo.
  pause
  exit /b 1
)

if not exist "node_modules\electron\dist\electron.exe" (
  echo.
  echo [!] Electron مش متسطّب. شغّل الأول:
  echo     npm install
  echo.
  pause
  exit /b 1
)

start "" "node_modules\electron\dist\electron.exe" .
