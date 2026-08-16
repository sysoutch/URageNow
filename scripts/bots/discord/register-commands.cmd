@echo off
set PROFILE=%~1

if "%PROFILE%"=="" (
  call "%~dp0..\secure-run-as-admin.cmd" register "" main
) else (
  call "%~dp0..\secure-run-as-admin.cmd" register "%PROFILE%" main
)
