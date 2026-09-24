(function () {
  var STORAGE_KEY = "theme";
  var root = document.documentElement;
  var themeAnimTimer = null;

  function getInitialTheme() {
    try {
      var saved = localStorage.getItem(STORAGE_KEY);
      if (saved === "light" || saved === "dark") return saved;
      if (window.matchMedia && window.matchMedia("(prefers-color-scheme: dark)").matches) return "dark";
    } catch (e) {}
    return "light";
  }

  function apply(theme) {
    root.setAttribute("data-theme", theme);
    root.classList.add("is-theme-animating");
    clearTimeout(themeAnimTimer);
    themeAnimTimer = setTimeout(function () {
      root.classList.remove("is-theme-animating");
    }, 600);
  }

  function current() {
    return root.getAttribute("data-theme") === "dark" ? "dark" : "light";
  }

  function set(theme) {
    apply(theme);
    try {
      localStorage.setItem(STORAGE_KEY, theme);
    } catch (e) {}
    updateToggle();
  }

  function toggle() {
    set(current() === "dark" ? "light" : "dark");
  }

  function updateToggle() {
    var btn = document.querySelector("[data-theme-toggle]");
    var dark = current() === "dark";
    if (!btn) return;
    var icon = btn.querySelector("[data-theme-icon]");
    btn.setAttribute("aria-label", dark ? "ライトモードに切り替え" : "ダークモードに切り替え");
    btn.setAttribute("title", dark ? "ライトモードに切り替え" : "ダークモードに切り替え");
    if (icon) icon.textContent = dark ? "light_mode" : "dark_mode";
  }

  document.addEventListener("DOMContentLoaded", function () {
    apply(getInitialTheme());
    var btn = document.querySelector("[data-theme-toggle]");
    if (btn) btn.addEventListener("click", toggle);
    updateToggle();
  });

  window.addEventListener("storage", function (e) {
    if (e.key === STORAGE_KEY) apply(e.newValue || getInitialTheme());
  });
})();