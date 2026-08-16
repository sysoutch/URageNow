import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { readFile, writeFile } from 'node:fs/promises';

const __dirname = dirname(fileURLToPath(import.meta.url));
const rootDir = resolve(__dirname, '..');
const sourceFile = resolve(rootDir, 'styles', 'main.scss');
const outputFile = resolve(rootDir, 'style.css');

async function resolveScss(filePath, seen = new Set()) {
    const normalizedPath = resolve(filePath);
    if (seen.has(normalizedPath)) {
        return '';
    }
    seen.add(normalizedPath);

    const source = await readFile(normalizedPath, 'utf8');
    const lines = source.split(/\r?\n/);
    const chunks = [];

    for (const line of lines) {
        const match = line.match(/^\s*@use\s+["']([^"']+)["'];\s*$/);
        if (!match) {
            chunks.push(line);
            continue;
        }

        const partialPath = resolve(dirname(normalizedPath), `_${match[1]}.scss`);
        const resolved = await resolveScss(partialPath, seen);
        if (resolved.trim()) {
            chunks.push(resolved);
        }
    }

    return chunks.join('\n').trim();
}

async function main() {
    const bundled = await resolveScss(sourceFile);
    const output = `/* Generated from styles/main.scss. Do not edit style.css directly. */\n\n${bundled}\n`;
    await writeFile(outputFile, output, 'utf8');
    console.log(`Built ${outputFile} from ${sourceFile}`);
}

main().catch(error => {
    console.error(error);
    process.exitCode = 1;
});
