"""Copy every user add-on and extension from one Blender version to another and
enable the same set there.

Run it in the TARGET Blender; it starts the SOURCE Blender itself to read which
add-ons are enabled:

  "C:\\Program Files\\Blender Foundation\\Blender 5.1\\blender.exe" --background ^
    --python migrate_addons.py -- ^
    --source_blender="C:\\Program Files\\Blender Foundation\\Blender 4.5\\blender.exe"

Options (after "--"):
  --source_blender=PATH  Source blender.exe (blender-launcher.exe is accepted too).
  --manifest=PATH        Use an existing manifest instead of starting the source.
  --export_manifest=PATH Export mode: run in the SOURCE Blender to only write the manifest.
  --enable=same|all      Enable what was enabled in the source (default) or every copied add-on.
  --overwrite=true       Replace add-ons that already exist in the target (default: keep them).
  --dry_run=true         Report what would happen without copying, enabling or saving.

What it does in the target:
  1. Backs up the target's userpref.blend next to it (userpref.blend.bak-<timestamp>).
  2. Copies legacy add-ons (scripts/addons) and extension packages. Extensions keep
     their repository (e.g. blender_org) when the target has it, else go to user_default.
  3. Enables the add-ons, maps extension module names to their target repository,
     and saves the preferences.
  4. Prints a report; add-ons that fail to load in the target are listed with the reason.
"""

import datetime
import json
import os
import shutil
import subprocess
import sys
import tempfile
import traceback

import addon_utils
import bpy

# Files in the source add-on folder that are not add-ons.
SKIP_NAMES = {"__pycache__", "__init__.py", "README.txt", "README.md"}
SKIP_SUFFIXES = (".bak", ".pyc", ".pyo", ".orig", ".tmp")
# Internal or core modules that are always present and need no copy.
IGNORED_MODULES = {"bl_pkg"}
EXTENSION_PREFIX = "bl_ext."
FALLBACK_REPOSITORY = "user_default"
EXTENSION_MANIFEST = "blender_manifest.toml"
SOURCE_EXPORT_TIMEOUT_SECONDS = 300


def log(message):
    print(f"[migrate-addons] {message}", flush=True)


def get_arg(args, key, default=""):
    for arg in args:
        if arg.startswith(f"--{key}="):
            return arg.split("=", 1)[1].strip().strip('"')
    return default


def parse_bool(value):
    return str(value).strip().lower() in ("1", "true", "yes", "on")


def script_args():
    return sys.argv[sys.argv.index("--") + 1:] if "--" in sys.argv else []


# --------------------------------------------------------------------- export (source)

def user_addons_dir():
    return bpy.utils.user_resource("SCRIPTS", path="addons", create=True)


def repositories():
    """{module: directory} for every enabled local extension repository."""
    result = {}
    for repo in bpy.context.preferences.extensions.repos:
        if repo.enabled and repo.module != "system":
            result[repo.module] = repo.directory
    return result


def build_manifest():
    return {
        "blender_version": bpy.app.version_string,
        "user_addons_dir": user_addons_dir(),
        "enabled": sorted(bpy.context.preferences.addons.keys()),
        "repositories": repositories(),
    }


def export_manifest(path):
    manifest = build_manifest()
    with open(path, "w", encoding="utf-8") as handle:
        json.dump(manifest, handle, indent=2)
    log(f"Exported {len(manifest['enabled'])} enabled add-ons from Blender {manifest['blender_version']} to {path}")


def resolve_blender_executable(path):
    # blender-launcher.exe opens a GUI and detaches; blender.exe next to it runs headless.
    if os.path.basename(path).lower() == "blender-launcher.exe":
        candidate = os.path.join(os.path.dirname(path), "blender.exe")
        if os.path.isfile(candidate):
            return candidate
    return path


