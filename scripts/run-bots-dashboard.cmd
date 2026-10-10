@echo off
setlocal EnableExtensions
set MODE=%~1
if "%MODE%"=="" set MODE=start
cd /d "%~dp0.."
echo.
echo ----------------------------
echo --- URage Bots Dashboard ---
echo ----------------------------
echo Starting as %USERDOMAIN%\%USERNAME%
if /i "%MODE%"=="start" goto start
if /i "%MODE%"=="dev" goto dev
echo Usage: run-bots-dashboard.cmd [start^|dev]
exit /b 2
:start
node.exe --import tsx "%CD%\runtime\botsDashboardRuntime.ts"
exit /b %ERRORLEVEL%
:dev
node.exe --watch --import tsx "%CD%\runtime\botsDashboardRuntime.ts"
exit /b %ERRORLEVEL%
