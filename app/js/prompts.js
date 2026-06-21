/* SwimNotes - prompt template builders.
 * These assemble copy-paste prompts from notes. The app NEVER calls any AI. */

(function (global) {
  "use strict";

  function eventsBlock(meet) {
    var lines = [];
    (meet.events || []).forEach(function (evt, i) {
      var notes = (evt.notes || "").trim() || "(no notes)";
      lines.push("Event " + (i + 1) + " - " + evt.name + ": " + notes);
    });
    return lines.join("\n");
  }

  // Collect notes across multiple meets (used by talking-points / pattern finder)
  function allNotesBlock(meets) {
    var blocks = [];
    meets.forEach(function (meet) {
      var inner = [];
      (meet.events || []).forEach(function (evt) {
        var notes = (evt.notes || "").trim();
        if (notes) inner.push("- " + evt.name + ": " + notes);
      });
      if (inner.length) {
        blocks.push(
          meet.name + " (" + (meet.date || "") + "):\n" + inner.join("\n")
        );
      }
    });
    return blocks.join("\n\n");
  }

  // Prompt 1: Meet Summary (single meet)
  function meetSummary(meet) {
    return (
      "I am a competitive swimmer. Here are raw notes I took from my coach's\n" +
      "feedback at today's swim meet. Please organize them by theme (starts,\n" +
      "turns, finishes, stroke technique, pacing) and highlight anything\n" +
      "mentioned more than once. Only include what is in my notes - do not\n" +
      "add coaching advice.\n\n" +
      "Meet: " + meet.name + "\n" +
      "Date: " + (meet.date || "") + "\n\n" +
      eventsBlock(meet)
    );
  }

  // Prompt 2: Talking Points for Coach (recent meets)
  function talkingPoints(meets) {
    return (
      "Based on these swim meet feedback notes from my last few meets, what\n" +
      "are 2-3 specific questions I should ask my coach at my next practice?\n" +
      "Frame them as questions I can ask, not advice for me to follow. Only\n" +
      "reference what is actually in my notes.\n\n" +
      allNotesBlock(meets)
    );
  }

  // Prompt 3: Pattern Finder (all historical meets)
  function patternFinder(meets) {
    return (
      "Here are my swim meet feedback notes from my last several meets. What\n" +
      "feedback themes keep repeating? List them with how many times each\n" +
      "appeared. Only include patterns that appear 2 or more times. Do not\n" +
      "invent or assume anything not in the notes.\n\n" +
      allNotesBlock(meets)
    );
  }

  global.Prompts = {
    meetSummary: meetSummary,
    talkingPoints: talkingPoints,
    patternFinder: patternFinder,
    eventsBlock: eventsBlock,
    allNotesBlock: allNotesBlock
  };
})(window);
