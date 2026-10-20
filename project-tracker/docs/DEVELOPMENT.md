# Development

Requires Node.js 22+ (the add-on runs Node 22: the Dockerfile's Alpine 3.22). The add-on itself has no npm
dependencies; `npm install` only brings the dev tools (ESLint, TypeScript as a checker), which aren't shipped.

```sh
npm install         # the dev tools
npm run dev         # http://localhost:3200, restarts on changes
npm test            # unit, HTTP and add-on packaging tests (Node's built-in test runner)
npm run lint        # ESLint (eslint.config.js)
npm run typecheck   # type checks the JavaScript from its JSDoc comments (tsconfig.json); nothing is compiled
npm run check       # all three, as the pull request checks do
```

| Variable     | Default             | Purpose                                 |
|--------------|---------------------|-----------------------------------------|
| `PORT`       | `3200`              | Port to listen on                       |
| `HOST`       | `0.0.0.0`           | Interface to bind                       |
| `STATE_FILE` | `data/tracker.json` | Where projects and items are saved      |
| `HTTPS_PORT`, `TLS_CERT`, `TLS_KEY` | off | Also serve https (PEM certificate and key, reloaded when renewed); the add-on uses 3201 with Home Assistant's certificate (`ssl` option) |

The server doesn't know about Home Assistant: in the add-on, `run.sh` sets these variables.

To try it on your phone while developing, open `http://<your-pc-ip>:3200/` on the same Wi-Fi.

## Layout

This folder is a Home Assistant add-on (the files at the top) that contains the app (the rest).
See [_project_architecture.txt](_project_architecture.txt) for every file.

```
config.yaml, Dockerfile, run.sh     Home Assistant add-on
README.md, DOCS.md, CHANGELOG.md    add-on store page, Documentation tab, changelog

src/                      server (Node, no framework, no dependencies)
  server.js               entry point: load config and state, start HTTP (and https), graceful shutdown
  config.js               environment variables
  app.js                  HTTP routes: page, static files, API
  tracker/state.js        state shape, repairing saved data, the view sent to screens
  tracker/actions.js      every action, validated (the only code that changes state)
  store.js                JSON file storage: debounced, atomic writes
  sse.js                  Server-Sent Events hub for live updates
  static.js               safe static file serving
  tls.js                  https certificate: reading it, and reloading it when it's renewed

public/                   browser (plain ES modules, no build step)
  index.html              the page (markup only)
  css/                    base.css (theme, shared components), tracker.css (everything else)
  js/app.js               entry: keeps the latest view, remembers who and what you're looking at, switches
                          the three screens (home → a person's projects → a project), wires the parts
  js/shared/              tracker.js (statuses and limits, also used by the server), api, dom, format, storage
  js/ui/                  reusable pieces: back (phone back button), sheet (bottom sheets, swipe to close),
                          emoji-picker (the emoji grid + a field for any emoji from the keyboard),
                          confirm (type "delete" before deleting a project or a person),
                          viewport (keeps sheets above the keyboard), toast (messages at the bottom, with Undo; a tap dismisses), icons
  js/tracker/             kind-picker (bug / feature / other, by emoji), home (who's this? a tile per person), person-sheet (new / edit person),
                          board (the three columns, and the backlog under Todo), clear-done (clearing done items, with Undo), project-list (a person's projects, with search: the projects
                          screen and the switcher use it), switcher (header project button + the project list sheet),
                          add-sheet (the + button's sheet), item-sheet (one item), project-sheet (new / edit project)

test/                     node:test suites
```

## How it works

**Data flow.** Screens send actions (`POST /api/actions`, e.g. `{ "type": "setStatus", "itemId": "…",
"status": "test" }`). The server validates and applies the action, saves, and broadcasts the new view
to every screen over `GET /api/events` (Server-Sent Events). Screens never change items locally; they
only render the latest view.

**Actions:** `addPerson`, `renamePerson`, `setPersonEmoji`, `removePerson` (with their projects), `addProject`
(for a person), `renameProject`, `setProjectEmoji`, `setProjectHue`, `setProjectUrl` (its repo link: any web address, `cleanUrl`; the
project sheet takes a GitHub repo, `githubUrl` / `githubRepo` in `public/js/shared/tracker.js`), `removeProject` (with its items), `addItem`,
`editItem`, `setStatus`, `removeItem`, `clearDone`. See `src/tracker/actions.js`. Statuses are `todo`, `test` and
`done` (`STATUSES` in `public/js/shared/tracker.js`), plus `backlog` (`ITEM_STATUS_IDS`): out of the three lists,
not open (`isOpen`), shown dimmed under Todo; `movedAt` records when an item got its status, and lists show
the latest first.

**People.** Everyone has their own projects (`project.personId`); project names are unique per person. There are
no passwords: the home screen lets anyone pick anyone, and the device remembers who. Schema 1 (before people) is
moved to a first person, "Me", on load.

**Saved data** is versioned (`schema`). `normalizeState` repairs anything odd in the file on load
(unknown values fall back to defaults; items without text or a project are dropped), so a bad edit can't break the app.

**Updates while a page is open:** every view carries the app version; a page that sees a new
version reloads itself.

**Phone and PC:** the page has the three columns in it always. Below 900px wide only the one picked by the tabs
shows; above, all three sit side by side and the tabs hide (`css/tracker.css`).

**Remembered per device** (localStorage, `js/shared/storage.js`): who you are, the project you were on (per person),
the tab and whether the backlog is hidden. Reopening goes straight back to that project, with home and the projects screen behind it in
history. There's no "all projects" view: on the board you're always on one project, and the + adds to it.

**Screens:** home ("Who's this?") → a person's projects → a project's board. Only the board has the + button
(`body.has-fab`, which also keeps toasts clear of it).

**Back button:** opening a screen or a sheet adds a history entry, so the phone's back button (and the Home Assistant
app's) goes back a step instead of leaving the page (`js/ui/back.js`). Each entry stores its depth, so going back
any number of steps runs the right handlers, also after a reload.

**Sheets** freeze the page behind them while open (`body.locked`), so the iPhone keyboard can't scroll it out from
under the sheet.

**Paths are relative** (`api/actions`, `css/…`), so the app also works in the Home Assistant
sidebar, which serves it under `/api/hassio_ingress/<token>/`.

## Releasing a new version

1. Bump `version` in **both** `config.yaml` and `package.json` (a test fails if they differ).
2. Add an entry at the top of `CHANGELOG.md`.
3. Run `npm run check`, then open a pull request into `main`: it checks the version went up and runs lint, types
   and tests. Merging releases it: Home Assistant shows the update in the add-on store.

The tracker is kept in the add-on's `/data` folder across updates.

## Store images

`icon.png` (128×128) and `logo.png` (250×100) are what Home Assistant shows in the add-on store.
They are rendered from `public/img/logo.svg` and `art/store-logo.svg`, together with the home-screen
icons in `public/img/`; after changing either, run:

```sh
docker run --rm -v "$PWD:/addon" -w /addon alpine:3.20 sh art/render.sh
```

## Testing the add-on image locally

```sh
docker build --build-arg BUILD_ARCH=amd64 -t project-tracker .    # BUILD_FROM defaults to the Home Assistant base image
docker run --rm -p 3200:3200 -v project-tracker-data:/data project-tracker
```
