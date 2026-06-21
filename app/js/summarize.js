/* SwimNotes - Summarize page: build prompts, paste-back summary, export */

(function () {
  "use strict";
  var $ = UI.$;

  var meetId = UI.getParam("meet") || SwimNotes.getCurrentMeetId();
  var meet = meetId ? SwimNotes.getMeet(meetId) : SwimNotes.getCurrentMeet();
  var currentKind = "summary";

  function recentMeets(limit) {
    // current meet + others, newest first, capped
    var all = SwimNotes.getMeets();
    return limit ? all.slice(0, limit) : all;
  }

  function buildPrompt(kind) {
    if (!meet) return "No meet selected.";
    if (kind === "summary") return Prompts.meetSummary(meet);
    if (kind === "talking") return Prompts.talkingPoints(recentMeets(4));
    if (kind === "pattern") return Prompts.patternFinder(recentMeets());
    return "";
  }

  function renderPrompt() {
    $("#prompt-box").textContent = buildPrompt(currentKind);
  }

  function exportText() {
    if (!meet) return "";
    var lines = [];
    lines.push("SwimNotes — " + meet.name);
    lines.push("Date: " + (meet.date || ""));
    lines.push("");
    lines.push("RAW NOTES");
    lines.push("=========");
    (meet.events || []).forEach(function (evt, i) {
      lines.push(
        (i + 1) + ". " + evt.name + ": " + ((evt.notes || "").trim() || "(no notes)")
      );
    });
    if ((meet.summary || "").trim()) {
      lines.push("");
      lines.push("AI SUMMARY");
      lines.push("==========");
      lines.push(meet.summary.trim());
    }
    return lines.join("\n");
  }

  function init() {
    if (!meet) {
      $("#meet-label").textContent = "No meet found.";
      $("#prompt-box").textContent =
        "Create a meet and add some notes first.";
      return;
    }

    $("#meet-label").textContent =
      meet.name + " · " + UI.formatDate(meet.date);
    $("#summary").value = meet.summary || "";
    renderPrompt();

    // tabs
    UI.$all(".tab").forEach(function (tab) {
      tab.addEventListener("click", function () {
        UI.$all(".tab").forEach(function (t) {
          t.classList.remove("active");
        });
        tab.classList.add("active");
        currentKind = tab.getAttribute("data-kind");
        renderPrompt();
      });
    });

    // copy prompt
    $("#copy-prompt").addEventListener("click", function () {
      UI.copyText(buildPrompt(currentKind)).then(
        function () {
          UI.toast("Prompt copied — paste into your AI tool");
        },
        function () {
          UI.toast("Couldn't copy — select the text manually");
        }
      );
    });

    $("#open-ai").addEventListener("click", function () {
      // Stash the current prompt for the AI tools page to pick up.
      try {
        sessionStorage.setItem("swimnotes.prompt", buildPrompt(currentKind));
      } catch (e) {}
      window.location.href = "tools.html";
    });

    // save summary
    $("#save-summary").addEventListener("click", function () {
      SwimNotes.saveSummary(meet.id, $("#summary").value);
      meet = SwimNotes.getMeet(meet.id);
      UI.toast("Summary saved");
    });

    // exports
    $("#exp-copy").addEventListener("click", function () {
      UI.copyText(exportText()).then(function () {
        UI.toast("Copied to clipboard");
      });
    });
    $("#exp-email").addEventListener("click", function () {
      UI.emailText("SwimNotes — " + meet.name, exportText());
    });
    $("#exp-download").addEventListener("click", function () {
      var safe = meet.name.replace(/[^a-z0-9]+/gi, "-").toLowerCase();
      UI.downloadFile("swimnotes-" + safe + ".txt", exportText());
      UI.toast("Downloaded");
    });
    var shareBtn = $("#exp-share");
    if (!UI.canShare()) {
      shareBtn.disabled = true;
      shareBtn.title = "Share not supported on this device";
    }
    shareBtn.addEventListener("click", function () {
      UI.shareText("SwimNotes — " + meet.name, exportText()).catch(function () {});
    });

    // carry meet id forward to remind page
    $("#remind-btn").href = "remind.html?meet=" + encodeURIComponent(meet.id);
  }

  document.addEventListener("DOMContentLoaded", init);
})();
