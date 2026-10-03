/**
 * 作品一覧ページ (旧 docs/index.html + app.js と等価)。
 */
import { useEffect, useMemo, useRef, useState } from "react";
import { useTheme } from "../theme.js";
import {
  AppBar,
  Chip,
  Icon,
  ThemeToggleButton,
  ToastView,
  useElevatedAppBar,
  useToast,
} from "../components/ui.js";
import {
  SORT_TO_GROUP_FIELD,
  collectAddedYears,
  collectFieldOptions,
  countActiveFacets,
  countText,
  effectiveGenres,
  emptyCatalogFilter,
  filterAndSortWorks,
  groupWorks,
  readCatalogParams,
  splitMultiValue,
  writeCatalogParams,
} from "../catalog.js";
import type { CatalogFilter, SortMode, ViewMode } from "../catalog.js";
import { loadWorks, parseYouTubeId, thumbUrl } from "../works-core.js";
import type { Genre, NormalizedWork } from "../types.js";
import { copyText } from "../components/ui.js";

const GENRE_VALUES: Genre[] = ["CV", "SV", "PV"];

const VIEW_STORAGE_KEY = "catalog-view";

function readStoredView(): ViewMode {
  try {
    return window.localStorage.getItem(VIEW_STORAGE_KEY) === "list" ? "list" : "grid";
  } catch {
    return "grid";
  }
}

function readInitialView(search: string): ViewMode {
  const params = new URLSearchParams(search);
  if (params.get("view") === "list") return "list";
  if (params.get("view") === "grid") return "grid";
  return readStoredView();
}

function joinList(items: readonly string[]): string {
  if (!items.length) return "—";
  return items.join("・");
}

function WorkThumb({ work }: { work: NormalizedWork }): React.JSX.Element {
  const yid = parseYouTubeId(work.youtube);
  return (
    <div className="card__thumb">
      {yid && (
        <img
          src={thumbUrl(yid)}
          alt=""
          loading="lazy"
          onError={(e) => {
            e.currentTarget.classList.add("hide");
            e.currentTarget.parentElement?.classList.add("is-fallback");
          }}
        />
      )}
    </div>
  );
}

function MusicPreview({ work }: { work: NormalizedWork }): React.JSX.Element | null {
  if (!work.music.length) return null;
  const parts = work.music.map((m) => `${m.title || "（楽曲名不明）"}${m.composer ? `／${m.composer}` : ""}`);
  return (
    <div className="meta-line">
      <Icon name="music_note" />
      <span>{parts.join("・")}</span>
    </div>
  );
}

function CommunitiesPreview({ work }: { work: NormalizedWork }): React.JSX.Element | null {
  if (!work.communities.length) return null;
  return (
    <div className="card__chips">
      {work.communities.slice(0, 3).map((c) => (
        <Chip key={c} label={c} filled />
      ))}
      {work.communities.length > 3 && <Chip label={`+${work.communities.length - 3}`} />}
    </div>
  );
}

function WorkCard({ work, index }: { work: NormalizedWork; index: number }): React.JSX.Element {
  return (
    <a
      className="card card--clickable"
      style={{ "--i": index } as React.CSSProperties}
      href={`work.html?id=${encodeURIComponent(work.id)}`}
      aria-label={`${work.title} の詳細を見る`}
    >
      <WorkThumb work={work} />
      {work.genre && <span className="card__genre">{work.genre}</span>}
      <div className="card__body">
        <h2 className="card__title">{work.title}</h2>
        {work.description && <p className="card__desc">{work.description}</p>}
        <div className="meta-line">
          <Icon name="person" />
          <span>{work.author ? work.author : "作者不明"}</span>
        </div>
        <div className="meta-line">
          <Icon name="groups" />
          <span>{joinList(work.performers)}</span>
        </div>
        <MusicPreview work={work} />
        <CommunitiesPreview work={work} />
        <div className="card__footer">
          <span>詳細を見る</span>
          <Icon name="arrow_forward" />
        </div>
      </div>
    </a>
  );
}

