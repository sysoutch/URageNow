import { readFileSync } from "node:fs";
import {
  deleteNativeSecret,
  discordTokenSecretName,
  getNativeSecret,
  getNativeSecretStatus,
  setNativeSecret
} from "@urage/server/security/nativeSecretStore";

const command = String(process.argv[2] || "").trim().toLowerCase();
const name = String(process.argv[3] || discordTokenSecretName).trim();

if (command === "get") {
  const value = getNativeSecret(name);
  if (!value) {
    process.exitCode = 1;
  } else {
    process.stdout.write(value);
  }
} else if (command === "set") {
  const value = readFileSync(0, "utf8").replace(/[\r\n]+$/, "");
  setNativeSecret(name, value);
  console.log(`Stored ${name} in the current user's native credential store.`);
} else if (command === "delete") {
  const deleted = deleteNativeSecret(name);
  console.log(deleted ? `Deleted ${name}.` : `${name} was not present.`);
} else if (command === "status") {
  console.log(getNativeSecretStatus(name));
} else {
  console.error("Usage: manage-native-secret.ts <get|set|delete|status> [secret-name]");
  process.exitCode = 2;
}
