import {createHash, randomBytes} from "node:crypto";
import {existsSync} from "node:fs";
import {copyFile, mkdir, readFile, readdir, writeFile} from "node:fs/promises";
import {spawn} from "node:child_process";
import path from "node:path";
import {fileURLToPath} from "node:url";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const androidRoot = path.join(repoRoot, "apps", "android-companion");
const dataRoot = path.resolve(process.env.DASHBOARD_DATA_DIR || path.join(repoRoot, "data"));
const signingRoot = path.join(dataRoot, "android-signing");
const releasesRoot = path.join(dataRoot, "android-releases");
const signingConfigPath = path.join(signingRoot, "release-signing.json");
const keystorePath = path.join(signingRoot, "urage-companion-release.jks");
const bundledAndroidJavaHome = "C:\\Program Files\\Android\\Android Studio\\jbr";
const javaHome = process.env.ANDROID_JAVA_HOME
  || (process.platform === "win32" && existsSync(bundledAndroidJavaHome) ? bundledAndroidJavaHome : process.env.JAVA_HOME);
if (!javaHome) throw new Error("Set ANDROID_JAVA_HOME or JAVA_HOME to JDK 17.");
const versionSource = await readFile(path.join(androidRoot, "version.properties"), "utf8");
const version = Object.fromEntries(versionSource.split(/\r?\n/).map(line => line.split("=", 2)).filter(parts => parts.length === 2));
const versionName = String(version.VERSION_NAME || "").trim();
const versionCode = Number(version.VERSION_CODE || 0);
if (!/^\d+\.\d+\.\d+(?:[-+][a-z0-9.-]+)?$/i.test(versionName) || !Number.isInteger(versionCode) || versionCode < 1) {
  throw new Error("apps/android-companion/version.properties contains an invalid version.");
}

function run(command, args, options = {}) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, {stdio: "inherit", ...options});
    child.once("error", reject);
    child.once("exit", code => code === 0 ? resolve() : reject(new Error(`${command} exited with code ${code}.`)));
  });
}

function generatePassword() {
  return randomBytes(30).toString("base64url");
}

async function findApkSigner() {
  const sdkRoot = process.env.ANDROID_SDK_ROOT
    || process.env.ANDROID_HOME
    || (process.platform === "win32" && process.env.LOCALAPPDATA
      ? path.join(process.env.LOCALAPPDATA, "Android", "Sdk")
      : "");
  if (!sdkRoot) {
    throw new Error("Set ANDROID_SDK_ROOT or ANDROID_HOME so the published APK signature can be verified.");
  }
  const buildToolsRoot = path.join(sdkRoot, "build-tools");
  const versions = (await readdir(buildToolsRoot, {withFileTypes: true}))
    .filter(entry => entry.isDirectory())
    .map(entry => entry.name)
    .sort((left, right) => right.localeCompare(left, undefined, {numeric: true}));
  for (const version of versions) {
    const candidate = path.join(buildToolsRoot, version, "lib", "apksigner.jar");
    if (existsSync(candidate)) {
      return candidate;
    }
  }
  throw new Error(`Android SDK at ${sdkRoot} does not contain apksigner.`);
}

async function loadOrCreateSigningConfig() {
  await mkdir(signingRoot, {recursive: true});
  if (existsSync(signingConfigPath) && existsSync(keystorePath)) {
    return JSON.parse(await readFile(signingConfigPath, "utf8"));
  }
  const config = {
    keyAlias: "urage-companion",
    storePassword: generatePassword(),
    keyPassword: generatePassword(),
    createdAt: new Date().toISOString()
  };
  const keytool = path.join(javaHome, "bin", process.platform === "win32" ? "keytool.exe" : "keytool");
  await run(keytool, [
    "-genkeypair",
    "-keystore", keystorePath,
    "-storetype", "JKS",
    "-storepass", config.storePassword,
    "-alias", config.keyAlias,
    "-keypass", config.keyPassword,
    "-keyalg", "RSA",
    "-keysize", "4096",
    "-validity", "10000",
    "-dname", "CN=URage NOW Android Companion, OU=Release, O=URage NOW, C=CH"
  ]);
  await writeFile(signingConfigPath, JSON.stringify(config, null, 2) + "\n", {encoding: "utf8", mode: 0o600});
  return config;
}

