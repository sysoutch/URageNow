# Bundled ComfyUI Launcher

`run-comfyui.bat` is the default launcher shown in Settings → Setup → ComfyUI.
It runs from the selected ComfyUI launcher folder, which must contain:

```text
venv\Scripts\python.exe
ComfyUI\main.py
```

The dashboard stores this bundled launcher as the repository-relative path
`scripts/comfyui/run-comfyui.bat`. Select a custom `.bat` or `.cmd` file with
the Browse button when your ComfyUI installation needs a different launcher.

The initial ComfyUI installer installs to `data/comfyui` by default (or to the
custom folder selected in Setup → Install), then saves that folder for this
launcher. It does not start a separate unmanaged ComfyUI process.
