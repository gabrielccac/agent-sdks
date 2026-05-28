import { execFile } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const SCRIPT = join(__dirname, '..', 'scripts', 'get_captcha', 'get_token.py');

export async function getCaptchaToken(): Promise<string> {
  return new Promise((resolve, reject) => {
    execFile('python3', [SCRIPT, '--count', '1'], { timeout: 60_000 }, (err, stdout, stderr) => {
      if (err) return reject(new Error(`captcha script failed: ${err.message}\n${stderr}`));
      const token = stdout.trim();
      if (!token) return reject(new Error('captcha script produced no output'));
      resolve(token);
    });
  });
}