const signing = await loadOrCreateSigningConfig();
const gradleCommand = path.join(androidRoot, process.platform === "win32" ? "gradlew.bat" : "gradlew");
const releaseCommand = process.platform === "win32" ? "cmd.exe" : gradleCommand;
const releaseArguments = process.platform === "win32"
  ? ["/d", "/s", "/c", "gradlew.bat clean :app:assembleRelease :app:bundleRelease"]
  : ["clean", ":app:assembleRelease", ":app:bundleRelease"];
await run(releaseCommand, releaseArguments, {
  cwd: androidRoot,
  env: {
    ...process.env,
    JAVA_HOME: javaHome,
    ANDROID_RELEASE_KEYSTORE: keystorePath,
    ANDROID_RELEASE_STORE_PASSWORD: signing.storePassword,
    ANDROID_RELEASE_KEY_ALIAS: signing.keyAlias,
    ANDROID_RELEASE_KEY_PASSWORD: signing.keyPassword
  }
});

await mkdir(releasesRoot, {recursive: true});
const apkSigner = await findApkSigner();
const javaExecutable = path.join(javaHome, "bin", process.platform === "win32" ? "java.exe" : "java");
const apkOutputRoot = path.join(androidRoot, "app", "build", "outputs", "apk", "release");
const apkOutputs = (await readdir(apkOutputRoot))
  .filter(fileName => /^app-(?:universal|arm64-v8a|armeabi-v7a|x86_64)-release\.apk$/i.test(fileName));
if (!apkOutputs.some(fileName => fileName.includes("universal"))) {
  throw new Error("Gradle did not produce the required universal release APK.");
}
const artifacts = [];
for (const sourceName of apkOutputs) {
  const abi = sourceName.match(/^app-(.+)-release\.apk$/i)?.[1] || "universal";
  const fileName = `urage-companion-v${versionName}-${abi}.apk`;
  const destination = path.join(releasesRoot, fileName);
  await copyFile(path.join(apkOutputRoot, sourceName), destination);
  await run(javaExecutable, ["-jar", apkSigner, "verify", "--verbose", "--print-certs", destination], {
    env: {...process.env, JAVA_HOME: javaHome}
  });
  const payload = await readFile(destination);
  artifacts.push({
    type: "apk",
    abi,
    fileName,
    size: payload.length,
    sha256: createHash("sha256").update(payload).digest("hex")
  });
}
const sourceBundle = path.join(androidRoot, "app", "build", "outputs", "bundle", "release", "app-release.aab");
const bundleFileName = `urage-companion-v${versionName}.aab`;
const destinationBundle = path.join(releasesRoot, bundleFileName);
await copyFile(sourceBundle, destinationBundle);
const jarSigner = path.join(javaHome, "bin", process.platform === "win32" ? "jarsigner.exe" : "jarsigner");
// A local release certificate is intentionally self-signed, so `-strict`
// would reject its trust chain even when the bundle signature is intact.
await run(jarSigner, ["-verify", destinationBundle], {
  env: {...process.env, JAVA_HOME: javaHome}
});
const bundlePayload = await readFile(destinationBundle);
artifacts.push({
  type: "aab",
  abi: "bundle",
  fileName: bundleFileName,
  size: bundlePayload.length,
  sha256: createHash("sha256").update(bundlePayload).digest("hex")
});
const primary = artifacts.find(artifact => artifact.type === "apk" && artifact.abi === "universal");
if (!primary) throw new Error("Universal APK metadata is missing.");
const release = {
  versionName,
  versionCode,
  fileName: primary.fileName,
  size: primary.size,
  sha256: primary.sha256,
  builtAt: new Date().toISOString(),
  artifacts
};
await writeFile(path.join(releasesRoot, "latest.json"), JSON.stringify(release, null, 2) + "\n", "utf8");
console.log(`Built ${artifacts.length} signed Android release artifacts under ${releasesRoot}`);
console.log(`SHA-256: ${release.sha256}`);
console.log(`Back up ${keystorePath} and ${signingConfigPath}; losing them prevents upgrade signing.`);
