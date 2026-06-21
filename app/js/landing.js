/* SwimNotes - Landing page logic: dynamic "dive" background depth effect. */

(function () {
  "use strict";
  var $ = UI.$;

  // The deeper you scroll, the darker the water overlay gets.
  function setupDepth() {
    var overlay = $("#depth-overlay");
    if (!overlay) return;
    var MAX = 0.85; // darkest the abyss gets
    var ticking = false;

    function update() {
      ticking = false;
      var doc = document.documentElement;
      var max = (doc.scrollHeight || 0) - window.innerHeight;
      var p = max > 0 ? Math.min(1, Math.max(0, window.scrollY / max)) : 0;
      overlay.style.opacity = (p * MAX).toFixed(3);
    }
    function onScroll() {
      if (!ticking) {
        ticking = true;
        window.requestAnimationFrame(update);
      }
    }

    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", update);
    update();
  }

  document.addEventListener("DOMContentLoaded", setupDepth);
})();
