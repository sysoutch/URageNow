@echo off
set ACTION=%~1
if "%ACTION%"=="" set ACTION=start
set BASE_URL=%~2
if "%BASE_URL%"=="" set BASE_URL=http://127.0.0.1:4782

powershell.exe -ExecutionPolicy Bypass -File "%~dp0run-matrix-runtime.ps1" -Action %ACTION% -BaseUrl "%BASE_URL%"
