@echo off
set MODE=%~1
if "%MODE%"=="" set MODE=start-headless
set PROFILE=%~2

if /I "%MODE%"=="start" set MODE=start-headless
if /I "%MODE%"=="dev" set MODE=dev-headless

if "%PROFILE%"=="" (
  call "%~dp0..\secure-run-as-admin.cmd" %MODE% "" main
) else (
  call "%~dp0..\secure-run-as-admin.cmd" %MODE% "%PROFILE%" main
)
