/**
 * ジェネレーターの作品ドラフト・収集・検証 (UI非依存)。
 * 旧 generator.js の collectWork / validate / collectEntries /
 * stringifyOutput / bulk 処理と等価。
 */
import type { Genre, Music, NormalizedWork } from "./types.js";
import { parseYouTubeId } from "./works-core.js";

export interface MusicDraft {
  title: string;
  url: string;
  composer: string;
}

export interface WorkDraft {
  title: string;
  genre: Genre | "";
  description: string;
  youtube: string;
  author: string;
  added: string;
  performers: string[];
  music: MusicDraft[];
  communities: string[];
}

export function emptyDraft(): WorkDraft {
  return {
    title: "",
    genre: "",
    description: "",
    youtube: "",
    author: "",
    added: "",
    performers: [""],
    music: [{ title: "", url: "", composer: "" }],
    communities: [""],
  };
}

/** 既存作品 (編集モード) をドラフト化する。 */
export function draftFromNormalized(work: NormalizedWork): WorkDraft {
  return {
    title: work.title,
    genre: work.genre,
    description: work.description,
    youtube: work.youtube,
    author: work.author,
    added: work.added,
    performers: work.performers.length > 0 ? [...work.performers] : [""],
    music:
      work.music.length > 0
        ? work.music.map((m) => ({ title: m.title ?? "", url: m.url ?? "", composer: m.composer ?? "" }))
        : [{ title: "", url: "", composer: "" }],
    communities: work.communities.length > 0 ? [...work.communities] : [""],
  };
}

