(function () {
  var els = {};
  var editId = null;
  var allWorks = [];

  function esc(text) {
    return String(text)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;");
  }

  function icon(name) {
    return '<span class="material-symbols-outlined" aria-hidden="true">' + esc(name) + "</span>";
  }

  /* ------------------------------------------------ Repeaters */

  function performerRow(value) {
    value = value || "";
    return (
      '<div class="repeater-row">' +
      '<input class="field__control rp-input" type="text" placeholder="出演者名" value="' +
      esc(value) +
      '" />' +
      '<button class="icon-btn icon-btn--small rp-remove" type="button" aria-label="この出演者を削除">' +
      icon("close") +
      "</button></div>"
    );
  }

  function musicRow(m) {
    m = m || {};
    return (
      '<div class="repeater-row--multi">' +
      '<input class="field__control rp-title" type="text" placeholder="楽曲名" value="' +
      esc(m.title || "") +
      '" />' +
      '<input class="field__control rp-url" type="url" placeholder="楽曲のリンク（任意）" value="' +
      esc(m.url || "") +
      '" />' +
      '<input class="field__control rp-composer" type="text" placeholder="作曲者" value="' +
      esc(m.composer || "") +
      '" />' +
      '<button class="icon-btn icon-btn--small rp-remove" type="button" aria-label="この楽曲を削除">' +
      icon("close") +
      "</button></div>"
    );
  }

  function communityRow(value) {
    value = value || "";
    return (
      '<div class="repeater-row">' +
      '<input class="field__control rp-input" type="text" placeholder="コミュニティ名" value="' +
      esc(value) +
      '" />' +
      '<button class="icon-btn icon-btn--small rp-remove" type="button" aria-label="このコミュニティを削除">' +
      icon("close") +
      "</button></div>"
    );
  }

  function addPerformer(value) {
    els.performers.insertAdjacentHTML("beforeend", performerRow(value));
  }

  function addMusic(m) {
    els.music.insertAdjacentHTML("beforeend", musicRow(m));
  }

  function addCommunity(value) {
    els.communities.insertAdjacentHTML("beforeend", communityRow(value));
  }

  /* ------------------------------------------------ Collect */

  function slugify(text) {
    var s = String(text || "")
      .trim()
      .toLowerCase()
      .replace(/[^\w\s\u3040-\u30ff\u3400-\u9fff-]/g, "")
      .replace(/[\s_]+/g, "-")
      .replace(/-+/g, "-")
      .replace(/^-|-$/g, "");
    return s || "untitled";
  }

  function collectRows(containerEl, rowClass) {
    var out = [];
    containerEl.querySelectorAll(rowClass).forEach(function (row) {
      var val = row.querySelector(".rp-input");
      if (val && String(val.value).trim()) out.push(String(val.value).trim());
    });
    return out;
  }

  function collectMusic() {
    var out = [];
    els.music.querySelectorAll(".repeater-row--multi").forEach(function (row) {
      var title = (row.querySelector(".rp-title") || {}).value || "";
      var url = (row.querySelector(".rp-url") || {}).value || "";
      var composer = (row.querySelector(".rp-composer") || {}).value || "";
      if (title.trim() || url.trim() || composer.trim()) {
        var entry = {};
        if (title.trim()) entry.title = title.trim();
        if (url.trim()) entry.url = url.trim();
        if (composer.trim()) entry.composer = composer.trim();
        out.push(entry);
      }
    });
    return out;
  }

  function collect() {
    var youtube = String(els.youtube.value || "").trim();
    var title = String(els.title.value || "").trim();
    var author = String(els.author.value || "").trim();
    var description = String(els.description.value || "").trim();
    var added = String(els.added.value || "").trim();

    var yid = WORKS.parseYouTubeId(youtube);
    var obj = {
      id: yid || slugify(title),
      title: title,
      author: author,
      performers: collectRows(els.performers, ".repeater-row"),
      music: collectMusic(),
      communities: collectRows(els.communities, ".repeater-row")
    };
    var genre = String(els.genre.value || "").trim();
    if (genre) obj.genre = genre;
    if (description) obj.description = description;
    if (youtube) obj.youtube = youtube;
    if (added) obj.added = added;
    return obj;
  }

  function validate(obj) {
    var missing = [];
    if (!obj.title) missing.push("タイトル");
    if (!obj.author) missing.push("作者");
    if (!obj.youtube) missing.push("YouTube URL");
    return missing;
  }

  /* ------------------------------------------------ JSON highlight */

  function highlight(obj) {
    var json = JSON.stringify(obj, null, 2);
    var out = esc(json);
    out = out
      .replace(/(&quot;(?:\\.|[^&])*?&quot;)(\s*:)?/g, function (m, str, colon) {
        return colon ? '<span class="k">' + str + "</span>" + colon : '<span class="s">' + str + "</span>";
      })
      .replace(/(:\s*)(-?\d+(?:\.\d+)?(?:e[+-]?\d+)?)/gi, '$1<span class="n">$2</span>')
      .replace(/(:\s*)(true|false|null)\b/gi, '$1<span class="n">$2</span>');
    return out;
  }

  /* ------------------------------------------------ Preview / validation */

  function update() {
    var obj = collect();
    var missing = validate(obj);

    els.jsonView.textContent = "";
    var code = document.createElement("code");
    code.innerHTML = highlight(obj);
    els.jsonView.appendChild(code);

    var duplicate = !editId && allWorks.some(function (w) {
      return w.id === obj.id;
    });

    var chip = els.validity;
    if (missing.length) {
      chip.textContent = "必須項目が未入力";
      chip.classList.add("chip--fill");
      chip.style.backgroundColor = "var(--md-error-container)";
      chip.style.color = "var(--md-on-error-container)";
    } else if (duplicate) {
      chip.textContent = "既存作品と同じID";
      chip.classList.add("chip--fill");
      chip.style.backgroundColor = "var(--md-tertiary-container)";
      chip.style.color = "var(--md-on-tertiary-container)";
    } else {
      chip.textContent = "OK";
      chip.classList.add("chip--fill");
      chip.style.backgroundColor = "var(--md-primary-container)";
      chip.style.color = "var(--md-on-primary-container)";
    }
    return { obj: obj, missing: missing };
  }

  /* ------------------------------------------------ YouTube metadata */

  var metaCache = {};
  var autofetchBtnHint = false;

  function metadataEndpoint() {
    return String((window.SITE_CONFIG && window.SITE_CONFIG.youtubeMetadataEndpoint) || "").trim();
  }

  function youTubeKey() {
    return String((window.SITE_CONFIG && window.SITE_CONFIG.youtubeApiKey) || "").trim();
  }

  function fetchOfficial(id) {
    var key = youTubeKey();
    return fetch(
      "https://www.googleapis.com/youtube/v3/videos?part=snippet&id=" +
        encodeURIComponent(id) +
        "&key=" +
        encodeURIComponent(key)
    )
      .then(function (r) {
        if (!r.ok) throw new Error("api");
        return r.json();
      })
      .then(function (json) {
        var v = json.items && json.items[0];
        var s = v ? v.snippet : null;
        if (!s || !s.title) throw new Error("notfound");
        return {
          source: "api",
          title: s.title || "",
          description: s.description || "",
          publishedAt: s.publishedAt || ""
        };
      });
  }

  function fetchEndpoint(id) {
    var ep = metadataEndpoint();
    return fetch(
      ep +
        (ep.indexOf("?") === -1 ? "?" : "&") +
        "url=" +
        encodeURIComponent("https://youtu.be/" + id)
    )
      .then(function (r) {
        if (!r.ok) throw new Error("endpoint");
        return r.json();
      })
      .then(function (json) {
        if (!json || typeof json.title === "undefined") throw new Error("endpoint notfound");
        return {
          source: "endpoint",
          title: json.title || "",
          description: json.description || "",
          publishedAt: json.publishedAt || ""
        };
      });
  }

  function fetchInnerTube(id) {
    var body = JSON.stringify({
      context: { client: { clientName: "WEB", clientVersion: "2.20210909.01.00", hl: "ja" } },
      videoId: id
    });
    return fetch(
      "https://www.youtube.com/youtubei/v1/player?" +
        encodeURIComponent("AIzaSyAO_FJ2SlqU8Q4STEHLGCilw_Y9_11qcW8"),
      { method: "POST", headers: { "Content-Type": "application/json" }, body: body }
    )
      .then(function (r) {
        if (!r.ok) throw new Error("innertube");
        return r.json();
      })
      .then(function (json) {
        var vd = json.videoDetails;
        var mf = json.microformat && json.microformat.playerMicroformatRenderer;
        if (!vd || !vd.title) throw new Error("innertube notfound");
        return {
          source: "innertube",
          title: vd.title || "",
          description: vd.shortDescription || "",
          publishedAt: (mf && (mf.uploadDate || mf.publishDate)) || ""
        };
      });
  }

  function fetchOEmbed(id) {
    return new Promise(function (resolve, reject) {
      var cb = "cv_oembed_" + Date.now() + "_" + Math.round(Math.random() * 1e6).toString(36);
      var script = document.createElement("script");
      var done = false;
      function cleanup() {
        delete window[cb];
        if (script.parentNode) script.parentNode.removeChild(script);
      }
      window[cb] = function (data) {
        done = true;
        cleanup();
        resolve({ source: "oembed", title: (data && data.title) || "", description: "", publishedAt: "" });
      };
      script.onerror = function () {
        if (!done) {
          done = true;
          cleanup();
          reject(new Error("oembed failed"));
        }
      };
      script.src =
        "https://www.youtube.com/oembed?url=" +
        encodeURIComponent("https://youtu.be/" + id) +
        "&format=json&callback=" +
        cb;
      document.head.appendChild(script);
    });
  }

  function fetchVideoMeta(id) {
    var cached = metaCache[id];
    if (cached && Date.now() - cached.t < 10 * 60 * 1000) return Promise.resolve(cached.meta);
    var p;
    if (metadataEndpoint()) {
      p = fetchEndpoint(id).catch(function () {
        return fetchOEmbed(id);
      });
    } else if (youTubeKey()) {
      p = fetchOfficial(id).catch(function () {
        return fetchOEmbed(id);
      });
    } else {
      p = fetchInnerTube(id).catch(function () {
        return fetchOEmbed(id);
      });
    }
    return p.then(function (meta) {
      metaCache[id] = { meta: meta, t: Date.now() };
      return meta;
    });
  }

  function fillFromMeta(meta, force) {
    function setValue(input, value) {
      if (force || !String(input.value || "").trim()) input.value = value || "";
    }
    setValue(els.title, meta.title);
    setValue(els.description, meta.description);
    var date = /^\d{4}-\d{2}-\d{2}/.exec(meta.publishedAt || "");
    if (date && (force || !String(els.added.value || "").trim())) {
      els.added.value = date[0];
    }
    update();
  }

  function setFetching(on) {
    var btn = els.autofetchBtn;
    if (!btn) return;
    btn.disabled = on;
    var icon = btn.querySelector(".material-symbols-outlined");
    if (icon) {
      if (on) {
        icon.textContent = "progress_activity";
        btn.classList.add("is-spinning");
      } else {
        icon.textContent = "auto_awesome";
        btn.classList.remove("is-spinning");
      }
    }
  }

  function fetchAndFill(force) {
    var id = WORKS.parseYouTubeId(els.youtube.value);
    if (!id) {
      showToast("YouTubeのURLを入力してください");
      return;
    }
    setFetching(true);
    fetchVideoMeta(id)
      .then(function (meta) {
        fillFromMeta(meta, !!force);
        if (!meta.title) {
          showToast("動画情報を取得できませんでした");
        } else if (meta.description || meta.publishedAt) {
          showToast("タイトル・概要・公開日 を自動入力しました");
        } else {
          showToast("タイトルを自動入力しました（概要・公開日は未設定）");
          if (els.youtubeHint && !autofetchBtnHint && !metadataEndpoint()) {
            els.youtubeHint.textContent =
              "概要・公開日も自動入力するには、site/assets/js/config.js の youtubeMetadataEndpoint にプロキシURL（worker/ をデプロイ）を設定してください。APIキーがクライアントに公開されません。";
            autofetchBtnHint = true;
          }
        }
      })
      .catch(function () {
        showToast("動画情報を取得できませんでした");
      })
      .then(function () {
        setFetching(false);
      });
  }

  /* ------------------------------------------------ Actions */

  function copyText(text, done, fail) {
    function fallback() {
      var ta = document.createElement("textarea");
      ta.value = text;
      ta.style.position = "fixed";
      ta.style.opacity = "0";
      document.body.appendChild(ta);
      ta.focus();
      ta.select();
      try {
        if (document.execCommand("copy")) done();
        else fail();
      } catch (e) {
        fail();
      }
      document.body.removeChild(ta);
    }
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(text).then(done, fallback);
    } else {
      fallback();
    }
  }

  function copyJson() {
    var obj = collect();
    var missing = validate(obj);
    copyText(
      JSON.stringify(obj, null, 2),
      function () {
        showToast(missing.length ? "コピーしました（未入力項目に注意）" : "JSONをコピーしました");
      },
      function () {
        showToast("コピーに失敗しました");
      }
    );
  }

  function reset() {
    els.title.value = "";
    els.description.value = "";
    els.youtube.value = "";
    els.author.value = "";
    els.added.value = "";
    els.genre.value = "";
    els.performers.innerHTML = "";
    els.music.innerHTML = "";
    els.communities.innerHTML = "";
    addPerformer();
    addMusic();
    addCommunity();
    update();
  }

  function showEditBanner(w) {
    var banner = document.createElement("div");
    banner.className = "info-card";
    banner.style.margin = "16px 0 0";
    banner.innerHTML =
      '<div class="info-card__icon">' +
      icon("edit_note") +
      "</div>" +
      '<div class="info-card__body"><span class="type-title-small">編集モード</span>' +
      "<p>'" +
      esc(w.title) +
      "' の情報を修正しています。生成されたJSONで既存のエントリを置き換える形でPull Requestを作成してください。</p></div>";
    var main = document.querySelector("main");
    main.insertBefore(banner, main.firstChild);
  }

  /* ------------------------------------------------ Toast */

  var toastTimer = null;
  function showToast(msg) {
    els.toast.innerHTML = icon("check_circle") + "<span>" + esc(msg) + "</span>";
    els.toast.classList.add("is-shown");
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function () {
      els.toast.classList.remove("is-shown");
    }, 2200);
  }

  /* ------------------------------------------------ Init */

  function prefill(w) {
    els.title.value = w.title || "";
    els.description.value = w.description || "";
    els.youtube.value = w.youtube || "";
    els.author.value = w.author || "";
    els.added.value = w.added || "";
    els.genre.value = w.genre || "";
    (w.performers || []).forEach(addPerformer);
    (w.music || []).forEach(addMusic);
    (w.communities || []).forEach(addCommunity);
  }

  function setupGithubLink() {
    var cfg = window.SITE_CONFIG || {};
    var owner = (cfg.owner || "").trim();
    var repo = (cfg.repo || "").trim();
    var branch = (cfg.branch || "main").trim();
    var dataFile = (cfg.dataFile || "data/works.json").trim();

    var btn = els.githubBtn;
    var hint = els.githubHint;

    if (!owner || owner.indexOf("your-github") !== -1) {
      btn.style.display = "none";
      hint.innerHTML =
        '<span class="material-symbols-outlined" style="font-size:16px;vertical-align:-3px">info</span> ' +
        "GitHubのリポジトリ情報が未設定です。site/assets/js/config.js の owner / repo を設定すると「GitHubで編集」リンクが表示されます。";
      hint.style.display = "block";
      return;
    }

    var base = "https://github.com/" + encodeURIComponent(owner) + "/" + encodeURIComponent(repo);
    btn.href = base + "/edit/" + encodeURIComponent(branch) + "/" + dataFile;

    var issue = document.createElement("a");
    issue.className = "btn btn--text btn--small";
    issue.href = base + "/issues/new";
    issue.target = "_blank";
    issue.rel = "noopener noreferrer";
    issue.innerHTML = icon("question_answer") + "Issueで提案";

    function setIssueParams() {
      var obj = collect();
      issue.href =
        base +
        "/issues/new?title=" +
        encodeURIComponent("作品追加: " + obj.title) +
        "&body=" +
        encodeURIComponent("```json\n" + JSON.stringify(obj, null, 2) + "\n```");
    }

    document.addEventListener("input", setIssueParams);
    document.addEventListener("click", setIssueParams);
    issue.addEventListener("click", setIssueParams);
    setIssueParams();

    btn.insertAdjacentElement("afterend", issue);
  }

  function init() {
    els.appbar = document.getElementById("app-bar");
    els.title = document.getElementById("f-title");
    els.genre = document.getElementById("f-genre");
    els.description = document.getElementById("f-description");
    els.youtube = document.getElementById("f-youtube");
    els.author = document.getElementById("f-author");
    els.added = document.getElementById("f-added");
    els.performers = document.getElementById("repeat-performers");
    els.music = document.getElementById("repeat-music");
    els.communities = document.getElementById("repeat-communities");
    els.jsonView = document.getElementById("json-view");
    els.validity = document.getElementById("validity-chip");
    els.copyBtn = document.getElementById("copy-btn");
    els.githubBtn = document.getElementById("github-btn");
    els.resetBtn = document.getElementById("reset-btn");
    els.githubHint = document.getElementById("github-hint");
    els.autofetchBtn = document.getElementById("auto-fetch-btn");
    els.youtubeHint = document.getElementById("youtube-hint");
    els.toast = document.getElementById("toast");

    var params = new URLSearchParams(window.location.search);
    var id = params.get("id") || "";
    var initialSort = null;

    window.addEventListener("scroll", function () {
      els.appbar.classList.toggle("is-elevated", window.scrollY > 4);
    });

    addPerformer();
    addMusic();
    addCommunity();

    document.addEventListener("input", function (e) {
      update();
      if (e.target.classList && e.target.classList.contains("rp-input")) {
        var row = e.target.closest(".repeater-row");
        if (row && row === row.parentElement.lastElementChild && String(e.target.value).trim()) {
          var container = row.parentElement;
          if (container === els.performers) addPerformer();
          else addCommunity();
        }
      }
    });

    document.addEventListener("change", update);

    document.addEventListener("click", function (e) {
      var removeBtn = e.target.closest(".rp-remove");
      if (removeBtn) {
        removeBtn.closest(".repeater-row, .repeater-row--multi").remove();
        update();
        return;
      }
      var addBtn = e.target.closest("[data-add]");
      if (addBtn) {
        var kind = addBtn.getAttribute("data-add");
        if (kind === "performers") addPerformer();
        else if (kind === "music") addMusic();
        else if (kind === "communities") addCommunity();
        update();
      }
    });

    els.copyBtn.addEventListener("click", copyJson);
    els.resetBtn.addEventListener("click", reset);

    var autofillTimer = null;
    function scheduleAutofill() {
      clearTimeout(autofillTimer);
      autofillTimer = setTimeout(function () {
        if (!String(els.title.value || "").trim()) fetchAndFill(false);
      }, 900);
    }
    els.youtube.addEventListener("input", scheduleAutofill);
    els.youtube.addEventListener("paste", function () {
      clearTimeout(autofillTimer);
      if (!String(els.title.value || "").trim() && WORKS.parseYouTubeId(els.youtube.value)) {
        fetchAndFill(false);
      }
    });
    els.autofetchBtn.addEventListener("click", function () {
      fetchAndFill(true);
    });

    WORKS.load().then(function (works) {
      allWorks = works;
      if (id) {
        editId = id;
        var existing = WORKS.byId(works, id);
        if (existing) {
          prefill(existing);
          showEditBanner(existing);
        } else {
          prefill({ performers: [], music: [], communities: [] });
        }
      }
      setupGithubLink();
      update();
    });
  }

  document.addEventListener("DOMContentLoaded", init);
})();