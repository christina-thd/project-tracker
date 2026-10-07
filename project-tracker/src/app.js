import path from 'node:path';
import { ActionError, applyAction } from './tracker/actions.js';
import { toView } from './tracker/state.js';
import { SseHub } from './sse.js';
import { resolveInside, sendFile } from './static.js';

const MAX_BODY_BYTES = 10 * 1024;

const PAGES = {
  '/': 'index.html',
  '/manifest.webmanifest': 'manifest.webmanifest',
};
const STATIC_DIRS = ['/css/', '/js/', '/img/'];

class HttpError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}

function sendJson(res, status, body) {
  const json = JSON.stringify(body);
  res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' });
  res.end(json);
}

function readJsonBody(req) {
  return new Promise((resolve, reject) => {
    let size = 0;
    const chunks = [];
    req.on('data', (chunk) => {
      size += chunk.length;
      if (size > MAX_BODY_BYTES) {
        reject(new HttpError(413, 'Request body too large'));
        req.destroy();
        return;
      }
      chunks.push(chunk);
    });
    req.on('end', () => {
      try {
        resolve(JSON.parse(Buffer.concat(chunks).toString('utf8')));
      } catch {
        reject(new HttpError(400, 'Body must be valid JSON'));
      }
    });
    req.on('error', reject);
  });
}

/**
 * Builds the request handler.
 *
 *   GET  /                 the tracker
 *   GET  /manifest.webmanifest   web app manifest ("Add to Home Screen" opens it like an app)
 *   GET  /css/*, /js/*, /img/*   static files
 *   GET  /api/info         { version }
 *   GET  /api/events       live view (Server-Sent Events)
 *   POST /api/actions      apply one action, e.g. { "type": "setStatus", "itemId": "…", "status": "test" }
 *
 * @param {{ config: any, state: any, store: any, hub?: SseHub, now?: () => number,
 *   logger?: Pick<Console, 'error'> }} options
 */
export function createApp({ config, state, store, hub = new SseHub(), now = Date.now, logger = console }) {
  const view = () => toView(state, config.version);

  async function dispatch(req, res) {
    const action = await readJsonBody(req);
    const result = applyAction(state, action, now());
    store.save(state);
    hub.broadcast(view());
    sendJson(res, 200, result);
  }

  function notFound(res) {
    sendJson(res, 404, { error: 'Not found' });
  }

  async function route(req, res) {
    const { pathname } = new URL(req.url, 'http://localhost');
    const method = req.method;

    if (pathname === '/api/actions') {
      if (method !== 'POST') throw new HttpError(405, 'Use POST');
      return dispatch(req, res);
    }
    if (method !== 'GET' && method !== 'HEAD') throw new HttpError(405, 'Method not allowed');

    if (pathname === '/api/events') return hub.connect(req, res, view());
    if (pathname === '/api/info') return sendJson(res, 200, { version: config.version });
    if (Object.hasOwn(PAGES, pathname)) {
      return sendFile(req, res, path.join(config.publicDir, PAGES[pathname]), () => notFound(res));
    }
    if (STATIC_DIRS.some((dir) => pathname.startsWith(dir))) {
      let decoded;
      try {
        decoded = decodeURIComponent(pathname);
      } catch {
        throw new HttpError(400, 'Malformed path');
      }
      const file = resolveInside(config.publicDir, decoded);
      return file ? sendFile(req, res, file, () => notFound(res)) : notFound(res);
    }
    return notFound(res);
  }

  async function handle(req, res) {
    try {
      await route(req, res);
    } catch (err) {
      if (err instanceof ActionError || err instanceof HttpError) return sendJson(res, err.status, { error: err.message });
      logger.error(err);
      if (!res.headersSent) sendJson(res, 500, { error: 'Internal error' });
      else res.end();
    }
  }

  return { handle, hub };
}
