// YouTubeメタデータ取得プロキシ（Cloudflare Workers 用）
// このプロキシがYouTube Data API v3のキーを保持するため、
// GitHub Pagesに公開してもAPIキーはクライアントに漏れません。
//
// 受け付ける操作は次の2つだけです。
//   1. 動画URL → snippetの取得
//   2. 再生リストURL → 再生リスト内の動画（最大50件/回、ページトークンで分割）
// それ以外（GET以外のメソッド、"/"以外のパス、許可外のパラメータ、
// 不正なYouTube URL、許可外オリジン）はすべて拒否します。
//
// デプロイ方法:
//   1. https://dash.cloudflare.com で Workers を作成し、このファイルをデプロイ
//   2. wrangler secret put YOUTUBE_API_KEY     # YouTube Data API v3 のキー
//   3. wrangler secret put ALLOWED_ORIGIN      # 例: https://<user>.github.io
//      （設定しない場合は全オリジン許可。ただし許可を推奨）
//   4. docs/assets/js/config.js の youtubeMetadataEndpoint を
//      "https://<your-worker>.workers.dev" に設定
//
// 呼び出し: GET /?url=https://youtu.be/<VIDEO_ID>
// 応答:    { "title": "...", "description": "...", "publishedAt": "..." }
//
// 呼び出し: GET /?url=https://www.youtube.com/playlist?list=<PLAYLIST_ID>[&maxResults=50][&pageToken=...]
// 応答:    { "type": "playlist", "playlistId": "...", "title": "...", "totalResults": 12,
//            "nextPageToken": "", "items": [ { "videoId": "...", "title": "...",
//            "description": "...", "publishedAt": "...", "position": 0 } ] }
//            title は先頭ページ（pageToken なし）でのみ取得します。
//            2ページ目以降は同じ値になるため API を無駄に消費しません。

var VIDEO_ID_RE = /^[A-Za-z0-9_-]{11}$/;
var PLAYLIST_ID_RE = /^[A-Za-z0-9_-]{10,128}$/;
var PAGE_TOKEN_RE = /^[A-Za-z0-9_-]{10,128}$/;
var MAX_ITEMS_PER_REQUEST = 50;

function respond(obj, status, request, env) {
  var headers = {
    "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": "no-store"
  };
  var allowedOrigin = env && env.ALLOWED_ORIGIN ? env.ALLOWED_ORIGIN : "*";
  if (request) {
    var origin = (request.headers.get("Origin") || "").trim();
    if (allowedOrigin === "*") {
      headers["Access-Control-Allow-Origin"] = "*";
    } else if (origin && origin === allowedOrigin) {
      headers["Access-Control-Allow-Origin"] = origin;
      headers["Vary"] = "Origin";
    }
    if (request.method === "OPTIONS") {
      headers["Access-Control-Allow-Methods"] = "GET, OPTIONS";
      headers["Access-Control-Allow-Headers"] = "Content-Type";
    }
  }
  var body = status === 204 ? null : JSON.stringify(obj);
  return new Response(body, { status: status || 200, headers: headers });
}

// 許可するYouTube URLのみから動画ID(11桁)を抽出し、それ以外はnullを返す
function extractVideoId(target) {
  if (typeof target !== "string" || !target) return null;
  var url;
  try {
    url = new URL(target);
  } catch (e) {
    return null;
  }
  if (url.protocol !== "http:" && url.protocol !== "https:") return null;

  var host = url.hostname.toLowerCase();
  var id = null;

  if (host === "youtu.be") {
    var segs = url.pathname.split("/").filter(Boolean);
    if (segs.length === 1) id = segs[0];
  } else if (host === "youtube.com" || host === "www.youtube.com" || host === "m.youtube.com") {
    if (url.pathname === "/watch") {
      id = url.searchParams.get("v");
    } else {
      var m = /^\/(?:shorts|embed|live)\/([A-Za-z0-9_-]{11})\/?$/.exec(url.pathname);
      if (m) id = m[1];
    }
  } else {
    return null;
  }

  return id && VIDEO_ID_RE.test(id) ? id : null;
}

// 再生リストURLから再生リストIDを抽出する（/playlist?list=... のみ許可）
function extractPlaylistId(target) {
  if (typeof target !== "string" || !target) return null;
  var url;
  try {
    url = new URL(target);
  } catch (e) {
    return null;
  }
  if (url.protocol !== "http:" && url.protocol !== "https:") return null;

  var host = url.hostname.toLowerCase();
  if (host !== "youtube.com" && host !== "www.youtube.com" && host !== "m.youtube.com") {
    return null;
  }
  if (url.pathname !== "/playlist") return null;

  var list = url.searchParams.get("list");
  return list && PLAYLIST_ID_RE.test(list) ? list : null;
}

