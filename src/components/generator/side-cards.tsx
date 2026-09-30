/**
 * ジェネレーターの一括編集・プレイリスト取込・JSONプレビューカード。
 */
import { Icon } from "../ui.js";
import type { BulkField, BulkScope, BulkValues } from "../../generator-model.js";

/* ---------- 一括編集 ---------- */

export function BulkCard({
  count,
  values,
  scope,
  onValue,
  onApply,
  onScope,
}: {
  count: number;
  values: BulkValues;
  scope: BulkScope;
  onValue: (field: BulkField, value: string) => void;
  onApply: (field: BulkField | "all") => void;
  onScope: (scope: BulkScope) => void;
}): React.JSX.Element {
  return (
    <section className="gen-card bulk-card" id="bulk-card" aria-labelledby="bulk-card-title">
      <div className="gen-card__title" id="bulk-card-title">
        <Icon name="drive_file_move" />
        一括編集
        <span className="chip bulk-card__count" id="bulk-count">
          {count}作品
        </span>
      </div>
      <p className="field__hint bulk-card__hint">
        作者・ジャンル・コミュニティを、入力中の作品へまとめて反映します。反映前の値は上書きされます。
      </p>

      <div className="bulk-fields">
        <label className="field">
          <span className="field__label type-label-large">作者</span>
          <div className="bulk-row">
            <input
              className="field__control"
              type="text"
              data-bulk-field="author"
              placeholder="例: JapEn Project"
              value={values.author}
              onChange={(e) => onValue("author", e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  onApply("author");
                }
              }}
            />
            <button
              className="btn btn--tonal btn--small bulk-apply"
              type="button"
              data-bulk-apply="author"
              aria-label="作者を作品に一括適用"
              onClick={() => onApply("author")}
            >
              適用
            </button>
          </div>
        </label>

        <label className="field">
          <span className="field__label type-label-large">ジャンル</span>
          <div className="bulk-row">
            <span className="select bulk-row__select">
              <select
                className="field__control"
                data-bulk-field="genre"
                value={values.genre}
                onChange={(e) => onValue("genre", e.target.value)}
              >
                <option value="">選択してください</option>
                <option value="CV">CV</option>
                <option value="SV">SV</option>
                <option value="PV">PV</option>
              </select>
            </span>
            <button
              className="btn btn--tonal btn--small bulk-apply"
              type="button"
              data-bulk-apply="genre"
              aria-label="ジャンルを作品に一括適用"
              onClick={() => onApply("genre")}
            >
              適用
            </button>
          </div>
        </label>

        <label className="field">
          <span className="field__label type-label-large">コミュニティ</span>
          <div className="bulk-row">
            <input
              className="field__control"
              type="text"
              data-bulk-field="communities"
              placeholder="例: JEB, ESP"
              value={values.communities}
              onChange={(e) => onValue("communities", e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  onApply("communities");
                }
              }}
            />
            <button
              className="btn btn--tonal btn--small bulk-apply"
              type="button"
              data-bulk-apply="communities"
              aria-label="コミュニティを作品に一括適用"
              onClick={() => onApply("communities")}
            >
              適用
            </button>
          </div>
          <span className="field__hint">複数の場合はカンマ区切りで入力します（例: JEB, ESP）</span>
        </label>
      </div>

      <div className="bulk-footer">
        <label className="field bulk-scope" htmlFor="bulk-scope">
          <span className="field__label type-label-medium">反映範囲</span>
          <span className="select bulk-row__select">
            <select
              id="bulk-scope"
              value={scope}
              onChange={(e) => onScope(e.target.value as BulkScope)}
            >
              <option value="all">すべての作品</option>
              <option value="empty">未入力の作品のみ</option>
            </select>
          </span>
        </label>
        <button
          className="btn btn--tonal btn--small"
          type="button"
          data-bulk-apply="all"
          onClick={() => onApply("all")}
        >
          <Icon name="done_all" />
          まとめて適用
        </button>
      </div>
    </section>
  );
}

/* ---------- プレイリスト取込 ---------- */

export const PLAYLIST_HINT_DEFAULT =
  "再生リストの動画を1本ずつ作品フォームとして追加します（タイトル・概要・公開日を自動入力、ジャンルは判別できた場合のみ）。著者は自動入力されないため、取り込み後に各作品へ入力してください。登録済みの動画はスキップします。";

export function PlaylistCard({
  url,
  busy,
  hint,
  onUrl,
  onImport,
}: {
  url: string;
  busy: boolean;
  hint: string;
  onUrl: (value: string) => void;
  onImport: () => void;
}): React.JSX.Element {
  return (
    <div className="gen-card">
      <div className="gen-card__title">
        <Icon name="playlist_play" />
        プレイリストから一括追加
      </div>
      <div className="youtube-row">
        <input
          className="field__control"
          id="playlist-url"
          type="url"
          placeholder="https://www.youtube.com/playlist?list=PLxxxx"
          value={url}
          onChange={(e) => onUrl(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              onImport();
            }
          }}
        />
        <button
          className={busy ? "btn btn--tonal btn--small is-spinning" : "btn btn--tonal btn--small"}
          id="playlist-btn"
          type="button"
          disabled={busy}
          onClick={onImport}
        >
          <span className="material-symbols-outlined">
            {busy ? "progress_activity" : "auto_awesome"}
          </span>
          取り込む
        </button>
      </div>
      <span className="field__hint" id="playlist-hint">
        {hint}
      </span>
    </div>
  );
}

