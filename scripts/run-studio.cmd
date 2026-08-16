@echo off
setlocal EnableExtensions

set "MODE=%~1"
if "%MODE%"=="" set "MODE=start"
if /I not "%MODE%"=="start" if /I not "%MODE%"=="dev" (
  echo Unsupported Studio mode "%MODE%". Use start or dev.
  exit /b 1
)

set "PROFILE=%~2"
set "DASHBOARD_LAUNCHER=%~dp0run-dashboard.cmd"

echo.
echo --------------------------------------
echo --- URage NOW Server + Dashboard ---
echo --------------------------------------
echo The dashboard HTTP/API server and browser UI share one runtime process.
echo Messenger runtimes remain controlled separately from Dashboard Settings.

call "%DASHBOARD_LAUNCHER%" "%MODE%" "%PROFILE%"
exit /b %ERRORLEVEL%
