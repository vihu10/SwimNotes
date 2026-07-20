/* SwimNotes - Add-to-calendar page.
 * Pick which meet's feedback to use (blank by default), then either:
 *  - if a practice schedule is uploaded: auto-pick the closest practice (no
 *    time prompt), with the option to choose another slot or go manual; or
 *  - otherwise: ask for a date and time. */

(function () {
  "use strict";
  var $ = UI.$;

  var STOP = {
    the: 1, a: 1, an: 1, and: 1, or: 1, on: 1, in: 1, to: 1, of: 1, too: 1,
    is: 1, was: 1, my: 1, i: 1, it: 1, at: 1, for: 1, with: 1, good: 1,
    said: 1, keep: 1, more: 1, less: 1, very: 1, that: 1, this: 1, be: 1
  };

  var selectedMeet = null;
  var manualOverride = false; // user chose to type a time despite a schedule
  var hasSchedule = false;

  // --- meet -> title/description -------------------------------------------

  function topThemes(meet, limit) {
    if (!meet) return [];
    var counts = {};
    (meet.events || []).forEach(function (evt) {
      (evt.notes || "")
        .toLowerCase()
        .replace(/[^a-z\s]/g, " ")
        .split(/\s+/)
        .forEach(function (w) {
          if (w.length < 3 || STOP[w]) return;
          counts[w] = (counts[w] || 0) + 1;
        });
    });
    return Object.keys(counts)
      .sort(function (a, b) {
        return counts[b] - counts[a];
      })
      .slice(0, limit || 3);
  }

  function titleFor(meet) {
    var themes = topThemes(meet, 3);
    if (themes.length) return "Ask Coach - " + themes.join(", ");
    if (meet) return "Ask Coach about " + meet.name;
    return "Ask my coach";
  }

  function descFor(meet) {
    if (!meet) return "";
    if ((meet.summary || "").trim()) return meet.summary.trim();
    var lines = ["From " + meet.name + ":"];
    (meet.events || []).forEach(function (evt) {
      var n = (evt.notes || "").trim();
      if (n) lines.push("- " + evt.name + ": " + n);
    });
    return lines.length > 1 ? lines.join("\n") : "";
  }

  // --- local datetime helpers ----------------------------------------------

  function pad(n) {
    return (n < 10 ? "0" : "") + n;
  }
  function toLocalValue(d) {
    return (
      d.getFullYear() + "-" + pad(d.getMonth() + 1) + "-" + pad(d.getDate()) +
      "T" + pad(d.getHours()) + ":" + pad(d.getMinutes())
    );
  }
  function fromLocalValue(s) {
    var m = String(s).match(/(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})/);
    if (!m) return null;
    return new Date(+m[1], +m[2] - 1, +m[3], +m[4], +m[5], 0);
  }
  function formatSlot(d) {
    return d.toLocaleString(undefined, {
      weekday: "short",
      month: "short",
      day: "numeric",
      hour: "numeric",
      minute: "2-digit"
    });
  }

  // --- analog-clock time picker --------------------------------------------
  // The field shows the familiar "--:--" until a time is set. Tapping it opens
  // a dialog with a draggable analog clock; the time can also be typed, and
  // AM/PM are two autofill chips (like the event-name suggestions). The value
  // is committed only on "Set time", so the field stays blank until then.

  var SVGNS = "http://www.w3.org/2000/svg";
  var selectedTime = null; // committed "HH:MM" (24h) or null = blank (--:--)
  var clock = null; // built lazily on first picker setup

  function svgEl(tag, attrs) {
    var node = document.createElementNS(SVGNS, tag);
    if (attrs) {
      Object.keys(attrs).forEach(function (k) {
        node.setAttribute(k, attrs[k]);
      });
    }
    return node;
  }

  // normalize to a valid "HH:MM" (24h)
  function clampTime(h24, min) {
    h24 = ((h24 % 24) + 24) % 24;
    min = ((min % 60) + 60) % 60;
    return pad(h24) + ":" + pad(min);
  }

  // "HH:MM" -> { h24, min, h12, pm }
  function split12(hhmm) {
    var mt = /(\d{1,2}):(\d{2})/.exec(hhmm || "");
    var h24 = mt ? +mt[1] : 16; // default 4 PM when nothing chosen yet
    var min = mt ? +mt[2] : 0;
    return { h24: h24, min: min, h12: ((h24 + 11) % 12) + 1, pm: h24 >= 12 };
  }

  // pretty "4:30 PM"
  function fmt12(hhmm) {
    var p = split12(hhmm);
    return p.h12 + ":" + pad(p.min) + " " + (p.pm ? "PM" : "AM");
  }

  // Parse free-form text ("4:30pm", "16:30", "430", "4 30 pm") -> "HH:MM"|null
  function parseTime(str) {
    if (!str) return null;
    var s = String(str).trim().toLowerCase();
    var ap = /([ap])\.?m?\.?$/.exec(s);
    var period = ap ? ap[1] : null;
    if (ap) s = s.slice(0, ap.index).trim();
    var digits = s.replace(/\D/g, "");
    if (!digits) return null;
    var h, m;
    if (s.indexOf(":") >= 0) {
      var parts = s.split(":");
      h = parseInt(parts[0], 10);
      m = parseInt(parts[1], 10);
    } else if (digits.length <= 2) {
      h = parseInt(digits, 10);
      m = 0;
    } else {
      m = parseInt(digits.slice(-2), 10);
      h = parseInt(digits.slice(0, -2), 10);
    }
    if (isNaN(h) || isNaN(m)) return null;
    if (period) {
      if (h < 1 || h > 12) return null;
      h = (h % 12) + (period === "p" ? 12 : 0);
    }
    if (h < 0 || h > 23 || m < 0 || m > 59) return null;
    return pad(h) + ":" + pad(m);
  }

  // Build the SVG clock once. onChange(hhmm) fires while a hand is dragged.
  function buildClock(onChange) {
    var host = $("#clock");
    if (!host) return null;

    var C = 120; // center of the 240x240 viewBox
    var HOUR_LEN = 52;
    var MIN_LEN = 84;

    host.appendChild(svgEl("circle", { cx: C, cy: C, r: 112, class: "clock-face" }));
    for (var i = 1; i <= 12; i++) {
      var a = (i * 30 * Math.PI) / 180;
      var t = svgEl("text", {
        x: C + 90 * Math.sin(a),
        y: C - 90 * Math.cos(a),
        class: "clock-num",
        "text-anchor": "middle",
        "dominant-baseline": "central"
      });
      t.textContent = String(i);
      host.appendChild(t);
    }
    var hourHand = svgEl("line", { x1: C, y1: C, x2: C, y2: C - HOUR_LEN, class: "hand hour" });
    var minHand = svgEl("line", { x1: C, y1: C, x2: C, y2: C - MIN_LEN, class: "hand minute" });
    host.appendChild(hourHand);
    host.appendChild(minHand);
    host.appendChild(svgEl("circle", { cx: C, cy: C, r: 6, class: "clock-center" }));

    var state = { h24: 16, min: 0 };
    var dragging = null; // "hour" | "minute"

    function angleOf(which) {
      var h12 = ((state.h24 + 11) % 12) + 1;
      return which === "minute"
        ? state.min * 6
        : (h12 % 12) * 30 + state.min * 0.5;
    }
    function render() {
      hourHand.setAttribute("transform", "rotate(" + angleOf("hour") + " " + C + " " + C + ")");
      minHand.setAttribute("transform", "rotate(" + angleOf("minute") + " " + C + " " + C + ")");
    }
    function point(e) {
      var r = host.getBoundingClientRect();
      var x = ((e.clientX - r.left) / r.width) * 240;
      var y = ((e.clientY - r.top) / r.height) * 240;
      var dx = x - C;
      var dy = y - C;
      var deg = (Math.atan2(dx, -dy) * 180) / Math.PI;
      if (deg < 0) deg += 360;
      return { x: x, y: y, deg: deg };
    }
    function tip(deg, len) {
      var a = (deg * Math.PI) / 180;
      return { x: C + len * Math.sin(a), y: C - len * Math.cos(a) };
    }
    function applyAngle(which, deg) {
      if (which === "minute") {
        state.min = Math.round(deg / 6) % 60;
      } else {
        var pm = state.h24 >= 12;
        var h12 = Math.round(deg / 30) % 12; // 0..11 (0 means 12)
        state.h24 = ((h12 === 0 ? 12 : h12) % 12) + (pm ? 12 : 0);
      }
      render();
      if (onChange) onChange(clampTime(state.h24, state.min));
    }
    function onMove(e) {
      if (dragging) applyAngle(dragging, point(e).deg);
    }
    function onUp() {
      dragging = null;
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
    }
    host.addEventListener("pointerdown", function (e) {
      e.preventDefault();
      var p = point(e);
      // grab whichever hand's tip is nearer to the pointer
      var ht = tip(angleOf("hour"), HOUR_LEN);
      var mt = tip(angleOf("minute"), MIN_LEN);
      var dh = Math.hypot(p.x - ht.x, p.y - ht.y);
      var dm = Math.hypot(p.x - mt.x, p.y - mt.y);
      dragging = dh <= dm ? "hour" : "minute";
      applyAngle(dragging, p.deg);
      window.addEventListener("pointermove", onMove);
      window.addEventListener("pointerup", onUp);
    });

    render();
    return {
      set: function (hhmm) {
        var p = split12(hhmm);
        state.h24 = p.h24;
        state.min = p.min;
        render();
      },
      value: function () {
        return clampTime(state.h24, state.min);
      }
    };
  }

  function renderTimeField() {
    var disp = $("#time-display");
    if (!disp) return;
    if (selectedTime) {
      disp.textContent = fmt12(selectedTime);
      disp.classList.remove("placeholder");
    } else {
      disp.textContent = "--:--";
      disp.classList.add("placeholder");
    }
  }

  function setupTimePicker() {
    var dlg = $("#time-dialog");
    var field = $("#time-field");
    if (!dlg || !field) return;

    var textInput = $("#time-text");
    var amBtn = dlg.querySelector('[data-ap="AM"]');
    var pmBtn = dlg.querySelector('[data-ap="PM"]');
    var draft = null; // working "HH:MM" while the dialog is open

    function markAmPm() {
      var pm = draft ? split12(draft).pm : false;
      amBtn.classList.toggle("active", !!draft && !pm);
      pmBtn.classList.toggle("active", !!draft && pm);
    }
    // reflect the current draft onto the clock, text field and chips
    function syncFromDraft() {
      clock.set(draft || "16:00");
      textInput.value = draft ? fmt12(draft) : "";
      markAmPm();
    }

    clock = buildClock(function (hhmm) {
      // dragging a hand updates the draft + text without resetting the clock
      draft = hhmm;
      textInput.value = fmt12(hhmm);
      markAmPm();
    });

    // type a time directly
    textInput.addEventListener("input", function () {
      var p = parseTime(textInput.value);
      if (p) {
        draft = p;
        clock.set(p);
        markAmPm();
      }
    });
    textInput.addEventListener("blur", function () {
      if (draft) textInput.value = fmt12(draft); // tidy up on the way out
    });

    // AM / PM autofill chips (same idea as the event-name suggestions)
    function pickPeriod(pm) {
      var p = split12(draft || "16:00");
      draft = clampTime((p.h24 % 12) + (pm ? 12 : 0), p.min);
      syncFromDraft();
    }
    amBtn.addEventListener("click", function () { pickPeriod(false); });
    pmBtn.addEventListener("click", function () { pickPeriod(true); });

    function open() {
      draft = selectedTime; // may be null
      if (dlg.showModal) dlg.showModal();
      else dlg.setAttribute("open", "");
      requestAnimationFrame(syncFromDraft); // needs the dialog laid out first
    }
    function close() {
      if (dlg.close) dlg.close();
      else dlg.removeAttribute("open");
    }

    field.addEventListener("click", open);
    dlg.addEventListener("cancel", function (e) {
      e.preventDefault();
      close();
    });
    $("#time-clear").addEventListener("click", function () {
      selectedTime = null;
      renderTimeField();
      refreshPreview();
      close();
    });
    $("#time-confirm").addEventListener("click", function () {
      selectedTime = parseTime(textInput.value) || draft || clock.value();
      renderTimeField();
      refreshPreview();
      close();
    });
  }

  // --- start datetime (schedule slot or manual inputs) ---------------------

  function scheduleActive() {
    return hasSchedule && !manualOverride;
  }

  function getStart() {
    if (scheduleActive()) {
      return fromLocalValue($("#sched-slot").value);
    }
    var dateVal = $("#date").value;
    if (!dateVal || !selectedTime) return null; // both must be chosen
    return fromLocalValue(dateVal + "T" + selectedTime);
  }

  function buildIcs() {
    var start = getStart();
    if (!start) throw new Error("no start");
    return Ics.build({
      title: $("#title").value || "Ask Coach",
      description: $("#desc").value || "",
      start: start,
      durationMinutes: Number($("#duration").value) || 15,
      alarmMinutes: Number($("#alarm").value)
    });
  }

  function refreshPreview() {
    try {
      $("#preview").textContent = buildIcs();
    } catch (e) {
      $("#preview").textContent = "Choose a meet and a time to preview the reminder.";
    }
  }

  // --- mode (schedule vs manual) -------------------------------------------

  function updateMode() {
    var useSchedule = scheduleActive();
    $("#sched-block").style.display = useSchedule ? "" : "none";
    $("#manual-block").style.display = useSchedule ? "none" : "";
    // Only nudge to upload when there is genuinely no schedule.
    $("#manual-hint").style.display = hasSchedule ? "none" : "";
    refreshPreview();
  }

  // --- voice dictation for notes (Web Speech API, progressive enhancement) --

  function setupDescVoice() {
    var btn = $("#desc-voice-btn");
    var status = $("#desc-voice-status");
    if (!btn) return;
    var SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SR) {
      btn.style.display = "none"; // unsupported browser: just hide it
      return;
    }

    var rec = new SR();
    rec.continuous = true;
    rec.interimResults = true;
    rec.lang = "en-US";
    var listening = false;
    var baseText = "";

    rec.onresult = function (e) {
      var finalText = "";
      var interim = "";
      for (var i = e.resultIndex; i < e.results.length; i++) {
        var t = e.results[i][0].transcript;
        if (e.results[i].isFinal) finalText += t;
        else interim += t;
      }
      if (finalText) {
        baseText = (baseText ? baseText + " " : "") + finalText.trim();
      }
      var sep = baseText && interim ? " " : "";
      $("#desc").value = baseText + sep + interim;
      refreshPreview(); // the description is part of the .ics preview
    };
    rec.onerror = function (e) {
      status.textContent = "Mic error: " + e.error;
      stop();
    };
    rec.onend = function () {
      if (listening) {
        // some browsers auto-stop; restart while the user wants it on
        try { rec.start(); } catch (err) { stop(); }
      }
    };

    function start() {
      baseText = $("#desc").value.trim();
      listening = true;
      btn.classList.add("recording");
      btn.innerHTML = '<span class="rec-dot">●</span> Stop';
      status.textContent = "Listening…";
      try { rec.start(); } catch (err) {}
    }
    function stop() {
      listening = false;
      btn.classList.remove("recording");
      btn.innerHTML = "🎤 Voice note";
      status.textContent = "";
      try { rec.stop(); } catch (err) {}
    }

    btn.addEventListener("click", function () {
      if (listening) stop();
      else start();
    });
    window.addEventListener("beforeunload", stop);
  }

  // --- population -----------------------------------------------------------

  function populateMeetSelect() {
    var sel = $("#meet-select");
    sel.appendChild(UI.el("option", { value: "" }, ["— None (blank reminder) —"]));
    SwimNotes.getMeets().forEach(function (m) {
      sel.appendChild(
        UI.el("option", { value: m.id }, [
          m.name + " · " + UI.formatDate(m.date)
        ])
      );
    });
  }

  function applyMeet(meet) {
    selectedMeet = meet;
    $("#title").value = titleFor(meet);
    $("#desc").value = descFor(meet);
    refreshPreview();
  }

  function populateScheduleSlots() {
    var sel = $("#sched-slot");
    sel.innerHTML = "";
    var slots = Schedule.upcoming(6, new Date());
    if (!slots.length) {
      hasSchedule = false; // schedule exists but no upcoming times -> manual
      return;
    }
    slots.forEach(function (d, i) {
      sel.appendChild(
        UI.el("option", { value: toLocalValue(d) }, [
          formatSlot(d) + (i === 0 ? "  (next practice)" : "")
        ])
      );
    });
    sel.selectedIndex = 0; // auto-pick the closest practice when a schedule exists
  }

  // --- schedule upload dialog ----------------------------------------------

  function updateSchedButton() {
    var btn = $("#open-sched");
    if (!btn) return;
    btn.textContent = Schedule.has() ? "📅 Schedule ✓" : "⬆️ Upload schedule";
  }

  function renderSchedStatus() {
    var box = $("#sched-status");
    var clearBtn = $("#sched-clear");
    var uploadBtn = $("#sched-upload");
    if (!box) return;
    box.innerHTML = "";

    if (!Schedule.has()) {
      clearBtn.style.display = "none";
      uploadBtn.textContent = "⬆️ Choose file";
      box.appendChild(
        UI.el("p", { class: "hint", style: "margin:0 0 8px" }, [
          "No schedule uploaded yet."
        ])
      );
      return;
    }

    clearBtn.style.display = "";
    uploadBtn.textContent = "↻ Replace file";
    var next = Schedule.nextPractice(new Date());
    var rows = [
      UI.el("div", {}, ["✅ Schedule loaded"]),
      UI.el("div", { class: "meta", style: "margin-top:4px" }, [Schedule.summary()])
    ];
    if (next) {
      rows.push(
        UI.el("div", { class: "meta", style: "margin-top:4px" }, [
          "Next practice: " + formatSlot(next)
        ])
      );
    }
    box.appendChild(UI.el("div", { class: "sched-loaded" }, rows));
  }

  // Re-evaluate schedule state and reflect it across the page.
  function refreshSchedule() {
    hasSchedule = Schedule.has();
    manualOverride = false;
    if (hasSchedule) populateScheduleSlots();
    updateSchedButton();
    renderSchedStatus();
    updateMode();
  }

  function handleSchedFile(file) {
    var reader = new FileReader();
    reader.onload = function () {
      var parsed = Schedule.parse(String(reader.result || ""), file.name);
      var count = (parsed.slots || []).length + (parsed.dates || []).length;
      if (!count) {
        UI.toast("Couldn't find any practice times in that file");
        return;
      }
      Schedule.save(parsed);
      refreshSchedule();
      UI.toast("Practice schedule saved");
    };
    reader.onerror = function () {
      UI.toast("Couldn't read that file");
    };
    reader.readAsText(file);
  }

  function setupScheduleDialog() {
    var dlg = $("#sched-dialog");
    var fileInput = $("#sched-file");

    function open() {
      renderSchedStatus();
      if (dlg.showModal) dlg.showModal();
      else dlg.setAttribute("open", "");
    }
    function close() {
      if (dlg.close) dlg.close();
      else dlg.removeAttribute("open");
    }

    $("#open-sched").addEventListener("click", open);
    $("#sched-close").addEventListener("click", close);
    dlg.addEventListener("cancel", function () {
      close();
    });
    $("#sched-upload").addEventListener("click", function () {
      fileInput.click();
    });
    fileInput.addEventListener("change", function () {
      if (fileInput.files && fileInput.files[0]) handleSchedFile(fileInput.files[0]);
      fileInput.value = ""; // allow re-uploading the same file name
    });
    $("#sched-clear").addEventListener("click", function () {
      if (confirm("Remove the uploaded practice schedule?")) {
        Schedule.clear();
        refreshSchedule();
        UI.toast("Schedule removed");
      }
    });
  }

  function init() {
    hasSchedule = Schedule.has();
    if (hasSchedule) populateScheduleSlots();

    populateMeetSelect();

    // preselect a meet if passed in the URL (from Summarize / History)
    var paramMeet = UI.getParam("meet");
    var initialMeet = paramMeet ? SwimNotes.getMeet(paramMeet) : null;
    if (initialMeet) {
      $("#meet-select").value = initialMeet.id;
      applyMeet(initialMeet);
    } else {
      applyMeet(null);
    }

    // No schedule => start with the date blank ("not selected", shows the
    // browser's mm-dd-yyyy placeholder). Clear explicitly so a value isn't
    // restored from the browser's form cache when returning to the page.
    $("#date").value = "";

    // Time starts blank; tapping the field opens the scroll-wheel picker.
    selectedTime = null;
    setupTimePicker();
    renderTimeField();
    setupDescVoice();

    // listeners
    $("#meet-select").addEventListener("change", function () {
      var id = $("#meet-select").value;
      applyMeet(id ? SwimNotes.getMeet(id) : null);
    });

    ["title", "desc", "duration", "alarm", "date", "sched-slot"].forEach(
      function (id) {
        var node = $("#" + id);
        if (node) node.addEventListener("input", refreshPreview);
      }
    );
    $("#sched-slot").addEventListener("change", refreshPreview);

    $("#manual-toggle").addEventListener("click", function (e) {
      e.preventDefault();
      manualOverride = true;
      updateMode();
    });

    // "Upload a practice schedule" nudge: draw attention to the top-right
    // Upload button (highlight only — don't open the dialog for them).
    var gotoSched = $("#goto-sched");
    if (gotoSched) {
      gotoSched.addEventListener("click", function (e) {
        e.preventDefault();
        var btn = $("#open-sched");
        if (!btn) return;
        btn.scrollIntoView({ behavior: "smooth", block: "center" });
        btn.classList.remove("highlight-glow");
        void btn.offsetWidth; // restart the animation if already applied
        btn.classList.add("highlight-glow");
        // The spinning ring is the last thing to finish; clean up after it.
        setTimeout(function () {
          btn.classList.remove("highlight-glow");
        }, 2900);
      });
    }

    setupScheduleDialog();
    updateSchedButton();

    $("#download-ics").addEventListener("click", function () {
      var start = getStart();
      if (!start) {
        UI.toast(scheduleActive() ? "Pick a practice slot" : "Pick a date and time");
        return;
      }
      var title = $("#title").value || "Ask Coach";
      var safe = title.replace(/[^a-z0-9]+/gi, "-").toLowerCase().slice(0, 40);
      var filename = "swimnotes-" + (safe || "reminder") + ".ics";
      var content = buildIcs();
      UI.downloadFile(filename, content, "text/calendar;charset=utf-8");

      // Stash details so the next-steps page can show them + offer re-download.
      try {
        sessionStorage.setItem(
          "swimnotes.lastIcs",
          JSON.stringify({
            filename: filename,
            content: content,
            title: title,
            when: start.toLocaleString(undefined, {
              weekday: "long",
              month: "long",
              day: "numeric",
              hour: "numeric",
              minute: "2-digit"
            })
          })
        );
      } catch (e) {}

      // Open the "how to add it to your calendar" page.
      setTimeout(function () {
        window.location.href = "added.html";
      }, 200);
    });

    updateMode();
  }

  document.addEventListener("DOMContentLoaded", init);
})();
