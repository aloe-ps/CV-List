// YouTubeメタデータ取得プロキシ（Cloudflare Workers 用）
// このプロキシがYouTube Data API v3のキーを保持するため、
// GitHub Pagesに公開してもAPIキーはクライアントに漏れません。
//
// 受け付ける操作は "YouTube動画IDの抽出 → snippetの取得" の1つだけ。
// それ以外（GET以外のメソッド、"/"以外のパス、url以外のパラメータ、
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

var VIDEO_ID_RE = /^[A-Za-z0-9_-]{11}$/;

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

    // パラメータは url のみ許可
    var params = Array.from(url.searchParams.keys());
    if (params.length !== 1 || params[0] !== "url") {
      return respond({ error: "only 'url' parameter is allowed" }, 400, request, env);
    }

    var target = url.searchParams.get("url") || "";
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

    var json;
    try {
      var res = await fetch(api);
      json = await res.json();
    } catch (e) {
      return respond({ error: "upstream fetch failed", title: "", description: "", publishedAt: "" }, 502, request, env);
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