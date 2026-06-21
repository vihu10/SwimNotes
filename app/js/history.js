/* SwimNotes - History page: list past meets, expand to view notes */

(function () {
  "use strict";
  var $ = UI.$;

  function render() {
    var list = $("#list");
    list.innerHTML = "";
    var meets = SwimNotes.getMeets();

    if (!meets.length) {
      list.appendChild(
        UI.el("div", { class: "empty" }, [
          UI.el("div", { class: "big" }, ["📭"]),
          UI.el("p", {}, ["No meets yet."]),
          UI.el("a", { class: "btn primary", href: "index.html" }, [
            "Start a meet"
          ])
        ])
      );
      return;
    }

    var currentId = SwimNotes.getCurrentMeetId();

    meets.forEach(function (m) {
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
        UI.el("span", { class: "pill" }, [m.id === currentId ? "Current" : "View"])
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

  document.addEventListener("DOMContentLoaded", render);
})();