def manifest_from_source_blender(source_blender):
    executable = resolve_blender_executable(source_blender)
    if not os.path.isfile(executable):
        raise RuntimeError(f"Source Blender not found: {executable}")
    manifest_path = os.path.join(tempfile.mkdtemp(prefix="urage-addons-"), "manifest.json")
    # No --factory-startup: that would hide exactly the user add-ons we want to read.
    command = [executable, "--background", "--python", os.path.abspath(__file__), "--",
               f"--export_manifest={manifest_path}"]
    log(f"Reading enabled add-ons from {executable} ...")
    completed = subprocess.run(command, capture_output=True, text=True, timeout=SOURCE_EXPORT_TIMEOUT_SECONDS)
    if not os.path.isfile(manifest_path):
        tail = (completed.stdout + completed.stderr)[-2000:]
        raise RuntimeError(f"The source Blender did not write a manifest.\n{tail}")
    with open(manifest_path, encoding="utf-8") as handle:
        return json.load(handle)


# --------------------------------------------------------------------- import (target)

def is_skipped(name):
    return name in SKIP_NAMES or name.endswith(SKIP_SUFFIXES) or name.startswith(".")


def copy_entry(source_path, target_path, overwrite, dry_run):
    """Copy one add-on file or folder. Returns 'copied', 'replaced' or 'kept'."""
    exists = os.path.exists(target_path)
    if exists and not overwrite:
        return "kept"
    if dry_run:
        return "replaced" if exists else "copied"
    if exists:
        if os.path.isdir(target_path):
            shutil.rmtree(target_path)
        else:
            os.remove(target_path)
    if os.path.isdir(source_path):
        shutil.copytree(source_path, target_path, ignore=shutil.ignore_patterns("__pycache__", "*.pyc"))
    else:
        shutil.copy2(source_path, target_path)
    return "replaced" if exists else "copied"


def copy_legacy_addons(manifest, overwrite, dry_run, report):
    source_dir = manifest["user_addons_dir"]
    target_dir = user_addons_dir()
    if os.path.normcase(os.path.abspath(source_dir)) == os.path.normcase(os.path.abspath(target_dir)):
        raise RuntimeError("Source and target add-on folders are the same; run this in the target Blender.")
    for name in sorted(os.listdir(source_dir)):
        if is_skipped(name):
            continue
        result = copy_entry(os.path.join(source_dir, name), os.path.join(target_dir, name), overwrite, dry_run)
        report[result].append(name)


def target_repository_dirs():
    return repositories()


def copy_extensions(manifest, overwrite, dry_run, report):
    """Copy extension packages; returns {source module name: target module name}."""
    target_repos = target_repository_dirs()
    renamed = {}
    for repo_module, repo_dir in manifest["repositories"].items():
        if not os.path.isdir(repo_dir):
            continue
        target_repo = repo_module if repo_module in target_repos else FALLBACK_REPOSITORY
        target_dir = target_repos.get(target_repo)
        if not target_dir:
            report["errors"].append(f"Target has no '{target_repo}' extension repository; skipped {repo_module}.")
            continue
        os.makedirs(target_dir, exist_ok=True)
        for package in sorted(os.listdir(repo_dir)):
            package_dir = os.path.join(repo_dir, package)
            if is_skipped(package) or not os.path.isfile(os.path.join(package_dir, EXTENSION_MANIFEST)):
                continue
            result = copy_entry(package_dir, os.path.join(target_dir, package), overwrite, dry_run)
            report[result].append(f"{repo_module}/{package} -> {target_repo}")
            renamed[f"{EXTENSION_PREFIX}{repo_module}.{package}"] = f"{EXTENSION_PREFIX}{target_repo}.{package}"
    return renamed


def refresh_addon_lists():
    try:
        bpy.ops.extensions.repo_refresh_all()
    except Exception as error:  # noqa: BLE001 - refresh is best effort
        log(f"Extension refresh skipped: {error}")
    addon_utils.modules_refresh()


def modules_to_enable(manifest, renamed, enable_mode):
    if enable_mode == "all":
        # Every legacy add-on in the target's user folder, plus every copied extension.
        target_dir = os.path.normcase(os.path.abspath(user_addons_dir()))
        legacy = [module.__name__ for module in addon_utils.modules()
                  if os.path.normcase(os.path.abspath(module.__file__ or "")).startswith(target_dir)]
        return sorted(set(legacy) | set(renamed.values()))
    return sorted(renamed.get(name, name) for name in manifest["enabled"] if name not in IGNORED_MODULES)


