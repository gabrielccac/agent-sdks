import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));

function todayBR() {
  const d = new Date(Date.now() - 3 * 60 * 60 * 1000);
  return d.toISOString().slice(0, 10); // YYYY-MM-DD in Brazil time
}

const template = readFileSync(join(__dirname, 'instructions.md'), 'utf8');

export const agentInstructions = template.replace('{{TODAY}}', todayBR());