/** タイトルスラグ化。旧 slugify と等価 (WORKS.resolveId の work- 方式とは別物)。 */
export function slugify(text: unknown): string {
  const slug = String(text ?? "")
    .trim()
    .toLowerCase()
    .replace(/[^\w\s\u3040-\u30ff\u3400-\u9fff-]/g, "")
    .replace(/[\s_]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
  return slug || "untitled";
}

/** カンマ・読点・改行・タブ区切りを分割し、trim・重複除去する。 */
export function parseBulkList(text: unknown): string[] {
  const out: string[] = [];
  for (const part of String(text ?? "").split(/[,、\n\r\t]+/)) {
    const value = part.trim();
    if (value && !out.includes(value)) out.push(value);
  }
  return out;
}

export interface CollectedWork {
  id: string;
  title: string;
  genre: string;
  author: string;
  performers: string[];
  music: Music[];
  communities: string[];
  description?: string;
  youtube?: string;
  added?: string;
}

/**
 * ドラフトをJSON用オブジェクト化する。キー順は旧実装と同一
 * (id, title, genre, author, performers, music, communities[, description][, youtube][, added])。
 */
export function collectWork(draft: WorkDraft, editId: string | null): CollectedWork {
  const title = draft.title.trim();
  const youtube = draft.youtube.trim();
  const author = draft.author.trim();
  const description = draft.description.trim();
  const added = draft.added.trim();
  const youtubeId = parseYouTubeId(youtube);
  const performers = draft.performers.map((v) => v.trim()).filter((v) => v !== "");
  const communities = draft.communities.map((v) => v.trim()).filter((v) => v !== "");
  const music: Music[] = [];
  for (const row of draft.music) {
    const rowTitle = row.title.trim();
    const rowUrl = row.url.trim();
    const rowComposer = row.composer.trim();
    if (!rowTitle && !rowUrl && !rowComposer) continue;
    const entry: Music = {};
    if (rowTitle) entry.title = rowTitle;
    if (rowUrl) entry.url = rowUrl;
    if (rowComposer) entry.composer = rowComposer;
    music.push(entry);
  }
  const obj: CollectedWork = {
    id: editId ?? youtubeId ?? slugify(title),
    title,
    genre: draft.genre.trim() as Genre | "",
    author,
    performers,
    music,
    communities,
  };
  if (description) obj.description = description;
  if (youtube) obj.youtube = youtube;
  if (added) obj.added = added;
  return obj;
}

/** 必須項目の不足ラベル一覧 (旧 validate と等価。作者は任意のため対象外)。 */
export function validateWork(
  obj: Pick<CollectedWork, "title" | "genre" | "youtube"> & { author?: unknown },
): string[] {
  const missing: string[] = [];
  if (!obj.title) missing.push("タイトル");
  if (!obj.genre) missing.push("ジャンル");
  if (!obj.youtube) missing.push("YouTube URL");
  else if (!parseYouTubeId(obj.youtube)) missing.push("YouTube URL");
  return missing;
}

/** タイトルかYouTube URLのどちらかがあるか (重複検査対象になるか)。 */
export function hasIdentity(obj: Pick<CollectedWork, "title" | "youtube">): boolean {
  return Boolean(obj.title || obj.youtube);
}

export interface DuplicateCheckEntry {
  id: string;
  title: string;
  youtube: string;
  editId: string | null;
}

/**
 * 各エントリのID重複を判定する。既存カタログ (編集中IDは除外) と
 * バッチ内の相互重複を見る。identityなしは対象外。
 */
export function findDuplicates(
  entries: readonly DuplicateCheckEntry[],
  allWorks: readonly NormalizedWork[],
): boolean[] {
  return entries.map((entry, index) => {
    if (!hasIdentity(entry)) return false;
    const existing = allWorks.some((w) => w.id === entry.id && w.id !== entry.editId);
    if (existing) return true;
    return entries.some(
      (other, otherIndex) =>
        otherIndex !== index && hasIdentity(other) && other.id === entry.id,
    );
  });
}

/** 作品オブジェクト群をカンマ区切りJSON化する (配列の [ ] は付けない)。 */
export function stringifyWorks(objects: readonly CollectedWork[]): string {
  return objects.map((obj) => JSON.stringify(obj, null, 2)).join(",\n");
}

export type BulkField = "author" | "genre" | "communities";
export type BulkScope = "all" | "empty";

export const BULK_FIELDS: Record<BulkField, { label: string }> = {
  author: { label: "作者" },
  genre: { label: "ジャンル" },
  communities: { label: "コミュニティ" },
};

export type BulkValues = Record<BulkField, string>;

/** ドラフトのフィールド値を bulk 用文字列表現で読む。 */
export function readDraftFieldValue(draft: WorkDraft, field: BulkField): string {
  if (field === "communities") {
    return draft.communities.map((v) => v.trim()).filter((v) => v !== "").join(", ");
  }
  return draft[field].trim();
}

/** bulk 値をドラフトへ書き込む (イミュータブル)。 */
export function writeDraftFieldValue(draft: WorkDraft, field: BulkField, value: string): WorkDraft {
  if (field === "communities") {
    const list = parseBulkList(value);
    return { ...draft, communities: list.length > 0 ? list : [""] };
  }
  return { ...draft, [field]: value };
}

/** 全ドラフト共通の値 (不一致なら "")。 */
export function commonFieldValue(drafts: readonly WorkDraft[], field: BulkField): string {
  let common: string | null = null;
  for (const draft of drafts) {
    const value = readDraftFieldValue(draft, field);
    if (common === null) common = value;
    else if (value !== common) return "";
  }
  return common ?? "";
}

/** 一括適用の対象インデックス。 */
export function bulkTargetIndexes(
  drafts: readonly WorkDraft[],
  field: BulkField,
  scope: BulkScope,
): number[] {
  const indexes: number[] = [];
  drafts.forEach((draft, index) => {
    if (scope === "all" || !readDraftFieldValue(draft, field)) indexes.push(index);
  });
  return indexes;
}

/** bulk 値が空でないか。 */
export function hasBulkValue(field: BulkField, value: string): boolean {
  if (field === "communities") return parseBulkList(value).length > 0;
  return value.trim() !== "";
}
