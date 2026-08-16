@echo off
setlocal

if not exist "venv\Scripts\python.exe" (
  echo [ERROR] ComfyUI virtual environment was not found in "%CD%".
  echo Select the ComfyUI launcher folder in URage NOW Settings, then try again.
  exit /b 1
)

if not exist "ComfyUI\main.py" (
  echo [ERROR] ComfyUI\main.py was not found in "%CD%".
  echo Select the folder that contains both venv and ComfyUI.
  exit /b 1
)

call "venv\Scripts\activate.bat"
python -s "ComfyUI\main.py" --windows-standalone-build --fast fp16_accumulation --listen 127.0.0.1
