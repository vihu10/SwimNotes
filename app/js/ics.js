/* SwimNotes - .ics calendar file generator (RFC 5545, minimal).
 * No calendar API / OAuth. Just produce a file the phone's calendar opens. */

(function (global) {
  "use strict";

  // Escape per RFC 5545 text rule: backslash, comma, semicolon, newline.
  function escIcs(text) {
    return String(text == null ? "" : text)
      .replace(/\\/g, "\\\\")
      .replace(/;/g, "\\;")
      .replace(/,/g, "\\,")
      .replace(/\r?\n/g, "\\n");
  }

  // Format a local Date as floating local time: YYYYMMDDTHHMMSS
  function fmtLocal(d) {
    function p(n) {
      return (n < 10 ? "0" : "") + n;
    }
    return (
      d.getFullYear() +
      p(d.getMonth() + 1) +
      p(d.getDate()) +
      "T" +
      p(d.getHours()) +
      p(d.getMinutes()) +
      p(d.getSeconds())
    );
  }

  // Format UTC timestamp for DTSTAMP: YYYYMMDDTHHMMSSZ
  function fmtUtc(d) {
    function p(n) {
      return (n < 10 ? "0" : "") + n;
    }
    return (
      d.getUTCFullYear() +
      p(d.getUTCMonth() + 1) +
      p(d.getUTCDate()) +
      "T" +
      p(d.getUTCHours()) +
      p(d.getUTCMinutes()) +
      p(d.getUTCSeconds()) +
      "Z"
    );
  }

  // Fold long lines to 75 octets (simple char-based fold is fine for ASCII-ish).
  function fold(line) {
    if (line.length <= 75) return line;
    var out = line.slice(0, 75);
    var rest = line.slice(75);
    while (rest.length > 74) {
      out += "\r\n " + rest.slice(0, 74);
      rest = rest.slice(74);
    }
    out += "\r\n " + rest;
    return out;
  }

  /* opts: { title, description, start: Date, durationMinutes, alarmMinutes } */
  function build(opts) {
    var start = opts.start;
    var dur = opts.durationMinutes || 15;
    var end = new Date(start.getTime() + dur * 60000);
    var alarm = opts.alarmMinutes == null ? 30 : opts.alarmMinutes;
    var uid =
      "swimnotes-" +
      Date.now().toString(36) +
      "-" +
      Math.random().toString(36).slice(2, 8) +
      "@swimnotes.app";

    var lines = [
      "BEGIN:VCALENDAR",
      "VERSION:2.0",
      "PRODID:-//SwimNotes//Phase1//EN",
      "CALSCALE:GREGORIAN",
      "BEGIN:VEVENT",
      "UID:" + uid,
      "DTSTAMP:" + fmtUtc(new Date()),
      "DTSTART:" + fmtLocal(start),
      "DTEND:" + fmtLocal(end),
      "SUMMARY:" + escIcs(opts.title || "Ask Coach"),
      "DESCRIPTION:" + escIcs(opts.description || ""),
      "BEGIN:VALARM",
      "TRIGGER:-PT" + alarm + "M",
      "ACTION:DISPLAY",
      "DESCRIPTION:" + escIcs(opts.title || "Ask Coach"),
      "END:VALARM",
      "END:VEVENT",
      "END:VCALENDAR"
    ];

    return lines.map(fold).join("\r\n");
  }

  global.Ics = { build: build };
})(window);
