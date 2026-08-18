export interface RuntimeShutdownDependency {
  label: string;
  detail: string;
}

export interface InteractiveShutdownPromptOptions {
  runtimeName: string;
  getDependencies: () => Promise<RuntimeShutdownDependency[]>;
  stop: () => Promise<void> | void;
}

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

/**
 * Keeps Ctrl+C interactive for the launcher console instead of immediately
 * terminating the Node process (and releasing the dashboard port).
 */
export function installInteractiveShutdownPrompt(options: InteractiveShutdownPromptOptions): void {
  let confirmationInProgress = false;

  process.on("SIGINT", () => {
    if (confirmationInProgress) {
      writeLine("\nA shutdown confirmation is already open. Answer y or n.");
      return;
    }
    confirmationInProgress = true;

    void (async () => {
      try {
        const dependencies = await options.getDependencies();
        writeLine(`\n${options.runtimeName} shutdown requested.`);
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

        writeLine(`Stopping ${options.runtimeName.toLowerCase()}.`);
        await options.stop();
        process.exit(0);
      } catch (error) {
        const detail = error instanceof Error ? error.message : String(error);
        writeLine(`Could not complete the shutdown prompt: ${detail}`);
        writeLine(`${options.runtimeName} shutdown cancelled; the server is still running.`);
      } finally {
        confirmationInProgress = false;
      }
    })();
  });
}
