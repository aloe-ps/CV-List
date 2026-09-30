/**
 * YouTube メタデータ取得 (UI非依存・fetch注入可能)。
 * 旧 generator.js の fetchVideoMeta / fetchPlaylistPage 振る舞いと等価。
 * oEmbed の JSONP は DOM を使うため script 挿入処理のみ注入可能にしている。
 */
import type { Genre } from "./types.js";

export type VideoMetaSource = "endpoint" | "api" | "innertube" | "oembed";

export interface VideoMeta {
  source: VideoMetaSource;
  title: string;
  description: string;
  publishedAt: string;
}

export interface PlaylistItem {
  videoId: string;
  title: string;
  description: string;
  publishedAt: string;
  position: number;
}

export interface PlaylistPage {
  title: string;
  totalResults: number;
  nextPageToken: string;
  items: PlaylistItem[];
}

export const PLAYLIST_PAGE_SIZE = 50;
export const PLAYLIST_MAX_ITEMS = 500;
export const META_CACHE_TTL_MS = 10 * 60 * 1000;

const INNERTUBE_KEY = "AIzaSyAO_FJ2SlqU8Q4STEHLGCilw_Y9_11qcW8";

function asString(value: unknown): string {
  return typeof value === "string" ? value : "";
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/** Worker 単体メタデータ取得URL。 */
export function buildVideoMetaUrl(endpoint: string, videoId: string): string {
  const normalized = endpoint.endsWith("/") ? endpoint : `${endpoint}/`;
  return `${normalized}?url=${encodeURIComponent(`https://youtu.be/${videoId}`)}`;
}

/** Worker プレイリスト取得URL。 */
export function buildPlaylistUrl(
  endpoint: string,
  playlistId: string,
  maxResults: number,
  pageToken: string,
): string {
  const normalized = endpoint.endsWith("/") ? endpoint : `${endpoint}/`;
  let url =
    `${normalized}?url=${encodeURIComponent(`https://www.youtube.com/playlist?list=${playlistId}`)}` +
    `&maxResults=${maxResults}`;
  if (pageToken) url += `&pageToken=${encodeURIComponent(pageToken)}`;
  return url;
}

/** YouTube Data API v3 動画取得URL。 */
export function buildOfficialVideoUrl(apiKey: string, videoId: string): string {
  return (
    "https://www.googleapis.com/youtube/v3/videos?part=snippet&id=" +
    `${encodeURIComponent(videoId)}&key=${encodeURIComponent(apiKey)}`
  );
}

/** InnerTube player リクエスト内容。 */
export function buildInnerTubeRequest(videoId: string): { url: string; init: RequestInit } {
  return {
    url: `https://www.youtube.com/youtubei/v1/player?${encodeURIComponent(INNERTUBE_KEY)}`,
    init: {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        context: { client: { clientName: "WEB", clientVersion: "2.20210909.01.00", hl: "ja" } },
        videoId,
      }),
    },
  };
}

/** 公式APIの videos.list 応答を解釈する。title欠落時は例外。 */
export function parseOfficialVideoResponse(json: unknown): VideoMeta {
  if (!isRecord(json) || !Array.isArray(json.items)) throw new Error("video-not-found");
  const first: unknown = json.items[0];
  const snippet: unknown = isRecord(first) ? first.snippet : undefined;
  const title = isRecord(snippet) ? asString(snippet.title) : "";
  if (!title) throw new Error("video-not-found");
  return {
    source: "api",
    title,
    description: isRecord(snippet) ? asString(snippet.description) : "",
    publishedAt: isRecord(snippet) ? asString(snippet.publishedAt) : "",
  };
}

/** Worker プレイリスト応答を解釈する。形式不正・error付きは例外。 */
export function parsePlaylistPageResponse(json: unknown): PlaylistPage {
  if (!isRecord(json) || !Array.isArray(json.items)) {
    const message = isRecord(json) ? asString(json.error) : "";
    throw new Error(message || "playlist-fetch-failed");
  }
  const items: PlaylistItem[] = [];
  for (const entry of json.items) {
    if (!isRecord(entry)) continue;
    const videoId = asString(entry.videoId);
    const title = asString(entry.title);
    if (!videoId || !title) continue;
    const position = typeof entry.position === "number" ? entry.position : items.length;
    items.push({
      videoId,
      title,
      description: asString(entry.description),
      publishedAt: asString(entry.publishedAt),
      position,
    });
  }
  return {
    title: asString(json.title),
    totalResults:
      isRecord(json.pageInfo) && typeof json.pageInfo.totalResults === "number"
        ? json.pageInfo.totalResults
        : items.length,
    nextPageToken: asString(json.nextPageToken),
    items,
  };
}

/** InnerTube player 応答を解釈する。title欠落時は例外。 */
export function parseInnerTubeResponse(json: unknown): VideoMeta {
  if (!isRecord(json)) throw new Error("video-not-found");
  const details: unknown = json.videoDetails;
  const title = isRecord(details) ? asString(details.title) : "";
  if (!title) throw new Error("video-not-found");
  const microformat: unknown = isRecord(json.microformat)
    ? json.microformat.playerMicroformatRenderer
    : undefined;
  const publishedAt = isRecord(microformat)
    ? asString(microformat.uploadDate) || asString(microformat.publishDate)
    : "";
  return {
    source: "innertube",
    title,
    description: isRecord(details) ? asString(details.shortDescription) : "",
    publishedAt,
  };
}

