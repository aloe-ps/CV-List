/**
 * 作品データ層の純粋ロジック (TypeScript)。
 *
 * ブラウザ公開物 docs/assets/js/works.js の単一ソース。
 * `npm run build:browser` が本ファイルを tsc で ESM に変換し、
 * scripts/build-works-browser.mjs が classic script (var WORKS) に整形して
 * docs/assets/js/works.js を生成する。works.js の直接編集は禁止。
 * 有効なデータに対する出力は旧 hand-written 版と等価 (tests/ で検証)。
 * 相違点は不正・欠損データに対する防御のみ (空レコード扱い・未知要素の除去)。
 * DOM・fetch の既定値以外の副作用は持たず、将来の React 移行時にも再利用できる。
 */
import type { Genre, Music, NormalizedWork, RawWork, WorksData } from "./types.js";

export const GENRES: readonly Genre[] = ["CV", "SV", "PV"];

// works.js と同一の正規表現・ホスト許可リスト (動作互換のため変更しない)。
const YOUTUBE_ID_PATTERN =
  /(?:youtube\.com\/(?:watch\?v=|shorts\/|embed\/|live\/)|youtu\.be\/)([A-Za-z0-9_-]{6,15})/;
const PLAYLIST_ID_PATTERN = /^[A-Za-z0-9_-]{13,128}$/;
const PLAYLIST_HOSTS: readonly string[] = [
  "youtube.com",
  "www.youtube.com",
  "m.youtube.com",
  "music.youtube.com",
  "youtu.be",
  "www.youtu.be",
];

/** works.js の DEFAULT_WORKS と同一内容。取得失敗時のフォールバック用。 */
export const DEFAULT_WORKS: readonly NormalizedWork[] = [
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

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function asString(value: unknown): string {
  return typeof value === "string" ? value : "";
}

function asStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.filter((item): item is string => typeof item === "string");
}

function isGenre(value: unknown): value is Genre {
  return typeof value === "string" && (GENRES as readonly string[]).includes(value);
}

function toMusic(value: unknown): Music | null {
  if (!isRecord(value)) return null;
  const music: Music = {};
  const title = asString(value.title);
  if (title) music.title = title;
  const url = asString(value.url);
  if (url) music.url = url;
  const composer = asString(value.composer);
  if (composer) music.composer = composer;
  return music;
}

function asMusicArray(value: unknown): Music[] {
  if (!Array.isArray(value)) return [];
  const out: Music[] = [];
  for (const item of value) {
    const music = toMusic(item);
    if (music !== null) out.push(music);
  }
  return out;
}

/** YouTube URL から動画 ID を抽出する。該当なし・非文字列は null。 */
export function parseYouTubeId(url: unknown): string | null {
  if (typeof url !== "string" || url === "") return null;
  const match = YOUTUBE_ID_PATTERN.exec(url);
  const id = match?.[1];
  return typeof id === "string" ? id : null;
}

/** 再生リスト URL または ID からリスト ID を抽出する。該当なしは null。 */
export function parsePlaylistId(url: unknown): string | null {
  if (typeof url !== "string" || url === "") return null;
  const raw = url.trim();
  if (PLAYLIST_ID_PATTERN.test(raw)) return raw;
  let parsed: URL;
  try {
    parsed = new URL(raw);
  } catch {
    return null;
  }
  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") return null;
  if (!PLAYLIST_HOSTS.includes(parsed.hostname.toLowerCase())) return null;
  const list = parsed.searchParams.get("list");
  return list !== null && PLAYLIST_ID_PATTERN.test(list) ? list : null;
}

/** YouTube サムネイル URL を組み立てる。 */
export function thumbUrl(id: string, size = "mqdefault"): string {
  return `https://img.youtube.com/vi/${encodeURIComponent(id)}/${size}.jpg`;
}

/**
 * 作品 ID を解決する。優先度は works.js と同じく
 * id → YouTube ID → タイトルスラグ の順。
 */
export function resolveId(work: RawWork): string {
  const id = asString(work.id);
  if (id) return id;
  const fromYoutube = parseYouTubeId(asString(work.youtube));
  if (fromYoutube !== null) return fromYoutube;
  return `work-${asString(work.title).replace(/\s+/g, "-").toLowerCase()}`;
}

/** 1作品を正規化する。非レコード入力は空レコードとして扱う。 */
export function normalizeWork(work: unknown): NormalizedWork {
  const record: RawWork = isRecord(work) ? work : {};
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
export function normalizeWorks(works: unknown): NormalizedWork[] {
  if (!Array.isArray(works)) return [];
  return works.map((work) => normalizeWork(work));
}

/** 取得データが works.json の形式 ({ version, works[] }) か検証する。 */
export function isWorksData(value: unknown): value is WorksData {
  if (!isRecord(value)) return false;
  return typeof value.version === "number" && Array.isArray(value.works);
}

/** ID で作品を探す。見つからない場合は undefined。 */
export function byId(
  works: readonly NormalizedWork[],
  id: string,
): NormalizedWork | undefined {
  return works.find((work) => work.id === id);
}

export interface LoadWorksOptions {
  url?: string;
  fetcher?: typeof fetch;
}

/**
 * works.json を取得して正規化する。works.js の load() と同じく、
 * 取得失敗・形式不正のいずれも DEFAULT_WORKS にフォールバックする。
 */
export async function loadWorks(options: LoadWorksOptions = {}): Promise<NormalizedWork[]> {
  const url = options.url ?? "data/works.json";
  const fetcher = options.fetcher ?? fetch;
  try {
    const res = await fetcher(url, { cache: "no-store" });
    if (!res.ok) throw new Error(`fetch failed: ${res.status}`);
    const json: unknown = await res.json();
    if (isWorksData(json)) return normalizeWorks(json.works);
  } catch {
    // フォールバックに委ねる (既存の load() と同じ扱い)。
  }
  return normalizeWorks(DEFAULT_WORKS);
}

/**
 * 既存ブラウザコード互換の名前空間。旧 works.js の公開 API
 * ({ load, byId, parseYouTubeId, parsePlaylistId, thumbUrl, normalize, GENRES })
 * と同じキーを持つ。ブラウザビルドでは `var WORKS` として出力される。
 */
export const WORKS = {
  load: loadWorks,
  byId,
  parseYouTubeId,
  parsePlaylistId,
  thumbUrl,
  normalize: normalizeWorks,
  GENRES,
};
