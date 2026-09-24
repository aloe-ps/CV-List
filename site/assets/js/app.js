(function () {
var COLLATOR = new Intl.Collator("ja", { sensitivity: "base" });

var SORT_KEY = {
  author: "author",
  performer: "performers",
  community: "communities"
};

var state = {
    all: [],
    query: "",
    sort: "date",
    genre: ""
  };

  var els = {};

  function esc(text) {
    return String(text)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  function icon(name) {
    return '<span class="material-symbols-outlined" aria-hidden="true">' + esc(name) + "</span>";
  }

  function taskChip(label, cls) {
    cls = cls || "";
    return '<span class="chip' + (cls ? " " + cls : "") + '">' + esc(label) + "</span>";
  }

  function joinList(items) {
    if (!items || !items.length) return "—";
    return esc(items.join("・"));
  }

  function workThumb(w) {
    var yid = WORKS.parseYouTubeId(w.youtube);
    var img = "";
    var fallback = "";
    if (yid) {
      img =
        '<img src="' +
        esc(WORKS.thumbUrl(yid)) +
        '" alt="" loading="lazy" onerror="this.classList.add(\'hide\');this.parentElement.classList.add(\'is-fallback\');" />';
    }
    fallback =
      '<div class="card__fallback" aria-hidden="true">' + icon("featured_video") + "</div>";
    return '<div class="card__thumb">' + img + fallback + "</div>";
  }

  function musicPreview(w) {
    if (!w.music || !w.music.length) return "";
    var parts = w.music.map(function (m) {
      var label = m.title || "（楽曲名不明）";
      if (m.composer) label += "／" + m.composer;
      return esc(label);
    });
    return '<div class="meta-line">' + icon("music_note") + "<span>" + parts.join("・") + "</span></div>";
  }

  function communitiesPreview(w) {
    if (!w.communities || !w.communities.length) return "";
    return (
      '<div class="card__chips">' +
      w.communities
        .slice(0, 3)
        .map(function (c) {
          return taskChip(c, "chip--fill");
        })
        .join("") +
      (w.communities.length > 3 ? taskChip("+" + (w.communities.length - 3)) : "") +
      "</div>"
    );
  }

  function workCard(w, idx) {
    idx = idx || 0;
    return (
      '<a class="card card--clickable" style="--i:' +
      idx +
      '" href="work.html?id=' +
      encodeURIComponent(w.id) +
      '" aria-label="' +
      esc(w.title) +
      " の詳細を見る\">" +
      workThumb(w) +
      (w.genre ? '<span class="card__genre">' + esc(w.genre) + "</span>" : "") +
      '<div class="card__body">' +
      '<h2 class="card__title">' +
      esc(w.title) +
      "</h2>" +
      (w.description
        ? '<p class="card__desc">' + esc(w.description) + "</p>"
        : "") +
      '<div class="meta-line">' +
      icon("person") +
      "<span>" +
      (w.author ? esc(w.author) : "作者不明") +
      "</span></div>" +
      '<div class="meta-line">' +
      icon("groups") +
      "<span>" +
      joinList(w.performers) +
      "</span></div>" +
      musicPreview(w) +
      communitiesPreview(w) +
      '<div class="card__footer"><span>詳細を見る</span>' + icon("arrow_forward") + "</div>" +
      "</div></a>"
    );
  }

  function matches(w, q) {
    if (!q) return true;
    var hay = [
      w.title,
      w.author,
      w.description
    ]
      .concat(w.performers || [])
      .concat((w.music || []).map(function (m) {
        return m.title + " " + (m.composer || "");
      }))
      .concat(w.communities || [])
      .join(" ")
      .toLowerCase();
    return hay.indexOf(q) !== -1;
  }

function groupKeysOf(w, key) {
  var v = w[key];
  if (Array.isArray(v)) return v.length ? v : ["未設定"];
  return v ? [String(v)] : ["未設定"];
}

function groupSorted(works, key) {
  var map = {};
  works.forEach(function (w) {
    groupKeysOf(w, key).forEach(function (k) {
      (map[k] = map[k] || []).push(w);
    });
  });
  return Object.keys(map).sort(function (a, b) {
    return COLLATOR.compare(a, b);
  });
}

function render() {
  var q = state.query.trim().toLowerCase();
  var works = state.all
    .filter(function (w) {
      return matches(w, q) && (!state.genre || w.genre === state.genre);
    })
    .slice()
    .sort(function (a, b) {
      return (b.added || "").localeCompare(a.added || "") || COLLATOR.compare(a.title, b.title);
    });

  els.count.textContent =
    works.length + " 件の作品" + (q ? "（検索: " + esc(state.query.trim()) + "）" : "");

  var html = "";
  if (!works.length) {
    html =
      '<div class="empty">' +
      icon("search_off") +
      '<span class="type-title-small">該当する作品が見つかりませんでした</span>' +
      '<span class="type-body-medium">条件を変えてお試しください</span>' +
      "</div>";
  } else if (state.sort === "date") {
    html = workGrid(works, "すべての作品");
  } else {
    var key = SORT_KEY[state.sort] || "author"; // author | performers | communities
    groupSorted(works, key).forEach(function (groupName) {
      var groupWorks = works.filter(function (w) {
        return groupKeysOf(w, key).indexOf(groupName) !== -1;
      });
      html += workGrid(groupWorks, groupName);
    });
  }

  els.list.innerHTML = html;
}

  function workGrid(works, groupName) {
    return (
      '<section aria-label="' +
      esc(groupName) +
      '">' +
      '<div class="group-title">' +
      '<span class="group-title__name">' +
      esc(groupName) +
      "</span>" +
      '<span class="group-title__count">' +
      works.length +
      " 件</span></div>" +
      '<div class="works-grid">' +
      works
        .map(function (w, i) {
          return workCard(w, i);
        })
        .join("") +
      "</div></section>"
    );
  }

  function bindUrl() {
    var url = new URL(window.location.href);
    if (state.query) url.searchParams.set("q", state.query);
    else url.searchParams.delete("q");
    if (state.sort !== "date") url.searchParams.set("sort", state.sort);
    else url.searchParams.delete("sort");
    if (state.genre) url.searchParams.set("genre", state.genre);
    else url.searchParams.delete("genre");
    history.replaceState(null, "", url.toString());
  }

  var enterTimer = null;
  function animateEnter() {
    if (!els.list) return;
    els.list.classList.add("is-entering");
    clearTimeout(enterTimer);
    enterTimer = setTimeout(function () {
      els.list.classList.remove("is-entering");
    }, 700);
  }

  function init() {
    els.appbar = document.getElementById("app-bar");
    els.list = document.getElementById("list");
    els.count = document.getElementById("result-count");
    els.search = document.getElementById("search-input");
    els.sort = document.getElementById("sort-select");

    var params = new URLSearchParams(window.location.search);
    state.query = params.get("q") || "";
    els.search.value = state.query;

    els.search.addEventListener("input", function () {
      state.query = els.search.value;
      bindUrl();
      render();
    });

    els.sort.addEventListener("change", function () {
      state.sort = els.sort.value;
      bindUrl();
      render();
    });

    document.querySelectorAll(".segment__btn[data-genre]").forEach(function (btn) {
      btn.addEventListener("click", function () {
        state.genre = btn.getAttribute("data-genre") || "";
        document.querySelectorAll(".segment__btn[data-genre]").forEach(function (b) {
          b.classList.toggle("is-active", b === btn);
        });
        bindUrl();
        render();
      });
    });

    window.addEventListener("scroll", function () {
      els.appbar.classList.toggle("is-elevated", window.scrollY > 4);
    });

    WORKS.load().then(function (works) {
      state.all = works;
      var sortParam = params.get("sort");
      if (sortParam === "date" || sortParam === "author" || sortParam === "performer" || sortParam === "community") {
        state.sort = sortParam;
        els.sort.value = sortParam;
      }
      var genreParam = params.get("genre");
      if (WORKS.GENRES.indexOf(genreParam) !== -1) {
        state.genre = genreParam;
        document.querySelectorAll(".segment__btn[data-genre]").forEach(function (btn) {
          btn.classList.toggle("is-active", btn.getAttribute("data-genre") === genreParam);
        });
      }
      render();
      animateEnter();
    });
  }

  document.addEventListener("DOMContentLoaded", init);
})();