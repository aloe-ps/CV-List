/**
 * 作品詳細ページ (旧 docs/work.html + work.js と等価)。
 */
import { useEffect, useRef, useState } from "react";
import { useTheme } from "../theme.js";
import {
  AppBar,
  Chip,
  Icon,
  ThemeToggleButton,
  ToastView,
  copyText,
  useElevatedAppBar,
  useToast,
} from "../components/ui.js";
import { byId, loadWorks, parseYouTubeId } from "../works-core.js";
import type { NormalizedWork } from "../types.js";

const PLAYER_ERROR_CODES = new Set([2, 5, 100, 101, 150, 153]);

function DetailSection({
  title,
  iconName,
  children,
}: {
  title: string;
  iconName: string;
  children: React.ReactNode;
}): React.JSX.Element {
  return (
    <section className="section">
      <h2 className="section__title">
        <Icon name={iconName} />
        {title}
      </h2>
      <div className="section__body">{children}</div>
    </section>
  );
}

function EmptyListText(): React.JSX.Element {
  return (
    <p className="type-body-medium" style={{ color: "var(--md-on-surface-variant)" }}>
      登録なし
    </p>
  );
}

function PerformerList({ work }: { work: NormalizedWork }): React.JSX.Element {
  if (!work.performers.length) return <EmptyListText />;
  return (
    <ul className="list">
      {work.performers.map((p) => (
        <li className="list-item" key={p}>
          <span className="list-item__icon">
            <Icon name="person" />
          </span>
          <div className="list-item__body">
            <div className="list-item__title">{p}</div>
          </div>
        </li>
      ))}
    </ul>
  );
}

function MusicList({ work }: { work: NormalizedWork }): React.JSX.Element {
  if (!work.music.length) return <EmptyListText />;
  return (
    <ul className="list">
      {work.music.map((m, idx) => (
        <li className="list-item" key={`${m.title ?? ""}-${m.url ?? ""}-${idx}`}>
          <span className="list-item__icon">
            <Icon name="music_note" />
          </span>
          <div className="list-item__body">
            <div className="list-item__title">{m.title ? m.title : "（楽曲名不明）"}</div>
            {m.composer && <div className="list-item__caption">作曲: {m.composer}</div>}
          </div>
          {m.url && (
            <a
              className="icon-btn icon-btn--small list-item__action"
              href={m.url}
              target="_blank"
              rel="noopener noreferrer"
              aria-label={`楽曲${idx + 1} のリンクを開く`}
            >
              <Icon name="open_in_new" />
            </a>
          )}
        </li>
      ))}
    </ul>
  );
}

function CommunityList({ work }: { work: NormalizedWork }): React.JSX.Element {
  if (!work.communities.length) return <EmptyListText />;
  return (
    <div className="card__chips" style={{ padding: "4px 0" }}>
      {work.communities.map((c) => (
        <Chip key={c} label={c} filled />
      ))}
    </div>
  );
}

function PlayerFallback({
  videoId,
  title,
  watchUrl,
  code,
}: {
  videoId: string;
  title: string;
  watchUrl: string;
  code: number;
}): React.JSX.Element {
  return (
    <>
      <img
        className="detail__video-thumb"
        src={`https://i.ytimg.com/vi/${encodeURIComponent(videoId)}/hqdefault.jpg`}
        alt={title}
        loading="lazy"
      />
      <div className="detail__video-fallback">
        <Icon name="play_circle" />
        <span className="type-title-small">
          プレーヤーでの再生に失敗しました（エラーコード: {code}）
        </span>
        <a
          className="btn btn--filled"
          href={watchUrl}
          target="_blank"
          rel="noopener noreferrer"
        >
          <Icon name="open_in_new" />
          YouTubeで開く
        </a>
      </div>
    </>
  );
}

