@echo off
setlocal EnableExtensions EnableDelayedExpansion
set MODE=%~1
if "%MODE%"=="" set MODE=start
set PROFILE=%~2
set ROLE=%~3
if "%ROLE%"=="" set ROLE=main
if /I "%ROLE%"=="dashboard" (
  echo The dashboard must run as the signed-in desktop user.
  echo Use scripts\run-dashboard.cmd instead.
  exit /b 1
)
set SCRIPT_PATH=%~dp0secure-run-as-admin.ps1
set DEFAULT_USER=%USERDOMAIN%\%USERNAME%
echo.
echo Select account for runas:
echo 1. Current user (!DEFAULT_USER!)
echo 2. Enter other user
set CHOICE=
set /p CHOICE=Choose 1 or 2 [1]: 
if "!CHOICE!"=="" set CHOICE=1
if "!CHOICE!"=="1" (
  set RUNAS_USER=!DEFAULT_USER!
) else if "!CHOICE!"=="2" (
  set /p RUNAS_USER=Enter user ^(DOMAIN\User or .\User^): 
) else (
  echo Invalid choice.
  exit /b 1
)
if "!RUNAS_USER!"=="" (
  echo No user entered.
  exit /b 1
)
if "%PROFILE%"=="" (
  runas /user:"!RUNAS_USER!" "powershell.exe -ExecutionPolicy Bypass -File \"%SCRIPT_PATH%\" -Role %ROLE% -Mode %MODE%"
) else (
  runas /user:"!RUNAS_USER!" "powershell.exe -ExecutionPolicy Bypass -File \"%SCRIPT_PATH%\" -Role %ROLE% -Mode %MODE% -Profile %PROFILE%"
)
