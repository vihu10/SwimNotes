/* SwimNotes - optional practice schedule.
 * Parses an uploaded schedule (.ics / .csv / .txt) into either weekly recurring
 * slots (weekday + time) or explicit dated practices, persists it, and answers
 * "when is the next practice?" so calendar reminders can skip the time prompt. */

(function (global) {
  "use strict";

  var KEY = "swimnotes.schedule";

  var DAY_WORDS = {
    sun: 0, sunday: 0,
    mon: 1, monday: 1,
    tue: 2, tues: 2, tuesday: 2,
    wed: 3, weds: 3, wednesday: 3,
    thu: 4, thur: 4, thurs: 4, thursday: 4,
    fri: 5, friday: 5,
    sat: 6, saturday: 6
  };
  var ICS_DAYS = { SU: 0, MO: 1, TU: 2, WE: 3, TH: 4, FR: 5, SA: 6 };
  var DAY_NAMES = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

  function pad(n) {
    return (n < 10 ? "0" : "") + n;
  }

  // --- persistence ----------------------------------------------------------

  function get() {
    try {
      var raw = localStorage.getItem(KEY);
      return raw ? JSON.parse(raw) : null;
    } catch (e) {
      return null;
    }
  }
  function save(obj) {
    localStorage.setItem(KEY, JSON.stringify(obj));
  }
  function clear() {
    localStorage.removeItem(KEY);
  }
  function has() {
    var s = get();
    return !!(s && (((s.slots || []).length) || ((s.dates || []).length)));
  }

  // --- time parsing ---------------------------------------------------------

  function normalizeTime(h, min, ap) {
    h = parseInt(h, 10);
    min = parseInt(min || "0", 10);
    ap = (ap || "").toLowerCase().replace(/\./g, "");
    if (ap === "pm" && h < 12) h += 12;
    if (ap === "am" && h === 12) h = 0;
    if (isNaN(h) || isNaN(min) || h > 23 || min > 59) return null;
    return pad(h) + ":" + pad(min);
  }

  function timeFromLine(line) {
    var m = line.match(/(\d{1,2}):(\d{2})\s*(a\.?m\.?|p\.?m\.?)?/i);
    if (m) return normalizeTime(m[1], m[2], m[3]);
    m = line.match(/\b(\d{1,2})\s*(a\.?m\.?|p\.?m\.?)\b/i);
    if (m) return normalizeTime(m[1], "0", m[2]);
    return null;
  }

  function dayFromLine(line) {
    var low = line.toLowerCase();
    // try longest names first so "monday" wins over "mon"
    var keys = Object.keys(DAY_WORDS).sort(function (a, b) {
      return b.length - a.length;
    });
    for (var i = 0; i < keys.length; i++) {
      if (new RegExp("\\b" + keys[i] + "\\b").test(low)) return DAY_WORDS[keys[i]];
    }
    return null;
  }

  function dedupeSlots(slots) {
    var seen = {};
    return slots.filter(function (s) {
      var k = s.weekday + "@" + s.time;
      if (seen[k]) return false;
      seen[k] = 1;
      return true;
    });
  }

  // --- parsers --------------------------------------------------------------

  function parseLines(text, filename) {
    var slots = [];
    text.split(/\r?\n/).forEach(function (line) {
      if (!line.trim()) return;
      var day = dayFromLine(line);
      var time = timeFromLine(line);
      if (day !== null && time) {
        slots.push({ weekday: day, time: time, label: line.trim() });
      }
    });
    return { filename: filename, slots: dedupeSlots(slots), dates: [] };
  }

  function localIso(d) {
    return (
      d.getFullYear() + "-" + pad(d.getMonth() + 1) + "-" + pad(d.getDate()) +
      "T" + pad(d.getHours()) + ":" + pad(d.getMinutes()) + ":00"
    );
  }

  function parseIcs(text, filename) {
    var dates = [];
    var slots = [];
    var unfolded = text.replace(/\r?\n[ \t]/g, ""); // unfold continued lines
    var lines = unfolded.split(/\r?\n/);
    var inEvent = false, curStart = null, curRrule = null;

    lines.forEach(function (line) {
      if (/^BEGIN:VEVENT/i.test(line)) {
        inEvent = true; curStart = null; curRrule = null; return;
      }
      if (/^END:VEVENT/i.test(line)) {
        if (curStart) {
          if (curRrule && /FREQ=WEEKLY/i.test(curRrule)) {
            var by = curRrule.match(/BYDAY=([^;]+)/i);
            if (by) {
              by[1].split(",").forEach(function (d) {
                var dd = d.trim().slice(-2).toUpperCase();
                if (ICS_DAYS[dd] !== undefined) {
                  slots.push({ weekday: ICS_DAYS[dd], time: curStart.time, label: "Practice" });
                }
              });
            } else {
              slots.push({ weekday: curStart.weekday, time: curStart.time, label: "Practice" });
            }
          } else {
            dates.push(curStart.iso);
          }
        }
        inEvent = false; return;
      }
      if (!inEvent) return;
      var dm = line.match(/^DTSTART[^:]*:(\d{4})(\d{2})(\d{2})T(\d{2})(\d{2})/i);
      if (dm) {
        var d = new Date(+dm[1], +dm[2] - 1, +dm[3], +dm[4], +dm[5], 0);
        curStart = { iso: localIso(d), time: pad(+dm[4]) + ":" + pad(+dm[5]), weekday: d.getDay() };
        return;
      }
      var rm = line.match(/^RRULE:(.+)/i);
      if (rm) curRrule = rm[1];
    });

    return { filename: filename, slots: dedupeSlots(slots), dates: dates };
  }

  // text auto-detects ICS vs plain lines
  function parse(text, filename) {
    if (/BEGIN:VCALENDAR/i.test(text)) return parseIcs(text, filename);
    return parseLines(text, filename);
  }

  // --- queries --------------------------------------------------------------

  function fromIso(iso) {
    var m = String(iso).match(/(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})/);
    if (!m) return null;
    return new Date(+m[1], +m[2] - 1, +m[3], +m[4], +m[5], 0);
  }

  function nextWeekly(from, weekday, time) {
    var tp = time.split(":");
    var d = new Date(from.getFullYear(), from.getMonth(), from.getDate(), +tp[0], +tp[1], 0);
    var diff = (weekday - d.getDay() + 7) % 7;
    d.setDate(d.getDate() + diff);
    if (d.getTime() <= from.getTime()) d.setDate(d.getDate() + 7);
    return d;
  }

  // earliest upcoming practice after `from` (defaults to now)
  function nextPractice(from) {
    var s = get();
    if (!s) return null;
    var cands = [];
    (s.slots || []).forEach(function (slot) {
      cands.push(nextWeekly(from, slot.weekday, slot.time));
    });
    (s.dates || []).forEach(function (iso) {
      var d = fromIso(iso);
      if (d && d.getTime() > from.getTime()) cands.push(d);
    });
    cands = cands.filter(Boolean).sort(function (a, b) {
      return a.getTime() - b.getTime();
    });
    return cands.length ? cands[0] : null;
  }

  // list of the next n distinct upcoming practices
  function upcoming(n, from) {
    from = from || new Date();
    var out = [];
    var cursor = new Date(from.getTime());
    for (var i = 0; i < (n || 6); i++) {
      var nx = nextPractice(cursor);
      if (!nx) break;
      out.push(nx);
      cursor = new Date(nx.getTime() + 60000);
    }
    return out;
  }

  function summary() {
    var s = get();
    if (!s) return "No schedule uploaded.";
    var parts = [];
    if ((s.slots || []).length) {
      var days = s.slots.map(function (sl) {
        return DAY_NAMES[sl.weekday].slice(0, 3) + " " + sl.time;
      });
      parts.push(days.join(", "));
    }
    if ((s.dates || []).length) {
      parts.push((s.dates.length) + " dated practice" + (s.dates.length === 1 ? "" : "s"));
    }
    return parts.length ? parts.join(" · ") : "Schedule loaded, but no practices found.";
  }

  global.Schedule = {
    get: get,
    save: save,
    clear: clear,
    has: has,
    parse: parse,
    nextPractice: nextPractice,
    upcoming: upcoming,
    summary: summary,
    DAY_NAMES: DAY_NAMES
  };
})(window);
