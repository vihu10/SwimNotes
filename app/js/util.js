/* SwimNotes - shared UI helpers: DOM, escaping, toast, export, theme detection */

(function (global) {
  "use strict";

  function $(sel, root) {
    return (root || document).querySelector(sel);
  }
  function $all(sel, root) {
    return Array.prototype.slice.call((root || document).querySelectorAll(sel));
  }

  function el(tag, attrs, children) {
    var node = document.createElement(tag);
    if (attrs) {
      Object.keys(attrs).forEach(function (k) {
        if (k === "class") node.className = attrs[k];
        else if (k === "text") node.textContent = attrs[k];
        else if (k.indexOf("on") === 0 && typeof attrs[k] === "function") {
          node.addEventListener(k.slice(2).toLowerCase(), attrs[k]);
        } else if (attrs[k] !== null && attrs[k] !== undefined) {
          node.setAttribute(k, attrs[k]);
        }
      });
    }
    (children || []).forEach(function (c) {
      if (c == null) return;
      node.appendChild(typeof c === "string" ? document.createTextNode(c) : c);
    });
    return node;
  }

  function escapeHtml(str) {
    return String(str == null ? "" : str)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  function getParam(name) {
    return new URLSearchParams(global.location.search).get(name);
  }

  function formatDate(iso) {
    if (!iso) return "";
    // iso is YYYY-MM-DD; render without timezone shift
    var parts = iso.split("-");
    if (parts.length !== 3) return iso;
    var d = new Date(Number(parts[0]), Number(parts[1]) - 1, Number(parts[2]));
    return d.toLocaleDateString(undefined, {
      weekday: "short",
      year: "numeric",
      month: "short",
      day: "numeric"
    });
  }

  // --- toast ---------------------------------------------------------------

  var toastTimer = null;
  function toast(msg) {
    var t = $("#toast");
    if (!t) {
      t = el("div", { id: "toast", class: "toast" });
      document.body.appendChild(t);
    }
    t.textContent = msg;
    t.classList.add("show");
    if (toastTimer) clearTimeout(toastTimer);
    toastTimer = setTimeout(function () {
      t.classList.remove("show");
    }, 2200);
  }

  // --- clipboard -----------------------------------------------------------

  function copyText(text) {
    if (navigator.clipboard && navigator.clipboard.writeText) {
      return navigator.clipboard.writeText(text);
    }
    // fallback
    return new Promise(function (resolve, reject) {
      try {
        var ta = el("textarea", { value: text });
        ta.style.position = "fixed";
        ta.style.opacity = "0";
        document.body.appendChild(ta);
        ta.select();
        document.execCommand("copy");
        document.body.removeChild(ta);
        resolve();
      } catch (e) {
        reject(e);
      }
    });
  }

  // --- file download -------------------------------------------------------

  function downloadFile(filename, content, mime) {
    var blob = new Blob([content], { type: mime || "text/plain;charset=utf-8" });
    var url = URL.createObjectURL(blob);
    var a = el("a", { href: url, download: filename });
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(function () {
      URL.revokeObjectURL(url);
    }, 1000);
  }

  // --- native share --------------------------------------------------------

  function canShare() {
    return !!(navigator.share);
  }

  function shareText(title, text) {
    if (!navigator.share) return Promise.reject(new Error("no share"));
    return navigator.share({ title: title, text: text });
  }

  // --- email ---------------------------------------------------------------

  function emailText(subject, body) {
    var href =
      "mailto:?subject=" +
      encodeURIComponent(subject) +
      "&body=" +
      encodeURIComponent(body);
    global.location.href = href;
  }

  global.UI = {
    $: $,
    $all: $all,
    el: el,
    escapeHtml: escapeHtml,
    getParam: getParam,
    formatDate: formatDate,
    toast: toast,
    copyText: copyText,
    downloadFile: downloadFile,
    canShare: canShare,
    shareText: shareText,
    emailText: emailText
  };
})(window);
