@echo off
powershell.exe -ExecutionPolicy Bypass -File "%~dp0..\launch.ps1" -Role main -Mode store-token
