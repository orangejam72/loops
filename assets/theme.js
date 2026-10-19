// Colour theme switch shared by every page: "system" follows the OS, "light"/"dark" pin it.
// Loaded in <head> so the saved choice applies before first paint. Printing always uses light.
(function () {
  var KEY = "loops-theme";
  var root = document.documentElement;

  function get() {
    try { return localStorage.getItem(KEY) || "system"; } catch (e) { return "system"; }
  }
  function apply(mode) {
    if (mode === "light" || mode === "dark") root.setAttribute("data-theme", mode);
    else root.removeAttribute("data-theme");
  }
  function sync() {
    var mode = get();
    document.querySelectorAll("[data-theme-set]").forEach(function (b) {
      b.setAttribute("aria-pressed", String(b.getAttribute("data-theme-set") === mode));
    });
  }

  apply(get());
  window.LoopsTheme = {
    get: get,
    set: function (mode) {
      try { localStorage.setItem(KEY, mode); } catch (e) {}
      apply(mode);
      sync();
    },
  };

  document.addEventListener("DOMContentLoaded", function () {
    document.querySelectorAll("[data-theme-set]").forEach(function (b) {
      b.addEventListener("click", function () { window.LoopsTheme.set(b.getAttribute("data-theme-set")); });
    });
    sync();
  });

  var beforePrint = null;
  window.addEventListener("beforeprint", function () {
    beforePrint = root.getAttribute("data-theme");
    root.setAttribute("data-theme", "light");
  });
  window.addEventListener("afterprint", function () {
    if (beforePrint) root.setAttribute("data-theme", beforePrint);
    else root.removeAttribute("data-theme");
  });
})();