def enable_addons(names, dry_run, report):
    available = {module.__name__ for module in addon_utils.modules()}
    enabled_now = set(bpy.context.preferences.addons.keys())
    for name in names:
        if name in enabled_now:
            report["already_enabled"].append(name)
            continue
        if name not in available:
            report["missing"].append(name)
            continue
        if dry_run:
            report["enabled"].append(name)
            continue
        try:
            module = addon_utils.enable(name, default_set=True, persistent=True, handle_error=None)
        except Exception as error:  # noqa: BLE001 - one broken add-on must not stop the rest
            report["failed"].append(f"{name}: {error}")
            continue
        if module is None or name not in bpy.context.preferences.addons.keys():
            report["failed"].append(f"{name}: did not register (see the traceback above)")
        else:
            report["enabled"].append(name)


def backup_userprefs(dry_run):
    config_dir = bpy.utils.user_resource("CONFIG")
    prefs_path = os.path.join(config_dir, "userpref.blend")
    if not os.path.isfile(prefs_path):
        return None
    stamp = datetime.datetime.now().strftime("%Y%m%d-%H%M%S")
    backup_path = f"{prefs_path}.bak-{stamp}"
    if not dry_run:
        shutil.copy2(prefs_path, backup_path)
    return backup_path


def print_report(report, backup_path, dry_run):
    log("=" * 60)
    log(f"Target Blender {bpy.app.version_string}{' (dry run, nothing changed)' if dry_run else ''}")
    if backup_path:
        log(f"Preferences backup: {backup_path}")
    for key, title in (("copied", "Copied"), ("replaced", "Replaced"), ("kept", "Already present, kept"),
                       ("enabled", "Enabled"), ("already_enabled", "Already enabled"),
                       ("missing", "Not available in this Blender"), ("failed", "Failed to enable"),
                       ("errors", "Errors")):
        items = report[key]
        if items:
            log(f"{title} ({len(items)}):")
            for item in items:
                log(f"  - {item}")
    print(f"MIGRATE_RESULT copied={len(report['copied']) + len(report['replaced'])} enabled={len(report['enabled'])} "
          f"failed={len(report['failed'])} missing={len(report['missing'])}", flush=True)


def import_into_target(manifest, enable_mode, overwrite, dry_run):
    report = {key: [] for key in ("copied", "replaced", "kept", "enabled", "already_enabled", "missing", "failed", "errors")}
    log(f"Source: Blender {manifest['blender_version']} ({len(manifest['enabled'])} enabled add-ons)")
    backup_path = backup_userprefs(dry_run)
    copy_legacy_addons(manifest, overwrite, dry_run, report)
    renamed = copy_extensions(manifest, overwrite, dry_run, report)
    if not dry_run:
        refresh_addon_lists()
    enable_addons(modules_to_enable(manifest, renamed, enable_mode), dry_run, report)
    if not dry_run:
        bpy.ops.wm.save_userpref()
    print_report(report, backup_path, dry_run)


def main():
    args = script_args()
    export_path = get_arg(args, "export_manifest")
    if export_path:
        export_manifest(export_path)
        return
    manifest_path = get_arg(args, "manifest")
    source_blender = get_arg(args, "source_blender")
    if manifest_path:
        with open(manifest_path, encoding="utf-8") as handle:
            manifest = json.load(handle)
    elif source_blender:
        manifest = manifest_from_source_blender(source_blender)
    else:
        raise RuntimeError("Pass --source_blender=PATH (or --manifest=PATH). See the header of this script.")
    enable_mode = "all" if get_arg(args, "enable", "same").lower() == "all" else "same"
    import_into_target(manifest, enable_mode, parse_bool(get_arg(args, "overwrite", "false")),
                       parse_bool(get_arg(args, "dry_run", "false")))


if __name__ == "__main__":
    try:
        main()
    except Exception as error:  # noqa: BLE001
        traceback.print_exc()
        print(f"MIGRATE_ERROR {error}", flush=True)
        sys.exit(1)
