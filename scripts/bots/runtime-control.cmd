@echo off
set MESSENGER=%~1
if "%MESSENGER%"=="" (
  echo Usage: runtime-control.cmd ^<discord^|telegram^|matrix^|whatsapp^> [start^|stop^|restart] [baseUrl]
  exit /b 1
)
set ACTION=%~2
if "%ACTION%"=="" set ACTION=start
set BASE_URL=%~3
if "%BASE_URL%"=="" set BASE_URL=http://127.0.0.1:4782

powershell.exe -ExecutionPolicy Bypass -File "%~dp0runtime-control.ps1" -Messenger %MESSENGER% -Action %ACTION% -BaseUrl "%BASE_URL%"
