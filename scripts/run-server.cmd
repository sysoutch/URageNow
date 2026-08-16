@echo off
setlocal EnableExtensions
set MODE=%~1
if "%MODE%"=="" set MODE=start
set PROFILE=%~2
set LAUNCHER=%~dp0bots\launch.ps1

if /I "%MODE%"=="start" (
  set LAUNCH_MODE=start-headless
) else if /I "%MODE%"=="dev" (
  set LAUNCH_MODE=dev-headless
) else (
  echo Unsupported server mode "%MODE%". Use start or dev.
  exit /b 1
)

echo.
echo ---------------------------
echo --- URage NOW Server ---
echo ---------------------------
echo Starting the headless runtime server as %USERDOMAIN%\%USERNAME%
echo The dashboard remains disabled in this process.
if "%PROFILE%"=="" (
  powershell.exe -ExecutionPolicy Bypass -File "%LAUNCHER%" -Role main -Mode "%LAUNCH_MODE%" -NoMessengerAutostart
) else (
  powershell.exe -ExecutionPolicy Bypass -File "%LAUNCHER%" -Role main -Mode "%LAUNCH_MODE%" -Profile "%PROFILE%" -NoMessengerAutostart
)