function DetailVideo({ work }: { work: NormalizedWork }): React.JSX.Element {
  const videoId = parseYouTubeId(work.youtube);
  const [failedCode, setFailedCode] = useState<number | null>(null);
  const frameRef = useRef<HTMLIFrameElement | null>(null);

  useEffect(() => {
    setFailedCode(null);
  }, [videoId]);

  useEffect(() => {
    if (!videoId) return;
    const onMessage = (e: MessageEvent): void => {
      const frame = frameRef.current;
      if (!frame || e.source !== frame.contentWindow) return;
      const data = e.data as { event?: unknown; info?: unknown } | null;
      if (!data || data.event !== "onError") return;
      const code = parseInt(String(data.info ?? ""), 10) || 0;
      if (PLAYER_ERROR_CODES.has(code)) setFailedCode(code);
    };
    window.addEventListener("message", onMessage);
    return () => window.removeEventListener("message", onMessage);
  }, [videoId]);

  if (!videoId) {
    return (
      <div className="empty" style={{ background: "var(--md-surface-container)", borderRadius: "16px" }}>
        <Icon name="videocam_off" />
        <span className="type-title-small">動画が登録されていません</span>
      </div>
    );
  }
  return (
    <div className="detail__video">
      {failedCode === null ? (
        <iframe
          ref={frameRef}
          src={`https://www.youtube.com/embed/${encodeURIComponent(videoId)}?rel=0&modestbranding=1&playsinline=1&enablejsapi=1&feature=oembed`}
          title={work.title}
          frameBorder="0"
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
          referrerPolicy="strict-origin-when-cross-origin"
          allowFullScreen
        />
      ) : (
        <PlayerFallback videoId={videoId} title={work.title} watchUrl={work.youtube} code={failedCode} />
      )}
    </div>
  );
}

export function WorkDetailPage(): React.JSX.Element {
  const { theme, toggleTheme } = useTheme();
  const { toast, showToast } = useToast(2000);
  const appbarRef = useElevatedAppBar();
  const [work, setWork] = useState<NormalizedWork | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [barTitle, setBarTitle] = useState("作品詳細");

  useEffect(() => {
    const id = new URLSearchParams(window.location.search).get("id") ?? "";
    let cancelled = false;
    void loadWorks().then((works) => {
      if (cancelled) return;
      const found = byId(works, id);
      if (found) {
        setWork(found);
        setBarTitle(found.title);
        document.title = `${found.title} | CV-LIST`;
      } else {
        setBarTitle("作品が見つかりません");
      }
      setLoaded(true);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  const share = async (): Promise<void> => {
    const ok = await copyText(window.location.href);
    if (ok) showToast("リンクをコピーしました");
  };

  return (
    <>
      <AppBar
        backHref="index.html"
        headline={barTitle}
        themeToggle={<ThemeToggleButton theme={theme} onToggle={toggleTheme} />}
        headerRef={appbarRef}
      />
      <main className="container container--narrow">
        <div className="detail" id="detail">
          {!loaded || !work ? (
            loaded ? (
              <div className="empty">
                <Icon name="search_off" />
                <span className="type-title-small">作品が見つかりませんでした</span>
                <a className="btn btn--tonal" style={{ marginTop: "8px" }} href="index.html">
                  一覧に戻る
                </a>
              </div>
            ) : (
              <div className="empty">
                <Icon name="download" />
                <span className="type-title-small">データを読み込み中…</span>
              </div>
            )
          ) : (
            <>
              <DetailVideo work={work} />
              <h1 className="detail__title">{work.title}</h1>
              <div className="detail__meta">
                {work.genre && (
                  <span className="chip chip--fill" title="ジャンル">
                    {work.genre}
                  </span>
                )}
                {work.added && (
                  <span className="chip" style={{ borderColor: "var(--md-outline-variant)" }}>
                    追加日: {work.added}
                  </span>
                )}
                <button
                  className="btn btn--text btn--small"
                  id="share-btn"
                  type="button"
                  onClick={() => void share()}
                >
                  <Icon name="link" />
                  リンクをコピー
                </button>
                <a
                  className="btn btn--text btn--small"
                  href={`generator.html?id=${encodeURIComponent(work.id)}`}
                  title="この作品の情報を修正してPRを送る"
                >
                  <Icon name="edit" />
                  編集提案
                </a>
              </div>
              {work.description && <p className="detail__desc type-body-large">{work.description}</p>}
              <DetailSection title="作者" iconName="person">
                <div className="list-item" style={{ borderRadius: "12px" }}>
                  <span className="list-item__icon">
                    <Icon name="badge" />
                  </span>
                  <div className="list-item__body">
                    <div className="list-item__title">{work.author}</div>
                  </div>
                </div>
              </DetailSection>
              <DetailSection title="出演者" iconName="groups">
                <PerformerList work={work} />
              </DetailSection>
              <DetailSection title="使用楽曲" iconName="library_music">
                <MusicList work={work} />
              </DetailSection>
              <DetailSection title="コミュニティ" iconName="forum">
                <CommunityList work={work} />
              </DetailSection>
            </>
          )}
        </div>
      </main>

      <footer className="footer container">
        <p>
          作品データの修正・追加は <a href="generator.html">JSONジェネレーター</a> と GitHub Pull Request
          で行えます。
        </p>
      </footer>
      <ToastView toast={toast} />
    </>
  );
}
