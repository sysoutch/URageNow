@echo off
set MODE=%~1
if "%MODE%"=="" set MODE=start
set PROFILE=%~2
set LAUNCHER=%~dp0bots\secure-run-as-admin.cmd

if "%PROFILE%"=="" (
  call "%LAUNCHER%" %MODE% "" worker
) else (
  call "%LAUNCHER%" %MODE% "%PROFILE%" worker
)
