@echo off
setlocal
cd /d "%~dp0"
echo =====================================
echo  RoomTab - local development starter
echo =====================================
echo.
node --version
if errorlevel 1 (
  echo Node.js is not installed or is not on PATH.
  echo Install Node.js 22 LTS from https://nodejs.org/ and reopen this file.
  pause
  exit /b 1
)
if not exist node_modules (
  echo Installing project packages. This requires an internet connection...
  call npm install
  if errorlevel 1 (
    echo.
    echo Package installation failed. Copy the full error from this window before closing it.
    pause
    exit /b 1
  )
)
echo.
echo Starting RoomTab. When Vite prints a localhost URL, open that URL in your browser.
echo Press Ctrl+C to stop the development server.
echo.
call npm run dev
pause
