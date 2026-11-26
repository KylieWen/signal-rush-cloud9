@echo off
setlocal
cd /d "%~dp0"
where python >nul 2>nul
if errorlevel 1 (
  echo Python 3.10+ is required. Install Python and try again.
  pause
  exit /b 1
)
start "" http://127.0.0.1:8010/
python server.py --port 8010
