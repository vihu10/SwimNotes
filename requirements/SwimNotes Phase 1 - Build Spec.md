# SwimNotes - Phase 1 Build Spec

*Notes + Prompts + Calendar Reminder*

Phase 1 is the simplest possible useful version. Swimmers take notes, get pre-built prompts to summarize them using any free AI tool, export the results, and set a calendar reminder to talk to their coach.

---

## What Phase 1 Does

Four things. That's it:

- **Take Notes:** Swimmer logs raw notes per event at the meet
- **Generate Prompt:** App builds a ready-to-paste prompt with their notes baked in
- **Export:** Copy summary, email it, download it, or share it
- **Set Reminder:** Add a calendar event to talk to coach at next practice

**What Phase 1 does NOT do:**

- No built-in AI (no API key, no cost, no privacy concern)
- No accounts or login
- No server-side storage
- No coach-facing features

---

## User Flow

### Step 1: Take Notes at the Meet

1. Open swimnotes.app on phone (bookmark or home screen)
2. Tap "New Meet" - enter meet name and date
3. For each event: tap "Add Event", select stroke/distance, type or voice-note what coach said
4. Notes save to browser localStorage automatically

Notes can be messy: "breakout 2 deep", "said good turns", "finish head dwn". All fine.

### Step 2: Get Your AI Prompt

After the meet, swimmer taps "Summarize." The app does NOT call any AI. Instead, it:

1. Collects all notes from that meet
2. Inserts them into a pre-written prompt template
3. Shows a "Copy Prompt" button
4. Swimmer pastes into ChatGPT, Gemini, or any free AI chatbot
5. Gets their summary back - then can copy it into the app or their notes

This means: zero API cost, zero API key, zero privacy risk from the app itself. The swimmer chooses which AI tool to use.

### Step 3: Export

Swimmer can export their raw notes or paste their AI summary back:

- Copy to clipboard
- Email to self or parent
- Download as text file
- Share via native share sheet (iMessage, WhatsApp, etc.)

### Step 4: Set Coach Reminder

After reviewing the summary, swimmer taps "Remind Me to Ask Coach." The app:

1. Opens a calendar event creation (using .ics file download)
2. Pre-fills: title = "Ask Coach: [key topics]", time = next practice slot
3. Swimmer confirms and it's on their phone calendar
4. Gets a notification before practice to follow up

No calendar integration needed from the app - just generate a .ics file that the phone's calendar app handles natively.

---

## Prompt Templates

The app pre-builds these prompts with the swimmer's notes embedded. The swimmer just copies and pastes into any AI chatbot.

### Prompt 1: Meet Summary

```
I am a competitive swimmer. Here are raw notes I took from my coach's
feedback at today's swim meet. Please organize them by theme (starts,
turns, finishes, stroke technique, pacing) and highlight anything
mentioned more than once. Only include what is in my notes - do not
add coaching advice.

Meet: [auto-filled]
Date: [auto-filled]

Event 1 - [event name]: [notes]
Event 2 - [event name]: [notes]
Event 3 - [event name]: [notes]
```

### Prompt 2: Talking Points for Coach

```
Based on these swim meet feedback notes from my last few meets, what
are 2-3 specific questions I should ask my coach at my next practice?
Frame them as questions I can ask, not advice for me to follow. Only
reference what is actually in my notes.

[all notes from recent meets auto-filled]
```

### Prompt 3: Pattern Finder

```
Here are my swim meet feedback notes from my last several meets. What
feedback themes keep repeating? List them with how many times each
appeared. Only include patterns that appear 2 or more times. Do not
invent or assume anything not in the notes.

[all historical notes auto-filled]
```

---

## Calendar Reminder Feature

### How It Works (No API Needed)

The app generates a standard .ics calendar file. When the swimmer taps "Add Reminder," their phone downloads the .ics file and prompts them to add it to their calendar app (Apple Calendar, Google Calendar, etc.).

**What the .ics file contains:**

- Title: "Ask Coach about: [top 2-3 feedback themes]"
- Description: The summarized talking points
- Time: Swimmer picks their next practice day/time from a simple picker
- Reminder alert: 30 minutes before

### Sample .ics Output

```
BEGIN:VCALENDAR
BEGIN:VEVENT
SUMMARY:Ask Coach - breakout depth, finish position
DESCRIPTION:From last meet:\n- Breakout too deep (2 events)\n- Keep head down on finish
DTSTART:20260618T160000
DTEND:20260618T161500
BEGIN:VALARM
TRIGGER:-PT30M
ACTION:DISPLAY
END:VALARM
END:VEVENT
END:VCALENDAR
```

No calendar API, no OAuth, no permissions needed. The .ics standard works on every phone.

---

## Technical Spec

### Stack

Use simple HTML, CSS, and Javascript to create a responsive web app that can be used on any device. I will do my own hosting.
### Pages / Screens

| Page | What It Does |
|------|-------------|
| `/` (Home) | Current meet: list of events + "Add Event" button. "Summarize" button at bottom. |
| `/event` | Single event note entry - event selector + text area + voice button |
| `/summarize` | Shows generated prompt + "Copy Prompt" button. Space to paste AI response back. |
| `/history` | List of past meets from localStorage. Tap to view notes. |
| `/remind` | Pick practice day/time + generates .ics download |

### Data Model (localStorage)

```json
{
  "meets": [
    {
      "id": "meet-001",
      "name": "CDST Invitational",
      "date": "2026-06-14",
      "events": [
        {
          "id": "evt-001",
          "name": "100 Fly",
          "notes": "breakout too deep, good turns",
          "timestamp": "2026-06-14T10:30:00"
        }
      ],
      "summary": "(pasted from AI, optional)"
    }
  ]
}
```

---

## Security & Privacy

Phase 1 has the cleanest possible privacy story:

- No server - static site only
- No AI API calls from the app - swimmer uses their own AI tool
- No accounts, no login, no personal data collected
- No analytics or tracking
- Data lives only in the swimmer's browser
- Calendar reminder is a file download - no calendar API access

**Legal status:** COPPA, FERPA, CCPA - none triggered. No data is collected by any operator.

---

## Build Plan

A high schooler can build Phase 1 in two weekends:

- **Day 1:** Set up Next.js + Tailwind. Build the home page and event note entry screen. Wire up localStorage.
- **Day 2:** Build the Summarize page - assemble prompt from notes, copy-to-clipboard button. Add "Paste Summary" field.
- **Day 3:** Build export (email/download/share) and meet history page.
- **Day 4:** Build the calendar reminder (.ics generator). Add practice day/time picker.
- **Day 5:** Deploy to Vercel, test on phone, share link with team.

### Cost

$0. No API keys. No subscriptions. Just a free Vercel account and a GitHub repo.
