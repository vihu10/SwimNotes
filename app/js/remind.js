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

  // --- start datetime (schedule slot or manual inputs) ---------------------

  function scheduleActive() {
    return hasSchedule && !manualOverride;
  }

  function getStart() {
    if (scheduleActive()) {
      return fromLocalValue($("#sched-slot").value);
    }
    var dateVal = $("#date").value;
    var timeVal = $("#time").value;
    if (!dateVal || !timeVal) return null; // both must be chosen
    return fromLocalValue(dateVal + "T" + timeVal);
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

    // No schedule => start with date and time blank ("not selected", shows the
    // browser's --:-- / mm-dd-yyyy placeholders). Clear explicitly so a value
    // isn't restored from the browser's form cache when returning to the page.
    $("#date").value = "";
    $("#time").value = "";

    // listeners
    $("#meet-select").addEventListener("change", function () {
      var id = $("#meet-select").value;
      applyMeet(id ? SwimNotes.getMeet(id) : null);
    });

    ["title", "desc", "duration", "alarm", "date", "time", "sched-slot"].forEach(
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
