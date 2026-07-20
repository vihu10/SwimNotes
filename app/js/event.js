/* SwimNotes - Event note entry (create or edit) */

(function () {
  "use strict";
  var $ = UI.$;

  var STROKES = [
    "Freestyle",
    "Backstroke",
    "Breaststroke",
    "Butterfly",
    "IM",
    "Relay",
    "Other"
  ];
  var DISTANCES = ["25", "50", "100", "200", "400", "500", "800", "1500"];

  // Shorthand people type for the four stroke names.
  var STROKE_ALIASES = {
    free: "Freestyle",
    back: "Backstroke",
    fly: "Butterfly",
    breast: "Breaststroke"
  };

  // Pool of example coach-feedback notes. A randomized subset is shown each
  // time the page opens, both as the placeholder and as tap-to-add chips.
  var FEEDBACK_EXAMPLES = [
    "breakout too deep, good turns",
    "finish head down, didn't breathe into the wall",
    "great start reaction, hold streamline longer off the blocks",
    "catching too early on free, fix the catch",
    "back half died, work on pacing the 200",
    "underwaters strong, careful not to pass 15m",
    "breaststroke pullout timing was late",
    "fly arms crossing over, widen the entry",
    "flip turns too far from the wall",
    "good tempo, drop the head on freestyle",
    "more dolphin kick off every wall",
    "negative split the back half next time",
    "hands slipping on the catch, anchor better",
    "strong finish, don't glide into the wall",
    "tighten the streamline, lose the gap",
    "breathing pattern off on the 100, try every 3",
    "faster tempo on the back end",
    "kick more on the last 25"
  ];

  function shuffle(arr) {
    var a = arr.slice();
    for (var i = a.length - 1; i > 0; i--) {
      var j = Math.floor(Math.random() * (i + 1));
      var tmp = a[i];
      a[i] = a[j];
      a[j] = tmp;
    }
    return a;
  }

  var meetId = UI.getParam("meet") || SwimNotes.getCurrentMeetId();
  var eventId = UI.getParam("event");
  var editing = !!eventId;
  var lastAuto = ""; // last value the dropdowns auto-filled into custom name

  function fillSelect(sel, items, placeholder) {
    // blank/placeholder option is selected by default (nothing pre-chosen)
    sel.appendChild(UI.el("option", { value: "" }, [placeholder]));
    items.forEach(function (v) {
      sel.appendChild(UI.el("option", { value: v }, [v]));
    });
  }

  // Returns the event name, or null if the user hasn't chosen enough yet.
  function composeName() {
    var custom = $("#custom-name").value.trim();
    if (custom) return custom;
    var dist = $("#distance").value; // "" when none selected
    var stroke = $("#stroke").value; // "" when none selected
    if (!stroke) return null; // nothing picked and no custom name
    if (stroke === "Other") return null; // "Other" needs a custom name
    return (dist ? dist + " " : "") + stroke;
  }

  // Canonical stroke for a case-insensitive match ("freestyle"/"free" ->
  // "Freestyle"), or null. "Other" is excluded: it isn't a real event name on
  // its own.
  function canonStroke(s) {
    s = s.trim().toLowerCase();
    if (!s) return null;
    for (var i = 0; i < STROKES.length; i++) {
      if (STROKES[i] === "Other") continue;
      if (STROKES[i].toLowerCase() === s) return STROKES[i];
    }
    return STROKE_ALIASES[s] || null;
  }

  // Parse a typed name into dropdown values, case-insensitively and in either
  // order. Each part alone is fine, and distance/stroke can come in any order:
  // "100", "freestyle", "100 free" and "free 100" all work. Returns
  // { dist, stroke } (each "" if absent), or null when the text can't be any
  // possible event — e.g. "asdf", "300" / "300 Freestyle" (300 isn't a listed
  // distance), "100 xyz", or two of the same kind ("100 200").
  function parseName(name) {
    name = (name || "").trim();
    if (!name) return null;
    var tokens = name.split(/\s+/);
    if (tokens.length > 2) return null;
    var dist = "";
    var stroke = "";
    for (var i = 0; i < tokens.length; i++) {
      var t = tokens[i];
      if (/^\d+$/.test(t)) {
        if (DISTANCES.indexOf(t) === -1 || dist) return null; // bad/duplicate distance
        dist = t;
      } else {
        var st = canonStroke(t);
        if (!st || stroke) return null; // bad/duplicate stroke
        stroke = st;
      }
    }
    if (!dist && !stroke) return null;
    return { dist: dist, stroke: stroke };
  }

  // Reverse of dropdownName: set the stroke/distance dropdowns from a name
  // (e.g. "100 Freestyle") so editing/typing reflects the selection. Returns
  // whether the name mapped to a real combination.
  function applyNameToSelects(name) {
    var parsed = parseName(name);
    $("#stroke").value = parsed ? parsed.stroke : "";
    $("#distance").value = parsed ? parsed.dist : "";
    return !!parsed;
  }

  // Build the name implied by the dropdowns, e.g. "100 Freestyle" ("" if none).
  function dropdownName() {
    var dist = $("#distance").value;
    var stroke = $("#stroke").value;
    if (!stroke || stroke === "Other") return "";
    return (dist ? dist + " " : "") + stroke;
  }

  // Dropdown -> custom name. The dropdowns have priority, so whenever they name
  // a full event (e.g. "100 Freestyle") that name replaces the custom field,
  // even if the user had typed something else. Picking a distance without a
  // stroke (or "Other") yields no name, so we leave whatever's typed alone.
  function syncCustomName() {
    var auto = dropdownName();
    if (auto) $("#custom-name").value = auto;
    lastAuto = auto;
  }

  // Custom name -> dropdowns. Scans the typed words in any order and fills each
  // picker from whichever word is a valid distance / stroke (alias-aware, not
  // case-sensitive). Unknown or incomplete words are ignored, so typing one part
  // never clears the other. No error fires here; that only happens on blur.
  function syncSelectsFromCustom() {
    var tokens = $("#custom-name").value.trim().split(/\s+/);
    var dist = "";
    var stroke = "";
    tokens.forEach(function (t) {
      if (DISTANCES.indexOf(t) !== -1) dist = t;
      else {
        var st = canonStroke(t);
        if (st) stroke = st;
      }
    });
    $("#distance").value = dist;
    $("#stroke").value = stroke;
    lastAuto = dropdownName();
  }

  // On blur: a valid name is normalized to canonical casing ("freestyle" ->
  // "Freestyle"); text that can't be any possible event runs the red trace +
  // blur + message, then clears the field once the light finishes going around.
  function validateCustomName() {
    var wrap = $("#custom-name-wrap");
    var field = $("#custom-name");
    var val = field.value.trim();
    if (!val) return; // empty -> nothing to do

    var parsed = parseName(val);
    if (parsed) {
      $("#stroke").value = parsed.stroke;
      $("#distance").value = parsed.dist;
      // canonical form, keeping whichever part was given ("100", "Freestyle",
      // or "100 Freestyle") so a distance-only entry isn't wiped.
      var canon = [parsed.dist, parsed.stroke].filter(Boolean).join(" ");
      field.value = canon;
      lastAuto = canon;
      return;
    }

    wrap.classList.remove("invalid-flash");
    void wrap.offsetWidth; // restart the animation if re-triggered
    wrap.classList.add("invalid-flash");
    // guard-trace runs 0.9s x2 = 1.8s; clear once the light has gone around.
    setTimeout(function () {
      wrap.classList.remove("invalid-flash");
      field.value = "";
      syncSelectsFromCustom(); // reset the (already empty) pickers + lastAuto
    }, 1800);
  }

  // Same red trace + blur + message on the notes field to prompt for feedback.
  // Nothing is cleared here (unlike the name field) — the box is already empty.
  function flashNotes() {
    var wrap = $("#notes-wrap");
    wrap.classList.remove("invalid-flash");
    void wrap.offsetWidth; // restart the animation if re-triggered
    wrap.classList.add("invalid-flash");
    setTimeout(function () {
      wrap.classList.remove("invalid-flash");
    }, 1800);
  }

  // Randomized coach-note suggestions: a fresh placeholder + chips each open.
  function renderSuggestions() {
    var picks = shuffle(FEEDBACK_EXAMPLES);
    $("#notes").setAttribute(
      "placeholder",
      picks.slice(0, 2).join(", ") + "…"
    );

    var wrap = $("#suggestions");
    if (!wrap) return;
    wrap.innerHTML = "";
    picks.slice(0, 4).forEach(function (text) {
      var chip = UI.el("button", { class: "chip", type: "button" }, [text]);
      chip.addEventListener("click", function () {
        var notes = $("#notes");
        notes.value = notes.value.trim()
          ? notes.value.replace(/\s*$/, "") + ", " + text
          : text;
        notes.focus();
      });
      wrap.appendChild(chip);
    });
  }

  function save() {
    // Don't let an impossible custom name through — flag it like a blur does.
    var custom = $("#custom-name").value.trim();
    if (custom && !parseName(custom)) {
      validateCustomName();
      return;
    }
    var name = composeName();
    if (!name) {
      UI.toast("Pick a stroke (and distance) or type a custom event name");
      $("#custom-name").focus();
      return;
    }
    var notes = $("#notes").value;
    if (!notes.trim()) {
      flashNotes();
      $("#notes").focus();
      return;
    }

    if (!meetId) {
      // No meet exists — create a quick one so notes aren't lost.
      var m = SwimNotes.createMeet("Untitled Meet", null);
      meetId = m.id;
    }

    if (editing) {
      SwimNotes.updateEvent(meetId, eventId, { name: name, notes: notes });
    } else {
      SwimNotes.addEvent(meetId, name, notes);
    }
    window.location.href = "meet.html";
  }

  // --- voice (Web Speech API, progressive enhancement) ---------------------

  function setupVoice() {
    var btn = $("#voice-btn");
    var status = $("#voice-status");
    var SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SR) {
      btn.style.display = "none";
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
      $("#notes").value = baseText + sep + interim;
    };
    rec.onerror = function (e) {
      status.textContent = "Mic error: " + e.error;
      stop();
    };
    rec.onend = function () {
      if (listening) {
        // some browsers auto-stop; restart while user wants it on
        try { rec.start(); } catch (err) { stop(); }
      }
    };

    function start() {
      baseText = $("#notes").value.trim();
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

  function init() {
    fillSelect($("#stroke"), STROKES, "— Select stroke —");
    fillSelect($("#distance"), DISTANCES, "— Select distance (optional) —");

    var meet = meetId ? SwimNotes.getMeet(meetId) : null;
    $("#meet-label").textContent = meet
      ? meet.name + " · " + UI.formatDate(meet.date)
      : "New meet will be created on save";

    if (editing) {
      var evt = SwimNotes.getEvent(meetId, eventId);
      if (evt) {
        $("#page-title").textContent = "Edit Event";
        $("#custom-name").value = evt.name;
        lastAuto = evt.name; // treat existing name as auto so dropdowns can update it
        applyNameToSelects(evt.name); // dropdowns hold the saved selection
        $("#notes").value = evt.notes || "";
        $("#save-btn").textContent = "Update Event";
      }
    }

    // Two-way binding between the pickers and the custom-name field. Selecting a
    // stroke/distance fills the name; typing a name matches it back onto the
    // pickers. The dropdown wins when both are set (its change fires last).
    $("#stroke").addEventListener("change", syncCustomName);
    $("#distance").addEventListener("change", syncCustomName);
    $("#custom-name").addEventListener("input", syncSelectsFromCustom);
    $("#custom-name").addEventListener("blur", validateCustomName);

    // Clear the "please input feedback" flash as soon as they start typing.
    $("#notes").addEventListener("input", function () {
      $("#notes-wrap").classList.remove("invalid-flash");
    });

    renderSuggestions();

    $("#save-btn").addEventListener("click", save);
    $("#cancel-btn").addEventListener("click", function () {
      window.location.href = "meet.html";
    });
    setupVoice();
  }

  document.addEventListener("DOMContentLoaded", init);
})();
