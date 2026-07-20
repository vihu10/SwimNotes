/* SwimNotes - Meet workspace logic (current meet + events) */

(function () {
  "use strict";
  var $ = UI.$;

  var freshMode = false; // arrived via "Add a Meet" — start a brand-new meet

  // Today's date as "YYYY-MM-DD" in the user's *local* time zone. Using
  // toISOString() here would convert to UTC and can roll the date forward a
  // day for anyone west of GMT in the evening.
  function todayLocal() {
    var d = new Date();
    var pad = function (n) {
      return (n < 10 ? "0" : "") + n;
    };
    return d.getFullYear() + "-" + pad(d.getMonth() + 1) + "-" + pad(d.getDate());
  }

  function render() {
    var meet = SwimNotes.getCurrentMeet();
    var noMeet = $("#no-meet");
    var hasMeet = $("#has-meet");
    var actionbar = $("#actionbar");

    if (!meet) {
      noMeet.style.display = "";
      hasMeet.style.display = "none";
      actionbar.style.display = "none";
      renderRecent();
      // Hide the "No meet in progress" placeholder when there are meets listed
      // below; show it only when there's genuinely nothing.
      var hasListed = $("#recent-wrap").children.length > 0;
      $("#no-meet-empty").style.display = hasListed ? "none" : "";
      return;
    }

    noMeet.style.display = "none";
    hasMeet.style.display = "";
    actionbar.style.display = "";

    $("#meet-name").textContent = meet.name;
    $("#meet-date").textContent = UI.formatDate(meet.date);

    var list = $("#events-list");
    list.innerHTML = "";

    if (!meet.events.length) {
      list.appendChild(
        UI.el("div", { class: "empty" }, [
          UI.el("div", { class: "big" }, ["📝"]),
          UI.el("p", {}, ["No events yet. Add what your coach said."])
        ])
      );
    } else {
      var card = UI.el("div", { class: "card" });
      meet.events.forEach(function (evt) {
        card.appendChild(eventRow(meet.id, evt));
      });
      list.appendChild(card);
    }

    // "In progress" status: list what's still missing before the meet counts
    // as complete (the meet name is not required for this).
    var missing = SwimNotes.missingInfo(meet);
    var statusEl = $("#meet-status");
    if (missing.length) {
      statusEl.style.display = "";
      statusEl.innerHTML = "";
      statusEl.appendChild(
        UI.el("div", { class: "meet-status-title" }, ["🚧 Meet in progress"])
      );
      statusEl.appendChild(
        UI.el("div", { class: "meet-status-sub" }, [
          "Add the following before this meet is complete:"
        ])
      );
      var ul = UI.el("ul", { class: "meet-status-list" });
      missing.forEach(function (item) {
        ul.appendChild(UI.el("li", {}, [item]));
      });
      statusEl.appendChild(ul);
    } else {
      statusEl.style.display = "none";
    }

    // Summarize disabled until there's at least one note
    var hasNotes = meet.events.some(function (e) {
      return (e.notes || "").trim();
    });
    var sBtn = $("#summarize-btn");
    if (hasNotes) {
      sBtn.classList.remove("disabled");
      sBtn.style.pointerEvents = "";
      sBtn.style.opacity = "";
    } else {
      sBtn.style.pointerEvents = "none";
      sBtn.style.opacity = "0.5";
    }
  }

  function eventRow(meetId, evt) {
    var notes = (evt.notes || "").trim();
    var info = UI.el("div", { style: "flex:1; min-width:0; cursor:pointer" }, [
      UI.el("div", { class: "ev-name" }, [evt.name]),
      UI.el("div", { class: "ev-notes" }, [notes || "(no notes — tap to add)"])
    ]);
    info.addEventListener("click", function () {
      window.location.href =
        "event.html?meet=" + encodeURIComponent(meetId) +
        "&event=" + encodeURIComponent(evt.id);
    });

    var del = UI.el("button", {
      class: "btn-icon",
      title: "Delete event",
      "aria-label": "Delete event"
    }, ["🗑"]);
    del.addEventListener("click", function (e) {
      e.stopPropagation();
      if (confirm("Delete \"" + evt.name + "\"?")) {
        SwimNotes.deleteEvent(meetId, evt.id);
        render();
      }
    });

    return UI.el("div", { class: "event-item" }, [info, del]);
  }

  function recentCard(m, inProgress) {
    var card = UI.el("div", { class: "card tappable" }, [
      UI.el("div", { class: "row between" }, [
        UI.el("div", {}, [
          UI.el("div", { style: "font-weight:600" }, [m.name]),
          UI.el("div", { class: "meta" }, [
            UI.formatDate(m.date) +
              " · " +
              m.events.length +
              " event" +
              (m.events.length === 1 ? "" : "s")
          ])
        ]),
        inProgress
          ? UI.el("span", { class: "pill warn" }, ["In progress"])
          : UI.el("span", { class: "pill" }, ["Open"])
      ])
    ]);
    card.addEventListener("click", function () {
      SwimNotes.setCurrentMeetId(m.id);
      render();
    });
    return card;
  }

  function renderRecent() {
    var wrap = $("#recent-wrap");
    wrap.innerHTML = "";
    var meets = SwimNotes.getMeets();
    if (!meets.length) return;

    // On "Add a Meet", still surface any unfinished (in-progress) meets so they
    // can be resumed instead of accidentally starting a duplicate. Completed
    // meets stay hidden here.
    if (freshMode) {
      var inProgress = meets.filter(function (m) {
        return SwimNotes.missingInfo(m).length > 0;
      });
      if (!inProgress.length) return;
      wrap.appendChild(UI.el("h2", {}, ["Meets in progress"]));
      inProgress.forEach(function (m) {
        wrap.appendChild(recentCard(m, true));
      });
      return;
    }

    wrap.appendChild(UI.el("h2", {}, ["Recent meets"]));
    meets.slice(0, 3).forEach(function (m) {
      wrap.appendChild(recentCard(m, SwimNotes.missingInfo(m).length > 0));
    });
    var viewAll = UI.el("a", { class: "btn ghost block", href: "history.html" }, [
      "View all history"
    ]);
    wrap.appendChild(viewAll);
  }

  // --- new meet dialog ------------------------------------------------------

  function openDialog() {
    var dlg = $("#meet-dialog");
    $("#dlg-name").value = "";
    $("#dlg-date").value = todayLocal();
    if (dlg.showModal) dlg.showModal();
    else dlg.setAttribute("open", "");
    setTimeout(function () {
      $("#dlg-name").focus();
    }, 50);
  }
  function closeDialog() {
    var dlg = $("#meet-dialog");
    if (dlg.close) dlg.close();
    else dlg.removeAttribute("open");
  }

  function init() {
    $("#new-meet-empty").addEventListener("click", openDialog);
    $("#new-meet-btn").addEventListener("click", openDialog);
    $("#dlg-cancel").addEventListener("click", closeDialog);
    $("#dlg-create").addEventListener("click", function () {
      var name = $("#dlg-name").value.trim() || "Untitled Meet";
      var date = $("#dlg-date").value || todayLocal();
      SwimNotes.createMeet(name, date);
      closeDialog();
      render();
    });
    $("#meet-dialog").addEventListener("cancel", function () {
      closeDialog();
    });

    // "Add a Meet" (?new=1): clear any current meet and go straight to creating
    // a fresh one — no old/current meet shown.
    if (UI.getParam("new")) {
      freshMode = true;
      SwimNotes.clearCurrentMeetId();
      render();
      var reduced =
        window.matchMedia &&
        window.matchMedia("(prefers-reduced-motion: reduce)").matches;
      // Don't pop the "New Meet" dialog if they've already tapped an in-progress
      // meet to resume it in the meantime.
      var openIfStillFresh = function () {
        if (!SwimNotes.getCurrentMeetId()) openDialog();
      };
      // When arriving from home, hold the dialog briefly so the page-transition
      // wave reveal is seen first (chrome.js marks that wave ".rising-in").
      var fromHomeWave = !!document.querySelector(".wave-bg.rising-in");
      if (reduced) {
        openIfStillFresh();
      } else if (fromHomeWave) {
        setTimeout(openIfStillFresh, 850);
      } else {
        // From anywhere else (e.g. History → "Start a meet"): slide the page in
        // from the left, then pop the dialog once it has settled.
        var appEl = document.querySelector(".app");
        if (appEl) {
          appEl.classList.add("slide-in-left");
          appEl.addEventListener("animationend", function handler() {
            appEl.removeEventListener("animationend", handler);
            appEl.classList.remove("slide-in-left");
          });
        }
        setTimeout(openIfStillFresh, 430);
      }
    } else {
      render();
    }
  }

  document.addEventListener("DOMContentLoaded", init);
})();