function WorkListRow({ work, index }: { work: NormalizedWork; index: number }): React.JSX.Element {
  return (
    <a
      className="card card--clickable work-row"
      style={{ "--i": index } as React.CSSProperties}
      href={`work.html?id=${encodeURIComponent(work.id)}`}
      aria-label={`${work.title} の詳細を見る`}
    >
      <div className="work-row__thumb">
        <WorkThumb work={work} />
        {work.genre && <span className="card__genre">{work.genre}</span>}
      </div>
      <div className="work-row__body">
        <h2 className="card__title">{work.title}</h2>
        {work.description && <p className="card__desc">{work.description}</p>}
        <div className="work-row__meta">
          <div className="meta-line">
            <Icon name="person" />
            <span>{work.author ? work.author : "作者不明"}</span>
          </div>
          <div className="meta-line">
            <Icon name="groups" />
            <span>{joinList(work.performers)}</span>
          </div>
          <MusicPreview work={work} />
        </div>
        <CommunitiesPreview work={work} />
      </div>
      <div className="work-row__action" aria-hidden="true">
        <Icon name="arrow_forward" />
      </div>
    </a>
  );
}

function WorksGroup({
  name,
  works,
  view,
}: {
  name: string;
  works: NormalizedWork[];
  view: ViewMode;
}): React.JSX.Element {
  return (
    <section aria-label={name}>
      <div className="group-title">
        <span className="group-title__name">{name}</span>
        <span className="group-title__count">{works.length} 件</span>
      </div>
      {view === "list" ? (
        <div className="works-list">
          {works.map((w, i) => (
            <WorkListRow key={w.id} work={w} index={i} />
          ))}
        </div>
      ) : (
        <div className="works-grid">
          {works.map((w, i) => (
            <WorkCard key={w.id} work={w} index={i} />
          ))}
        </div>
      )}
    </section>
  );
}

