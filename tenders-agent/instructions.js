import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));

export const agentInstructions = readFileSync(
  join(__dirname, 'instructions.md'),
  'utf8'
);
