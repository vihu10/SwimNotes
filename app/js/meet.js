/* SwimNotes - Meet workspace logic (current meet + events) */

(function () {
  "use strict";
  var $ = UI.$;

  var freshMode = false; // arrived via "Add a Meet" — start a brand-new meet

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

  function renderRecent() {
    var wrap = $("#recent-wrap");
    wrap.innerHTML = "";
    if (freshMode) return; // "Add a Meet" should not surface old meets
    var meets = SwimNotes.getMeets();
    if (!meets.length) return;
    wrap.appendChild(UI.el("h2", {}, ["Recent meets"]));
    meets.slice(0, 3).forEach(function (m) {
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
          UI.el("span", { class: "pill" }, ["Open"])
        ])
      ]);
      card.addEventListener("click", function () {
        SwimNotes.setCurrentMeetId(m.id);
        render();
      });
      wrap.appendChild(card);
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
    $("#dlg-date").value = new Date().toISOString().slice(0, 10);
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
      var date = $("#dlg-date").value || new Date().toISOString().slice(0, 10);
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
      // Hold the dialog briefly so the page-transition wave + bubbles are seen
      // first (a modal renders above them and would otherwise hide the reveal).
      var reduced =
        window.matchMedia &&
        window.matchMedia("(prefers-reduced-motion: reduce)").matches;
      if (reduced) openDialog();
      else setTimeout(openDialog, 850);
    } else {
      render();
    }
  }

  document.addEventListener("DOMContentLoaded", init);
})();
