@echo off
setlocal enabledelayedexpansion

:: ------------------------------
:: 0. Check if Python is available
:: ------------------------------
echo ------------------------------
echo 0. Check if Python is available
echo ------------------------------
where python >nul 2>&1
if errorlevel 1 (
    echo [ERROR] Python is not installed or not in PATH.
    echo Opening Python 3.12.10 download page...
    start https://www.python.org/downloads/release/python-31210/
    exit /b 1
)

:: ------------------------------
:: 1. Get Python path and check version
:: ------------------------------
echo ------------------------------
echo 1. Get Python path and check version
echo ------------------------------
for /f "delims=" %%P in ('where python') do (
    set PYTHON_FOUND=%%P
    goto :found
)

:found
echo Found Python: %PYTHON_FOUND%

:: Optionally verify version is 3.12
for /f "tokens=2 delims= " %%V in ('python --version') do (
    set PY_VERSION=%%V
)

echo Python version: %PY_VERSION%
echo.

:: ------------------------------
:: 2. Set up paths
:: ------------------------------
echo ------------------------------
echo 2. Set up paths
echo ------------------------------
if not "%~1"=="" (
    set ROOT_DIR=%~1
) else (
    set ROOT_DIR=%CD%
)
echo Install root: %ROOT_DIR%
set VENV_DIR=%ROOT_DIR%\venv
set PYTHON_EXE=%VENV_DIR%\Scripts\python.exe

:: ------------------------------
:: 3. Create virtual environment
:: ------------------------------
echo ------------------------------
echo 3. Create virtual environment
echo ------------------------------
if not exist "%PYTHON_EXE%" (
    echo Creating virtual environment...
    python -m venv "%VENV_DIR%"
)

:: ------------------------------
:: 4. Upgrade pip
:: ------------------------------
echo ------------------------------
echo 4. Upgrade pip
echo ------------------------------
"%PYTHON_EXE%" -m pip install --upgrade pip

:: ------------------------------
:: 5. Clone ComfyUI
:: ------------------------------
echo ------------------------------
echo 5. Clone ComfyUI
echo ------------------------------
if not exist "%ROOT_DIR%\ComfyUI" (
    git clone https://github.com/comfyanonymous/ComfyUI.git "%ROOT_DIR%\ComfyUI"
)

:: ------------------------------
:: 6. Clone Hunyuan3D-2
:: ------------------------------
echo ------------------------------
echo 6. Clone Hunyuan3D-2
echo ------------------------------
if not exist "%ROOT_DIR%\ComfyUI\custom_nodes\Hunyuan3D-2" (
    git clone https://github.com/Tencent-Hunyuan/Hunyuan3D-2.git "%ROOT_DIR%\ComfyUI\custom_nodes\Hunyuan3D-2"
)

:: ------------------------------
:: 7. Install Hunyuan3D-2 dependencies
:: ------------------------------
echo ------------------------------
echo 7. Install Hunyuan3D-2 dependencies
echo ------------------------------
echo Installing Hunyuan3D-2 dependencies...
"%PYTHON_EXE%" -m pip install -r "%ROOT_DIR%\ComfyUI\custom_nodes\Hunyuan3D-2\requirements.txt"

:: ------------------------------
:: 8. Clone Hunyuan3DWrapper
:: ------------------------------
echo ------------------------------
echo 8. Clone Hunyuan3DWrapper
echo ------------------------------
if not exist "%ROOT_DIR%\ComfyUI\custom_nodes\ComfyUI-Hunyuan3DWrapper" (
    git clone https://github.com/kijai/ComfyUI-Hunyuan3DWrapper.git "%ROOT_DIR%\ComfyUI\custom_nodes\ComfyUI-Hunyuan3DWrapper"
)

:: ------------------------------
:: 9. Install dependencies
:: ------------------------------
echo ------------------------------
echo 9. Install dependencies
echo ------------------------------
echo Installing additional dependencies...

:: Required for some builds
"%PYTHON_EXE%" -m pip install ninja

:: PyTorch 2.6.0 + CUDA 12.6
"%PYTHON_EXE%" -m pip install torch==2.6.0+cu126 torchvision==0.21.0+cu126 torchaudio==2.6.0+cu126 --extra-index-url https://download.pytorch.org/whl/cu126

:: ComfyUI dependencies
"%PYTHON_EXE%" -m pip install -r "%ROOT_DIR%\ComfyUI\requirements.txt"

:: Hunyuan3DWrapper dependencies
"%PYTHON_EXE%" -m pip install -r "%ROOT_DIR%\ComfyUI\custom_nodes\ComfyUI-Hunyuan3DWrapper\requirements.txt"

:: Extra dependency
"%PYTHON_EXE%" -m pip install transparent_background

:: ------------------------------
:: 10. Install prebuilt rasterizer wheel (if available)
:: ------------------------------
echo ------------------------------
echo 10. Install prebuilt rasterizer wheel (if available)
echo ------------------------------
set WHEEL_PATH=%ROOT_DIR%\ComfyUI\custom_nodes\ComfyUI-Hunyuan3DWrapper\wheels\custom_rasterizer-0.1.0+torch260.cuda126-cp312-cp312-win_amd64.whl

if exist "%WHEEL_PATH%" (
    echo Installing prebuilt rasterizer wheel...
    "%PYTHON_EXE%" -m pip install "%WHEEL_PATH%"
)

:: ------------------------------
:: 10. Load Visual Studio build environment
:: ------------------------------
::echo Initializing MSVC environment...
::call "C:\Program Files (x86)\Microsoft Visual Studio\2022\BuildTools\VC\Auxiliary\Build\vcvars64.bat"

:: ------------------------------
:: 10.1. Build and install the custom rasterizer
:: ------------------------------
::echo Installing custom_rasterizer from source...
::"%PYTHON_EXE%" -m pip install "%RASTERIZER_PATH%" --force-reinstall

:: ------------------------------
:: 11. Install ComfyUI Manager
:: ------------------------------
echo ------------------------------
echo 11. Install ComfyUI Manager
echo ------------------------------
if not exist "%ROOT_DIR%\ComfyUI\custom_nodes\ComfyUI-Manager" (
    echo Installing ComfyUI-Manager...
    git clone https://github.com/Comfy-Org/ComfyUI-Manager.git "%ROOT_DIR%\ComfyUI\custom_nodes\ComfyUI-Manager"
)

:: ------------------------------
:: 12. Install ComfyUI Essentials
:: ------------------------------
echo ------------------------------
echo 12. Install ComfyUI Essentials
echo ------------------------------
if not exist "%ROOT_DIR%\ComfyUI\custom_nodes\ComfyUI_essentials" (
    echo Installing ComfyUI-Manager...
    git clone https://github.com/cubiq/ComfyUI_essentials.git "%ROOT_DIR%\ComfyUI\custom_nodes\ComfyUI_essentials"
)

:: ------------------------------
:: 13. Launch ComfyUI
:: ------------------------------
echo ------------------------------
echo 13. Launch ComfyUI
echo ------------------------------
echo Launching ComfyUI...
"%PYTHON_EXE%" "%ROOT_DIR%\ComfyUI\main.py" --windows-standalone-build

pause
