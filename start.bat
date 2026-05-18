@echo off
title Digital Office Launcher
color 0A

echo.
echo  ============================================
echo   DIGITAL OFFICE - AI Multi-Agent Workspace
echo  ============================================
echo.

:: Check Node
where node >nul 2>nul
if %ERRORLEVEL% NEQ 0 (
  echo [ERROR] Node.js not found. Please install from https://nodejs.org
  pause
  exit /b 1
)

:: Setup backend .env if not exists
if not exist "backend\.env" (
  echo [Setup] Creating backend\.env from example...
  copy "backend\.env.example" "backend\.env" >nul
  echo [!] Please edit backend\.env with your API keys before continuing.
  echo     Opening file...
  start notepad "backend\.env"
  pause
)

:: Install backend deps
echo [1/4] Installing backend dependencies...
cd backend
call npm install --silent
if %ERRORLEVEL% NEQ 0 (
  echo [ERROR] Backend install failed
  pause
  exit /b 1
)
cd ..

:: Install frontend deps
echo [2/4] Installing frontend dependencies...
cd frontend
call npm install --silent
if %ERRORLEVEL% NEQ 0 (
  echo [ERROR] Frontend install failed
  pause
  exit /b 1
)
cd ..

echo.
echo [3/4] Starting backend on http://localhost:3001 ...
start "DO-Backend" /min cmd /k "cd /d %~dp0backend && npm run dev"

timeout /t 3 /nobreak >nul

echo [4/4] Starting frontend on http://localhost:5173 ...
start "DO-Frontend" /min cmd /k "cd /d %~dp0frontend && npm run dev"

timeout /t 4 /nobreak >nul

echo.
echo  Opening Digital Office...
start http://localhost:5173

echo.
echo  Digital Office is running!
echo  Backend  : http://localhost:3001
echo  Frontend : http://localhost:5173
echo.
echo  Close both terminal windows to stop.
pause
