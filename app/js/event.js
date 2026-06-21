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

  // Reverse of dropdownName: set the stroke/distance dropdowns from a saved
  // event name (e.g. "100 Freestyle") so editing shows the stored selection.
  function applyNameToSelects(name) {
    var m = name.match(/^(\d+)\s+(.+)$/);
    if (m && STROKES.indexOf(m[2]) !== -1) {
      $("#distance").value = m[1];
      if ($("#distance").value !== m[1]) $("#distance").value = ""; // not a listed distance
      $("#stroke").value = m[2];
      return true;
    }
    if (STROKES.indexOf(name) !== -1) {
      $("#stroke").value = name;
      return true;
    }
    return false;
  }

  // Build the name implied by the dropdowns, e.g. "100 Freestyle" ("" if none).
  function dropdownName() {
    var dist = $("#distance").value;
    var stroke = $("#stroke").value;
    if (!stroke || stroke === "Other") return "";
    return (dist ? dist + " " : "") + stroke;
  }

  // Auto-fill the custom-name field from the dropdowns, but never clobber text
  // the user typed themselves (only overwrite when empty or still our last fill).
  function syncCustomName() {
    var auto = dropdownName();
    var field = $("#custom-name");
    if (auto && (field.value.trim() === "" || field.value === lastAuto)) {
      field.value = auto;
    }
    lastAuto = auto;
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
    var name = composeName();
    if (!name) {
      UI.toast("Pick a stroke (and distance) or type a custom event name");
      $("#custom-name").focus();
      return;
    }
    var notes = $("#notes").value;

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

    // Selecting a stroke/distance auto-fills the custom name (e.g. "100 Freestyle").
    $("#stroke").addEventListener("change", syncCustomName);
    $("#distance").addEventListener("change", syncCustomName);

    renderSuggestions();

    $("#save-btn").addEventListener("click", save);
    $("#cancel-btn").addEventListener("click", function () {
      window.location.href = "meet.html";
    });
    setupVoice();
  }

  document.addEventListener("DOMContentLoaded", init);
})();
