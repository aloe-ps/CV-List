(function () {
  var els = {};
  var playerContext = null;

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

  function chip(label) {
    return '<span class="chip chip--fill">' + esc(label) + "</span>";
  }

  function videoHtml(w, yid) {
    return (
      '<div class="detail__video">' +
      '<iframe src="https://www.youtube.com/embed/' +
      encodeURIComponent(yid) +
      '?rel=0&modestbranding=1&playsinline=1&enablejsapi=1&feature=oembed" title="' +
      esc(w.title) +
      '" frameborder="0" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share" referrerpolicy="strict-origin-when-cross-origin" allowfullscreen></iframe>' +
      "</div>"
    );
  }

  function playerFallback(code) {
    var ctx = playerContext;
    if (!ctx) return;
    var wrap = ctx.frame.closest(".detail__video");
    if (!wrap) return;
    var wobble = ctx.title ? esc(ctx.title) : "";
    wrap.innerHTML =
      '<img class="detail__video-thumb" src="https://i.ytimg.com/vi/' +
      encodeURIComponent(ctx.yid) +
      '/hqdefault.jpg" alt="' +
      wobble +
      '" loading="lazy">' +
      '<div class="detail__video-fallback">' +
      icon("play_circle") +
      '<span class="type-title-small">プレーヤーでの再生に失敗しました（エラーコード: ' +
      code +
      "）</span>" +
      '<a class="btn btn--filled" href="' +
      esc(ctx.watchUrl) +
      '" target="_blank" rel="noopener noreferrer">' +
      icon("open_in_new") +
      "YouTubeで開く</a>" +
      "</div>";
  }

  function onPlayerMessage(e) {
    if (!playerContext) return;
    if (e.source !== playerContext.frame.contentWindow) return;
    var d = e.data;
    if (!d || d.event !== "onError") return;
    var code = parseInt(d.info, 10) || 0;
    if (code === 2 || code === 5 || code === 100 || code === 101 || code === 150 || code === 153) {
      playerFallback(code);
    }
  }

  function section(title, iconName, body) {
    return (
      '<section class="section">' +
      '<h2 class="section__title">' +
      icon(iconName) +
      esc(title) +
      "</h2>" +
      '<div class="section__body">' +
      body +
      "</div></section>"
    );
  }

  function performerList(w) {
    if (!w.performers.length) return '<p class="type-body-medium" style="color:var(--md-on-surface-variant)">登録なし</p>';
    return (
      '<ul class="list">' +
      w.performers
        .map(function (p) {
          return (
            '<li class="list-item">' +
            '<span class="list-item__icon">' +
            icon("person") +
            "</span>" +
            '<div class="list-item__body">' +
            '<div class="list-item__title">' +
            esc(p) +
            "</div></div></li>"
          );
        })
        .join("") +
      "</ul>"
    );
  }

  function musicList(w) {
    if (!w.music.length) return '<p class="type-body-medium" style="color:var(--md-on-surface-variant)">登録なし</p>';
    return (
      '<ul class="list">' +
      w.music
        .map(function (m, idx) {
          var title = m.title ? esc(m.title) : "（楽曲名不明）";
          var metaParts = [];
          if (m.composer) metaParts.push("作曲: " + esc(m.composer));
          var link = "";
          if (m.url) {
            link =
              '<a class="icon-btn icon-btn--small list-item__action" href="' +
              esc(m.url) +
              '" target="_blank" rel="noopener noreferrer" aria-label="楽曲' +
              (idx + 1) +
              ' のリンクを開く">' +
              icon("open_in_new") +
              "</a>";
          }
          return (
            '<li class="list-item">' +
            '<span class="list-item__icon">' +
            icon("music_note") +
            "</span>" +
            '<div class="list-item__body">' +
            '<div class="list-item__title">' +
            title +
            "</div>" +
            (metaParts.length ? '<div class="list-item__caption">' + metaParts.join(" ") + "</div>" : "") +
            "</div>" +
            link +
            "</li>"
          );
        })
        .join("") +
      "</ul>"
    );
  }

  function communityList(w) {
    if (!w.communities.length) return '<p class="type-body-medium" style="color:var(--md-on-surface-variant)">登録なし</p>';
    return (
      '<div class="card__chips" style="padding:4px 0">' +
      w.communities.map(chip).join("") +
      "</div>"
    );
  }

  function render(w) {
    document.title = w.title + " | CV-LIST";
    els.barTitle.textContent = w.title;
    var yid = WORKS.parseYouTubeId(w.youtube);
    var player = yid
      ? videoHtml(w, yid)
      : '<div class="empty" style="background:var(--md-surface-container);border-radius:16px;">' +
        icon("videocam_off") +
        '<span class="type-title-small">動画が登録されていません</span>' +
        "</div>";
    els.detail.innerHTML =
      player +
      '<h1 class="detail__title">' +
      esc(w.title) +
      "</h1>" +
      '<div class="detail__meta">' +
      (w.genre
        ? '<span class="chip chip--fill" title="ジャンル">' + esc(w.genre) + "</span>"
        : "") +
      (w.added
        ? '<span class="chip" style="border-color:var(--md-outline-variant)">追加日: ' + esc(w.added) + "</span>"
        : "") +
      '<button class="btn btn--text btn--small" id="share-btn" type="button">' +
      icon("link") +
      "リンクをコピー</button>" +
      '<a class="btn btn--text btn--small" href="generator.html?id=' +
      encodeURIComponent(w.id) +
      '" title="この作品の情報を修正してPRを送る">' +
      icon("edit") +
      "編集提案</a>" +
      "</div>" +
      (w.description
        ? '<p class="detail__desc type-body-large">' + esc(w.description) + "</p>"
        : "") +
      section("作者", "person", '<div class="list-item" style="border-radius:12px">' +
        '<span class="list-item__icon">' + icon("badge") + "</span>" +
        '<div class="list-item__body"><div class="list-item__title">' + esc(w.author) + "</div></div></div>") +
      section("出演者", "groups", performerList(w)) +
      section("使用楽曲", "library_music", musicList(w)) +
      section("コミュニティ", "forum", communityList(w));

    var frame = els.detail.querySelector(".detail__video iframe");
    if (frame && yid) {
      playerContext = { frame: frame, yid: yid, title: w.title, watchUrl: w.youtube };
    }

    var shareBtn = document.getElementById("share-btn");
    if (shareBtn) {
      shareBtn.addEventListener("click", function () {
        var url = window.location.href;
        function done() {
          showToast("リンクをコピーしました");
        }
        function fallback() {
          var ta = document.createElement("textarea");
          ta.value = url;
          document.body.appendChild(ta);
          ta.select();
          try {
            document.execCommand("copy");
            done();
          } catch (e) {}
          document.body.removeChild(ta);
        }
        if (navigator.clipboard && navigator.clipboard.writeText) {
          navigator.clipboard.writeText(url).then(done, fallback);
        } else {
          fallback();
        }
      });
    }
  }

  var toastTimer = null;
  function showToast(msg) {
    els.toast.innerHTML = icon("check_circle") + "<span>" + esc(msg) + "</span>";
    els.toast.classList.add("is-shown");
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function () {
      els.toast.classList.remove("is-shown");
    }, 2000);
  }

  function init() {
    els.appbar = document.getElementById("app-bar");
    els.barTitle = document.getElementById("bar-title");
    els.detail = document.getElementById("detail");
    els.toast = document.getElementById("toast");

    window.addEventListener("scroll", function () {
      els.appbar.classList.toggle("is-elevated", window.scrollY > 4);
    });

    window.addEventListener("message", onPlayerMessage);

    var params = new URLSearchParams(window.location.search);
    var id = params.get("id") || "";

    WORKS.load().then(function (works) {
      var w = WORKS.byId(works, id);
      if (w) {
        render(w);
      } else {
        els.barTitle.textContent = "作品が見つかりません";
        els.detail.innerHTML =
          '<div class="empty">' +
          icon("search_off") +
          '<span class="type-title-small">作品が見つかりませんでした</span>' +
          '<a class="btn btn--tonal" style="margin-top:8px" href="index.html">一覧に戻る</a>' +
          "</div>";
      }
    });
  }

  document.addEventListener("DOMContentLoaded", init);
})();