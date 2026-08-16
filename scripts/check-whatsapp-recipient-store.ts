import assert from "node:assert/strict";
import { mergeWhatsAppRecipients } from "../dashboard/src/server/messagingAndModel/whatsappRecipientStore.js";

const merged = mergeWhatsAppRecipients(
  [{ id: "runtime", to: "+1 555 123 4567", label: "Runtime label" }],
  [{
    id: "persisted",
    to: "+15551234567",
    label: "Saved label",
    lastUsedAt: "2026-01-01T00:00:00.000Z",
    lastMessagePreview: "Hello"
  }]
);

assert.equal(merged.length, 1);
assert.equal(merged[0]?.to, "+15551234567");
assert.equal(merged[0]?.label, "Runtime label");

console.log("WhatsApp persisted recipient merge validation passed.");
