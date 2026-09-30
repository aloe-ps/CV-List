/**
 * JSONジェネレーターページ (旧 docs/generator.html + generator.js と等価)。
 * 作品ドラフトの配列を状態として持ち、JSON・検証・GitHub誘導は派生値として算出する。
 */
import { useEffect, useMemo, useRef, useState } from "react";
import { useTheme } from "../theme.js";
import { SITE_CONFIG } from "../config.js";
import {
  AppBar,
  Icon,
  ThemeToggleButton,
  ToastView,
  copyText,
  useElevatedAppBar,
  useToast,
} from "../components/ui.js";
import {
  BULK_FIELDS,
  bulkTargetIndexes,
  collectWork,
  commonFieldValue,
  draftFromNormalized,
  emptyDraft,
  findDuplicates,
  hasBulkValue,
  readDraftFieldValue,
  stringifyWorks,
  validateWork,
  writeDraftFieldValue,
} from "../generator-model.js";
import type {
  BulkField,
  BulkScope,
  BulkValues,
  CollectedWork,
  WorkDraft,
} from "../generator-model.js";
import { byId, loadWorks, parsePlaylistId, parseYouTubeId } from "../works-core.js";
import type { NormalizedWork } from "../types.js";
import {
  PLAYLIST_MAX_ITEMS,
  PLAYLIST_PAGE_SIZE,
  detectGenre,
  fetchPlaylistPage,
  fetchVideoMeta,
  toDateInput,
} from "../youtube.js";
import { BulkCard, JsonPreview, PLAYLIST_HINT_DEFAULT, PlaylistCard } from "../components/generator/side-cards.js";
import type { ValidityKind } from "../components/generator/side-cards.js";
import { WorkFormItem } from "../components/generator/work-form.js";
import type { RepeaterKind, WorkFormCallbacks, WorkFormState } from "../components/generator/work-form.js";

const AUTOFILL_DEBOUNCE_MS = 900;
const ISSUE_BODY_LIMIT = 60000;
const METADATA_UPGRADE_HINT =
  "概要・公開日も自動入力するには、src/config.ts の youtubeMetadataEndpoint にプロキシURL（worker/ をデプロイ）を設定してください。APIキーがクライアントに公開されません。";

interface PendingFetch {
  timer: number | null;
  token: number;
}

function createForm(key: string, draft: WorkDraft, editId: string | null): WorkFormState {
  return { key, draft, editId, dirty: false, fetching: false, metadataHintShown: false, metadataHint: "" };
}

/** 存在しない作品IDで開かれた場合の空プレフィル用。 */
function emptyNormalized(): NormalizedWork {
  return {
    id: "",
    title: "",
    genre: "",
    description: "",
    youtube: "",
    author: "",
    performers: [],
    music: [],
    communities: [],
    added: "",
  };
}

function applyAutofill(
  draft: WorkDraft,
  meta: { title: string; description: string; publishedAt: string },
  force: boolean,
): WorkDraft {
  const next = { ...draft };
  if (force || !next.title.trim()) next.title = meta.title;
  if (force || !next.description.trim()) next.description = meta.description;
  const date = toDateInput(meta.publishedAt);
  if (date && (force || !next.added.trim())) next.added = date;
  return next;
}

