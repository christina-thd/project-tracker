# Project Tracker

Keep track of what's to do and what's ready to test, for every project you're working on.

## Getting started

1. Open **Projects** in the Home Assistant sidebar.
2. Tap **Add the first person** and type your name.
3. Tap **Add your first project** and give it a name. An emoji and a color are picked for it; change them if you like.
4. Tap the round **+** at the bottom right, type, and press Enter. That's it: it's on the **Todo** list.

## People

Everyone in the house has their own projects. The home screen ("Who's this?") has a tile per person, with how many
items they have open: tap yours to see your projects. Each phone or PC remembers who picked it last, so after the first
time it opens straight on your projects.

Your emoji is at the top right: tap it (or use the back button) to go back to the home screen and pick someone else.
On the home screen, **Add person** adds someone, and **⋯** on a tile renames them, changes their emoji, or deletes them
(with all their projects).

There are no passwords: anyone can pick anyone. It's for keeping things tidy, not private.

## The lists

Every item is in one of three lists:

| List              | Means                                    |
|-------------------|------------------------------------------|
| **Todo**          | Still to be done                         |
| **Test**          | Built, waiting for you to try it         |
| **Done**          | Tested and finished                      |

Tap the round button in front of an item to move it to the next list: Todo → Test → Done.
A message at the bottom offers **Undo** for a few seconds; tap the message to dismiss it.

Tap the item itself to open it: change its text, add notes (how to test it, a link, …), move it to any list
(e.g. back to Todo when a test fails), or delete it.

## Adding things quickly

The round **+** at the bottom right opens a small sheet that adds to **the project you're on**. Pick **Todo** or
**Test** at the top: it starts on the tab you're looking at (Todo when you're on Done).

Type and press Enter: it's added, and the field clears for the next one, so you can add several in a row.
Tap **Done** (or swipe the sheet down) when you're finished. On a PC, press **n** (or **+**) to open it and Escape to close it.

## Projects

The name at the top is the project you're on. Tap it to see all your projects (just yours), the most recently active first,
with how many items each has in Todo and Test; tap one to switch to it. With more than a few projects there's a
search field too: type part of a name and press Enter to jump to the first match.

In that list, **⋯** next to a project renames it, changes its emoji or color, clears its done items, or deletes it
(with everything in it). **New project** at the bottom adds one.

Every project has an **emoji**, shown next to its name. When you add a project, one is suggested from its name as you
type ("Garden sensors" → 🌱, "Budget" → 💰); if nothing fits, it's one no other project uses yet. Pick another from
the grid, or tap the field below it and pick any emoji from your keyboard's emoji keys. The project's **color** marks its items and the + button.

**Clear** in the Done list removes the project's done items; it asks first (tap it again), as this can't be undone.

## Phone and PC

On a phone you see one list at a time, picked with the tabs. On a wide screen the three lists sit side by side.
Everything you change shows up straight away on every screen that has the tracker open.

If the connection to Home Assistant is lost for more than a few seconds, an **Offline** badge shows next to the
title. It reconnects by itself and the badge goes away; until then, changes made on other screens don't show.

To have it like an app on your phone, open the direct address `http://<your-homeassistant-ip>:3200/` in the
browser and choose **Add to Home Screen**. It works in the Home Assistant app too, from the sidebar.

## Your data

Projects and items are saved in the add-on's own storage (`/data/tracker.json`) and are kept across updates and
restarts. Home Assistant backups include it.
