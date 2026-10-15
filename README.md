# Project Tracker

A to-do and ready-to-test tracker for every project you're working on, as a Home Assistant add-on.

<p>
  <img src="images/home.jpg" alt="The home screen: pick yourself to see your projects" width="200">
  <img src="images/projects.jpg" alt="Your projects, with what's open in each: pick one to work on" width="200">
  <img src="images/todo.jpg" alt="A project's Todo list, with the Todo, Test and Done tabs at the top" width="200">
  <img src="images/add.jpg" alt="Adding an item, with a note: the sheet stays open for the next one" width="200">
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
- Everyone has their own projects, each with an emoji and a link to its GitHub repo
- **Todo**, **Test** and **Done** lists; one tap moves an item along
- Quick add: tap +, type, and the next one
- Notes and 🐞 bug / ✨ feature / 📝 other on any item
- Phone and PC, live on every screen

[Documentation →](./project-tracker/README.md)

## Development

The app is plain Node.js with no build step and no dependencies. See
[project-tracker/docs/DEVELOPMENT.md](./project-tracker/docs/DEVELOPMENT.md).

```sh
cd project-tracker
npm test
npm run dev
```
