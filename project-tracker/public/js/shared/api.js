// Client for the server API. Paths are relative so the app also works behind
// Home Assistant ingress (served under /api/hassio_ingress/<token>/).

async function readJson(res) {
  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(body.error || `Request failed (${res.status})`);
  return body;
}

export async function sendAction(action) {
  const res = await fetch('api/actions', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(action),
  });
  return readJson(res);
}

/**
 * Calls `onView` with the full view on connect and after every change, and `onConnection(true | false)` when the
 * live connection opens or drops (it reconnects by itself).
 * If the server was updated to a new version while the page stayed open, reloads the page
 * so it never runs old code against the new server.
 * @param {(view: any) => void} onView
 * @param {(connected: boolean) => void} [onConnection]
 */
export function subscribe(onView, onConnection = (_connected) => {}) {
  let version = null;
  const events = new EventSource('api/events');
  events.onopen = () => onConnection(true);
  events.onerror = () => onConnection(false);
  events.onmessage = (event) => {
    const view = JSON.parse(event.data);
    if (version && view.version !== version) {
      location.reload();
      return;
    }
    version = view.version;
    onView(view);
  };
  return events;
}
