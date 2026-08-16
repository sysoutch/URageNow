const express = require("express");
const cors = require("cors");
const path = require("path");

const app = express();
const ROOT = __dirname;
const PORT = Number(process.env.PORT || 3001);

const PROVIDERS = {
    ollama: {
        id: "ollama",
        label: "Ollama",
        baseUrl: process.env.OLLAMA_URL || "http://192.168.1.37:11434"
    },
    lmstudio: {
        id: "lmstudio",
        label: "LM Studio",
        baseUrl: process.env.LMSTUDIO_URL || "http://192.168.1.37:1234"
    }
};

const DEFAULT_DETECT_PROMPT = [
    "Detect all sprites in this image.",
    "Ignore background.",
    "",
    "Return ONLY JSON:",
    "{",
    '  "sprites":[{"x":0,"y":0,"width":0,"height":0}]',
    "}"
].join("\n");

app.use(cors());
app.use(express.json({ limit: "50mb" }));

/* ================= SERVE FRONTEND ================= */
app.use(express.static(ROOT));

app.get("/", (req, res) => {
    res.sendFile(path.join(ROOT, "index.html"));
});

function getProvider(providerId = "ollama") {
    return PROVIDERS[providerId] || null;
}

function resolveBaseUrl(provider, endpointOverride) {
    const override = String(endpointOverride || "").trim();
    if (!override) {
        return provider.baseUrl;
    }

    try {
        const parsed = new URL(override);
        if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
            throw new Error("Endpoint must use http or https");
        }

        return override.replace(/\/+$/, "");
    } catch {
        throw new Error(`Invalid endpoint URL: ${override}`);
    }
}

function getErrorMessage(error, fallback) {
    if (error instanceof Error && error.message) {
        return error.message;
    }
    return fallback;
}

function normalizeModels(providerId, payload) {
    if (providerId === "ollama") {
        return (payload.models || [])
            .filter((model) => model && model.name)
            .map((model) => ({ name: model.name }));
    }

    if (providerId === "lmstudio") {
        return (payload.data || [])
            .map((model) => ({ name: model?.id || model?.name }))
            .filter((model) => model.name);
    }

    return [];
}

function normalizeContent(providerId, payload) {
    if (providerId === "ollama") {
        return payload?.message?.content || payload?.response || "";
    }

    if (providerId === "lmstudio") {
        const content = payload?.choices?.[0]?.message?.content;

        if (typeof content === "string") {
            return content;
        }

        if (Array.isArray(content)) {
            return content
                .map((part) => {
                    if (typeof part === "string") {
                        return part;
                    }
                    return part?.text || "";
                })
                .join("\n")
                .trim();
        }

        return "";
    }

    return "";
}

function extractModelTextExact(providerId, payload) {
    if (providerId === "ollama") {
        return payload?.message?.content ?? payload?.response ?? "";
    }

    if (providerId === "lmstudio") {
        const content = payload?.choices?.[0]?.message?.content;
        if (typeof content === "string") {
            return content;
        }

        if (Array.isArray(content)) {
            return JSON.stringify(content, null, 2);
        }

        return "";
    }

    return "";
}

async function fetchJson(url, body) {
    const init = body
        ? {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify(body)
          }
        : undefined;

    const response = await fetch(url, init);
    const rawText = await response.text();

    let json = {};
    if (rawText) {
        try {
            json = JSON.parse(rawText);
        } catch {
            json = { raw: rawText };
        }
    }

    return { ok: response.ok, status: response.status, json, rawText };
}

/* ================= PROVIDERS ================= */
app.get("/api/providers", (req, res) => {
    res.json({
        providers: Object.values(PROVIDERS).map((provider) => ({
            id: provider.id,
            label: provider.label,
            baseUrl: provider.baseUrl
        }))
    });
});