function parseBoundedInt(value, min, max, fallback) {
  if (value === null || value === undefined || value === "") return fallback;
  if (!/^\d{1,4}$/.test(value)) return null;
  var n = parseInt(value, 10);
  return n >= min && n <= max ? n : null;
}

// YouTube Data API のエラーステータスをクライアントへ伝える。
// 入力に起因するもの（400 / 404）だけそのまま返し、
// 認証・レート制限・障害（401 / 403 / 429 / 5xx など）は
// 呼び出し側の入力では直せないため 502 にまとめる。
function upstreamStatus(status) {
  return status === 400 || status === 404 ? status : 502;
}

// 動画のメタデータをIDごとに集める（videos.list は ID をまとめて1回で取得できる）
// 取得に成功したかどうかも返す。失敗時は呼び出し側でプレイリストの snippet にフォールバックする。
async function fetchVideoSnippets(ids, key) {
  var result = { ok: false, map: {} };
  if (!ids.length) return result;
  var api =
    "https://www.googleapis.com/youtube/v3/videos?part=snippet&id=" +
    encodeURIComponent(ids.join(",")) +
    "&key=" +
    encodeURIComponent(key);
  try {
    var res = await fetch(api);
    if (!res.ok) return result;
    var json = await res.json();
    if (json.error) return result;
    (json.items || []).forEach(function (item) {
      if (item && item.id && item.snippet) {
        result.map[item.id] = {
          title: item.snippet.title || "",
          description: item.snippet.description || "",
          publishedAt: item.snippet.publishedAt || ""
        };
      }
    });
    result.ok = true;
  } catch (e) {}
  return result;
}

// 再生リスト自体のタイトルを取得する（失敗しても本体は返せるので握りつぶす）
async function fetchPlaylistTitle(playlistId, key) {
  try {
    var res = await fetch(
      "https://www.googleapis.com/youtube/v3/playlists?part=snippet&id=" +
        encodeURIComponent(playlistId) +
        "&key=" +
        encodeURIComponent(key)
    );
    if (!res.ok) return "";
    var json = await res.json();
    var s = json.items && json.items[0] && json.items[0].snippet;
    return (s && s.title) || "";
  } catch (e) {
    return "";
  }
}

async function handlePlaylist(playlistId, searchParams, request, env) {
  var key = env.YOUTUBE_API_KEY;
  if (!key) {
    return respond({ error: "YOUTUBE_API_KEY not set", items: [] }, 500, request, env);
  }

  var maxResults = parseBoundedInt(
    searchParams.get("maxResults"),
    1,
    MAX_ITEMS_PER_REQUEST,
    MAX_ITEMS_PER_REQUEST
  );
  if (maxResults === null) {
    return respond({ error: "invalid maxResults", items: [] }, 400, request, env);
  }

  var pageToken = searchParams.get("pageToken") || "";
  if (pageToken && !PAGE_TOKEN_RE.test(pageToken)) {
    return respond({ error: "invalid pageToken", items: [] }, 400, request, env);
  }

  var api =
    "https://www.googleapis.com/youtube/v3/playlistItems?part=snippet&maxResults=" +
    maxResults +
    "&playlistId=" +
    encodeURIComponent(playlistId) +
    "&key=" +
    encodeURIComponent(key);
  if (pageToken) api += "&pageToken=" + encodeURIComponent(pageToken);

  var res;
  var json;
  try {
    res = await fetch(api);
    json = await res.json();
  } catch (e) {
    return respond({ error: "upstream fetch failed", items: [] }, 502, request, env);
  }

  if (!res.ok || (json && json.error)) {
    var code = res.ok && json && json.error ? json.error.code : res.status;
    return respond(
      {
        error: (json && json.error && json.error.message) || "playlist not found",
        items: []
      },
      upstreamStatus(code),
      request,
      env
    );
  }

  var entries = (json.items || []).filter(function (item) {
    return item && item.snippet && item.snippet.resourceId && item.snippet.resourceId.videoId;
  });
  var ids = entries.map(function (item) {
    return item.snippet.resourceId.videoId;
  });
  var snippets = await fetchVideoSnippets(ids, key);

  // 再生リスト内の順番のまま返す。
  // videos.list の取得に成功した場合は、その一覧に現れない動画（非公開・削除済み）を除外する。
  // 取得に失敗した場合のみ再生リスト側の snippet にフォールバックする。
  var items = [];
  entries.forEach(function (item) {
    var id = item.snippet.resourceId.videoId;
    var meta = snippets.map[id];
    if (snippets.ok && !meta) return;
    var title = (meta && meta.title) || item.snippet.title || "";
    if (!title) return;
    items.push({
      videoId: id,
      title: title,
      description: (meta && meta.description) || "",
      publishedAt: (meta && meta.publishedAt) || "",
      position: typeof item.snippet.position === "number" ? item.snippet.position : items.length
    });
  });

  return respond(
    {
      type: "playlist",
      playlistId: playlistId,
      title: pageToken ? "" : await fetchPlaylistTitle(playlistId, key),
      totalResults: json.pageInfo ? json.pageInfo.totalResults : items.length,
      nextPageToken: json.nextPageToken || "",
      items: items
    },
    200,
    request,
    env
  );
}

