# Stories

A client-only Instagram-style Stories demo built with HTML, Tailwind CSS (CDN), and vanilla JavaScript. Stories are stored in the browser with `localStorage` — no backend required.

## Live demo

Live website deployed on Vercel: [https://story-pi-six.vercel.app/](https://story-pi-six.vercel.app/)

## Features

- Horizontal story tray with a always-visible **+** upload control
- Newest stories appear first
- Images are center-cropped to **9:16** and capped at **1080 × 1920** (Canvas API)
- Persist across refresh and browser close (`localStorage`)
- Stories expire after **24 hours** (cleanup on load + every 60 seconds)
- Viewer with segmented progress bars and a **15s** auto-advance timer
- Seen rings dim after a story is viewed
- Desktop: left/right half-click to go previous/next; dim backdrop + centered phone frame
- Mobile: horizontal swipe (left = next, right = previous)
- Close via **X**, backdrop click, or end of the last story

## Project structure

```
stories/
├── index.html      # Page markup (tray + viewer)
├── css/styles.css  # Custom styles (rings, viewer frame, progress)
├── js/app.js       # All app logic (storage, upload, tray, viewer, gestures)
└── README.md
```

## How to run

Because the app uses ES modules, open it through a local server (not `file://`):

```bash
# from the stories folder
python3 -m http.server 8765
```

Then visit [http://127.0.0.1:8765](http://127.0.0.1:8765).

Or use any static server (VS Code Live Server, `npx serve`, etc.).

## Usage

1. Click **+** and choose an image
2. The image is cropped to 9:16 and added as a circle in the tray
3. Click a circle to open the viewer (stack starts at that story and continues through older ones)
4. Wait 15s, swipe/click to navigate, or close with X / backdrop

## Data model

Each story in `localStorage` (key: `stories:v1`):

```js
{
  id: number,        // Date.now()
  base64: string,    // cropped image as data URL
  createdAt: number, // upload time (ms)
  seen: boolean
}
```

Array order is **newest first**.

## Tech notes

- Tailwind via CDN; custom CSS in `css/styles.css`
- Single JS file with ES6 arrow functions (`type="module"`)
- No build step, no dependencies beyond the CDN/fonts

## Out of scope

- Backend / auth / multi-user
- Manual delete
- Video stories
