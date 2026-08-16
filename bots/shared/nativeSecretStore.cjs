"use strict";

const nativeSecretService = "URageStudio";

function getNativeSecret(name) {
  try {
    const { Entry } = require("@napi-rs/keyring");
    const value = new Entry(nativeSecretService, String(name || "").trim()).getPassword();
    return typeof value === "string" && value.trim() ? value.trim() : "";
  } catch {
    return "";
  }
}

function setNativeSecret(name, value) {
  const normalizedName = String(name || "").trim();
  const normalizedValue = String(value || "");
  if (!normalizedName || !normalizedValue) throw new Error("Secret name and value are required.");
  const { Entry } = require("@napi-rs/keyring");
  new Entry(nativeSecretService, normalizedName).setPassword(normalizedValue);
}

module.exports = { getNativeSecret, setNativeSecret };
