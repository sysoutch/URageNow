import type {NativeApplicationPort} from "./nativeApplicationPort.js";
import {createRustNativeApplicationAdapter} from "./rustNativeApplicationAdapter.js";
import {createTypeScriptNativeApplicationAdapter} from "./typeScriptNativeApplicationAdapter.js";

let nativeApplicationPort: NativeApplicationPort | null = null;

export function getNativeApplicationPort(): NativeApplicationPort {
  if (nativeApplicationPort) {
    return nativeApplicationPort;
  }
  const brokerPath = String(process.env.URAGE_NATIVE_APPLICATION_BROKER_PATH || "").trim();
  nativeApplicationPort = brokerPath
    ? createRustNativeApplicationAdapter(brokerPath)
    : createTypeScriptNativeApplicationAdapter();
  return nativeApplicationPort;
}

export function setNativeApplicationPortForTesting(port: NativeApplicationPort | null): void {
  nativeApplicationPort = port;
}
