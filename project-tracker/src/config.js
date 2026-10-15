import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export const ROOT_DIR = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

function parsePort(value) {
  const port = Number(value);
  return Number.isInteger(port) && port > 0 && port < 65536 ? port : null;
}

/**
 * Environment variables (the Home Assistant add-on sets them in run.sh):
 *   PORT        port to listen on (default 3200)
 *   HOST        interface to bind (default all)
 *   STATE_FILE  where projects and items are saved (default ./data/tracker.json)
 *   HTTPS_PORT, TLS_CERT, TLS_KEY  also serve https (PEM certificate and key; off unless all three are set)
 */
export function loadConfig(env = process.env) {
  const pkg = JSON.parse(readFileSync(path.join(ROOT_DIR, 'package.json'), 'utf8'));

  return Object.freeze({
    version: pkg.version,
    port: parsePort(env.PORT) ?? 3200,
    host: env.HOST || '0.0.0.0',
    httpsPort: parsePort(env.HTTPS_PORT),
    tlsCert: env.TLS_CERT || null,
    tlsKey: env.TLS_KEY || null,
    stateFile: env.STATE_FILE || path.join(ROOT_DIR, 'data', 'tracker.json'),
    publicDir: path.join(ROOT_DIR, 'public'),
  });
}
