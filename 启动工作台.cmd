@echo off
setlocal
cd /d "%~dp0"
where npm >nul 2>&1
if errorlevel 1 (
  echo Node.js is required. Install Node.js 24 LTS and try again.
  pause
  exit /b 1
)
if not exist "node_modules\vite\bin\vite.js" (
  call npm install
  if errorlevel 1 (
    echo Dependency installation failed.
    pause
    exit /b 1
  )
)
echo Starting Teyvat Damage Studio at http://127.0.0.1:5173/
echo Keep this window open while using the editor.
call npm run dev -- --port 5173 --open
pause
