@echo off
setlocal EnableExtensions
set MODE=%~1
if "%MODE%"=="" set MODE=start
set PROFILE=%~2
set LAUNCHER=%~dp0bots\launch.ps1

echo.
echo ------------------------------
echo --- URage NOW Dashboard ---
echo ------------------------------
echo Starting dashboard as %USERDOMAIN%\%USERNAME%
echo Windows profile: %USERPROFILE%
if "%PROFILE%"=="" (
  powershell.exe -ExecutionPolicy Bypass -File "%LAUNCHER%" -Role dashboard -Mode "%MODE%"
) else (
  powershell.exe -ExecutionPolicy Bypass -File "%LAUNCHER%" -Role dashboard -Mode "%MODE%" -Profile "%PROFILE%"
)
