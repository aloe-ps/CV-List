/**
 * 作品一覧の検索・絞り込み・並び替え (UI非依存)。
 * 旧 docs/assets/js/app.js の matches / groupKeysOf / groupSorted / render
 * 振る舞いと等価。
 */
import type { Genre, NormalizedWork } from "./types.js";

export type SortMode = "date" | "author" | "performer" | "community";
export type GenreFilter = Genre | "";
export type GroupField = "author" | "performers" | "communities";
export type ViewMode = "grid" | "list";

/** ジャンルの複数選択。空配列は「すべて」と等価。 */
export type GenreSelection = Genre[];

export const SORT_TO_GROUP_FIELD: Record<Exclude<SortMode, "date">, GroupField> = {
  author: "author",
  performer: "performers",
  community: "communities",
};

const collator = new Intl.Collator("ja", { sensitivity: "base" });

export function compareByDateDescTitle(a: NormalizedWork, b: NormalizedWork): number {
  return b.added.localeCompare(a.added) || collator.compare(a.title, b.title);
}

/** 検索クエリに一致するか。クエリは内部で trim・小文字化する。 */
export function matchesWork(work: NormalizedWork, query: string): boolean {
  const q = query.trim().toLowerCase();
  if (!q) return true;
  const hay = [work.title, work.author, work.description]
    .concat(work.performers)
    .concat(work.music.map((m) => `${m.title} ${m.composer ?? ""}`))
    .concat(work.communities)
    .join(" ")
    .toLowerCase();
  return hay.includes(q);
}

export interface CatalogFilter {
  query: string;
  /** 旧来の単一ジャンル。`genres` が空でない場合はそちらを優先する。 */
  genre: GenreFilter;
  /** ジャンルの複数選択 (CV・SV・PV の組み合わせ)。空配列はすべて。 */
  genres: GenreSelection;
  /** 作者の複数条件 (OR)。部分一致・大小無視。カンマ区切り入力を配列化したもの。 */
  authors: string[];
  /** 出演者の複数条件 (OR)。 */
  performers: string[];
  /** コミュニティの複数条件 (OR)。 */
  communities: string[];
  /** 楽曲名の絞り込み (部分一致・大小無視)。空文字は無条件。 */
  musicTitle: string;
  /** 作曲者の絞り込み (部分一致・大小無視)。空文字は無条件。 */
  musicComposer: string;
  /**
   * 公開年・追加年の絞り込み。
   * works.json に公開日フィールドが存在しないため、追加日 (`added`) の
   * 年部分を基準に `YYYY` 形式で範囲指定する。空文字は下限・上限なし。
   */
  yearFrom: string;
  yearTo: string;
}

/** 全条件が未指定のフィルター。 */
export function emptyCatalogFilter(): CatalogFilter {
  return {
    query: "",
    genre: "",
    genres: [],
    authors: [],
    performers: [],
    communities: [],
    musicTitle: "",
    musicComposer: "",
    yearFrom: "",
    yearTo: "",
  };
}

/** カンマ・読点・改行区切りの複数条件入力を配列化する。空要素は除去する。 */
export function splitMultiValue(input: string): string[] {
  return input
    .split(/[,，、\n]+/)
    .map((s) => s.trim())
    .filter((s) => s.length > 0);
}

/** `YYYY` 形式の年のみ受け付ける。不正値は null。 */
export function parseFilterYear(value: string): number | null {
  const trimmed = value.trim();
  if (!/^\d{4}$/.test(trimmed)) return null;
  const year = Number(trimmed);
  return year >= 1000 && year <= 9999 ? year : null;
}

/** 作品の追加年 (`added` の先頭4桁)。欠損・不正は null。 */
export function workAddedYear(work: NormalizedWork): number | null {
  const match = /^(\d{4})/.exec(work.added.trim());
  if (!match) return null;
  return parseFilterYear(match[1]!);
}

/** 単一値が複数条件 (OR・部分一致・大小無視) のいずれかに一致するか。 */
function matchesAnyValue(value: string, conditions: readonly string[]): boolean {
  if (conditions.length === 0) return true;
  const hay = value.toLowerCase();
  return conditions.some((c) => {
    const needle = c.trim().toLowerCase();
    return needle !== "" && hay.includes(needle);
  });
}

/** 配列値のいずれかが複数条件 (OR) のいずれかに一致するか。 */
function matchesAnyArray(values: readonly string[], conditions: readonly string[]): boolean {
  if (conditions.length === 0) return true;
  const lowered = values.map((v) => v.toLowerCase());
  return conditions.some((c) => {
    const needle = c.trim().toLowerCase();
    if (!needle) return false;
    return lowered.some((hay) => hay.includes(needle));
  });
}

function matchesMusic(
  work: NormalizedWork,
  field: "title" | "composer",
  condition: string,
): boolean {
  const needle = condition.trim().toLowerCase();
  if (!needle) return true;
  return work.music.some((m) => (m[field] ?? "").toLowerCase().includes(needle));
}