export function GeneratorPage(): React.JSX.Element {
  const { theme, toggleTheme } = useTheme();
  const { toast, showToast } = useToast(2200);
  const appbarRef = useElevatedAppBar();

  const [works, setWorks] = useState<WorkFormState[]>(() => [createForm("1", emptyDraft(), null)]);
  const [activeKey, setActiveKey] = useState("1");
  const [expandedKey, setExpandedKey] = useState<string | null>("1");
  const [allWorks, setAllWorks] = useState<NormalizedWork[]>([]);
  const [editBanner, setEditBanner] = useState<NormalizedWork | null>(null);
  const [bulkValues, setBulkValues] = useState<BulkValues>({ author: "", genre: "", communities: "" });
  const [bulkDirty, setBulkDirty] = useState<Record<BulkField, boolean>>({
    author: false,
    genre: false,
    communities: false,
  });
  const [bulkScope, setBulkScope] = useState<BulkScope>("all");
  const [playlistUrl, setPlaylistUrl] = useState("");
  const [playlistBusy, setPlaylistBusy] = useState(false);
  const [playlistHint, setPlaylistHint] = useState(PLAYLIST_HINT_DEFAULT);

  const nextKeyRef = useRef(2);
  const pendingRef = useRef(new Map<string, PendingFetch>());
  const triggerRefs = useRef(new Map<string, HTMLButtonElement>());
  const focusTitleKeyRef = useRef<string | null>(null);
  const titleInputs = useRef(new Map<string, HTMLInputElement>());

  const worksRef = useRef(works);
  useEffect(() => {
    worksRef.current = works;
  }, [works]);

  const pendingFor = (key: string): PendingFetch => {
    const existing = pendingRef.current.get(key);
    if (existing) return existing;
    const created: PendingFetch = { timer: null, token: 0 };
    pendingRef.current.set(key, created);
    return created;
  };
  const invalidateAutofill = (key: string): void => {
    const pending = pendingFor(key);
    if (pending.timer !== null) {
      window.clearTimeout(pending.timer);
      pending.timer = null;
    }
    pending.token += 1;
    setWorks((prev) => prev.map((w) => (w.key === key && w.fetching ? { ...w, fetching: false } : w)));
  };

  /* ---------- 初期読み込み・編集モード ---------- */
  useEffect(() => {
    const id = new URLSearchParams(window.location.search).get("id") ?? "";
    let cancelled = false;
    void loadWorks().then((loaded) => {
      if (cancelled) return;
      setAllWorks(loaded);
      if (id) {
        const existing = byId(loaded, id) ?? null;
        setWorks((prev) =>
          prev.map((w, i) =>
            i === 0
              ? { ...w, editId: id, draft: w.dirty ? w.draft : draftFromNormalized(existing ?? emptyNormalized()) }
              : w,
          ),
        );
        if (existing) setEditBanner(existing);
      }
    });
    return () => {
      cancelled = true;
    };
  }, []);

  /* ---------- 派生値: エントリ・JSON・検証・Issue ---------- */
  const entries = useMemo(
    () =>
      works.map((w) => {
        const obj = collectWork(w.draft, w.editId);
        return { key: w.key, obj, missing: w.dirty ? validateWork(obj) : [] };
      }),
    [works],
  );
  const duplicates = useMemo(
    () =>
      findDuplicates(
        entries.map((e) => ({ id: e.obj.id, title: e.obj.title, youtube: e.obj.youtube ?? "", editId: works.find((w) => w.key === e.key)?.editId ?? null })),
        allWorks,
      ),
    [entries, works, allWorks],
  );
  const json = useMemo(() => stringifyWorks(entries.map((e) => e.obj)), [entries]);
  const missingCount = entries.filter((e) => e.missing.length > 0).length;
  const duplicateCount = duplicates.filter(Boolean).length;

  const validity: { text: string; kind: ValidityKind } = missingCount > 0
    ? { text: `必須項目が未入力 (${missingCount}件)`, kind: "missing" }
    : duplicateCount > 0
      ? { text: "IDが重複しています", kind: "duplicate" }
      : entries.length > 1
        ? { text: `OK (${entries.length}作品)`, kind: "ok" }
        : { text: "OK", kind: "ok" };

  const github = useMemo(() => {
    const owner = SITE_CONFIG.owner.trim();
    const repo = SITE_CONFIG.repo.trim();
    const configured = Boolean(owner) && !owner.includes("your-github");
    if (!configured) return { configured: false, editHref: "#", issueBase: "" };
    const issueBase = `https://github.com/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}`;
    const branch = (SITE_CONFIG.branch || "master").trim();
    return {
      configured: true,
      editHref: `${issueBase}/edit/${encodeURIComponent(branch)}/${SITE_CONFIG.dataFile.trim()}`,
      issueBase,
    };
  }, []);

  const issue = useMemo(() => {
    if (!github.configured || !github.issueBase) return { href: "#", tooLong: false };
    const first: CollectedWork | undefined = entries[0]?.obj;
    const title =
      entries.length > 1 ? `作品追加: ${entries.length}作品` : `作品追加: ${first?.title || "無題"}`;
    const body = `\`\`\`json\n${json}\n\`\`\``;
    const tooLong = body.length > ISSUE_BODY_LIMIT;
    let href = `${github.issueBase}/issues/new?title=${encodeURIComponent(title)}`;
    if (!tooLong) href += `&body=${encodeURIComponent(body)}`;
    return { href, tooLong };
  }, [github, entries, json]);

  /* ---------- bulk 自動同期 ---------- */
  useEffect(() => {
    setBulkValues((prev) => {
      const next = { ...prev };
      let changed = false;
      (Object.keys(BULK_FIELDS) as BulkField[]).forEach((field) => {
        if (bulkDirty[field]) return;
        const common = commonFieldValue(
          worksRef.current.map((w) => w.draft),
          field,
        );
        if (next[field] !== common) {
          next[field] = common;
          changed = true;
        }
      });
      return changed ? next : prev;
    });
  }, [works, bulkDirty]);

  /* ---------- 作品操作 ---------- */
  const activateWork = (key: string, focus: boolean): void => {
    setActiveKey(key);
    setExpandedKey(key);
    if (focus) focusTitleKeyRef.current = key;
  };

  const addWork = (): void => {
    const key = String(nextKeyRef.current++);
    setWorks((prev) => [...prev, createForm(key, emptyDraft(), null)]);
    activateWork(key, true);
    showToast("新しい作品フォームを追加しました");
  };

  const removeWork = (key: string): void => {
    const current = worksRef.current;
    if (current.length === 1) {
      showToast("作品を削除するには、まず別の作品を追加してください");
      return;
    }
    invalidateAutofill(key);
    pendingRef.current.delete(key);
    const index = current.findIndex((w) => w.key === key);
    if (index < 0) return;
    const rest = current.filter((w) => w.key !== key);
    setWorks(rest);
    const next = rest[Math.min(index, rest.length - 1)]!;
    setActiveKey(next.key);
    setExpandedKey(next.key);
    showToast("作品を削除しました");
  };

  const toggleWork = (key: string): void => {
    setActiveKey(key);
    setExpandedKey((prev) => (prev === key ? null : key));
  };

  const triggerKeyDown = (e: React.KeyboardEvent, index: number): void => {
    const current = worksRef.current;
    if (!current.length) return;
    let nextIndex = -1;
    if (e.key === "ArrowDown" || e.key === "ArrowRight") nextIndex = (index + 1) % current.length;
    else if (e.key === "ArrowUp" || e.key === "ArrowLeft")
      nextIndex = (index - 1 + current.length) % current.length;
    else if (e.key === "Home") nextIndex = 0;
    else if (e.key === "End") nextIndex = current.length - 1;
    else return;
    e.preventDefault();
    const next = current[nextIndex]!;
    setActiveKey(next.key);
    setExpandedKey(next.key);
    triggerRefs.current.get(next.key)?.focus();
  };

  const patchDraft = (key: string, patch: Partial<WorkDraft>): void => {
    setWorks((prev) => prev.map((w) => (w.key === key ? { ...w, draft: { ...w.draft, ...patch }, dirty: true } : w)));
  };

  const changeRow = (key: string, kind: RepeaterKind, index: number, field: string, value: string): void => {
    setWorks((prev) =>
      prev.map((w) => {
        if (w.key !== key) return w;
        const draft = { ...w.draft };
        if (kind === "music") {
          const rows = draft.music.map((row, i) => (i === index ? { ...row, [field]: value } : row));
          draft.music = rows;
        } else {
          const rows = (kind === "performers" ? draft.performers : draft.communities).map((row, i) =>
            i === index ? value : row,
          );
          // 最終行への入力で空行を自動追加 (出演者・コミュニティのみ)
          if (index === rows.length - 1 && value.trim() !== "") rows.push("");
          if (kind === "performers") draft.performers = rows;
          else draft.communities = rows;
        }
        return { ...w, draft, dirty: true };
      }),
    );
  };

  const addRow = (key: string, kind: RepeaterKind): void => {
    setWorks((prev) =>
      prev.map((w) => {
        if (w.key !== key) return w;
        const draft = { ...w.draft };
        if (kind === "music") draft.music = [...draft.music, { title: "", url: "", composer: "" }];
        else if (kind === "performers") draft.performers = [...draft.performers, ""];
        else draft.communities = [...draft.communities, ""];
        return { ...w, draft, dirty: true };
      }),
    );
  };

  const removeRow = (key: string, kind: RepeaterKind, index: number): void => {
    setWorks((prev) =>
      prev.map((w) => {
        if (w.key !== key) return w;
        const draft = { ...w.draft };
        if (kind === "music") draft.music = draft.music.filter((_, i) => i !== index);
        else if (kind === "performers") draft.performers = draft.performers.filter((_, i) => i !== index);
        else draft.communities = draft.communities.filter((_, i) => i !== index);
        return { ...w, draft, dirty: true };
      }),
    );
  };

  /* ---------- 自動入力 ---------- */
  const fetchAndFill = (key: string, force: boolean): void => {
    const form = worksRef.current.find((w) => w.key === key);
    if (!form) return;
    const pending = pendingFor(key);
    if (pending.timer !== null) {
      window.clearTimeout(pending.timer);
      pending.timer = null;
    }
    const videoId = parseYouTubeId(form.draft.youtube);
    if (!videoId) {
      showToast("YouTubeのURLを入力してください");
      return;
    }
    pending.token += 1;
    const token = pending.token;
    setWorks((prev) => prev.map((w) => (w.key === key ? { ...w, fetching: true } : w)));
    const endpoint = SITE_CONFIG.youtubeMetadataEndpoint.trim();
    const apiKey = SITE_CONFIG.youtubeApiKey.trim();
    void fetchVideoMeta(videoId, { endpoint, apiKey })
      .then((meta) => {
        const latest = worksRef.current.find((w) => w.key === key);
        if (!latest || pendingFor(key).token !== token) return;
        if (parseYouTubeId(latest.draft.youtube) !== videoId) return;
        setWorks((prev) =>
          prev.map((w) => {
            if (w.key !== key) return w;
            const filled = applyAutofill(w.draft, meta, force);
            const needsHint =
              !w.metadataHintShown && !endpoint && !meta.description && !meta.publishedAt && Boolean(meta.title);
            return {
              ...w,
              draft: filled,
              dirty: true,
              fetching: false,
              metadataHintShown: w.metadataHintShown || needsHint,
              metadataHint: needsHint ? METADATA_UPGRADE_HINT : w.metadataHint,
            };
          }),
        );
        if (!meta.title) showToast("動画情報を取得できませんでした");
        else if (meta.description || meta.publishedAt) showToast("タイトル・概要・公開日 を自動入力しました");
        else showToast("タイトルを自動入力しました（概要・公開日は未設定）");
      })
      .catch(() => {
        const latest = worksRef.current.find((w) => w.key === key);
        if (latest && pendingFor(key).token === token) showToast("動画情報を取得できませんでした");
      })
      .finally(() => {
        const latest = worksRef.current.find((w) => w.key === key);
        if (latest && pendingFor(key).token === token) {
          setWorks((prev) => prev.map((w) => (w.key === key ? { ...w, fetching: false } : w)));
        }
      });
  };

  const changeYoutube = (key: string, value: string): void => {
    patchDraft(key, { youtube: value });
    invalidateAutofill(key);
    const pending = pendingFor(key);
    pending.timer = window.setTimeout(() => {
      pending.timer = null;
      const latest = worksRef.current.find((w) => w.key === key);
      if (latest && !latest.draft.title.trim()) fetchAndFill(key, false);
    }, AUTOFILL_DEBOUNCE_MS);
  };

  const pasteYoutube = (key: string): void => {
    window.setTimeout(() => {
      const latest = worksRef.current.find((w) => w.key === key);
      if (
        latest &&
        !latest.draft.title.trim() &&
        parseYouTubeId(latest.draft.youtube) !== null
      ) {
        fetchAndFill(key, false);
      }
    }, 0);
  };

  /* ---------- bulk ---------- */
  const changeBulkValue = (field: BulkField, value: string): void => {
    setBulkValues((prev) => ({ ...prev, [field]: value }));
    setBulkDirty((prev) => ({ ...prev, [field]: true }));
  };

  const applyBulk = (name: BulkField | "all"): void => {
    const names: BulkField[] =
      name === "all" ? (Object.keys(BULK_FIELDS) as BulkField[]) : [name];
    if (name === "all") {
      setBulkDirty({ author: true, genre: true, communities: true });
    } else {
      setBulkDirty((prev) => ({ ...prev, [name]: true }));
    }
    const labels: string[] = [];
    const touched = new Set<string>();
    const currentDrafts = worksRef.current.map((w) => w.draft);
    const perFieldTargets = new Map<BulkField, Set<number>>();
    for (const field of names) {
      if (!hasBulkValue(field, bulkValues[field])) continue;
      const targets = new Set(bulkTargetIndexes(currentDrafts, field, bulkScope));
      if (!targets.size) continue;
      perFieldTargets.set(field, targets);
      labels.push(BULK_FIELDS[field].label);
    }
    if (perFieldTargets.size > 0) {
      setWorks((prev) =>
        prev.map((w, index) => {
          let draft = w.draft;
          let changed = false;
          for (const [field, targets] of perFieldTargets) {
            if (!targets.has(index)) continue;
            draft = writeDraftFieldValue(draft, field, bulkValues[field]);
            changed = true;
          }
          if (!changed) return w;
          touched.add(w.key);
          return { ...w, draft, dirty: true };
        }),
      );
    }
    if (!labels.length) {
      const hasValue = names.some((field) => hasBulkValue(field, bulkValues[field]));
      showToast(hasValue ? "未入力の作品がありません" : "一括編集する値を入力してください");
      return;
    }
    showToast(`${labels.join("・")}を${touched.size}作品に適用しました`);
  };

  /* ---------- プレイリスト取込 ---------- */
  const importPlaylist = (): void => {
    if (playlistBusy) return;
    const endpoint = SITE_CONFIG.youtubeMetadataEndpoint.trim();
    if (!endpoint) {
      showToast("取り込みには youtubeMetadataEndpoint（Cloudflare Worker）の設定が必要です");
      return;
    }
    const playlistId = parsePlaylistId(playlistUrl);
    if (!playlistId) {
      showToast("再生リストのURLまたはIDが不正です");
      return;
    }
    const known = new Set<string>();
    for (const w of allWorks) {
      const id = parseYouTubeId(w.youtube);
      if (id) known.add(id);
    }
    for (const w of worksRef.current) {
      const id = parseYouTubeId(w.draft.youtube);
      if (id) known.add(id);
    }
    setPlaylistBusy(true);
    setPlaylistHint("取得中...");
    const collected: Array<{ title: string; description: string; youtube: string; added: string; genre: "" | "CV" | "SV" | "PV" }> = [];
    let fetched = 0;
    let playlistTitle = "";
    let nextPageToken = "";

    const loadPage = async (pageToken: string): Promise<void> => {
      const page = await fetchPlaylistPage(playlistId, {
        endpoint,
        maxResults: PLAYLIST_PAGE_SIZE,
        pageToken,
      });
      if (page.title) playlistTitle = page.title;
      fetched += page.items.length;
      for (const item of page.items) {
        if (!/^[A-Za-z0-9_-]{11}$/.test(item.videoId) || known.has(item.videoId)) continue;
        known.add(item.videoId);
        collected.push({
          title: item.title,
          description: item.description,
          youtube: `https://youtu.be/${item.videoId}`,
          added: toDateInput(item.publishedAt),
          genre: detectGenre(item.title) || detectGenre(playlistTitle),
        });
      }
      nextPageToken = page.nextPageToken;
    };

    void (async () => {
      try {
        await loadPage("");
        while (nextPageToken && collected.length < PLAYLIST_MAX_ITEMS) {
          await loadPage(nextPageToken);
        }
        if (!collected.length) throw new Error("empty");
        let firstKey: string | null = null;
        setWorks((prev) => {
          const added: WorkFormState[] = [];
          let counter = nextKeyRef.current;
          for (const item of collected) {
            const key = String(counter++);
            if (firstKey === null) firstKey = key;
            added.push(
              createForm(
                key,
                {
                  ...emptyDraft(),
                  title: item.title,
                  description: item.description,
                  youtube: item.youtube,
                  added: item.added,
                  genre: item.genre,
                },
                null,
              ),
            );
          }
          nextKeyRef.current = counter;
          return [...prev, ...added.map((w) => ({ ...w, dirty: true }))];
        });
        if (firstKey !== null) {
          setActiveKey(firstKey);
          setExpandedKey(firstKey);
        }
        const skipped = fetched - collected.length;
        showToast(
          `${collected.length}作品を追加しました${skipped > 0 ? `（登録済み ${skipped}本をスキップ）` : ""}`,
        );
        setPlaylistHint(
          `${collected.length}作品を追加しました` +
            (skipped > 0 ? `。登録済みの ${skipped}本はスキップしています。` : "。") +
            (nextPageToken ? ` 上限 ${PLAYLIST_MAX_ITEMS}件で打ち切りました。` : "") +
            " 著者は自動入力されないため、各作品へ入力してください。",
        );
      } catch (err) {
        const reason = err instanceof Error ? err.message : "";
        if (reason === "empty") showToast("再生リストに動画が見つかりませんでした");
        else if (reason === "no-endpoint")
          showToast("取り込みには youtubeMetadataEndpoint（Cloudflare Worker）の設定が必要です");
        else showToast("再生リストの取得に失敗しました（Worker の再デプロイが必要な場合があります）");
        setPlaylistHint(PLAYLIST_HINT_DEFAULT);
      } finally {
        setPlaylistBusy(false);
      }
    })();
  };

  /* ---------- コピー・リセット ---------- */
  const copyJson = (): void => {
    void copyText(json).then((ok) => {
      if (!ok) {
        showToast("コピーに失敗しました");
        return;
      }
      showToast(missingCount > 0 ? "コピーしました（未入力項目に注意）" : "JSONをコピーしました");
    });
  };

  const resetActive = (): void => {
    const active = worksRef.current.find((w) => w.key === activeKey);
    if (!active) return;
    invalidateAutofill(active.key);
    setWorks((prev) =>
      prev.map((w) =>
        w.key === active.key ? { ...w, draft: emptyDraft(), dirty: true } : w,
      ),
    );
    showToast("現在の作品をリセットしました");
  };

  const callbacksFor = (key: string): WorkFormCallbacks => ({
    onToggle: () => toggleWork(key),
    onTriggerKeyDown: (e) => {
      const index = worksRef.current.findIndex((w) => w.key === key);
      triggerKeyDown(e, index);
    },
    onDraftChange: (patch) => patchDraft(key, patch),
    onYoutubeChange: (value) => changeYoutube(key, value),
    onYoutubePaste: () => pasteYoutube(key),
    onFetch: () => {
      patchDraft(key, {});
      fetchAndFill(key, true);
    },
    onRemove: () => removeWork(key),
    onAddRow: (kind) => addRow(key, kind),
    onRemoveRow: (kind, index) => removeRow(key, kind, index),
    onRowChange: (kind, index, field, value) => changeRow(key, kind, index, field, value),
  });

  return (
    <>
      <AppBar
        backHref="index.html"
        headline="JSONジェネレーター"
        subtitle="作品データを作成してPull Requestを送る"
        themeToggle={<ThemeToggleButton theme={theme} onToggle={toggleTheme} />}
        headerRef={appbarRef}
      />
      <main className="container container--narrow">
        {editBanner && (
          <div className="info-card" style={{ margin: "16px 0 0" }}>
            <div className="info-card__icon">
              <Icon name="edit_note" />
            </div>
            <div className="info-card__body">
              <span className="type-title-small">編集モード</span>
              <p>
                &apos;{editBanner.title}
                &apos; の情報を修正しています。生成されたJSONで既存のエントリを置き換える形でPull
                Requestを作成してください。
              </p>
            </div>
          </div>
        )}

        <section className="gen-card" style={{ marginTop: "20px" }}>
          <div className="gen-card__title">
            <Icon name="help" />
            Pull Requestの送り方
          </div>
          <div className="steps">
            <div className="step">
              <span className="step__num">1</span>
              <span className="step__body">
                作品をアコーディオンで展開して作品情報を入力すると、右側に登録する作品すべてのJSONが自動生成されます。作品を2つ以上登録すると「一括編集」で作者・ジャンル・コミュニティをまとめて設定できます。
              </span>
            </div>
            <div className="step">
              <span className="step__num">2</span>
              <span className="step__body">「JSONをコピー」でデータをクリップボードにコピーします。</span>
            </div>
            <div className="step">
              <span className="step__num">3</span>
              <span className="step__body">
                「GitHubで編集」を開き、リポジトリの <code id="step-datafile">public/data/works.json</code> の{" "}
                <code>works</code> 配列へ作品オブジェクトを追加し、Pull Requestを送ってください。
              </span>
            </div>
          </div>
        </section>

        <div className="gen-layout">
          <div className="gen-form">
            <PlaylistCard
              url={playlistUrl}
              busy={playlistBusy}
              hint={playlistHint}
              onUrl={setPlaylistUrl}
              onImport={importPlaylist}
            />

            {works.length >= 2 && (
              <BulkCard
                count={works.length}
                values={bulkValues}
                scope={bulkScope}
                onValue={changeBulkValue}
                onApply={applyBulk}
                onScope={setBulkScope}
              />
            )}

            <div className="work-acc" id="work-accordion">
              {works.map((form, index) => (
                <WorkFormItem
                  key={form.key}
                  index={index}
                  form={form}
                  missing={entries[index]?.missing ?? []}
                  duplicate={duplicates[index] ?? false}
                  expanded={expandedKey === form.key}
                  isActive={activeKey === form.key}
                  canRemove={works.length > 1}
                  triggerRef={(el) => {
                    if (el) triggerRefs.current.set(form.key, el);
                    else triggerRefs.current.delete(form.key);
                  }}
                  titleInputRef={(el) => {
                    if (el) titleInputs.current.set(form.key, el);
                    else titleInputs.current.delete(form.key);
                    if (el && focusTitleKeyRef.current === form.key) {
                      focusTitleKeyRef.current = null;
                      el.focus();
                    }
                  }}
                  callbacks={callbacksFor(form.key)}
                />
              ))}
            </div>

            <button
              className="btn btn--tonal btn--small work-add"
              type="button"
              data-add-work
              aria-label="登録する作品を追加"
              onClick={addWork}
            >
              <span className="work-add__plus" aria-hidden="true">
                +
              </span>
              <span>登録する作品を追加</span>
            </button>
          </div>

          <JsonPreview
            json={json}
            count={entries.length}
            validityText={validity.text}
            validityKind={validity.kind}
            issueHref={issue.href}
            issueTooLong={issue.tooLong}
            githubHref={github.editHref}
            githubConfigured={github.configured}
            onCopy={copyJson}
            onReset={resetActive}
          />
        </div>
      </main>

      <footer className="footer container">
        <p>
          コピーしたデータは <code>public/data/works.json</code> に追加されます。
        </p>
      </footer>
      <ToastView toast={toast} />
    </>
  );
}
