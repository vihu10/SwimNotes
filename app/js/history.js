/* SwimNotes - History page: list past meets, expand to view notes */

(function () {
  "use strict";
  var $ = UI.$;

  // Slide the current page off to the right, then follow the link's href. Pairs
  // with the destination's slide-in-from-left for a smooth left→right handoff.
  function slideOutTo(e) {
    var reduced =
      window.matchMedia &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    var href = this.getAttribute("href");
    if (reduced || !href) return; // navigate normally
    e.preventDefault();
    var appEl = document.querySelector(".app");
    var done = false;
    var go = function () {
      if (done) return;
      done = true;
      window.location.href = href;
    };
    if (!appEl) return go();
    appEl.classList.add("slide-out-right");
    appEl.addEventListener("animationend", go, { once: true });
    setTimeout(go, 500); // fallback if animationend doesn't fire
  }

  function render() {
    var list = $("#list");
    list.innerHTML = "";
    var meets = SwimNotes.getMeets();

    // "Delete all" only makes sense when there's something to delete.
    $("#danger-zone").style.display = meets.length ? "" : "none";

    if (!meets.length) {
      var startBtn = UI.el(
        "a",
        { class: "btn primary", href: "meet.html?new=1" },
        ["Start a meet"]
      );
      startBtn.addEventListener("click", slideOutTo);
      list.appendChild(
        UI.el("div", { class: "empty" }, [
          UI.el("div", { class: "big" }, ["📭"]),
          UI.el("p", {}, ["No meets yet."]),
          startBtn
        ])
      );
      return;
    }

    var currentId = SwimNotes.getCurrentMeetId();

    meets.forEach(function (m) {
      var incomplete = SwimNotes.missingInfo(m).length > 0;
      var pills = [];
      if (incomplete) {
        pills.push(UI.el("span", { class: "pill warn" }, ["In progress"]));
      }
      pills.push(
        UI.el("span", { class: "pill" }, [m.id === currentId ? "Current" : "View"])
      );

      var header = UI.el("div", { class: "row between" }, [
        UI.el("div", {}, [
          UI.el("div", { style: "font-weight:600" }, [
            m.name + (m.id === currentId ? "  " : "")
          ]),
          UI.el("div", { class: "meta" }, [
            UI.formatDate(m.date) +
              " · " +
              m.events.length +
              " event" +
              (m.events.length === 1 ? "" : "s") +
              (m.summary && m.summary.trim() ? " · has summary" : "")
          ])
        ]),
        UI.el("div", { class: "history-pills" }, pills)
      ]);

      var body = UI.el("div", { style: "display:none; margin-top:14px" });
      renderBody(body, m);

      var card = UI.el("div", { class: "card tappable" }, [header, body]);
      header.addEventListener("click", function () {
        body.style.display = body.style.display === "none" ? "" : "none";
      });
      list.appendChild(card);
    });
  }

  function renderBody(body, m) {
    var missing = SwimNotes.missingInfo(m);
    if (missing.length) {
      var note = UI.el("div", { class: "meet-status compact" }, [
        UI.el("div", { class: "meet-status-title" }, ["🚧 In progress"]),
        UI.el("div", { class: "meet-status-sub" }, ["Still needs:"]),
        UI.el(
          "ul",
          { class: "meet-status-list" },
          missing.map(function (item) {
            return UI.el("li", {}, [item]);
          })
        )
      ]);
      body.appendChild(note);
    }

    if (!m.events.length) {
      body.appendChild(UI.el("p", { class: "meta" }, ["No events recorded."]));
    } else {
      m.events.forEach(function (evt) {
        body.appendChild(
          UI.el("div", { class: "event-item" }, [
            UI.el("div", { style: "flex:1" }, [
              UI.el("div", { class: "ev-name" }, [evt.name]),
              UI.el("div", { class: "ev-notes" }, [
                (evt.notes || "").trim() || "(no notes)"
              ])
            ])
          ])
        );
      });
    }

    if (m.summary && m.summary.trim()) {
      body.appendChild(UI.el("h2", { style: "font-size:15px" }, ["AI summary"]));
      body.appendChild(UI.el("div", { class: "ev-notes" }, [m.summary.trim()]));
    }

    var actions = UI.el("div", { class: "btn-grid", style: "margin-top:16px" }, [
      makeBtn("✏️ Edit meet", "primary", function () {
        // Load this meet into the workspace so more events can be added.
        SwimNotes.setCurrentMeetId(m.id);
        window.location.href = "meet.html";
      }),
      makeBtn("Summarize", "", function () {
        window.location.href =
          "summarize.html?meet=" + encodeURIComponent(m.id);
      }),
      makeBtn("Reminder", "", function () {
        window.location.href = "remind.html?meet=" + encodeURIComponent(m.id);
      }),
      makeBtn("Delete", "danger", function () {
        if (confirm('Delete "' + m.name + '" and all its notes?')) {
          SwimNotes.deleteMeet(m.id);
          render();
        }
      })
    ]);
    body.appendChild(actions);
  }

  function makeBtn(label, cls, onClick) {
    var b = UI.el("button", { class: "btn small " + cls }, [label]);
    b.addEventListener("click", function (e) {
      e.stopPropagation();
      onClick();
    });
    return b;
  }

  function setupDeleteAll() {
    var btn = $("#delete-all-btn");
    var dlg = $("#confirm-delete-all");
    if (!btn || !dlg) return;

    function open() {
      if (dlg.showModal) dlg.showModal();
      else dlg.setAttribute("open", "");
    }
    function close() {
      if (dlg.close) dlg.close();
      else dlg.removeAttribute("open");
    }

    btn.addEventListener("click", open);
    $("#confirm-cancel").addEventListener("click", close);
    dlg.addEventListener("cancel", function (e) {
      e.preventDefault(); // close via our handler (also handles Esc)
      close();
    });
    $("#confirm-delete").addEventListener("click", function () {
      SwimNotes.deleteAllMeets();
      close();
      render();
      UI.toast("All meets deleted");
    });
  }

  function init() {
    setupDeleteAll();
    render();
  }

  document.addEventListener("DOMContentLoaded", init);
})();
