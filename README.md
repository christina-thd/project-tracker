# Project Tracker

A to-do and ready-to-test tracker for every project you're working on, as a Home Assistant add-on.

Everyone in the house picks themselves on the home screen and has their own projects.
Add a project, tap **+** to jot down what's to do, and move each item along with one tap:
**Todo** → **Test** → **Done**. Made for phones, in portrait; on a PC the three lists sit side by side.

<p>
  <img src="images/home.jpg" alt="The home screen: pick yourself to see your projects" width="200">
  <img src="images/todo.jpg" alt="A project's Todo list, with the project's emoji and name at the top" width="200">
  <img src="images/test.jpg" alt="The Test list: things built and waiting to be tried" width="200">
  <img src="images/item.jpg" alt="An item opened: its text, status and notes on how to test it" width="200">
  <img src="images/add.jpg" alt="Adding an item: type and press Enter, the sheet stays open for the next one" width="200">
  <img src="images/projects.jpg" alt="Switching project: every project with what's open in it" width="200">
</p>
<p>
  <img src="images/desktop.jpg" alt="On a PC: Todo, Test and Done side by side" width="820">
</p>

## Installation

Add this repository to Home Assistant:

1. Go to **Settings** → **Add-ons** → **Add-on Store**
2. Click menu (⋮) → **Repositories**
3. Add: `https://github.com/christina-thd/project-tracker`
4. Install **Project Tracker** from the store

## Add-ons

### Project Tracker

Keep track of what's to do and what's ready to test, per project.

**Features:**
- Everyone in the house has their own projects: pick yourself on the home screen
- A project per thing you work on, each with its own emoji
- Todo, Test and Done lists, with notes on any item
- Quick add: tap +, type, press Enter, and the next one
- Live on every screen: phone and PC at the same time

[Documentation →](./project-tracker/README.md)

## Development

The app is plain Node.js with no build step and no dependencies. See
[project-tracker/docs/DEVELOPMENT.md](./project-tracker/docs/DEVELOPMENT.md).

```sh
cd project-tracker
npm test
npm run dev
```

## Support

For issues, check the add-on logs or open an issue in this repository.
