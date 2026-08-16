@echo off
set MODE=%~1
if "%MODE%"=="" set MODE=start
set PROFILE=%~2

if "%PROFILE%"=="" (
  call "%~dp0..\secure-run-as-admin.cmd" %MODE% "" main
) else (
  call "%~dp0..\secure-run-as-admin.cmd" %MODE% "%PROFILE%" main
)
