/* ============================================================
   Help Desk Command Reference, shared logic.
   No rendering here. Every design candidate uses this file.

   Privacy choices, on purpose:
   - Nothing is written to localStorage, sessionStorage or cookies.
     A technician can paste real output into a result field, and that
     output can contain data that must not persist on a shared machine.
     State lives in memory and is gone when the tab closes.
   - No command result is ever passed to console.log.
   - No command is ever executed. This file has no exec path.
   ============================================================ */
(function (global) {
  "use strict";

  var RESULT_MAX = 2000;
  var NOT_DOCUMENTED = "Not documented.";

  /* ---------- data ---------- */

  function all() {
    var d = global.HELPDESK_COMMANDS;
    return Array.isArray(d) ? d : [];
  }

  /* ---------- state, memory only ---------- */

  var order = 0;
  var state = {
    query: "",
    category: "All",
    filters: { info: false, change: false, admin: false, selected: false, restart: false },
    sel: Object.create(null) /* id -> { order: n, result: "" } */
  };

  var listeners = [];
  function on(fn) { listeners.push(fn); }
  function emit() { for (var i = 0; i < listeners.length; i++) { listeners[i](); } }

  /* ---------- sanitising ---------- */

  /* Strip control characters, normalise line endings, cap the length.
     Everything is rendered with textContent, so this is a second layer,
     not the only one. */
  var CONTROL = new RegExp("[\\u0000-\\u0008\\u000B\\u000C\\u000E-\\u001F\\u007F]", "g");
  var BIDI = new RegExp("[\\u202A-\\u202E\\u2066-\\u2069]", "g");
  var LONGDASH = new RegExp("[\\u2013\\u2014]");

  function sanitize(s) {
    if (typeof s !== "string") { return ""; }
    var out = s.replace(/\r\n?/g, "\n");
    out = out.replace(CONTROL, "");
    out = out.replace(BIDI, "");
    if (out.length > RESULT_MAX) { out = out.slice(0, RESULT_MAX); }
    return out;
  }

  /* One line, for the ticket note. Newlines become spaces so a pasted
     block of output cannot break the note structure. */
  function oneLine(s) {
    return sanitize(s).replace(/\s*\n\s*/g, " ").replace(/\s{2,}/g, " ").trim();
  }

  /* ---------- selection ---------- */

  function isSelected(id) { return Object.prototype.hasOwnProperty.call(state.sel, id); }

  function toggle(id, want) {
    var on_ = (typeof want === "boolean") ? want : !isSelected(id);
    if (on_ && !isSelected(id)) {
      state.sel[id] = { order: ++order, result: "" };
    } else if (!on_ && isSelected(id)) {
      delete state.sel[id];
    }
    emit();
  }

  function clearOne(id) {
    if (isSelected(id)) { delete state.sel[id]; emit(); }
  }

  function clearAllSelected() {
    state.sel = Object.create(null);
    order = 0;
    emit();
  }

  function resetResults() {
    for (var k in state.sel) {
      if (Object.prototype.hasOwnProperty.call(state.sel, k)) { state.sel[k].result = ""; }
    }
    emit();
  }

  function getResult(id) { return isSelected(id) ? state.sel[id].result : ""; }

  function setResult(id, text) {
    if (!isSelected(id)) { return; }
    state.sel[id].result = sanitize(text);
    /* deliberately no emit here: re-rendering on every keystroke would
       steal focus from the textarea. Callers refresh the note panel. */
  }

  function selectedCommands() {
    var list = [];
    var data = all();
    for (var i = 0; i < data.length; i++) {
      if (isSelected(data[i].id)) { list.push(data[i]); }
    }
    list.sort(function (a, b) { return state.sel[a.id].order - state.sel[b.id].order; });
    return list;
  }

  function selectedCount() { return Object.keys(state.sel).length; }

  /* ---------- filtering ---------- */

  function setQuery(q) { state.query = typeof q === "string" ? q : ""; emit(); }
  function setCategory(c) { state.category = c || "All"; emit(); }
  function toggleFilter(key) {
    if (Object.prototype.hasOwnProperty.call(state.filters, key)) {
      state.filters[key] = !state.filters[key];
      emit();
    }
  }
  function clearFilters() {
    state.query = "";
    state.category = "All";
    for (var k in state.filters) {
      if (Object.prototype.hasOwnProperty.call(state.filters, k)) { state.filters[k] = false; }
    }
    emit();
  }
  function anyFilterActive() {
    if (state.query || state.category !== "All") { return true; }
    for (var k in state.filters) {
      if (Object.prototype.hasOwnProperty.call(state.filters, k) && state.filters[k]) { return true; }
    }
    return false;
  }

  function changesSystem(c) { return c.commandType !== "Information only"; }

  function matches(c) {
    var f = state.filters;
    if (state.category !== "All" && c.category !== state.category) { return false; }
    if (f.info && changesSystem(c)) { return false; }
    if (f.change && !changesSystem(c)) { return false; }
    if (f.admin && !c.adminRequired) { return false; }
    if (f.restart && !c.restartRequired) { return false; }
    if (f.selected && !isSelected(c.id)) { return false; }

    var q = state.query.trim().toLowerCase();
    if (!q) { return true; }
    var terms = q.split(/\s+/);
    /* Search by command name, by the command itself, and by
       troubleshooting purpose: the example, the purpose line and keywords. */
    var hay = [
      c.name, c.command, c.category, c.whatItIs, c.whatItDoes,
      c.realWorldExample, c.purpose, c.whatToCheck,
      (c.keywords || []).join(" ")
    ].join(" ").toLowerCase();
    for (var i = 0; i < terms.length; i++) {
      if (hay.indexOf(terms[i]) === -1) { return false; }
    }
    return true;
  }

  function visible() { return all().filter(matches); }

  function categories() {
    var seen = [];
    var data = all();
    for (var i = 0; i < data.length; i++) {
      if (seen.indexOf(data[i].category) === -1) { seen.push(data[i].category); }
    }
    return seen.map(function (name) {
      var inCat = data.filter(function (c) { return c.category === name; });
      return {
        name: name,
        total: inCat.length,
        selected: inCat.filter(function (c) { return isSelected(c.id); }).length
      };
    });
  }

  /* ---------- safety labels ---------- */

  function labels(c) {
    var out = [];
    if (c.commandType === "Information only") {
      out.push({ text: "Information only", tone: "info" });
    } else if (c.commandType === "Low-risk change") {
      out.push({ text: "Low-risk change", tone: "low" });
    } else {
      out.push({ text: "System change", tone: "high" });
    }
    if (c.adminRequired) { out.push({ text: "Administrator required", tone: "admin" }); }
    if (c.serviceInterruptionPossible) { out.push({ text: "Service interruption possible", tone: "warn" }); }
    if (c.restartRequired) { out.push({ text: "Restart required", tone: "warn" }); }
    return out;
  }

  /* The visible warning shown on any command that modifies the system.
     Returns null for read only commands. */
  function warning(c) {
    if (!changesSystem(c)) { return null; }
    var lines = [];
    if (c.commandType === "System change") {
      lines.push("This command changes the system. Tell the user what you are about to do before you run it.");
    } else {
      lines.push("This command makes a small change to the system.");
    }
    if (c.serviceInterruptionPossible) {
      lines.push("The user may lose the network, an application, or the sign in session while it runs.");
    }
    if (c.restartRequired) {
      lines.push("A restart is needed before the change takes effect. Agree a time with the user first.");
    }
    if (c.adminRequired) {
      lines.push("Run it from a prompt opened as administrator.");
    }
    return lines;
  }

  /* ---------- text builders ---------- */

  function commandText(c) { return c.command; }

  function commandWithExplanation(c) {
    var L = [];
    L.push("Command: " + c.command);
    L.push("Shell: " + c.shell);
    L.push("What it is: " + c.whatItIs);
    L.push("What it does: " + c.whatItDoes);
    L.push("Analogy: " + c.analogy);
    L.push("Real world example: " + c.realWorldExample);
    L.push("Administrator required: " + (c.adminRequired ? "Yes" : "No"));
    L.push("Command type: " + c.commandType);
    L.push("Restart required: " + (c.restartRequired ? "Yes" : "No"));
    L.push("Service interruption possible: " + (c.serviceInterruptionPossible ? "Yes" : "No"));
    L.push("What to check: " + c.whatToCheck);
    return L.join("\n");
  }

  function allSelectedCommandsText() {
    var list = selectedCommands();
    if (!list.length) { return ""; }
    return list.map(function (c) { return c.command; }).join("\n");
  }

  /* ---------- ticket notes ----------
     Two formats.
     "plain" is the default and is what goes into a ticketing system.
     It carries no asterisks, no backticks and no other markup
     characters, because those survive badly in ticket fields.
     "markdown" reproduces the bullet and backtick layout for tools
     that render markdown. */

  function ticketNotes(format) {
    var md = (format === "markdown");
    var list = selectedCommands();
    var L = [];

    if (!list.length) {
      return "No commands have been selected yet.";
    }

    L.push("Troubleshooting performed:");
    L.push("");

    var changed = [];
    var findings = [];
    var restart = false;

    for (var i = 0; i < list.length; i++) {
      var c = list[i];
      var res = oneLine(getResult(c.id));
      var shown = res ? res : NOT_DOCUMENTED;
      if (res) { findings.push({ cmd: c.command, res: res }); }
      if (changesSystem(c)) { changed.push(c); }
      if (c.restartRequired) { restart = true; }

      if (md) {
        L.push("* Ran: `" + c.command + "`");
        L.push("* Purpose: " + c.purpose);
        L.push("* Result: " + shown);
        L.push("");
      } else {
        L.push((i + 1) + ". Ran: " + c.command);
        L.push("   Purpose: " + c.purpose);
        L.push("   Result: " + shown);
        L.push("");
      }
    }

    L.push("Summary:");
    if (md) {
      L.push("");
      L.push("* Commands run: " + list.length);
    } else {
      L.push("   Commands run: " + list.length);
    }

    /* Key findings. Only what the technician actually typed.
       Nothing is inferred and nothing is invented. */
    if (!findings.length) {
      L.push(md ? "* Key findings: None documented." : "   Key findings: None documented.");
    } else if (findings.length === 1) {
      L.push((md ? "* " : "   ") + "Key findings: " + findings[0].res);
    } else {
      L.push((md ? "* " : "   ") + "Key findings:");
      for (var j = 0; j < findings.length; j++) {
        L.push((md ? "    * " : "      ") + findings[j].cmd + ": " + findings[j].res);
      }
    }

    if (!changed.length) {
      L.push((md ? "* " : "   ") + "Changes made: None. Every command run was information only.");
    } else if (changed.length === 1) {
      L.push((md ? "* " : "   ") + "Changes made: " + changed[0].command + " (" + changed[0].commandType + ")");
    } else {
      L.push((md ? "* " : "   ") + "Changes made:");
      for (var k = 0; k < changed.length; k++) {
        L.push((md ? "    * " : "      ") + changed[k].command + " (" + changed[k].commandType + ")");
      }
    }

    L.push((md ? "* " : "   ") + "Restart required: " + (restart ? "Yes" : "No"));

    return L.join("\n").replace(/\n{3,}/g, "\n\n").trim() + "\n";
  }

  /* ---------- clipboard ----------
     The page is served over plain http on the home network, so
     navigator.clipboard is not available in that context on most
     browsers. The legacy path is the one that actually runs on a
     phone or an iPad. If both fail the caller shows the text so it
     can be selected by hand. */

  function legacyCopy(text) {
    var ta = document.createElement("textarea");
    ta.value = text;
    ta.setAttribute("readonly", "");
    ta.setAttribute("aria-hidden", "true");
    ta.style.position = "fixed";
    ta.style.top = "0";
    ta.style.left = "0";
    ta.style.width = "1px";
    ta.style.height = "1px";
    ta.style.padding = "0";
    ta.style.border = "none";
    ta.style.opacity = "0";
    document.body.appendChild(ta);
    var ok = false;
    try {
      if (/ipad|iphone|ipod/i.test(navigator.userAgent)) {
        var range = document.createRange();
        range.selectNodeContents(ta);
        var sel = window.getSelection();
        sel.removeAllRanges();
        sel.addRange(range);
        ta.setSelectionRange(0, text.length);
      } else {
        ta.select();
      }
      ok = document.execCommand("copy");
    } catch (e) {
      ok = false;
    }
    document.body.removeChild(ta);
    return ok;
  }

  /* Returns a promise for true or false. Never logs the text. */
  function copy(text) {
    if (typeof text !== "string" || !text) { return Promise.resolve(false); }
    if (global.navigator && navigator.clipboard && global.isSecureContext) {
      return navigator.clipboard.writeText(text).then(function () { return true; },
        function () { return legacyCopy(text); });
    }
    return Promise.resolve(legacyCopy(text));
  }

  /* ---------- integrity check ---------- */

  function audit() {
    var data = all();
    var required = ["id", "category", "name", "command", "shell", "whatItIs", "whatItDoes",
      "analogy", "realWorldExample", "purpose", "commandType", "whatToCheck", "keywords"];
    var bools = ["adminRequired", "restartRequired", "serviceInterruptionPossible"];
    var problems = [];
    var ids = Object.create(null);
    var cmds = Object.create(null);
    var types = ["Information only", "Low-risk change", "System change"];

    for (var i = 0; i < data.length; i++) {
      var c = data[i];
      for (var r = 0; r < required.length; r++) {
        if (c[required[r]] === undefined || c[required[r]] === null || c[required[r]] === "") {
          problems.push("id " + c.id + " missing " + required[r]);
        }
      }
      for (var b = 0; b < bools.length; b++) {
        if (typeof c[bools[b]] !== "boolean") { problems.push("id " + c.id + " " + bools[b] + " is not true or false"); }
      }
      if (ids[c.id]) { problems.push("duplicate id " + c.id); }
      ids[c.id] = true;
      var key = String(c.command).trim().toLowerCase();
      if (cmds[key]) { problems.push("duplicate command " + c.command); }
      cmds[key] = true;
      if (types.indexOf(c.commandType) === -1) { problems.push("id " + c.id + " bad commandType"); }
      if (LONGDASH.test(JSON.stringify(c))) { problems.push("id " + c.id + " contains a long dash character"); }
    }
    return { count: data.length, problems: problems };
  }

  global.HD = {
    all: all,
    state: state,
    on: on,
    emit: emit,
    sanitize: sanitize,
    isSelected: isSelected,
    toggle: toggle,
    clearOne: clearOne,
    clearAllSelected: clearAllSelected,
    resetResults: resetResults,
    getResult: getResult,
    setResult: setResult,
    selectedCommands: selectedCommands,
    selectedCount: selectedCount,
    setQuery: setQuery,
    setCategory: setCategory,
    toggleFilter: toggleFilter,
    clearFilters: clearFilters,
    anyFilterActive: anyFilterActive,
    visible: visible,
    categories: categories,
    changesSystem: changesSystem,
    labels: labels,
    warning: warning,
    commandText: commandText,
    commandWithExplanation: commandWithExplanation,
    allSelectedCommandsText: allSelectedCommandsText,
    ticketNotes: ticketNotes,
    copy: copy,
    audit: audit
  };
})(window);
