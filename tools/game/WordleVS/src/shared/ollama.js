import { OLLAMA_GENERATE_PATH } from './constants.js';

export async function generateWithOllama(payload) {
    const response = await fetch(OLLAMA_GENERATE_PATH, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify(payload)
    });

    if (!response.ok) {
        let details = '';
        try {
            details = await response.text();
        } catch {
            details = '';
        }
        throw new Error(`Ollama proxy request failed (${response.status}): ${details || response.statusText}`);
    }

    return response.json();
}

export function extractOllamaText(data) {
    if (!data || typeof data !== 'object') return '';
    if (typeof data.response === 'string') return data.response;
    if (typeof data.output === 'string') return data.output;
    return '';
}
