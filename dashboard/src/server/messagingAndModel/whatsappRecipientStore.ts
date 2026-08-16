import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { appConfig } from "@urage/server/config/appConfig";

export type PersistedWhatsAppRecipient = {
  id: string;
  to: string;
  label: string;
  lastUsedAt: string;
  lastMessagePreview: string;
};

const storePath = path.resolve(appConfig.dataDirectory, "whatsapp-recipient-history.json");
let mutationQueue: Promise<unknown> = Promise.resolve();

function normalizePhoneNumber(value: unknown): string {
  const cleaned = String(value || "").trim().replace(/[^\d+]+/g, "");
  if (!cleaned) return "";
  return `+${cleaned.replace(/^\+/, "").replace(/\D+/g, "")}`;
}

async function readRecipients(): Promise<PersistedWhatsAppRecipient[]> {
  try {
    const parsed = JSON.parse(await readFile(storePath, "utf8")) as unknown;
    return Array.isArray(parsed) ? parsed.filter((entry): entry is PersistedWhatsAppRecipient =>
      Boolean(entry && typeof entry === "object" && "to" in entry && "lastUsedAt" in entry)
    ) : [];
  } catch {
    return [];
  }
}

async function persistRecipients(recipients: PersistedWhatsAppRecipient[]): Promise<void> {
  await mkdir(path.dirname(storePath), { recursive: true });
  await writeFile(storePath, JSON.stringify(recipients.slice(0, 100), null, 2) + "\n", "utf8");
}

export async function listPersistedWhatsAppRecipients(): Promise<PersistedWhatsAppRecipient[]> {
  await mutationQueue;
  return readRecipients();
}

export async function rememberWhatsAppRecipient(input: { to: unknown; label?: unknown; message?: unknown }): Promise<PersistedWhatsAppRecipient> {
  const to = normalizePhoneNumber(input.to);
  if (to.length < 8) throw new Error("WhatsApp recipient must use a valid international phone number.");
  const operation = mutationQueue.then(async () => {
    const recipients = await readRecipients();
    const existing = recipients.find(recipient => recipient.to === to);
    const recipient: PersistedWhatsAppRecipient = {
      id: existing?.id || to,
      to,
      label: String(input.label || existing?.label || to).trim().slice(0, 80) || to,
      lastUsedAt: new Date().toISOString(),
      lastMessagePreview: String(input.message || existing?.lastMessagePreview || "").trim().replace(/\s+/g, " ").slice(0, 180)
    };
    const next = [recipient, ...recipients.filter(entry => entry.to !== to)]
      .sort((left, right) => right.lastUsedAt.localeCompare(left.lastUsedAt));
    await persistRecipients(next);
    return recipient;
  });
  mutationQueue = operation.then(() => undefined, () => undefined);
  return operation;
}

export function mergeWhatsAppRecipients(runtimeContacts: unknown[], persisted: PersistedWhatsAppRecipient[]): Array<Record<string, unknown>> {
  const merged = new Map<string, Record<string, unknown>>();
  for (const raw of [...persisted, ...(Array.isArray(runtimeContacts) ? runtimeContacts : [])]) {
    if (!raw || typeof raw !== "object") continue;
    const contact = raw as Record<string, unknown>;
    const to = normalizePhoneNumber(contact.to || contact.phone || contact.id);
    if (!to) continue;
    const prior = merged.get(to) || {};
    merged.set(to, {
      ...prior,
      ...contact,
      id: String(contact.id || prior.id || to),
      to,
      label: String(contact.label || contact.name || prior.label || to)
    });
  }
  return [...merged.values()];
}
