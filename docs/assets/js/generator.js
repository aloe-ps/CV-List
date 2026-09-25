(function () {
  var els = {};
  var workItems = [];
  var activeWorkKey = null;
  var expandedWorkKey = null;
  var nextWorkKey = 1;
  var allWorks = [];
  var metaCache = {};
  var issueLink = null;
  var issueBase = "";
  var toastTimer = null;

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

  function getWork(key) {
    for (var i = 0; i < workItems.length; i += 1) {
      if (workItems[i].key === key) return workItems[i];
    }
    return null;
  }

  function getActiveWork() {
    return getWork(activeWorkKey);
  }

  function getWorkFromNode(node) {
    if (!node || !node.closest) return null;
    var panel = node.closest("[data-work-panel]");
    if (!panel) return null;
    return getWork(panel.getAttribute("data-work-key"));
  }

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

  function addPerformer(work, value) {
    if (!work || !work.elements.performers) return;
    work.elements.performers.insertAdjacentHTML("beforeend", performerRow(value));
  }

  function addMusic(work, m) {
    if (!work || !work.elements.music) return;
    work.elements.music.insertAdjacentHTML("beforeend", musicRow(m));
  }

  function addCommunity(work, value) {
    if (!work || !work.elements.communities) return;
    work.elements.communities.insertAdjacentHTML("beforeend", communityRow(value));
  }

  function clearRepeaters(work) {
    if (!work) return;
    work.elements.performers.innerHTML = "";
    work.elements.music.innerHTML = "";
    work.elements.communities.innerHTML = "";
  }

  function getFieldElements(root) {
    return {
      title: root.querySelector('[data-field="title"]'),
      genre: root.querySelector('[data-field="genre"]'),
      description: root.querySelector('[data-field="description"]'),
      youtube: root.querySelector('[data-field="youtube"]'),
      author: root.querySelector('[data-field="author"]'),
      added: root.querySelector('[data-field="added"]'),
      performers: root.querySelector('[data-repeater="performers"]'),
      music: root.querySelector('[data-repeater="music"]'),
      communities: root.querySelector('[data-repeater="communities"]'),
      autofetchBtn: root.querySelector("[data-fetch]"),
      youtubeHint: root.querySelector('[data-role="youtube-hint"]'),
      removeBtn: root.querySelector("[data-remove-work]")
    };
  }

  function createTriggerParts(root, key) {
    var trigger = root.querySelector("[data-work-tab]");
    var body = root.querySelector("[data-work-body]");
    trigger.id = "work-trigger-" + key;
    trigger.setAttribute("data-work-tab", key);
    trigger.setAttribute("aria-controls", "work-body-" + key);
    trigger.tabIndex = -1;
    body.id = "work-body-" + key;
    body.setAttribute("role", "region");
    body.setAttribute("aria-labelledby", "work-trigger-" + key);
    return {
      trigger: trigger,
      label: trigger.querySelector(".work-item__label"),
      status: trigger.querySelector(".work-item__status"),
      body: body
    };
  }

  function createWork(data, editId) {
    var key = String(nextWorkKey);
    nextWorkKey += 1;

    var root = els.template.content.firstElementChild.cloneNode(true);
    root.id = "work-item-" + key;
    root.setAttribute("data-work-key", key);

    var parts = createTriggerParts(root, key);
    var work = {
      key: key,
      root: root,
      trigger: parts.trigger,
      triggerLabel: parts.label,
      triggerStatus: parts.status,
      body: parts.body,
      elements: getFieldElements(root),
      editId: editId || null,
      autoFillTimer: null,
      requestToken: 0,
      fetching: false,
      metadataHintShown: false,
      dirty: false
    };

    var fields = ["title", "genre", "description", "youtube", "author", "added"];
    fields.forEach(function (name) {
      if (work.elements[name]) {
        work.elements[name].id = key === "1" ? "f-" + name : "work-" + key + "-" + name;
      }
    });
    if (key === "1") {
      if (work.elements.autofetchBtn) work.elements.autofetchBtn.id = "auto-fetch-btn";
      if (work.elements.youtubeHint) work.elements.youtubeHint.id = "youtube-hint";
      if (work.elements.performers) work.elements.performers.id = "repeat-performers";
      if (work.elements.music) work.elements.music.id = "repeat-music";
      if (work.elements.communities) work.elements.communities.id = "repeat-communities";
    }

    els.accordion.appendChild(root);
    workItems.push(work);
    prefill(work, data || {});
    return work;
  }

  function prefill(work, data) {
    if (!work) return;
    var fields = work.elements;
    fields.title.value = data.title || "";
    fields.genre.value = data.genre || "";
    fields.description.value = data.description || "";
    fields.youtube.value = data.youtube || "";
    fields.author.value = data.author || "";
    fields.added.value = data.added || "";

    clearRepeaters(work);
    var performers = Array.isArray(data.performers) ? data.performers : [];
    var music = Array.isArray(data.music) ? data.music : [];
    var communities = Array.isArray(data.communities) ? data.communities : [];

    performers.forEach(function (value) {
      addPerformer(work, value);
    });
    music.forEach(function (value) {
      addMusic(work, value);
    });
    communities.forEach(function (value) {
      addCommunity(work, value);
    });

    if (!performers.length) addPerformer(work);
    if (!music.length) addMusic(work);
    if (!communities.length) addCommunity(work);
  }

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
    if (!containerEl) return out;
    containerEl.querySelectorAll(rowClass).forEach(function (row) {
      var val = row.querySelector(".rp-input");
      if (val && String(val.value).trim()) out.push(String(val.value).trim());
    });
    return out;
  }

  function collectMusic(work) {
    var out = [];
    if (!work || !work.elements.music) return out;
    work.elements.music.querySelectorAll(".repeater-row--multi").forEach(function (row) {
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

  function collectWork(work) {
    if (!work) return null;
    var fields = work.elements;
    var youtube = String(fields.youtube.value || "").trim();
    var title = String(fields.title.value || "").trim();
    var author = String(fields.author.value || "").trim();
    var description = String(fields.description.value || "").trim();
    var added = String(fields.added.value || "").trim();
    var yid = WORKS.parseYouTubeId(youtube);
    var obj = {
      id: work.editId || yid || slugify(title),
      title: title,
      author: author,
      performers: collectRows(fields.performers, ".repeater-row"),
      music: collectMusic(work),
      communities: collectRows(fields.communities, ".repeater-row")
    };
    var genre = String(fields.genre.value || "").trim();
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
    else if (!WORKS.parseYouTubeId(obj.youtube)) missing.push("YouTube URL");
    return missing;
  }

  function hasIdentity(obj) {
    return Boolean(obj.title || obj.youtube);
  }

  function collectEntries() {
    var entries = workItems.map(function (work) {
      var obj = collectWork(work);
      return { work: work, obj: obj, missing: validate(obj), duplicate: false };
    });

    entries.forEach(function (entry) {
      if (!hasIdentity(entry.obj)) return;
      var existing = allWorks.some(function (work) {
        return work.id === entry.obj.id && work.id !== entry.work.editId;
      });
      var batch = entries.some(function (other) {
        return (
          other !== entry &&
          hasIdentity(other.obj) &&
          other.obj.id === entry.obj.id
        );
      });
      entry.duplicate = existing || batch;
    });

    return entries;
  }

  function stringifyOutput(entries) {
    return entries
      .map(function (entry) {
        return JSON.stringify(entry.obj, null, 2);
      })
      .join(",\n");
  }

  function getWorkLabel(work) {
    var title = String(work.elements.title.value || "").trim();
    if (title) return title;
    return "作品" + (workItems.indexOf(work) + 1);
  }

  function renderTrigger(work, entry) {
    var index = workItems.indexOf(work) + 1;
    var label = getWorkLabel(work);
    var state = entry.missing.length ? "missing" : entry.duplicate ? "duplicate" : "ok";
    work.triggerLabel.textContent = label;
    work.trigger.setAttribute("data-state", state);
    work.trigger.setAttribute(
      "aria-label",
      index + "作品目: " + label + (state === "ok" ? "" : "（要確認）")
    );
    work.triggerStatus.textContent = state === "ok" ? "" : "!";
  }

  function highlight(json) {
    var out = esc(json);
    out = out
      .replace(/(&quot;(?:\\.|[^&])*?&quot;)(\s*:)?/g, function (m, str, colon) {
        return colon ? '<span class="k">' + str + "</span>" + colon : '<span class="s">' + str + "</span>";
      })
      .replace(/(:\s*)(-?\d+(?:\.\d+)?(?:e[+-]?\d+)?)/gi, '$1<span class="n">$2</span>')
      .replace(/(:\s*)(true|false|null)\b/gi, '$1<span class="n">$2</span>');
    return out;
  }

  function setValidityChip(chip, text, kind) {
    chip.textContent = text;
    chip.classList.add("chip--fill");
    if (kind === "missing") {
      chip.style.backgroundColor = "var(--md-error-container)";
      chip.style.color = "var(--md-on-error-container)";
    } else if (kind === "duplicate") {
      chip.style.backgroundColor = "var(--md-tertiary-container)";
      chip.style.color = "var(--md-on-tertiary-container)";
    } else {
      chip.style.backgroundColor = "var(--md-primary-container)";
      chip.style.color = "var(--md-on-primary-container)";
    }
  }

  function update() {
    if (!els.jsonView) return null;
    var entries = collectEntries();
    var json = stringifyOutput(entries);
    var missingCount = entries.filter(function (entry) {
      return entry.missing.length > 0;
    }).length;
    var duplicateCount = entries.filter(function (entry) {
      return entry.duplicate;
    }).length;

    els.jsonView.textContent = "";
    var code = document.createElement("code");
    code.innerHTML = highlight(json);
    els.jsonView.appendChild(code);
    els.workCount.textContent = entries.length + "作品";

    entries.forEach(function (entry) {
      renderTrigger(entry.work, entry);
    });

    if (missingCount) {
      setValidityChip(els.validity, "必須項目が未入力 (" + missingCount + "件)", "missing");
    } else if (duplicateCount) {
      setValidityChip(els.validity, "IDが重複しています", "duplicate");
    } else if (entries.length > 1) {
      setValidityChip(els.validity, "OK (" + entries.length + "作品)", "ok");
    } else {
      setValidityChip(els.validity, "OK", "ok");
    }

    updateIssueParams();
    return { entries: entries, json: json, missingCount: missingCount, duplicateCount: duplicateCount };
  }

  function applyWorkState() {
    workItems.forEach(function (item) {
      var expanded = item.key === expandedWorkKey;
      item.root.classList.toggle("is-open", expanded);
      item.body.hidden = !expanded;
      item.trigger.setAttribute("aria-expanded", expanded ? "true" : "false");
      item.trigger.tabIndex = item.key === activeWorkKey ? 0 : -1;
      if (item.elements.removeBtn) {
        item.elements.removeBtn.disabled = workItems.length === 1;
        item.elements.removeBtn.setAttribute(
          "aria-label",
          item.key === activeWorkKey ? "現在の作品を削除" : "この作品を削除"
        );
      }
    });
  }

  function activateWork(work, focus) {
    if (!work) return;
    activeWorkKey = work.key;
    expandedWorkKey = work.key;
    applyWorkState();
    update();
    if (focus) work.elements.title.focus();
  }

  function toggleWork(work) {
    if (!work) return;
    activeWorkKey = work.key;
    expandedWorkKey = expandedWorkKey === work.key ? null : work.key;
    applyWorkState();
    update();
  }

  function addWork() {
    var work = createWork();
    activateWork(work, true);
    showToast("新しい作品フォームを追加しました");
  }

  function removeWork(work) {
    if (!work) return;
    if (workItems.length === 1) {
      showToast("作品を削除するには、まず別の作品を追加してください");
      return;
    }
    clearTimeout(work.autoFillTimer);
    work.requestToken += 1;
    var index = workItems.indexOf(work);
    if (index < 0) return;
    workItems.splice(index, 1);
    work.root.remove();
    var next = workItems[Math.min(index, workItems.length - 1)];
    activateWork(next, false);
    showToast("作品を削除しました");
  }

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

  function isCurrentRequest(work, id, token) {
    return (
      getWork(work.key) === work &&
      work.requestToken === token &&
      WORKS.parseYouTubeId(work.elements.youtube.value) === id
    );
  }

  function fillFromMeta(work, meta, force) {
    function setValue(input, value) {
      if (force || !String(input.value || "").trim()) input.value = value || "";
    }
    setValue(work.elements.title, meta.title);
    setValue(work.elements.description, meta.description);
    var date = /^\d{4}-\d{2}-\d{2}/.exec(meta.publishedAt || "");
    if (date && (force || !String(work.elements.added.value || "").trim())) {
      work.elements.added.value = date[0];
    }
    update();
  }

  function setFetching(work, on) {
    var btn = work.elements.autofetchBtn;
    if (!btn) return;
    work.fetching = on;
    btn.disabled = on;
    var btnIcon = btn.querySelector(".material-symbols-outlined");
    if (!btnIcon) return;
    if (on) {
      btnIcon.textContent = "progress_activity";
      btn.classList.add("is-spinning");
    } else {
      btnIcon.textContent = "auto_awesome";
      btn.classList.remove("is-spinning");
    }
  }

  function fetchAndFill(work, force) {
    if (!work) return;
    clearTimeout(work.autoFillTimer);
    var id = WORKS.parseYouTubeId(work.elements.youtube.value);
    if (!id) {
      showToast("YouTubeのURLを入力してください");
      return;
    }
    var token = ++work.requestToken;
    setFetching(work, true);
    fetchVideoMeta(id)
      .then(function (meta) {
        if (!isCurrentRequest(work, id, token)) return;
        fillFromMeta(work, meta, !!force);
        if (!meta.title) {
          showToast("動画情報を取得できませんでした");
        } else if (meta.description || meta.publishedAt) {
          showToast("タイトル・概要・公開日 を自動入力しました");
        } else {
          showToast("タイトルを自動入力しました（概要・公開日は未設定）");
          if (work.elements.youtubeHint && !work.metadataHintShown && !metadataEndpoint()) {
            work.elements.youtubeHint.textContent =
              "概要・公開日も自動入力するには、docs/assets/js/config.js の youtubeMetadataEndpoint にプロキシURL（worker/ をデプロイ）を設定してください。APIキーがクライアントに公開されません。";
            work.metadataHintShown = true;
          }
        }
      })
      .catch(function () {
        if (isCurrentRequest(work, id, token)) showToast("動画情報を取得できませんでした");
      })
      .then(function () {
        if (isCurrentRequest(work, id, token)) setFetching(work, false);
      });
  }

  function invalidateAutofill(work) {
    clearTimeout(work.autoFillTimer);
    work.requestToken += 1;
    if (work.fetching) setFetching(work, false);
  }

  function scheduleAutofill(work) {
    if (!work) return;
    invalidateAutofill(work);
    work.autoFillTimer = setTimeout(function () {
      if (getWork(work.key) === work && !String(work.elements.title.value || "").trim()) {
        fetchAndFill(work, false);
      }
    }, 900);
  }

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
    var snapshot = collectEntries();
    var missingCount = snapshot.filter(function (entry) {
      return entry.missing.length > 0;
    }).length;
    copyText(
      stringifyOutput(snapshot),
      function () {
        showToast(
          missingCount
            ? "コピーしました（未入力項目に注意）"
            : "JSONをコピーしました"
        );
      },
      function () {
        showToast("コピーに失敗しました");
      }
    );
  }

  function reset() {
    var work = getActiveWork();
    if (!work) return;
    invalidateAutofill(work);
    work.dirty = true;
    prefill(work, {});
    update();
    showToast("現在の作品をリセットしました");
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
    if (main) main.insertBefore(banner, main.firstChild);
  }

  function showToast(msg) {
    if (!els.toast) return;
    els.toast.innerHTML = icon("check_circle") + "<span>" + esc(msg) + "</span>";
    els.toast.classList.add("is-shown");
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function () {
      els.toast.classList.remove("is-shown");
    }, 2200);
  }

  function updateIssueParams() {
    if (!issueLink) return;
    var entries = collectEntries();
    var json = stringifyOutput(entries);
    var title =
      entries.length > 1
        ? "作品追加: " + entries.length + "作品"
        : "作品追加: " + (entries[0].obj.title || "無題");
    issueLink.href =
      issueBase +
      "/issues/new?title=" +
      encodeURIComponent(title) +
      "&body=" +
      encodeURIComponent("```json\n" + json + "\n```");
  }

  function setupGithubLink() {
    var cfg = window.SITE_CONFIG || {};
    var owner = (cfg.owner || "").trim();
    var repo = (cfg.repo || "").trim();
    var branch = (cfg.branch || "master").trim();
    var dataFile = (cfg.dataFile || "data/works.json").trim();
    var btn = els.githubBtn;
    var hint = els.githubHint;

    if (!owner || owner.indexOf("your-github") !== -1) {
      btn.style.display = "none";
      hint.innerHTML =
        '<span class="material-symbols-outlined" style="font-size:16px;vertical-align:-3px">info</span> ' +
        "GitHubのリポジトリ情報が未設定です。docs/assets/js/config.js の owner / repo を設定すると「GitHubで編集」リンクが表示されます。";
      hint.style.display = "block";
      return;
    }

    issueBase = "https://github.com/" + encodeURIComponent(owner) + "/" + encodeURIComponent(repo);
    btn.href = issueBase + "/edit/" + encodeURIComponent(branch) + "/" + dataFile;

    issueLink = document.createElement("a");
    issueLink.className = "btn btn--text btn--small";
    issueLink.href = issueBase + "/issues/new";
    issueLink.target = "_blank";
    issueLink.rel = "noopener noreferrer";
    issueLink.innerHTML = icon("question_answer") + "Issueで提案";
    issueLink.addEventListener("click", updateIssueParams);
    btn.insertAdjacentElement("afterend", issueLink);
    updateIssueParams();
  }

  function init() {
    els.appbar = document.getElementById("app-bar");
    els.accordion = document.getElementById("work-accordion");
    els.template = document.getElementById("work-form-template");
    els.jsonView = document.getElementById("json-view");
    els.workCount = document.getElementById("work-count");
    els.validity = document.getElementById("validity-chip");
    els.copyBtn = document.getElementById("copy-btn");
    els.githubBtn = document.getElementById("github-btn");
    els.resetBtn = document.getElementById("reset-btn");
    els.githubHint = document.getElementById("github-hint");
    els.toast = document.getElementById("toast");

    window.addEventListener("scroll", function () {
      els.appbar.classList.toggle("is-elevated", window.scrollY > 4);
    });

    var firstWork = createWork();
    activateWork(firstWork, false);

    document.addEventListener("input", function (e) {
      var work = getWorkFromNode(e.target);
      if (!work) return;
      work.dirty = true;
      if (e.target === work.elements.youtube) scheduleAutofill(work);
      update();
      if (e.target.classList && e.target.classList.contains("rp-input")) {
        var row = e.target.closest(".repeater-row");
        if (row && row.parentElement.lastElementChild === row && String(e.target.value).trim()) {
          var container = row.parentElement;
          if (container === work.elements.performers) addPerformer(work);
          else if (container === work.elements.communities) addCommunity(work);
        }
      }
    });

    document.addEventListener("change", function (e) {
      var work = getWorkFromNode(e.target);
      if (!work) return;
      work.dirty = true;
      update();
    });

    document.addEventListener("paste", function (e) {
      var work = getWorkFromNode(e.target);
      if (!work || e.target !== work.elements.youtube) return;
      work.dirty = true;
      clearTimeout(work.autoFillTimer);
      update();
      setTimeout(function () {
        if (getWork(work.key) === work && !String(work.elements.title.value || "").trim() && WORKS.parseYouTubeId(work.elements.youtube.value)) {
          fetchAndFill(work, false);
        }
      }, 0);
    });

    document.addEventListener("click", function (e) {
      if (!e.target || !e.target.closest) return;
      var trigger = e.target.closest("[data-work-tab]");
      if (trigger) {
        toggleWork(getWork(trigger.getAttribute("data-work-tab")));
        return;
      }
      if (e.target.closest("[data-add-work]")) {
        addWork();
        return;
      }
      var removeBtn = e.target.closest("[data-remove-work]");
      if (removeBtn) {
        var removedWork = getWorkFromNode(removeBtn);
        if (removedWork) removedWork.dirty = true;
        removeWork(removedWork);
        return;
      }
      var fetchBtn = e.target.closest("[data-fetch]");
      if (fetchBtn) {
        var fetchWork = getWorkFromNode(fetchBtn);
        if (fetchWork) fetchWork.dirty = true;
        fetchAndFill(fetchWork, true);
        return;
      }
      var rowRemoveBtn = e.target.closest(".rp-remove");
      if (rowRemoveBtn) {
        var rowWork = getWorkFromNode(rowRemoveBtn);
        var row = rowRemoveBtn.closest(".repeater-row, .repeater-row--multi");
        if (row) row.remove();
        if (rowWork) rowWork.dirty = true;
        update();
        return;
      }
      var addBtn = e.target.closest("[data-add]");
      if (addBtn) {
        var work = getWorkFromNode(addBtn);
        var kind = addBtn.getAttribute("data-add");
        if (!work) return;
        work.dirty = true;
        if (kind === "performers") addPerformer(work);
        else if (kind === "music") addMusic(work);
        else if (kind === "communities") addCommunity(work);
        update();
      }
    });

    document.addEventListener("keydown", function (e) {
      if (!e.target || !e.target.closest) return;
      var trigger = e.target.closest("[data-work-tab]");
      if (!trigger) return;
      var index = workItems.findIndex(function (work) {
        return work.trigger === trigger;
      });
      if (index < 0) return;
      var nextIndex = index;
      if (e.key === "ArrowDown" || e.key === "ArrowRight") nextIndex = (index + 1) % workItems.length;
      else if (e.key === "ArrowUp" || e.key === "ArrowLeft") nextIndex = (index - 1 + workItems.length) % workItems.length;
      else if (e.key === "Home") nextIndex = 0;
      else if (e.key === "End") nextIndex = workItems.length - 1;
      else return;
      e.preventDefault();
      activateWork(workItems[nextIndex], false);
      workItems[nextIndex].trigger.focus();
    });

    els.copyBtn.addEventListener("click", copyJson);
    els.resetBtn.addEventListener("click", reset);

    var params = new URLSearchParams(window.location.search);
    var id = params.get("id") || "";
    WORKS.load().then(function (works) {
      allWorks = works;
      if (id) {
        var existing = WORKS.byId(works, id);
        firstWork.editId = id;
        if (!firstWork.dirty) {
          if (existing) {
            prefill(firstWork, existing);
            showEditBanner(existing);
          } else {
            prefill(firstWork, {});
          }
        }
      }
      setupGithubLink();
      update();
    });
  }

  document.addEventListener("DOMContentLoaded", init);
})();
