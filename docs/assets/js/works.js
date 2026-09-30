// このファイルは生成物です。直接編集しないでください。
// ソース: src/works-core.ts (`npm run build:browser` で再生成)。
const GENRES = ["CV", "SV", "PV"];
// works.js と同一の正規表現・ホスト許可リスト (動作互換のため変更しない)。
const YOUTUBE_ID_PATTERN = /(?:youtube\.com\/(?:watch\?v=|shorts\/|embed\/|live\/)|youtu\.be\/)([A-Za-z0-9_-]{6,15})/;
const PLAYLIST_ID_PATTERN = /^[A-Za-z0-9_-]{13,128}$/;
const PLAYLIST_HOSTS = [
    "youtube.com",
    "www.youtube.com",
    "m.youtube.com",
    "music.youtube.com",
    "youtu.be",
    "www.youtu.be",
];
/** works.js の DEFAULT_WORKS と同一内容。取得失敗時のフォールバック用。 */
const DEFAULT_WORKS = [
    {
        id: "MQaIQ-U6oSk",
        title: "JapEn 17th │ PenSpinning",
        author: "MEL",
        performers: [],
        music: [
            {
                title: "Finale",
                url: "https://soundcloud.com/akiza1004/akiza-finale",
                composer: "Akiza",
            },
        ],
        communities: ["JEB"],
        genre: "CV",
        youtube: "https://youtu.be/MQaIQ-U6oSk",
        description: "",
        added: "2021-12-25",
    },
];
function isRecord(value) {
    return typeof value === "object" && value !== null && !Array.isArray(value);
}
function asString(value) {
    return typeof value === "string" ? value : "";
}
function asStringArray(value) {
    if (!Array.isArray(value))
        return [];
    return value.filter((item) => typeof item === "string");
}
function isGenre(value) {
    return typeof value === "string" && GENRES.includes(value);
}
function toMusic(value) {
    if (!isRecord(value))
        return null;
    const music = {};
    const title = asString(value.title);
    if (title)
        music.title = title;
    const url = asString(value.url);
    if (url)
        music.url = url;
    const composer = asString(value.composer);
    if (composer)
        music.composer = composer;
    return music;
}
function asMusicArray(value) {
    if (!Array.isArray(value))
        return [];
    const out = [];
    for (const item of value) {
        const music = toMusic(item);
        if (music !== null)
            out.push(music);
    }
    return out;
}
/** YouTube URL から動画 ID を抽出する。該当なし・非文字列は null。 */
function parseYouTubeId(url) {
    if (typeof url !== "string" || url === "")
        return null;
    const match = YOUTUBE_ID_PATTERN.exec(url);
    const id = match?.[1];
    return typeof id === "string" ? id : null;
}
/** 再生リスト URL または ID からリスト ID を抽出する。該当なしは null。 */
function parsePlaylistId(url) {
    if (typeof url !== "string" || url === "")
        return null;
    const raw = url.trim();
    if (PLAYLIST_ID_PATTERN.test(raw))
        return raw;
    let parsed;
    try {
        parsed = new URL(raw);
    }
    catch {
        return null;
    }
    if (parsed.protocol !== "http:" && parsed.protocol !== "https:")
        return null;
    if (!PLAYLIST_HOSTS.includes(parsed.hostname.toLowerCase()))
        return null;
    const list = parsed.searchParams.get("list");
    return list !== null && PLAYLIST_ID_PATTERN.test(list) ? list : null;
}
/** YouTube サムネイル URL を組み立てる。 */
function thumbUrl(id, size = "mqdefault") {
    return `https://img.youtube.com/vi/${encodeURIComponent(id)}/${size}.jpg`;
}
/**
 * 作品 ID を解決する。優先度は works.js と同じく
 * id → YouTube ID → タイトルスラグ の順。
 */
function resolveId(work) {
    const id = asString(work.id);
    if (id)
        return id;
    const fromYoutube = parseYouTubeId(asString(work.youtube));
    if (fromYoutube !== null)
        return fromYoutube;
    return `work-${asString(work.title).replace(/\s+/g, "-").toLowerCase()}`;
}
/** 1作品を正規化する。非レコード入力は空レコードとして扱う。 */
function normalizeWork(work) {
    const record = isRecord(work) ? work : {};
    return {
        id: resolveId(record),
        genre: isGenre(record.genre) ? record.genre : "",
        title: asString(record.title) || "（無題）",
        description: asString(record.description),
        youtube: asString(record.youtube),
        author: asString(record.author),
        performers: asStringArray(record.performers),
        music: asMusicArray(record.music),
        communities: asStringArray(record.communities),
        added: asString(record.added),
    };
}
/** 作品配列を正規化する。配列以外は空配列になる。未知フィールドは破棄される。 */
function normalizeWorks(works) {
    if (!Array.isArray(works))
        return [];
    return works.map((work) => normalizeWork(work));
}
/** 取得データが works.json の形式 ({ version, works[] }) か検証する。 */
function isWorksData(value) {
    if (!isRecord(value))
        return false;
    return typeof value.version === "number" && Array.isArray(value.works);
}
/** ID で作品を探す。見つからない場合は undefined。 */
function byId(works, id) {
    return works.find((work) => work.id === id);
}
/**
 * works.json を取得して正規化する。works.js の load() と同じく、
 * 取得失敗・形式不正のいずれも DEFAULT_WORKS にフォールバックする。
 */
async function loadWorks(options = {}) {
    const url = options.url ?? "data/works.json";
    const fetcher = options.fetcher ?? fetch;
    try {
        const res = await fetcher(url, { cache: "no-store" });
        if (!res.ok)
            throw new Error(`fetch failed: ${res.status}`);
        const json = await res.json();
        if (isWorksData(json))
            return normalizeWorks(json.works);
    }
    catch {
        // フォールバックに委ねる (既存の load() と同じ扱い)。
    }
    return normalizeWorks(DEFAULT_WORKS);
}
/**
 * 既存ブラウザコード互換の名前空間。旧 works.js の公開 API
 * ({ load, byId, parseYouTubeId, parsePlaylistId, thumbUrl, normalize, GENRES })
 * と同じキーを持つ。ブラウザビルドでは `var WORKS` として出力される。
 */
var WORKS = {
    load: loadWorks,
    byId,
    parseYouTubeId,
    parsePlaylistId,
    thumbUrl,
    normalize: normalizeWorks,
    GENRES,
};