/* ================= MODELS ================= */
app.get("/api/models", async (req, res) => {
    const providerId = String(req.query.provider || "ollama");
    const provider = getProvider(providerId);
    const endpoint = String(req.query.endpoint || "");

    if (!provider) {
        res.status(400).json({ error: `Unsupported provider: ${providerId}` });
        return;
    }

    let baseUrl;
    try {
        baseUrl = resolveBaseUrl(provider, endpoint);
    } catch (error) {
        res.status(400).json({
            error: getErrorMessage(error, "Invalid endpoint"),
            provider: providerId
        });
        return;
    }

    const url =
        providerId === "ollama"
            ? `${baseUrl}/api/tags`
            : `${baseUrl}/v1/models`;

    try {
        const { ok, status, json } = await fetchJson(url);

        if (!ok) {
            res.status(502).json({
                error: `${provider.label} returned HTTP ${status}`,
                provider: providerId,
                upstream: json
            });
            return;
        }

        res.json({
            provider: providerId,
            endpoint: baseUrl,
            models: normalizeModels(providerId, json)
        });
    } catch (error) {
        res.status(500).json({
            error: getErrorMessage(error, `${provider.label} is not reachable`),
            provider: providerId
        });
    }
});

/* ================= DETECT ================= */
app.post("/api/detect", async (req, res) => {
    const providerId = String(req.body?.provider || "ollama");
    const provider = getProvider(providerId);
    const endpoint = String(req.body?.endpoint || "");

    if (!provider) {
        res.status(400).json({ error: `Unsupported provider: ${providerId}` });
        return;
    }

    let baseUrl;
    try {
        baseUrl = resolveBaseUrl(provider, endpoint);
    } catch (error) {
        res.status(400).json({
            error: getErrorMessage(error, "Invalid endpoint"),
            provider: providerId
        });
        return;
    }

    const model = String(req.body?.model || "").trim();
    const imageBase64 = String(req.body?.imageBase64 || "").trim();
    const referenceImageBase64 = String(req.body?.referenceImageBase64 || "").trim();
    const prompt = String(req.body?.prompt || DEFAULT_DETECT_PROMPT).trim();

    if (!model) {
        res.status(400).json({ error: "Model is required", provider: providerId });
        return;
    }

    if (!imageBase64) {
        res.status(400).json({ error: "imageBase64 is required", provider: providerId });
        return;
    }

    const images = [referenceImageBase64, imageBase64].filter((entry) => !!entry);

    const url =
        providerId === "ollama"
            ? `${baseUrl}/api/chat`
            : `${baseUrl}/v1/chat/completions`;

    const body =
        providerId === "ollama"
            ? {
                  model,
                  stream: false,
                  messages: [
                      {
                          role: "user",
                          content: prompt,
                          images
                      }
                  ]
              }
            : {
                  model,
                  temperature: 0,
                  messages: [
                      {
                          role: "user",
                          content: [{ type: "text", text: prompt }].concat(
                              images.map((entry) => ({
                                  type: "image_url",
                                  image_url: {
                                      url: `data:image/png;base64,${entry}`
                                  }
                              }))
                          )
                      }
                  ]
              };

    try {
        const { ok, status, json, rawText } = await fetchJson(url, body);

        if (!ok) {
            res.status(502).json({
                error: `${provider.label} returned HTTP ${status}`,
                provider: providerId,
                endpoint: baseUrl,
                promptSent: prompt,
                modelText: extractModelTextExact(providerId, json),
                upstreamRawText: rawText,
                upstream: json
            });
            return;
        }

        res.json({
            provider: providerId,
            endpoint: baseUrl,
            promptSent: prompt,
            modelText: extractModelTextExact(providerId, json),
            upstreamRawText: rawText,
            content: normalizeContent(providerId, json),
            raw: json
        });
    } catch (error) {
        res.status(500).json({
            error: getErrorMessage(error, `${provider.label} request failed`),
            provider: providerId
        });
    }
});

/* ================= FAVICON (silent) ================= */
app.get("/favicon.ico", (req, res) => res.status(204).end());

app.listen(PORT, () => {
    console.log(`SpriteForge running -> http://localhost:${PORT}`);
});
