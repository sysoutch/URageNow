import {spawn} from "node:child_process";
import {
  assertAllowlistedNativeApplicationRequest,
  type NativeApplicationLaunchResult,
  type NativeApplicationPort
} from "./nativeApplicationPort.js";

interface RustBrokerOutput {
  launched?: boolean;
  pid?: number | null;
}

export function createRustNativeApplicationAdapter(brokerPath: string): NativeApplicationPort {
  const executablePath = String(brokerPath || "").trim();
  if (!executablePath) {
    throw new Error("Rust native application broker path is required.");
  }
  return {
    async launch(request): Promise<NativeApplicationLaunchResult> {
      assertAllowlistedNativeApplicationRequest(request);
      const brokerArgs = [
        "--application-id",
        request.applicationId,
        "--executable",
        request.executablePath
      ];
      if (request.workingDirectory) {
        brokerArgs.push("--working-directory", request.workingDirectory);
      }
      request.args.forEach(argument => {
        brokerArgs.push("--argument", argument);
      });
      if (request.detached === true) {
        brokerArgs.push("--detached");
      }
      const output = await new Promise<string>((resolve, reject) => {
        let stdout = "";
        let stderr = "";
        const child = spawn(executablePath, brokerArgs, {
          shell: false,
          stdio: ["ignore", "pipe", "pipe"],
          windowsHide: true
        });
        child.stdout.on("data", chunk => {
          stdout += chunk.toString();
        });
        child.stderr.on("data", chunk => {
          stderr += chunk.toString();
        });
        child.on("error", reject);
        child.on("close", code => {
          if (code === 0) {
            resolve(stdout);
            return;
          }
          reject(new Error(stderr.trim() || `Native application broker exited with code ${code}.`));
        });
      });
      const result = JSON.parse(output) as RustBrokerOutput;
      if (result.launched !== true) {
        throw new Error("Native application broker did not confirm the launch.");
      }
      return {
        launched: true,
        pid: Number.isInteger(result.pid) ? Number(result.pid) : null,
        adapter: "rust"
      };
    }
  };
}
