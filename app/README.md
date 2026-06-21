# SwimNotes — Phase 1

A static, client-only web app for competitive swimmers to log coach feedback at
meets, generate copy-paste AI prompts, export notes, and set a calendar reminder
to talk to their coach.

**No server. No accounts. No AI API calls. No tracking.** All data lives in the
browser's `localStorage`.

## Run it

It's plain HTML/CSS/JS — no build step.

- **Quickest:** open `index.html` in a browser.
- **Recommended (so voice + clipboard work reliably):** serve over localhost:

  ```sh
  cd app
  python3 -m http.server 8000
  # then visit http://localhost:8000
  ```

## Host it

Upload the contents of this `app/` folder to any static host (Netlify, GitHub
Pages, Cloudflare Pages, S3, or your own server). No configuration required.

## Pages

| File             | Purpose                                                          |
| ---------------- | ---------------------------------------------------------------- |
| `index.html`     | Landing page — welcome, nav buttons, optional schedule upload    |
| `meet.html`      | Meet workspace — current meet, event list, New Meet, Summarize   |
| `event.html`     | Add/edit a single event note (stroke/distance + voice input)     |
| `summarize.html` | Build AI prompts, paste summary back, export (copy/email/etc)    |
| `tools.html`     | Launch a free AI chatbot with the prompt auto-filled or copied   |
| `history.html`   | Past meets from localStorage                                     |
| `remind.html`    | Pick a meet's feedback + time → download `.ics` calendar reminder |

## Landing page & calendar

- **Landing page** (`index.html`) — an intro page with a big centered hero
  header, Features and How-it-works sections, an optional schedule upload, and a
  security statement. The hero's three theme-matched buttons are the entry
  points: **Add a Meet** → `meet.html`, **See Existing Meets** → `history.html`,
  and **Add to Calendar** → `remind.html`.
- **Dynamic "dive" background** — the landing page sits over a water gradient;
  scrolling deepens a fixed darkening overlay (`#depth-overlay`, driven by scroll
  progress in `landing.js`) so you descend from the sunlit surface into the
  abyss as you read. Rising bubbles add life; honors `prefers-reduced-motion`.
- **Calendar from feedback** — on `remind.html` you pick which meet's feedback to
  use from a dropdown (blank by default), which auto-fills the title and talking
  points. You're always asked for a **time** (date + time inputs).
- **Optional practice schedule** — upload a schedule from the **Upload schedule**
  button at the top of the calendar page (`remind.html`), which opens a centered
  dialog accepting `.ics`, `.csv`, or `.txt`. Once uploaded, the calendar page
  skips the time prompt and auto-selects your **closest upcoming practice**
  instead (with the option to choose another slot or enter a time manually).
- **Blank dropdowns** — every dropdown (event stroke/distance, calendar meet
  picker) defaults to an unselected placeholder, with inline guidance on how and
  where to set or later edit the value.
- **Dropdown auto-names the event** — choosing a stroke/distance (e.g. `100` +
  `Freestyle`) fills the custom-name field with `100 Freestyle`. Typing your own
  name is preserved and won't be overwritten by later dropdown changes.
- **Randomized note suggestions** — the event page draws from a pool of ~18
  example coach-feedback notes, randomizing the placeholder and a set of
  tap-to-add example chips on every visit.

## AI tools page

The **Open an AI tool** button on Summarize stashes the current prompt (in
`sessionStorage`) and opens `tools.html`, which lists free chatbots:

- **Auto paste-in** (ChatGPT, Claude, Perplexity) — opens the tool with the
  prompt prefilled via a URL query (`?q=…`); just review and send.
- **Copy & paste** (Gemini, Copilot, Meta AI) — copies the prompt to your
  clipboard first, then opens the tool so you can paste it.
- Each tool shows a tag/subdescription stating which behavior applies. The
  prompt is editable on the page, and very long prompts fall back to copy &
  paste (URL-length safe).

## UI / responsiveness

- **Responsive** mobile → tablet → desktop via a fluid container with breakpoints
  at 600px and 1024px. Inputs use ≥16px text to avoid iOS zoom-on-focus.
- **Light / dark mode** toggle switch in the top bar of every page. The choice is
  saved to `localStorage`; first visit follows the OS `prefers-color-scheme`. An
  inline `<head>` snippet applies the theme before paint to avoid a flash.
- **Animated wave background** — a subtle, slow, layered SVG wave fixed behind the
  content. Colors adapt per theme and it honors `prefers-reduced-motion`.
- **Expanding dialog** — tapping **New Meet** opens a dialog that expands to fill
  the whole device on phones (full-screen sheet) and is a centered modal on
  tablet/desktop.

## Code layout

```
app/
├── index.html (landing), meet.html, event.html, summarize.html,
│   tools.html, history.html, remind.html
├── css/styles.css   # themes, responsive rules, waves, toggle, modal, landing
└── js/
    ├── storage.js   # localStorage data layer (single source of truth)
    ├── util.js      # DOM helpers, toast, clipboard, download, share, email
    ├── chrome.js    # injects wave background + theme toggle; persists theme
    ├── schedule.js  # parse/store practice schedule; "next practice" query
    ├── prompts.js   # the three prompt templates
    ├── ics.js       # RFC 5545 .ics generator
    └── landing.js / meet.js / event.js / summarize.js / tools.js /
        history.js / remind.js
```

## Notes on the three optional/native features

- **Voice notes** use the Web Speech API (`webkitSpeechRecognition`). Supported
  in Chrome/Safari; the button hides itself where unsupported.
- **Share** uses the Web Share API (`navigator.share`); the button is disabled
  where unsupported. Copy/Email/Download always work.
- **Calendar** uses a downloaded `.ics` file with a 30-min `VALARM` — opened by
  the phone's native calendar app. No calendar API or OAuth.
