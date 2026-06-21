/* SwimNotes - shared app chrome: animated wave background + theme toggle.
 * Injected on every page so markup stays DRY. Theme persists in localStorage.
 * NOTE: an inline <head> snippet sets data-theme before paint to avoid a flash;
 * this file wires up the toggle and renders the chrome. */

(function () {
  "use strict";

  var THEME_KEY = "swimnotes.theme";

  function currentTheme() {
    return document.documentElement.getAttribute("data-theme") || "dark";
  }

  function applyTheme(theme) {
    document.documentElement.setAttribute("data-theme", theme);
    try {
      localStorage.setItem(THEME_KEY, theme);
    } catch (e) {}

    var meta = document.querySelector('meta[name="theme-color"]');
    if (meta) meta.setAttribute("content", theme === "light" ? "#e9f1fb" : "#0e1726");

    var btn = document.querySelector(".theme-toggle");
    if (btn) btn.setAttribute("aria-checked", theme === "dark" ? "true" : "false");
  }

  function injectWaves() {
    if (document.querySelector(".wave-bg")) return;
    var wrap = document.createElement("div");
    wrap.className = "wave-bg";
    // Rise the background wave up from the bottom only when arriving from the
    // home page (home -> other). Page-to-page navigation gets no transition.
    if (
      !prefersReduced &&
      !document.body.classList.contains("landing") &&
      cameFromHome()
    ) {
      wrap.className += " rising-in";
    }
    wrap.setAttribute("aria-hidden", "true");
    // Classic layered SVG wave; four <use> layers drift at different speeds.
    wrap.innerHTML =
      '<svg class="waves" viewBox="0 24 150 28" preserveAspectRatio="none" ' +
      'shape-rendering="auto">' +
      '<defs><path id="swim-wave" d="M-160 44c30 0 58-18 88-18s58 18 88 18 ' +
      "58-18 88-18 58 18 88 18 v44h-352z\"/></defs>" +
      '<g class="wave-parallax">' +
      '<use href="#swim-wave" xlink:href="#swim-wave" x="48" y="0"/>' +
      '<use href="#swim-wave" xlink:href="#swim-wave" x="48" y="3"/>' +
      '<use href="#swim-wave" xlink:href="#swim-wave" x="48" y="5"/>' +
      '<use href="#swim-wave" xlink:href="#swim-wave" x="48" y="7"/>' +
      "</g></svg>";

    // Resume each drift layer at the shared phase so the wave looks unchanged
    // across page navigations (no restart/jump).
    if (!prefersReduced) {
      var uses = wrap.querySelectorAll(".wave-parallax > use");
      for (var i = 0; i < uses.length; i++) {
        uses[i].style.animationDelay = resumeDelay(WAVE_DURS[i], WAVE_OFFS[i]);
      }
    }

    document.body.insertBefore(wrap, document.body.firstChild);
  }

  var prefersReduced =
    window.matchMedia &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  // True once if we just navigated here from the home page (consumes the flag).
  function cameFromHome() {
    try {
      if (sessionStorage.getItem("swimnotes.fromHome") === "1") {
        sessionStorage.removeItem("swimnotes.fromHome");
        return true;
      }
    } catch (e) {}
    return false;
  }

  // Shared time origin so the background wave + bubbles keep the SAME phase
  // across page loads — switching pages looks like only the content changes.
  function bgElapsed() {
    var key = "swimnotes.bgEpoch";
    var t;
    try {
      t = parseInt(sessionStorage.getItem(key), 10);
      if (!t || isNaN(t)) {
        t = Date.now();
        sessionStorage.setItem(key, String(t));
      }
    } catch (e) {
      t = Date.now();
    }
    return (Date.now() - t) / 1000; // seconds since the session's first page
  }

  // Negative animation-delay that resumes a loop of `dur`s at the shared phase.
  function resumeDelay(dur, offset) {
    var phase = (bgElapsed() + (offset || 0)) % dur;
    return "-" + phase.toFixed(3) + "s";
  }

  // Wave drift layer timings (must match the CSS .wave-parallax > use rules).
  var WAVE_DURS = [9, 13, 17, 24];
  var WAVE_OFFS = [2, 3, 4, 5];

  // Fixed bubble layout — identical on every page so the background matches.
  var BUBBLES = [
    { left: 12, size: 9, dur: 15 },
    { left: 31, size: 6, dur: 12 },
    { left: 49, size: 12, dur: 18 },
    { left: 67, size: 7, dur: 13 },
    { left: 85, size: 10, dur: 16 }
  ];

  // Rising bubbles on every page. The landing page has its own (more) set baked
  // into its #water-bg, so here we add a fixed, lighter set to the other pages.
  // The layout is identical on every page and resumes at the shared phase, so
  // the background looks the same when you switch pages.
  function injectBubbles() {
    if (document.body.classList.contains("landing")) return;
    if (document.querySelector(".bubbles")) return;
    var wrap = document.createElement("div");
    wrap.className = "bubbles";
    wrap.setAttribute("aria-hidden", "true");
    var html = "";
    for (var i = 0; i < BUBBLES.length; i++) {
      var b = BUBBLES[i];
      var delay = resumeDelay(b.dur, i * 3); // staggered, phase-continued
      html +=
        '<span class="bubble" style="left:' + b.left + "%;width:" + b.size +
        "px;height:" + b.size + "px;animation-duration:" + b.dur +
        "s;animation-delay:" + delay + '"></span>';
    }
    wrap.innerHTML = html;
    document.body.appendChild(wrap);
  }

  // Wave transition only for home <-> other-page navigation:
  //  - leaving home: flag the destination so it rises its wave in;
  //  - heading home from another page: slide that page's wave down first.
  // Everything else (page <-> page) navigates with no wave animation.
  function setupNav() {
    if (prefersReduced) return;
    var isLanding = document.body.classList.contains("landing");

    document.addEventListener("click", function (e) {
      if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey) return;
      var a = e.target.closest ? e.target.closest("a") : null;
      if (!a) return;
      var href = a.getAttribute("href");
      if (!href || a.target === "_blank" || a.hasAttribute("download")) return;
      if (!/\.html(\?|#|$)/i.test(href)) return; // internal page nav only

      var goingHome =
        href === "index.html" || /(^|\/)index\.html(\?|#|$)/i.test(href);

      if (isLanding && !goingHome) {
        // home -> other: let the destination rise its wave in
        try {
          sessionStorage.setItem("swimnotes.fromHome", "1");
        } catch (e2) {}
        return; // navigate normally
      }

      if (!isLanding && goingHome) {
        // other -> home: slide this page's wave down, then go
        var wave = document.querySelector(".wave-bg");
        if (!wave) return;
        e.preventDefault();
        wave.classList.remove("rising-in");
        wave.classList.add("falling-out");
        setTimeout(function () {
          window.location.href = href;
        }, 500);
      }
      // other -> other (and home -> home): no transition
    });
  }

  // "How it works" popup explaining the (server-less) backend, with a
  // toggleable flowchart of the same information.
  var INFO_HTML =
    '<h2 style="margin-top:0">How SwimNotes works</h2>' +
    '<p class="hint" style="margin-top:0">The short version: there is no backend. Everything runs in your browser and stays on your device.</p>' +
    '<div class="info-toolbar"><button class="btn small" id="info-toggle">📊 View flowchart</button></div>' +

    '<div id="info-desc" class="info-panel">' +
    "<h3>Where your data lives</h3>" +
    "<p>SwimNotes is a <strong>static web app</strong> &mdash; just HTML, CSS, and JavaScript running in your browser. There is no server and no database behind it.</p>" +
    "<ul>" +
    "<li>Your meets, events, notes, and pasted summaries are saved in your browser's <strong>local storage</strong>, on this device only.</li>" +
    "<li>Your light/dark choice and any uploaded practice schedule are saved the same way.</li>" +
    "<li>Nothing is uploaded &mdash; no accounts, no logins, no analytics, no tracking.</li>" +
    "</ul>" +
    "<h3>How the AI part works</h3>" +
    "<p>The app <strong>never calls an AI itself</strong>. It builds a ready-to-paste prompt from your notes; you pick a free AI tool (ChatGPT, Claude, Gemini&hellip;), paste it in, and paste the answer back. No API keys, no AI costs.</p>" +
    "<h3>Reminders &amp; schedule</h3>" +
    "<p>Calendar reminders are generated as a standard <strong>.ics file</strong> in your browser and downloaded &mdash; no calendar account or permission needed. An uploaded practice schedule is parsed locally to pick your next practice time.</p>" +
    "<h3>What this means for you</h3>" +
    "<ul>" +
    "<li>Your feedback is private by default &mdash; it never leaves your device unless you export or share it.</li>" +
    "<li>Because no operator collects data, rules like COPPA, FERPA, and CCPA aren't triggered.</li>" +
    "<li>Clearing browser data (or using another browser/device) starts you fresh &mdash; use Export to back up.</li>" +
    "</ul>" +
    "</div>" +

    '<div id="info-flow" class="info-panel" style="display:none">' +
    '<div class="flow">' +
    '<div class="flow-box accent">📝 You log your coach\'s feedback, per event</div>' +
    '<div class="flow-arrow">↓<span>saved instantly</span></div>' +
    '<div class="flow-box">💾 Saved in your browser only (local storage)<br><small>no server · no account · stays on your device</small></div>' +
    '<div class="flow-arrow">↓<span>when you tap Summarize</span></div>' +
    '<div class="flow-box">🤖 The app builds a prompt from your notes</div>' +
    '<div class="flow-arrow">↓<span>you copy &amp; paste it</span></div>' +
    '<div class="flow-box">🌐 You run it in a free AI tool of your choice</div>' +
    '<div class="flow-arrow">↓<span>paste the summary back</span></div>' +
    '<div class="flow-box">🗒️ Summary saved with your meet (still on device)</div>' +
    '<div class="flow-arrow">↓</div>' +
    '<div class="flow-box accent">📤 Export it, or 📅 download an .ics reminder<br><small>generated locally &mdash; nothing is uploaded</small></div>' +
    "</div>" +
    "</div>" +

    '<div class="dialog-actions" style="margin-top:16px"><button class="btn ghost block" id="info-close">Close</button></div>';

  var infoDialog = null;

  function buildInfoDialog() {
    if (infoDialog) return infoDialog;
    var dlg = document.createElement("dialog");
    dlg.className = "sheet info-dialog";
    dlg.innerHTML = INFO_HTML;
    document.body.appendChild(dlg);

    var toggle = dlg.querySelector("#info-toggle");
    var desc = dlg.querySelector("#info-desc");
    var flow = dlg.querySelector("#info-flow");
    toggle.addEventListener("click", function () {
      var showFlow = flow.style.display === "none";
      flow.style.display = showFlow ? "" : "none";
      desc.style.display = showFlow ? "none" : "";
      toggle.textContent = showFlow ? "📄 View description" : "📊 View flowchart";
      dlg.scrollTop = 0;
    });
    dlg.querySelector("#info-close").addEventListener("click", function () {
      closeInfo();
    });
    dlg.addEventListener("cancel", function () {
      closeInfo();
    });
    infoDialog = dlg;
    return dlg;
  }

  function openInfo() {
    var dlg = buildInfoDialog();
    // always open on the description view
    dlg.querySelector("#info-desc").style.display = "";
    dlg.querySelector("#info-flow").style.display = "none";
    dlg.querySelector("#info-toggle").textContent = "📊 View flowchart";
    if (dlg.showModal) dlg.showModal();
    else dlg.setAttribute("open", "");
    dlg.scrollTop = 0;
  }
  function closeInfo() {
    if (!infoDialog) return;
    if (infoDialog.close) infoDialog.close();
    else infoDialog.removeAttribute("open");
  }

  function injectInfoButton() {
    var bar = document.querySelector(".topbar");
    if (!bar || bar.querySelector(".info-btn")) return;
    var btn = document.createElement("button");
    btn.className = "info-btn";
    btn.type = "button";
    btn.title = "How SwimNotes works";
    btn.setAttribute("aria-label", "How SwimNotes works");
    btn.textContent = "ⓘ";
    btn.addEventListener("click", openInfo);
    bar.appendChild(btn);
  }

  function injectToggle() {
    var bar = document.querySelector(".topbar");
    if (!bar || bar.querySelector(".theme-toggle")) return;
    var btn = document.createElement("button");
    btn.className = "theme-toggle";
    btn.type = "button";
    btn.setAttribute("role", "switch");
    btn.setAttribute("aria-label", "Toggle light and dark mode");
    btn.innerHTML =
      '<span class="tt-track">' +
      '<span class="tt-ico tt-sun">☀</span>' +
      '<span class="tt-ico tt-moon">☾</span>' +
      '<span class="tt-thumb"></span></span>';
    btn.addEventListener("click", function () {
      applyTheme(currentTheme() === "light" ? "dark" : "light");
    });
    bar.appendChild(btn);
  }

  function init() {
    injectWaves();
    injectBubbles();
    injectInfoButton();
    injectToggle();
    applyTheme(currentTheme());
    setupNav();
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
