/* SwimNotes - "added to calendar" next-steps page.
 * Shows the downloaded reminder's details and lets the user re-download it. */

(function () {
  "use strict";
  var $ = UI.$;

  function init() {
    var data = null;
    try {
      data = JSON.parse(sessionStorage.getItem("swimnotes.lastIcs") || "null");
    } catch (e) {}

    var dlBtn = $("#download-again");

    if (data) {
      $("#r-title").textContent = data.title || "Your reminder";
      $("#r-when").textContent = data.when ? "When: " + data.when : "";
      $("#r-file").textContent = data.filename || "";
      if (data.content) {
        dlBtn.addEventListener("click", function () {
          UI.downloadFile(
            data.filename || "swimnotes-reminder.ics",
            data.content,
            "text/calendar;charset=utf-8"
          );
          UI.toast("Downloaded again — check your Downloads");
        });
      } else {
        dlBtn.style.display = "none";
      }
    } else {
      // Page opened directly (no recent download) — show generic guidance.
      $("#summary").style.display = "none";
      $("#subtitle").textContent =
        "Here's how to add a downloaded .ics calendar file to your calendar.";
    }
  }

  document.addEventListener("DOMContentLoaded", init);
})();