/* ---------- JSONプレビュー ---------- */

export type ValidityKind = "missing" | "duplicate" | "ok";

const VALIDITY_STYLE: Record<ValidityKind, React.CSSProperties> = {
  missing: { backgroundColor: "var(--md-error-container)", color: "var(--md-on-error-container)" },
  duplicate: {
    backgroundColor: "var(--md-tertiary-container)",
    color: "var(--md-on-tertiary-container)",
  },
  ok: { backgroundColor: "var(--md-primary-container)", color: "var(--md-on-primary-container)" },
};

/** JSONシンタックスハイライト (旧 highlight と等価な配色)。 */
export function highlightJson(json: string): React.ReactNode[] {
  const nodes: React.ReactNode[] = [];
  const pattern = /("(?:[^"\\]|\\.)*")(\s*:)?|(-?\d+(?:\.\d+)?(?:[eE][+-]?\d+)?)|(true|false|null)\b/g;
  let last = 0;
  let key = 0;
  for (let match = pattern.exec(json); match !== null; match = pattern.exec(json)) {
    if (match.index > last) nodes.push(json.slice(last, match.index));
    const [full, text, colon, number, literal] = match;
    if (text !== undefined) {
      nodes.push(
        colon ? (
          <span className="k" key={key++}>
            {text}
          </span>
        ) : (
          <span className="s" key={key++}>
            {text}
          </span>
        ),
      );
      if (colon) nodes.push(colon);
    } else if (number !== undefined || literal !== undefined) {
      nodes.push(
        <span className="n" key={key++}>
          {full}
        </span>,
      );
    } else {
      nodes.push(full);
    }
    last = match.index + full.length;
  }
  if (last < json.length) nodes.push(json.slice(last));
  return nodes;
}

export function JsonPreview({
  json,
  count,
  validityText,
  validityKind,
  issueHref,
  issueTooLong,
  githubHref,
  githubConfigured,
  onCopy,
  onReset,
}: {
  json: string;
  count: number;
  validityText: string;
  validityKind: ValidityKind;
  issueHref: string;
  issueTooLong: boolean;
  githubHref: string;
  githubConfigured: boolean;
  onCopy: () => void;
  onReset: () => void;
}): React.JSX.Element {
  return (
    <div className="preview-card">
      <div className="preview-card__head">
        <span className="material-symbols-outlined" style={{ color: "var(--md-primary)" }}>
          data_object
        </span>
        <span className="type-title-small">生成されるJSON</span>
        <span className="chip" id="work-count">
          {count}作品
        </span>
        <span className="chip chip--fill" id="validity-chip" style={VALIDITY_STYLE[validityKind]}>
          {validityText}
        </span>
      </div>

      <pre className="json-view" id="json-view" aria-live="polite">
        <code>{highlightJson(json)}</code>
      </pre>

      <div className="preview-card__actions">
        <button className="btn btn--filled" id="copy-btn" type="button" onClick={onCopy}>
          <Icon name="content_copy" />
          JSONをコピー
        </button>
        {githubConfigured && (
          <>
            <a
              className="btn btn--outlined"
              id="github-btn"
              href={githubHref}
              target="_blank"
              rel="noopener noreferrer"
            >
              <Icon name="edit" />
              GitHubで編集
            </a>
            <a
              className="btn btn--text btn--small"
              href={issueHref}
              target="_blank"
              rel="noopener noreferrer"
            >
              <Icon name="question_answer" />
              Issueで提案
            </a>
          </>
        )}
        <button
          className="btn btn--text"
          id="reset-btn"
          type="button"
          title="現在選択中の作品をリセット"
          aria-label="現在選択中の作品をリセット"
          onClick={onReset}
        >
          リセット
        </button>
      </div>

      <p className="field__hint" id="issue-hint" hidden={!issueTooLong}>
        登録する作品が多いため JSON を URL に埋め込めませんでした。「JSONをコピー」で貼り付けて Issue
        を作成してください。
      </p>
      <p className="field__hint" id="output-hint">
        作品オブジェクトを出力します。複数の作品を登録している場合はカンマ区切りで並ぶので、そのまま{" "}
        <code>works</code> 配列の中に貼り付けられます（配列の <code>[ ]</code> は出力しません）。
      </p>
      <p
        className="field__hint"
        id="github-hint"
        style={githubConfigured ? undefined : { display: "block" }}
      >
        {githubConfigured ? (
          <>
            GitHubで編集 を開いてから、コピーした内容を <code>works</code> 配列の末尾に追加して Pull
            Request を作成してください。
          </>
        ) : (
          <>
            <span className="material-symbols-outlined" style={{ fontSize: "16px", verticalAlign: "-3px" }}>
              info
            </span>{" "}
            GitHubのリポジトリ情報が未設定です。src/config.ts の owner / repo
            を設定すると「GitHubで編集」リンクが表示されます。
          </>
        )}
      </p>
    </div>
  );
}