function matchesYearRange(work: NormalizedWork, from: string, to: string): boolean {
  const fromYear = from ? parseFilterYear(from) : null;
  const toYear = to ? parseFilterYear(to) : null;
  if (from && fromYear === null) return true;
  if (to && toYear === null) return true;
  if (fromYear === null && toYear === null) return true;
  const year = workAddedYear(work);
  if (year === null) return false;
  let low = fromYear;
  let high = toYear;
  if (low !== null && high !== null && low > high) [low, high] = [high, low];
  if (low !== null && year < low) return false;
  if (high !== null && year > high) return false;
  return true;
}

/** 有効なジャンル選択 (genres 優先・なければ genre 単一)。 */
export function effectiveGenres(filter: Pick<CatalogFilter, "genre" | "genres">): GenreSelection {
  const cleaned = filter.genres.filter(
    (g): g is Genre => g === "CV" || g === "SV" || g === "PV",
  );
  if (cleaned.length > 0) return [...new Set(cleaned)];
  return filter.genre ? [filter.genre] : [];
}

/** 絞り込み＋追加日降順 (同日はタイトル順) に並べ替える。 */
export function filterAndSortWorks(
  all: readonly NormalizedWork[],
  filter: CatalogFilter,
): NormalizedWork[] {
  const genres = effectiveGenres(filter);
  return all
    .filter(
      (w) =>
        matchesWork(w, filter.query) &&
        (genres.length === 0 || (w.genre !== "" && genres.includes(w.genre))) &&
        matchesAnyValue(w.author, filter.authors ?? []) &&
        matchesAnyArray(w.performers, filter.performers ?? []) &&
        matchesAnyArray(w.communities, filter.communities ?? []) &&
        matchesMusic(w, "title", filter.musicTitle ?? "") &&
        matchesMusic(w, "composer", filter.musicComposer ?? "") &&
        matchesYearRange(w, filter.yearFrom ?? "", filter.yearTo ?? ""),
    )
    .slice()
    .sort(compareByDateDescTitle);
}

/** キーワード以外の詳細条件が何件指定されているか (共有URLバッジ用)。 */
export function countActiveFacets(filter: CatalogFilter): number {
  let count = 0;
  if (effectiveGenres(filter).length > 0) count += 1;
  if (filter.authors.length > 0) count += 1;
  if (filter.performers.length > 0) count += 1;
  if (filter.communities.length > 0) count += 1;
  if (filter.musicTitle.trim() !== "") count += 1;
  if (filter.musicComposer.trim() !== "") count += 1;
  if (parseFilterYear(filter.yearFrom) !== null || parseFilterYear(filter.yearTo) !== null)
    count += 1;
  return count;
}

/** グループ見出し用のキー一覧。空値は「未設定」にまとめる。 */
export function groupKeysOf(work: NormalizedWork, field: GroupField): string[] {
  const value = work[field];
  if (Array.isArray(value)) return value.length > 0 ? [...value] : ["未設定"];
  return value ? [value] : ["未設定"];
}

export interface WorkGroup {
  name: string;
  works: NormalizedWork[];
}

/** グループ名の昇順 (ja collator) でグループ化する。 */
export function groupWorks(
  works: readonly NormalizedWork[],
  field: GroupField,
): WorkGroup[] {
  const map = new Map<string, NormalizedWork[]>();
  for (const work of works) {
    for (const key of groupKeysOf(work, field)) {
      const list = map.get(key);
      if (list) list.push(work);
      else map.set(key, [work]);
    }
  }
  return [...map.entries()]
    .sort(([a], [b]) => collator.compare(a, b))
    .map(([name, group]) => ({ name, works: group }));
}

/** 「○ 件の作品（検索: …）」の件数文言。 */
export function countText(count: number, query: string, activeFacets = 0): string {
  const trimmed = query.trim();
  const parts: string[] = [];
  if (trimmed) parts.push(`検索: ${trimmed}`);
  if (activeFacets > 0) parts.push(`絞り込み: ${activeFacets}件`);
  return `${count} 件の作品` + (parts.length > 0 ? `（${parts.join("・")}）` : "");
}

/** サジェスト・プルダウン用の候補値。件数の多い順、同件数は日本語照合順。 */
export function collectFieldOptions(
  works: readonly NormalizedWork[],
  field: "author" | "performers" | "communities" | "composer",
  limit = 200,
): string[] {
  const counts = new Map<string, number>();
  const add = (value: string): void => {
    const name = value.trim();
    if (!name) return;
    counts.set(name, (counts.get(name) ?? 0) + 1);
  };
  for (const work of works) {
    if (field === "author") add(work.author);
    else if (field === "performers") work.performers.forEach(add);
    else if (field === "communities") work.communities.forEach(add);
    else work.music.forEach((m) => m.composer && add(m.composer));
  }
  return [...counts.entries()]
    .sort(([a, aCount], [b, bCount]) => bCount - aCount || collator.compare(a, b))
    .slice(0, Math.max(0, limit))
    .map(([name]) => name);
}

