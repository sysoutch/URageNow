@echo off
setlocal

set "SCRIPT_DIR=%~dp0"
set "INPUT_BLEND=%~1"
set "OUTPUT_DIR=%~2"
set "OUTPUT_FILE=%~3"
set "FRAME_DIR_NAME=%~4"

if not defined INPUT_BLEND set "INPUT_BLEND=%SCRIPT_DIR%test.blend"
if not defined OUTPUT_DIR set "OUTPUT_DIR=%SCRIPT_DIR%output"
if not defined OUTPUT_FILE set "OUTPUT_FILE=capture.png"
if not defined FRAME_DIR_NAME set "FRAME_DIR_NAME=frames"
if not defined BLENDER_EXECUTABLE_PATH set "BLENDER_EXECUTABLE_PATH=blender.exe"

if not exist "%INPUT_BLEND%" (
  echo Input blend file not found: "%INPUT_BLEND%"
  echo Usage: %~nx0 [input.blend] [output-directory]
  exit /b 1
)

if not exist "%OUTPUT_DIR%" mkdir "%OUTPUT_DIR%"

shift /1
shift /1
shift /1
shift /1
"%BLENDER_EXECUTABLE_PATH%" -b "%INPUT_BLEND%" --python "%SCRIPT_DIR%capture.py" -- --output "%OUTPUT_DIR%\%OUTPUT_FILE%" --gif-folder "%OUTPUT_DIR%\%FRAME_DIR_NAME%" %*
