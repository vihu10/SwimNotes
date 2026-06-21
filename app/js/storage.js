/* SwimNotes - shared localStorage data layer
 * Single source of truth for all meet/event data.
 * Data lives only in the browser. No server, no accounts. */

(function (global) {
  "use strict";

  var STORAGE_KEY = "swimnotes.v1";
  var CURRENT_MEET_KEY = "swimnotes.currentMeet";

  // --- low level read/write -------------------------------------------------

  function readAll() {
    try {
      var raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return { meets: [] };
      var data = JSON.parse(raw);
      if (!data || !Array.isArray(data.meets)) return { meets: [] };
      return data;
    } catch (e) {
      console.error("SwimNotes: failed to read storage", e);
      return { meets: [] };
    }
  }

  function writeAll(data) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  }

  // --- id helpers -----------------------------------------------------------

  function uid(prefix) {
    return (
      prefix +
      "-" +
      Date.now().toString(36) +
      "-" +
      Math.random().toString(36).slice(2, 7)
    );
  }

  function nowIso() {
    return new Date().toISOString();
  }

  // --- meets ----------------------------------------------------------------

  function getMeets() {
    // newest first
    return readAll().meets.slice().sort(function (a, b) {
      return (b.date || "").localeCompare(a.date || "");
    });
  }

  function getMeet(id) {
    var meets = readAll().meets;
    for (var i = 0; i < meets.length; i++) {
      if (meets[i].id === id) return meets[i];
    }
    return null;
  }

  function createMeet(name, date) {
    var data = readAll();
    var meet = {
      id: uid("meet"),
      name: (name || "Untitled Meet").trim(),
      date: date || nowIso().slice(0, 10),
      events: [],
      summary: ""
    };
    data.meets.push(meet);
    writeAll(data);
    setCurrentMeetId(meet.id);
    return meet;
  }

  function updateMeet(id, fields) {
    var data = readAll();
    for (var i = 0; i < data.meets.length; i++) {
      if (data.meets[i].id === id) {
        if (fields.name !== undefined) data.meets[i].name = fields.name.trim();
        if (fields.date !== undefined) data.meets[i].date = fields.date;
        if (fields.summary !== undefined) data.meets[i].summary = fields.summary;
        writeAll(data);
        return data.meets[i];
      }
    }
    return null;
  }

  function deleteMeet(id) {
    var data = readAll();
    data.meets = data.meets.filter(function (m) {
      return m.id !== id;
    });
    writeAll(data);
    if (getCurrentMeetId() === id) clearCurrentMeetId();
  }

  function saveSummary(meetId, summary) {
    return updateMeet(meetId, { summary: summary });
  }

  // --- events ---------------------------------------------------------------

  function addEvent(meetId, name, notes) {
    var data = readAll();
    for (var i = 0; i < data.meets.length; i++) {
      if (data.meets[i].id === meetId) {
        var evt = {
          id: uid("evt"),
          name: (name || "Event").trim(),
          notes: notes || "",
          timestamp: nowIso()
        };
        data.meets[i].events.push(evt);
        writeAll(data);
        return evt;
      }
    }
    return null;
  }

  function getEvent(meetId, eventId) {
    var meet = getMeet(meetId);
    if (!meet) return null;
    for (var i = 0; i < meet.events.length; i++) {
      if (meet.events[i].id === eventId) return meet.events[i];
    }
    return null;
  }

  function updateEvent(meetId, eventId, fields) {
    var data = readAll();
    for (var i = 0; i < data.meets.length; i++) {
      if (data.meets[i].id !== meetId) continue;
      var events = data.meets[i].events;
      for (var j = 0; j < events.length; j++) {
        if (events[j].id === eventId) {
          if (fields.name !== undefined) events[j].name = fields.name.trim();
          if (fields.notes !== undefined) events[j].notes = fields.notes;
          writeAll(data);
          return events[j];
        }
      }
    }
    return null;
  }

  function deleteEvent(meetId, eventId) {
    var data = readAll();
    for (var i = 0; i < data.meets.length; i++) {
      if (data.meets[i].id === meetId) {
        data.meets[i].events = data.meets[i].events.filter(function (e) {
          return e.id !== eventId;
        });
        writeAll(data);
        return true;
      }
    }
    return false;
  }

  // --- current meet pointer -------------------------------------------------

  function getCurrentMeetId() {
    return localStorage.getItem(CURRENT_MEET_KEY);
  }

  function setCurrentMeetId(id) {
    localStorage.setItem(CURRENT_MEET_KEY, id);
  }

  function clearCurrentMeetId() {
    localStorage.removeItem(CURRENT_MEET_KEY);
  }

  function getCurrentMeet() {
    var id = getCurrentMeetId();
    if (!id) return null;
    var meet = getMeet(id);
    if (!meet) {
      clearCurrentMeetId();
      return null;
    }
    return meet;
  }

  // --- public API -----------------------------------------------------------

  global.SwimNotes = {
    getMeets: getMeets,
    getMeet: getMeet,
    createMeet: createMeet,
    updateMeet: updateMeet,
    deleteMeet: deleteMeet,
    saveSummary: saveSummary,
    addEvent: addEvent,
    getEvent: getEvent,
    updateEvent: updateEvent,
    deleteEvent: deleteEvent,
    getCurrentMeetId: getCurrentMeetId,
    setCurrentMeetId: setCurrentMeetId,
    clearCurrentMeetId: clearCurrentMeetId,
    getCurrentMeet: getCurrentMeet
  };
})(window);
