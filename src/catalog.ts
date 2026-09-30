/**
 * 作品一覧の検索・絞り込み・並び替え (UI非依存)。
 * 旧 docs/assets/js/app.js の matches / groupKeysOf / groupSorted / render
 * 振る舞いと等価。
 */
import type { Genre, NormalizedWork } from "./types.js";

export type SortMode = "date" | "author" | "performer" | "community";
export type GenreFilter = Genre | "";
export type GroupField = "author" | "performers" | "communities";

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
  genre: GenreFilter;
}

/** 絞り込み＋追加日降順 (同日はタイトル順) に並べ替える。 */
export function filterAndSortWorks(
  all: readonly NormalizedWork[],
  filter: CatalogFilter,
): NormalizedWork[] {
  return all
    .filter((w) => matchesWork(w, filter.query) && (!filter.genre || w.genre === filter.genre))
    .slice()
    .sort(compareByDateDescTitle);
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
export function countText(count: number, query: string): string {
  const trimmed = query.trim();
  return `${count} 件の作品` + (trimmed ? `（検索: ${trimmed}）` : "");
}

/** URLクエリ (?q=, ?sort=, ?genre=) を読み取る。 */
export function readCatalogParams(search: string): {
  query: string;
  sort: SortMode;
  genre: GenreFilter;
} {
  const params = new URLSearchParams(search);
  const sortParam = params.get("sort");
  const sort: SortMode =
    sortParam === "author" || sortParam === "performer" || sortParam === "community"
      ? sortParam
      : "date";
  const genreParam = params.get("genre");
  const genre: GenreFilter =
    genreParam === "CV" || genreParam === "SV" || genreParam === "PV" ? genreParam : "";
  return { query: params.get("q") ?? "", sort, genre };
}

/** 検索条件をURLクエリに反映する (履歴は積まない)。 */
export function writeCatalogParams(filter: CatalogFilter, sort: SortMode): void {
  const url = new URL(window.location.href);
  if (filter.query) url.searchParams.set("q", filter.query);
  else url.searchParams.delete("q");
  if (sort !== "date") url.searchParams.set("sort", sort);
  else url.searchParams.delete("sort");
  if (filter.genre) url.searchParams.set("genre", filter.genre);
  else url.searchParams.delete("genre");
  window.history.replaceState(null, "", url.toString());
}