/** 追加年の選択肢 (昇順)。データに年がない場合は空配列。 */
export function collectAddedYears(works: readonly NormalizedWork[]): string[] {
  const years = new Set<number>();
  for (const work of works) {
    const year = workAddedYear(work);
    if (year !== null) years.add(year);
  }
  return [...years].sort((a, b) => a - b).map(String);
}

/** 複数値パラメータを読む。繰り返し指定とカンマ区切りの両方に対応する。 */
function readMultiParam(params: URLSearchParams, key: string): string[] {
  const values: string[] = [];
  for (const raw of params.getAll(key)) {
    for (const part of raw.split(/[,，、\n]+/)) {
      const trimmed = part.trim();
      if (trimmed && !values.includes(trimmed)) values.push(trimmed);
    }
  }
  return values;
}

/** 単一ジャンル (`genre=CV`) と複数 (`genres=CV,PV`) の両方を読む。 */
function readGenreSelection(params: URLSearchParams): { genre: GenreFilter; genres: GenreSelection } {
  const multi = params
    .getAll("genres")
    .flatMap((raw) => raw.split(/[,，、\s]+/))
    .map((s) => s.trim().toUpperCase())
    .filter((g): g is Genre => g === "CV" || g === "SV" || g === "PV");
  if (multi.length > 0) {
    const unique = [...new Set(multi)];
    return { genre: unique.length === 1 ? unique[0]! : "", genres: unique };
  }
  const single = (params.get("genre") ?? "").trim().toUpperCase();
  if (single === "CV" || single === "SV" || single === "PV") {
    return { genre: single, genres: [single] };
  }
  return { genre: "", genres: [] };
}

/** URLクエリ (?q=, ?sort=, ?genre=, ?genres=, ?author=, ...) を読み取る。 */
export function readCatalogParams(search: string): {
  query: string;
  sort: SortMode;
  genre: GenreFilter;
  genres: GenreSelection;
  authors: string[];
  performers: string[];
  communities: string[];
  musicTitle: string;
  musicComposer: string;
  yearFrom: string;
  yearTo: string;
  view: ViewMode;
} {
  const params = new URLSearchParams(search);
  const sortParam = params.get("sort");
  const sort: SortMode =
    sortParam === "author" || sortParam === "performer" || sortParam === "community"
      ? sortParam
      : "date";
  const { genre, genres } = readGenreSelection(params);
  const viewParam = params.get("view");
  const view: ViewMode = viewParam === "list" ? "list" : "grid";
  const yearFrom = params.get("from") ?? params.get("yearFrom") ?? "";
  const yearTo = params.get("to") ?? params.get("yearTo") ?? "";
  return {
    query: params.get("q") ?? "",
    sort,
    genre,
    genres,
    authors: readMultiParam(params, "author"),
    performers: readMultiParam(params, "performer"),
    communities: readMultiParam(params, "community"),
    musicTitle: params.get("music") ?? "",
    musicComposer: params.get("composer") ?? "",
    yearFrom: parseFilterYear(yearFrom) !== null ? yearFrom.trim() : "",
    yearTo: parseFilterYear(yearTo) !== null ? yearTo.trim() : "",
    view,
  };
}

/** 複数値パラメータを書き込む。空は削除する。 */
function writeMultiParam(params: URLSearchParams, key: string, values: readonly string[]): void {
  params.delete(key);
  const cleaned = values.map((v) => v.trim()).filter((v) => v !== "");
  for (const value of [...new Set(cleaned)]) params.append(key, value);
}

/** 検索条件をURLクエリに反映する (履歴は積まない)。 */
export function writeCatalogParams(filter: CatalogFilter, sort: SortMode, view: ViewMode = "grid"): void {
  const url = new URL(window.location.href);
  const params = url.searchParams;
  if (filter.query) params.set("q", filter.query);
  else params.delete("q");
  if (sort !== "date") params.set("sort", sort);
  else params.delete("sort");
  const genres = effectiveGenres(filter);
  params.delete("genre");
  params.delete("genres");
  if (genres.length === 1) params.set("genre", genres[0]!);
  else if (genres.length > 1) params.set("genres", genres.join(","));
  writeMultiParam(params, "author", filter.authors);
  writeMultiParam(params, "performer", filter.performers);
  writeMultiParam(params, "community", filter.communities);
  if (filter.musicTitle.trim()) params.set("music", filter.musicTitle.trim());
  else params.delete("music");
  if (filter.musicComposer.trim()) params.set("composer", filter.musicComposer.trim());
  else params.delete("composer");
  if (parseFilterYear(filter.yearFrom) !== null) params.set("from", filter.yearFrom.trim());
  else params.delete("from");
  if (parseFilterYear(filter.yearTo) !== null) params.set("to", filter.yearTo.trim());
  else params.delete("to");
  params.delete("yearFrom");
  params.delete("yearTo");
  if (view === "list") params.set("view", "list");
  else params.delete("view");
  window.history.replaceState(null, "", url.toString());
}
