export interface RuntimeShutdownDependency {
  label: string;
  detail: string;
}

export interface InteractiveShutdownPromptOptions {
  runtimeName: string;
  getDependencies: () => Promise<RuntimeShutdownDependency[]>;
  stop: () => Promise<void> | void;
  confirmOnSigint?: boolean;
  shutdownTimeoutMs?: number;
}

const DEFAULT_SHUTDOWN_TIMEOUT_MS = 10_000;

function writeLine(message = ""): void {
  process.stdout.write(`${message}\n`);
}

async function askForConfirmation(runtimeName: string): Promise<boolean> {
  if (!process.stdin.isTTY) {
    writeLine("No interactive terminal is available; stopping the runtime.");
    return true;
  }

  return new Promise(resolve => {
    const onData = (chunk: Buffer | string): void => {
      const answer = String(chunk).trim().toLowerCase();
      process.stdin.off("data", onData);
      process.stdin.pause();
      resolve(answer === "y" || answer === "yes");
    };

    process.stdout.write(`Stop the ${runtimeName.toLowerCase()}? [y/N] `);
    process.stdin.resume();
    process.stdin.once("data", onData);
  });
}

async function stopWithTimeout(stop: () => Promise<void> | void, timeoutMs: number): Promise<void> {
  let timeout: ReturnType<typeof setTimeout> | undefined;
  try {
    await Promise.race([
      Promise.resolve().then(stop),
      new Promise<never>((_, reject) => {
        timeout = setTimeout(() => reject(new Error(`shutdown exceeded ${timeoutMs} ms`)), timeoutMs);
      })
    ]);
  } finally {
    if (timeout) clearTimeout(timeout);
  }
}

export function installInteractiveShutdownPrompt(options: InteractiveShutdownPromptOptions): void {
  let shutdownInProgress = false;

  process.on("SIGINT", () => {
    if (shutdownInProgress) {
      writeLine(`\n${options.runtimeName} shutdown is already in progress. Please wait.`);
      return;
    }
    shutdownInProgress = true;

    void (async () => {
      let stopping = false;
      try {
        writeLine(`\n${options.runtimeName} shutdown requested.`);
        if (options.confirmOnSigint !== false) {
          const dependencies = await options.getDependencies();
          if (dependencies.length > 0) {
            writeLine("Current runtime impact:");
            for (const dependency of dependencies) {
              writeLine(`- ${dependency.label}: ${dependency.detail}`);
            }
          } else {
            writeLine("No managed bots or ComfyUI runtime are currently detected.");
          }

          const confirmed = await askForConfirmation(options.runtimeName);
          if (!confirmed) {
            writeLine(`${options.runtimeName} shutdown cancelled; the server is still running and its port remains open.`);
            return;
          }
        }

        stopping = true;
        writeLine(`Stopping ${options.runtimeName.toLowerCase()}.`);
        await stopWithTimeout(options.stop, options.shutdownTimeoutMs ?? DEFAULT_SHUTDOWN_TIMEOUT_MS);
        writeLine(`${options.runtimeName} stopped. Exiting now.`);
        process.exit(0);
      } catch (error) {
        const detail = error instanceof Error ? error.message : String(error);
        if (stopping) {
          writeLine(`${options.runtimeName} cleanup could not finish: ${detail}. Exiting the process now.`);
          process.exit(1);
        }
        writeLine(`Could not complete the shutdown prompt: ${detail}`);
        writeLine(`${options.runtimeName} shutdown cancelled; the server is still running.`);
      } finally {
        shutdownInProgress = false;
      }
    })();
  });
}
