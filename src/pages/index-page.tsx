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
  countText,
  filterAndSortWorks,
  groupWorks,
  readCatalogParams,
  writeCatalogParams,
} from "../catalog.js";
import type { GenreFilter, SortMode } from "../catalog.js";
import { loadWorks, parseYouTubeId, thumbUrl } from "../works-core.js";
import type { NormalizedWork } from "../types.js";

const GENRE_OPTIONS: Array<{ value: GenreFilter; label: string }> = [
  { value: "", label: "すべて" },
  { value: "CV", label: "CV" },
  { value: "SV", label: "SV" },
  { value: "PV", label: "PV" },
];

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

function WorksGroup({ name, works }: { name: string; works: NormalizedWork[] }): React.JSX.Element {
  return (
    <section aria-label={name}>
      <div className="group-title">
        <span className="group-title__name">{name}</span>
        <span className="group-title__count">{works.length} 件</span>
      </div>
      <div className="works-grid">
        {works.map((w, i) => (
          <WorkCard key={w.id} work={w} index={i} />
        ))}
      </div>
    </section>
  );
}

export function IndexPage(): React.JSX.Element {
  const { theme, toggleTheme } = useTheme();
  const { toast } = useToast();
  const appbarRef = useElevatedAppBar();
  const [all, setAll] = useState<NormalizedWork[]>([]);
  const [query, setQuery] = useState(() => readCatalogParams(window.location.search).query);
  const [sort, setSort] = useState<SortMode>("date");
  const [genre, setGenre] = useState<GenreFilter>("");
  const [entered, setEntered] = useState(false);
  const enterTimer = useRef<number | null>(null);

  useEffect(() => {
    let cancelled = false;
    void loadWorks().then((works) => {
      if (cancelled) return;
      setAll(works);
      const params = readCatalogParams(window.location.search);
      setSort(params.sort);
      setGenre(params.genre);
      setEntered(true);
      if (enterTimer.current !== null) window.clearTimeout(enterTimer.current);
      enterTimer.current = window.setTimeout(() => setEntered(false), 700);
    });
    return () => {
      cancelled = true;
      if (enterTimer.current !== null) window.clearTimeout(enterTimer.current);
    };
  }, []);

  const filtered = useMemo(() => filterAndSortWorks(all, { query, genre }), [all, query, genre]);

  const groups = useMemo(() => {
    if (sort === "date") return [{ name: "すべての作品", works: filtered }];
    return groupWorks(filtered, SORT_TO_GROUP_FIELD[sort]);
  }, [filtered, sort]);

  const updateQuery = (next: string): void => {
    setQuery(next);
    writeCatalogParams({ query: next, genre }, sort);
  };
  const updateSort = (next: SortMode): void => {
    setSort(next);
    writeCatalogParams({ query, genre }, next);
  };
  const updateGenre = (next: GenreFilter): void => {
    setGenre(next);
    writeCatalogParams({ query, genre: next }, sort);
  };

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
              value={query}
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
            <span className="segment" role="group" aria-label="ジャンルで絞り込み">
              {GENRE_OPTIONS.map((option) => (
                <button
                  key={option.label}
                  className={genre === option.value ? "segment__btn is-active" : "segment__btn"}
                  type="button"
                  data-genre={option.value}
                  onClick={() => updateGenre(option.value)}
                >
                  {option.label}
                </button>
              ))}
            </span>
          </div>
          <div className="toolbar__count" id="result-count" role="status">
            {countText(filtered.length, query)}
          </div>
        </div>

        <div id="list" aria-live="polite" className={entered ? "is-entering" : undefined}>
          {!filtered.length ? (
            <div className="empty">
              <Icon name="search_off" />
              <span className="type-title-small">該当する作品が見つかりませんでした</span>
              <span className="type-body-medium">条件を変えてお試しください</span>
            </div>
          ) : (
            groups.map((g) => <WorksGroup key={g.name} name={g.name} works={g.works} />)
          )}
        </div>
      </main>

      <footer className="footer container">
        <p>
          作品データは <Icon name="data_object" /> <code>docs/data/works.json</code> で管理されています。
        </p>
      </footer>
      <ToastView toast={toast} />
    </>
  );
}
