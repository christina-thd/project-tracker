# Project Tracker Add-on

What's still to do and what's ready to test, for every project you're working on. Made for adding things quickly
from your phone, and just as usable from a PC.

## Features

- Everyone has their own projects, each with an emoji and a link to its GitHub repo
- **Todo**, **Test** and **Done** lists; one tap moves an item along
- Quick add: tap +, type, and the next one
- Notes and 🐞 bug / ✨ feature / 📝 other on any item
- Phone and PC, live on every screen

## Installation

1. Add this repository to Home Assistant, or copy this directory to your Home Assistant `/addons` folder
2. Refresh the add-on store
3. Install the "Project Tracker" add-on
4. Start it, and turn on "Show in sidebar"

## Configuration

None needed. Optional:

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| ssl | bool | false | Also serve https on port 3201 with Home Assistant's own certificate, so Android can install the app |
| certfile | str | fullchain.pem | Certificate in Home Assistant's `ssl` folder |
| keyfile | str | privkey.pem | Its key, in the `ssl` folder |

## Usage

Open **Projects** in the Home Assistant sidebar
or go straight to `http://<your-homeassistant-ip>:3200/`.
With `ssl` on, the secure address is `https://<your-domain>:3201/` (see the Documentation tab).

## Development

See [docs/DEVELOPMENT.md](docs/DEVELOPMENT.md).
