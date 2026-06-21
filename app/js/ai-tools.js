/* SwimNotes - AI tools launcher.
 * Lists free AI chatbots. Tools that accept a URL query open with the prompt
 * already filled in ("auto paste-in"); the rest get the prompt copied to the
 * clipboard first, then open, so the user can paste it ("copy & paste"). */

(function () {
  "use strict";
  var $ = UI.$;

  // GET-prefill URLs can't be arbitrarily long; beyond this, fall back to copy.
  var MAX_URL = 7000;

  var TOOLS = [
    {
      name: "ChatGPT",
      icon: "🤖",
      auto: true,
      home: "https://chatgpt.com/",
      q: function (p) {
        return "https://chatgpt.com/?q=" + encodeURIComponent(p);
      }
    },
    {
      name: "Google Gemini",
      icon: "♊",
      auto: false,
      home: "https://gemini.google.com/app"
    },
    {
      name: "Claude",
      icon: "✳️",
      auto: true,
      home: "https://claude.ai/new",
      q: function (p) {
        return "https://claude.ai/new?q=" + encodeURIComponent(p);
      }
    }
  ];

  function openTool(tool) {
    var prompt = $("#prompt").value.trim();
    var canAuto = tool.auto && !!prompt && tool.q(prompt).length <= MAX_URL;

    // Copy as a convenient fallback whenever there's a prompt (covers the case
    // where auto-prefill silently fails, and is the path for copy & paste tools).
    if (prompt) UI.copyText(prompt).catch(function () {});

    var url = canAuto ? tool.q(prompt) : tool.home;
    window.open(url, "_blank", "noopener");

    if (canAuto) UI.toast("Opening " + tool.name + " with your prompt");
    else if (prompt) UI.toast("Prompt copied — paste it into " + tool.name);
    else UI.toast("Opening " + tool.name);
  }

  function renderTools() {
    var list = $("#tool-list");
    list.innerHTML = "";
    TOOLS.forEach(function (tool) {
      var tag = tool.auto
        ? UI.el("span", { class: "ac-tag auto" }, ["Auto paste-in"])
        : UI.el("span", { class: "ac-tag manual" }, ["Copy & paste"]);
      var sub = tool.auto
        ? "Opens with your prompt already filled in"
        : "Prompt copied to your clipboard — paste it in";

      var card = UI.el(
        "button",
        { class: "action-card tool-card", type: "button" },
        [
          UI.el("span", { class: "ac-ico" }, [tool.icon]),
          UI.el("span", { class: "ac-text" }, [
            UI.el("span", { class: "ac-title" }, [tool.name + " ", tag]),
            UI.el("span", { class: "ac-sub" }, [sub])
          ]),
          UI.el("span", { class: "ac-arrow" }, ["↗"])
        ]
      );
      card.addEventListener("click", function () {
        openTool(tool);
      });
      list.appendChild(card);
    });
  }

  function init() {
    var prompt = "";
    try {
      prompt = sessionStorage.getItem("swimnotes.prompt") || "";
    } catch (e) {}
    $("#prompt").value = prompt;
    $("#no-prompt-hint").style.display = prompt ? "none" : "";

    $("#prompt").addEventListener("input", function () {
      $("#no-prompt-hint").style.display = $("#prompt").value.trim()
        ? "none"
        : "";
    });

    $("#copy-prompt").addEventListener("click", function () {
      var p = $("#prompt").value.trim();
      if (!p) {
        UI.toast("Nothing to copy yet");
        return;
      }
      UI.copyText(p).then(function () {
        UI.toast("Prompt copied");
      });
    });

    renderTools();
  }

  document.addEventListener("DOMContentLoaded", init);
})();
