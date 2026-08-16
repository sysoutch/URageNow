import {spawn} from "node:child_process";
import {
  assertAllowlistedNativeApplicationRequest,
  type NativeApplicationPort
} from "./nativeApplicationPort.js";

export function createTypeScriptNativeApplicationAdapter(): NativeApplicationPort {
  return {
    async launch(request) {
      assertAllowlistedNativeApplicationRequest(request);
      return await new Promise((resolve, reject) => {
        const child = spawn(request.executablePath, request.args, {
          cwd: request.workingDirectory,
          detached: request.detached === true,
          shell: false,
          stdio: request.stdio || "ignore",
          windowsHide: request.windowsHide !== false
        });
        child.once("error", reject);
        child.once("spawn", () => {
          child.removeListener("error", reject);
          if (request.detached === true) {
            child.unref();
          }
          resolve({
            launched: true,
            pid: child.pid ?? null,
            adapter: "typescript"
          });
        });
      });
    }
  };
}