export default {
  async fetch(request, env) {
    var url;
    try {
      url = new URL(request.url);
    } catch (e) {
      return respond({ error: "bad request" }, 400, request, env);
    }

    // 許可外オリジン（Originヘッダー付きの不正利用）は拒否
    var allowedOrigin = env && env.ALLOWED_ORIGIN ? env.ALLOWED_ORIGIN : "*";
    var origin = (request.headers.get("Origin") || "").trim();
    if (allowedOrigin !== "*" && origin && origin !== allowedOrigin) {
      return respond({ error: "origin not allowed" }, 403, request, env);
    }

    // CORSプリフライト
    if (request.method === "OPTIONS") {
      var preflightAllowed = allowedOrigin === "*" || (origin && origin === allowedOrigin);
      return respond({ ok: true }, preflightAllowed ? 204 : 403, request, env);
    }

    // GET以外は受け付けない
    if (request.method !== "GET") {
      return respond({ error: "method not allowed" }, 405, request, env);
    }

    // ルートパス以外は受け付けない
    if (url.pathname !== "/") {
      return respond({ error: "not found" }, 404, request, env);
    }

    // パラメータは url（必須）と maxResults / pageToken（再生リスト時のみ許可）
    var params = Array.from(url.searchParams.keys());
    var allowed = ["url", "maxResults", "pageToken"];
    for (var i = 0; i < params.length; i++) {
      if (allowed.indexOf(params[i]) === -1) {
        return respond({ error: "unsupported parameter" }, 400, request, env);
      }
    }
    if (params.indexOf("url") === -1) {
      return respond({ error: "'url' parameter is required" }, 400, request, env);
    }

    var target = url.searchParams.get("url") || "";

    var playlistId = extractPlaylistId(target);
    if (playlistId) {
      return handlePlaylist(playlistId, url.searchParams, request, env);
    }

    var id = extractVideoId(target);
    if (!id) {
      return respond({ error: "invalid or unsupported youtube url" }, 400, request, env);
    }

    var key = env.YOUTUBE_API_KEY;
    if (!key) {
      return respond({ error: "YOUTUBE_API_KEY not set", title: "", description: "", publishedAt: "" }, 500, request, env);
    }

    // YouTube Data API v3 の snippet 取得のみ実行（ターゲット固定）
    var api =
      "https://www.googleapis.com/youtube/v3/videos?part=snippet&id=" +
      encodeURIComponent(id) +
      "&key=" +
      encodeURIComponent(key);

    var res;
    var json;
    try {
      res = await fetch(api);
      json = await res.json();
    } catch (e) {
      return respond({ error: "upstream fetch failed", title: "", description: "", publishedAt: "" }, 502, request, env);
    }

    if (!res.ok) {
      return respond(
        {
          error: (json && json.error && json.error.message) || "video request failed",
          title: "",
          description: "",
          publishedAt: ""
        },
        upstreamStatus(res.status),
        request,
        env
      );
    }

    var s = json.items && json.items[0] && json.items[0].snippet;
    if (!s || !s.title) {
      return respond({ error: "video not found", title: "", description: "", publishedAt: "" }, 404, request, env);
    }

    return respond(
      { title: s.title || "", description: s.description || "", publishedAt: s.publishedAt || "" },
      200,
      request,
      env
    );
  }
};