export function IndexPage(): React.JSX.Element {
  const { theme, toggleTheme } = useTheme();
  const { toast, showToast } = useToast();
  const appbarRef = useElevatedAppBar();
  const [all, setAll] = useState<NormalizedWork[]>([]);
  const [filter, setFilter] = useState<CatalogFilter>(() => {
    const params = readCatalogParams(window.location.search);
    return {
      ...emptyCatalogFilter(),
      query: params.query,
      genre: params.genre,
      genres: params.genres,
      authors: params.authors,
      performers: params.performers,
      communities: params.communities,
      musicTitle: params.musicTitle,
      musicComposer: params.musicComposer,
      yearFrom: params.yearFrom,
      yearTo: params.yearTo,
    };
  });
  const [sort, setSort] = useState<SortMode>(() => readCatalogParams(window.location.search).sort);
  const [view, setView] = useState<ViewMode>(() => readInitialView(window.location.search));
  const [showAdvanced, setShowAdvanced] = useState(
    () => countActiveFacets(readCatalogParams(window.location.search) as CatalogFilter) > 0,
  );
  const [entered, setEntered] = useState(false);
  const enterTimer = useRef<number | null>(null);

  useEffect(() => {
    let cancelled = false;
    void loadWorks().then((works) => {
      if (cancelled) return;
      setAll(works);
      const params = readCatalogParams(window.location.search);
      setFilter({
        ...emptyCatalogFilter(),
        query: params.query,
        genre: params.genre,
        genres: params.genres,
        authors: params.authors,
        performers: params.performers,
        communities: params.communities,
        musicTitle: params.musicTitle,
        musicComposer: params.musicComposer,
        yearFrom: params.yearFrom,
        yearTo: params.yearTo,
      });
      setSort(params.sort);
      const urlView = new URLSearchParams(window.location.search).get("view");
      const nextView = urlView === "list" || urlView === "grid" ? urlView : readStoredView();
      setView(nextView);
      setShowAdvanced(countActiveFacets(params as CatalogFilter) > 0);
      setEntered(true);
      if (enterTimer.current !== null) window.clearTimeout(enterTimer.current);
      enterTimer.current = window.setTimeout(() => setEntered(false), 700);
    });
    return () => {
      cancelled = true;
      if (enterTimer.current !== null) window.clearTimeout(enterTimer.current);
    };
  }, []);

  const filtered = useMemo(() => filterAndSortWorks(all, filter), [all, filter]);
  const activeFacets = useMemo(() => countActiveFacets(filter), [filter]);
  const selectedGenres = useMemo(() => effectiveGenres(filter), [filter]);

  const authorOptions = useMemo(() => collectFieldOptions(all, "author"), [all]);
  const performerOptions = useMemo(() => collectFieldOptions(all, "performers"), [all]);
  const communityOptions = useMemo(() => collectFieldOptions(all, "communities"), [all]);
  const composerOptions = useMemo(() => collectFieldOptions(all, "composer"), [all]);
  const yearOptions = useMemo(() => collectAddedYears(all), [all]);

  const patchFilter = (patch: Partial<CatalogFilter>): void => {
    setFilter((prev) => {
      const next = { ...prev, ...patch };
      writeCatalogParams(next, sort, view);
      return next;
    });
  };
  const updateQuery = (next: string): void => {
    patchFilter({ query: next });
  };
  const updateSort = (next: SortMode): void => {
    setSort(next);
    writeCatalogParams(filter, next, view);
  };
  const toggleGenre = (genre: Genre): void => {
    const current = effectiveGenres(filter);
    const next = current.includes(genre) ? current.filter((g) => g !== genre) : [...current, genre];
    patchFilter({ genres: next, genre: next.length === 1 ? next[0]! : "" });
  };
  const updateView = (next: ViewMode): void => {
    setView(next);
    writeCatalogParams(filter, sort, next);
    try {
      window.localStorage.setItem(VIEW_STORAGE_KEY, next);
    } catch {
      /* 保存できなくても表示は切り替える */
    }
  };
  const resetFilters = (): void => {
    const next = emptyCatalogFilter();
    setFilter(next);
    writeCatalogParams(next, sort, view);
  };
  const copyShareLink = async (): Promise<void> => {
    writeCatalogParams(filter, sort, view);
    const ok = await copyText(window.location.href);
    showToast(ok ? "検索条件のURLをコピーしました" : "URLのコピーに失敗しました");
  };

  const groups = useMemo(() => {
    if (sort === "date") return [{ name: "すべての作品", works: filtered }];
    return groupWorks(filtered, SORT_TO_GROUP_FIELD[sort]);
  }, [filtered, sort]);

  return (
    <>
      <AppBar
        title="PENSPINNING-FILMS-LIST"
        subtitle="CV,SV,PVアーカイブ"
        themeToggle={<ThemeToggleButton theme={theme} onToggle={toggleTheme} />}
        headerRef={appbarRef}
      />
      <main className="container">
        <section className="hero">
          <h1 className="hero__title">登録されている作品</h1>
          <p className="hero__lead">
            作者・出演者・使用楽曲・コミュニティから作品をさがせます。作品をクリックすると詳細を確認できます。
          </p>
        </section>

        <section className="info-card" aria-label="作品を追加する">
          <div className="info-card__icon">
            <Icon name="library_add" />
          </div>
          <div className="info-card__body">
            <span className="type-title-small">作品を追加したいですか？</span>
            <p>サイト内のジェネレーターで JSON を生成し、GitHub の Pull Request で作品概要を追加できます。</p>
          </div>
          <div className="info-card__actions">
            <a className="btn btn--filled" href="generator.html">
              <Icon name="add" />
              作品を追加
            </a>
          </div>
        </section>

        <div className="toolbar">
          <div className="toolbar__search">
            <Icon name="search" />
            <input
              type="search"
              id="search-input"
              placeholder="タイトル・作者・楽曲・出演者で検索"
              autoComplete="off"
              value={filter.query}
              onChange={(e) => updateQuery(e.target.value)}
            />
          </div>
          <div className="toolbar__sort">
            <span className="hide-sm">並び順</span>
            <span className="select">
              <select id="sort-select" aria-label="並び順" value={sort} onChange={(e) => updateSort(e.target.value as SortMode)}>
                <option value="date">新しい順</option>
                <option value="author">作者順</option>
                <option value="performer">出演者順</option>
                <option value="community">コミュニティ順</option>
              </select>
            </span>
          </div>
          <div className="toolbar__genres">
            <span className="segment" role="group" aria-label="ジャンルで絞り込み（複数選択可）">
              {GENRE_VALUES.map((value) => {
                const active = selectedGenres.includes(value);
                return (
                  <button
                    key={value}
                    className={active ? "segment__btn is-active" : "segment__btn"}
                    type="button"
                    data-genre={value}
                    aria-pressed={active}
                    onClick={() => toggleGenre(value)}
                  >
                    {value}
                  </button>
                );
              })}
            </span>
          </div>
          <div className="toolbar__view">
            <span className="segment" role="group" aria-label="表示形式を切り替え">
              <button
                type="button"
                className={view === "grid" ? "segment__btn is-active" : "segment__btn"}
                aria-pressed={view === "grid"}
                aria-label="グリッド表示"
                title="グリッド表示"
                data-view="grid"
                onClick={() => updateView("grid")}
              >
                <Icon name="grid_view" />
              </button>
              <button
                type="button"
                className={view === "list" ? "segment__btn is-active" : "segment__btn"}
                aria-pressed={view === "list"}
                aria-label="リスト表示"
                title="リスト表示"
                data-view="list"
                onClick={() => updateView("list")}
              >
                <Icon name="view_list" />
              </button>
            </span>
          </div>
          <div className="toolbar__count" id="result-count" role="status">
            {countText(filtered.length, filter.query, activeFacets)}
          </div>
        </div>

        <div className="toolbar toolbar--advanced-toggle">
          <button
            type="button"
            className="btn btn--tonal btn--small"
            aria-expanded={showAdvanced}
            aria-controls="advanced-filters"
            onClick={() => setShowAdvanced((v) => !v)}
          >
            <Icon name="tune" />
            詳細検索{activeFacets > 0 ? `（${activeFacets}件の条件）` : ""}
          </button>
          {activeFacets > 0 && (
            <button type="button" className="btn btn--text btn--small" onClick={resetFilters}>
              <Icon name="filter_alt_off" />
              条件をリセット
            </button>
          )}
          <button
            type="button"
            className="btn btn--outlined btn--small"
            onClick={() => void copyShareLink()}
            title="現在の検索条件をURLに保存して共有します"
          >
            <Icon name="share" />
            検索条件を共有
          </button>
        </div>

        {showAdvanced && (
          <section
            id="advanced-filters"
            className="filters-advanced"
            aria-label="詳細な絞り込み条件"
          >
            <div className="filter-grid">
              <fieldset className="filter-field">
                <legend className="type-label-large">ジャンル（複数選択可）</legend>
                <div className="filter-genres">
                  {GENRE_VALUES.map((value) => {
                    const active = selectedGenres.includes(value);
                    return (
                      <label key={value} className={active ? "chip chip--fill" : "chip"}>
                        <input
                          type="checkbox"
                          checked={active}
                          onChange={() => toggleGenre(value)}
                          aria-label={`ジャンル ${value} で絞り込む`}
                        />
                        {value}
                      </label>
                    );
                  })}
                </div>
                <p className="field__hint">期間（追加年）と組み合わせて CV・SV・PV を横断検索できます。</p>
              </fieldset>
              <fieldset className="filter-field">
                <legend className="type-label-large">公開年・追加年（追加日基準）</legend>
                <div className="filter-years">
                  <label>
                    開始年
                    <span className="select">
                      <select
                        aria-label="開始年"
                        value={filter.yearFrom}
                        onChange={(e) => patchFilter({ yearFrom: e.target.value })}
                      >
                        <option value="">指定なし</option>
                        {yearOptions.map((year) => (
                          <option key={year} value={year}>
                            {year}
                          </option>
                        ))}
                      </select>
                    </span>
                  </label>
                  <span aria-hidden="true">〜</span>
                  <label>
                    終了年
                    <span className="select">
                      <select
                        aria-label="終了年"
                        value={filter.yearTo}
                        onChange={(e) => patchFilter({ yearTo: e.target.value })}
                      >
                        <option value="">指定なし</option>
                        {yearOptions.map((year) => (
                          <option key={year} value={year}>
                            {year}
                          </option>
                        ))}
                      </select>
                    </span>
                  </label>
                </div>
                <p className="field__hint">
                  作品データに公開日がないため追加日（added）の年で絞り込みます。
                </p>
              </fieldset>
              <div className="filter-field">
                <label className="type-label-large" htmlFor="filter-authors">
                  作者（複数可・カンマ区切り）
                </label>
                <input
                  id="filter-authors"
                  className="field__control"
                  type="text"
                  placeholder="例: MEL, futemi."
                  autoComplete="off"
                  list="author-suggest"
                  value={filter.authors.join(", ")}
                  onChange={(e) => patchFilter({ authors: splitMultiValue(e.target.value) })}
                />
                <datalist id="author-suggest">
                  {authorOptions.map((name) => (
                    <option key={name} value={name} />
                  ))}
                </datalist>
              </div>
              <div className="filter-field">
                <label className="type-label-large" htmlFor="filter-performers">
                  出演者（複数可・カンマ区切り）
                </label>
                <input
                  id="filter-performers"
                  className="field__control"
                  type="text"
                  placeholder="例: pARu, omoa"
                  autoComplete="off"
                  list="performer-suggest"
                  value={filter.performers.join(", ")}
                  onChange={(e) => patchFilter({ performers: splitMultiValue(e.target.value) })}
                />
                <datalist id="performer-suggest">
                  {performerOptions.map((name) => (
                    <option key={name} value={name} />
                  ))}
                </datalist>
              </div>
              <div className="filter-field">
                <label className="type-label-large" htmlFor="filter-communities">
                  コミュニティ（複数可・カンマ区切り）
                </label>
                <input
                  id="filter-communities"
                  className="field__control"
                  type="text"
                  placeholder="例: JEB"
                  autoComplete="off"
                  list="community-suggest"
                  value={filter.communities.join(", ")}
                  onChange={(e) => patchFilter({ communities: splitMultiValue(e.target.value) })}
                />
                <datalist id="community-suggest">
                  {communityOptions.map((name) => (
                    <option key={name} value={name} />
                  ))}
                </datalist>
              </div>
              <div className="filter-field">
                <label className="type-label-large" htmlFor="filter-music">
                  楽曲名
                </label>
                <input
                  id="filter-music"
                  className="field__control"
                  type="text"
                  placeholder="例: Finale"
                  autoComplete="off"
                  value={filter.musicTitle}
                  onChange={(e) => patchFilter({ musicTitle: e.target.value })}
                />
              </div>
              <div className="filter-field">
                <label className="type-label-large" htmlFor="filter-composer">
                  作曲者
                </label>
                <input
                  id="filter-composer"
                  className="field__control"
                  type="text"
                  placeholder="例: Akiza"
                  autoComplete="off"
                  list="composer-suggest"
                  value={filter.musicComposer}
                  onChange={(e) => patchFilter({ musicComposer: e.target.value })}
                />
                <datalist id="composer-suggest">
                  {composerOptions.map((name) => (
                    <option key={name} value={name} />
                  ))}
                </datalist>
              </div>
            </div>
            <div className="filter-actions">
              <button type="button" className="btn btn--text btn--small" onClick={resetFilters}>
                <Icon name="filter_alt_off" />
                条件をリセット
              </button>
              <button
                type="button"
                className="btn btn--tonal btn--small"
                onClick={() => void copyShareLink()}
              >
                <Icon name="link" />
                検索条件のURLをコピー
              </button>
            </div>
          </section>
        )}

        <div id="list" aria-live="polite" className={entered ? "is-entering" : undefined}>
          {!filtered.length ? (
            <div className="empty">
              <Icon name="search_off" />
              <span className="type-title-small">該当する作品が見つかりませんでした</span>
              <span className="type-body-medium">条件を変えてお試しください</span>
            </div>
          ) : (
            groups.map((g) => <WorksGroup key={g.name} name={g.name} works={g.works} view={view} />)
          )}
        </div>
      </main>

      <footer className="footer container">
        <p>
          作品データは <Icon name="data_object" /> <code>public/data/works.json</code> で管理されています。
        </p>
      </footer>
      <ToastView toast={toast} />
    </>
  );
}
