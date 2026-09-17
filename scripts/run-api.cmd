@echo off
setlocal EnableExtensions
set MODE=%~1
if "%MODE%"=="" set MODE=start
set PROFILE=%~2
set LAUNCHER=%~dp0bots\launch.ps1

if /I not "%MODE%"=="start" if /I not "%MODE%"=="dev" (
  echo Unsupported API mode "%MODE%". Use start or dev.
  exit /b 1
)

echo.
echo ------------------------
echo --- URage NOW API ---
echo ------------------------
echo Starting API-only runtime as %USERDOMAIN%\%USERNAME%
echo Dashboard pages and static tools are disabled in this process.
if "%PROFILE%"=="" (
  powershell.exe -ExecutionPolicy Bypass -File "%LAUNCHER%" -Role api -Mode "%MODE%"
) else (
  powershell.exe -ExecutionPolicy Bypass -File "%LAUNCHER%" -Role api -Mode "%MODE%" -Profile "%PROFILE%"
)