/** Worker 単体メタデータ応答を解釈する。 */
export function parseEndpointVideoResponse(json: unknown): VideoMeta {
  if (!isRecord(json) || !("title" in json)) throw new Error("video-not-found");
  return {
    source: "endpoint",
    title: asString(json.title),
    description: asString(json.description),
    publishedAt: asString(json.publishedAt),
  };
}

/** ISO日時などから YYYY-MM-DD 先頭部分を抜き出す。 */
export function toDateInput(value: unknown): string {
  const match = /^(\d{4}-\d{2}-\d{2})/.exec(String(value ?? ""));
  return match?.[1] ?? "";
}

/** タイトル等からジャンル (CV/SV/PV) を推測する。 */
export function detectGenre(text: unknown): Genre | "" {
  const match = /(?:^|[^0-9A-Za-z])(CV|SV|PV)(?:[^0-9A-Za-z]|$)/i.exec(String(text ?? ""));
  const found = match?.[1]?.toUpperCase();
  return found === "CV" || found === "SV" || found === "PV" ? found : "";
}

export interface FetchVideoMetaOptions {
  endpoint: string;
  apiKey: string;
  fetcher?: typeof fetch;
  /** oEmbed JSONP の代替実装 (テスト用・SSR用)。未指定時は document に script を挿入する。 */
  oembedLoader?: (videoId: string) => Promise<string>;
}

const metaCache = new Map<string, { meta: VideoMeta; at: number }>();

/** テスト用にメタデータキャッシュを破棄する。 */
export function clearVideoMetaCache(): void {
  metaCache.clear();
}

function loadOEmbedTitle(videoId: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const callback = `cv_oembed_${Date.now()}_${Math.round(Math.random() * 1e6).toString(36)}`;
    const script = document.createElement("script");
    const done = { current: false };
    const cleanup = (): void => {
      delete (window as unknown as Record<string, unknown>)[callback];
      script.parentNode?.removeChild(script);
    };
    (window as unknown as Record<string, unknown>)[callback] = (data: unknown) => {
      done.current = true;
      cleanup();
      resolve(isRecord(data) ? asString(data.title) : "");
    };
    script.onerror = () => {
      if (!done.current) {
        done.current = true;
        cleanup();
        reject(new Error("oembed-failed"));
      }
    };
    script.src =
      "https://www.youtube.com/oembed?url=" +
      `${encodeURIComponent(`https://youtu.be/${videoId}`)}&format=json&callback=${callback}`;
    document.head.appendChild(script);
  });
}

async function fetchJson(fetcher: typeof fetch, url: string, init?: RequestInit): Promise<unknown> {
  const res = await fetcher(url, init);
  if (!res.ok) throw new Error(`request-failed:${res.status}`);
  return (await res.json()) as unknown;
}

/**
 * 動画メタデータを取得する。優先順位は旧実装と同じ:
 * endpoint → 公式API → InnerTube のいずれか＋ oEmbed フォールバック。
 */
export async function fetchVideoMeta(
  videoId: string,
  options: FetchVideoMetaOptions,
): Promise<VideoMeta> {
  const cached = metaCache.get(videoId);
  if (cached && Date.now() - cached.at < META_CACHE_TTL_MS) return cached.meta;
  const fetcher = options.fetcher ?? fetch;
  const endpoint = options.endpoint.trim();
  const apiKey = options.apiKey.trim();

  let task: Promise<VideoMeta>;
  if (endpoint) {
    task = fetchJson(fetcher, buildVideoMetaUrl(endpoint, videoId)).then(parseEndpointVideoResponse);
  } else if (apiKey) {
    task = fetchJson(fetcher, buildOfficialVideoUrl(apiKey, videoId)).then(
      parseOfficialVideoResponse,
    );
  } else {
    const { url, init } = buildInnerTubeRequest(videoId);
    task = fetchJson(fetcher, url, init).then(parseInnerTubeResponse);
  }
  const meta = await task.catch(async () => {
    if (options.oembedLoader) {
      return { source: "oembed" as const, title: await options.oembedLoader(videoId), description: "", publishedAt: "" };
    }
    return {
      source: "oembed" as const,
      title: await loadOEmbedTitle(videoId),
      description: "",
      publishedAt: "",
    };
  });
  metaCache.set(videoId, { meta, at: Date.now() });
  return meta;
}

export interface FetchPlaylistPageOptions {
  endpoint: string;
  maxResults?: number;
  pageToken?: string;
  fetcher?: typeof fetch;
}

/** Worker からプレイリスト1ページ分を取得する。 */
export async function fetchPlaylistPage(
  playlistId: string,
  options: FetchPlaylistPageOptions,
): Promise<PlaylistPage> {
  const endpoint = options.endpoint.trim();
  if (!endpoint) throw new Error("no-endpoint");
  const fetcher = options.fetcher ?? fetch;
  const json = await fetchJson(
    fetcher,
    buildPlaylistUrl(endpoint, playlistId, options.maxResults ?? PLAYLIST_PAGE_SIZE, options.pageToken ?? ""),
  );
  return parsePlaylistPageResponse(json);
}
