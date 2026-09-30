/**
 * ジェネレーターの作品フォーム (アコーディオン1件分)。
 * 旧 generator.js のテンプレート・renderTrigger・renderFieldErrors と等価。
 */
import { Icon } from "../ui.js";
import type { MusicDraft, WorkDraft } from "../../generator-model.js";

export type RepeaterKind = "performers" | "music" | "communities";

export interface WorkFormState {
  key: string;
  draft: WorkDraft;
  editId: string | null;
  dirty: boolean;
  fetching: boolean;
  metadataHintShown: boolean;
  metadataHint: string;
}

const DEFAULT_METADATA_HINT =
  "youtu.be / youtube.com のURLを入力。貼り付けるとタイトル・概要・公開日を自動入力します。";

export interface WorkFormCallbacks {
  onToggle: () => void;
  onTriggerKeyDown: (e: React.KeyboardEvent) => void;
  onDraftChange: (patch: Partial<WorkDraft>) => void;
  onYoutubeChange: (value: string) => void;
  onYoutubePaste: () => void;
  onFetch: () => void;
  onRemove: () => void;
  onAddRow: (kind: RepeaterKind) => void;
  onRemoveRow: (kind: RepeaterKind, index: number) => void;
  onRowChange: (kind: RepeaterKind, index: number, field: string, value: string) => void;
}

function fieldId(key: string, name: string): string {
  return key === "1" ? `f-${name}` : `work-${key}-${name}`;
}

function PerformerRows({
  values,
  onRowChange,
  onRemoveRow,
}: {
  values: string[];
  onRowChange: (index: number, value: string) => void;
  onRemoveRow: (index: number) => void;
}): React.JSX.Element {
  return (
    <>
      {values.map((value, index) => (
        <div className="repeater-row" key={index}>
          <input
            className="field__control rp-input"
            type="text"
            placeholder="出演者名"
            value={value}
            onChange={(e) => onRowChange(index, e.target.value)}
          />
          <button
            className="icon-btn icon-btn--small rp-remove"
            type="button"
            aria-label="この出演者を削除"
            onClick={() => onRemoveRow(index)}
          >
            <Icon name="close" />
          </button>
        </div>
      ))}
    </>
  );
}

function MusicRows({
  values,
  onRowChange,
  onRemoveRow,
}: {
  values: MusicDraft[];
  onRowChange: (index: number, field: string, value: string) => void;
  onRemoveRow: (index: number) => void;
}): React.JSX.Element {
  return (
    <>
      {values.map((m, index) => (
        <div className="repeater-row--multi" key={index}>
          <input
            className="field__control rp-title"
            type="text"
            placeholder="楽曲名"
            value={m.title}
            onChange={(e) => onRowChange(index, "title", e.target.value)}
          />
          <input
            className="field__control rp-url"
            type="url"
            placeholder="楽曲のリンク（任意）"
            value={m.url}
            onChange={(e) => onRowChange(index, "url", e.target.value)}
          />
          <input
            className="field__control rp-composer"
            type="text"
            placeholder="作曲者"
            value={m.composer}
            onChange={(e) => onRowChange(index, "composer", e.target.value)}
          />
          <button
            className="icon-btn icon-btn--small rp-remove"
            type="button"
            aria-label="この楽曲を削除"
            onClick={() => onRemoveRow(index)}
          >
            <Icon name="close" />
          </button>
        </div>
      ))}
    </>
  );
}

function CommunityRows({
  values,
  onRowChange,
  onRemoveRow,
}: {
  values: string[];
  onRowChange: (index: number, value: string) => void;
  onRemoveRow: (index: number) => void;
}): React.JSX.Element {
  return (
    <>
      {values.map((value, index) => (
        <div className="repeater-row" key={index}>
          <input
            className="field__control rp-input"
            type="text"
            placeholder="コミュニティ名"
            value={value}
            onChange={(e) => onRowChange(index, e.target.value)}
          />
          <button
            className="icon-btn icon-btn--small rp-remove"
            type="button"
            aria-label="このコミュニティを削除"
            onClick={() => onRemoveRow(index)}
          >
            <Icon name="close" />
          </button>
        </div>
      ))}
    </>
  );
}

export function WorkFormItem({
  index,
  form,
  missing,
  duplicate,
  expanded,
  isActive,
  canRemove,
  triggerRef,
  titleInputRef,
  callbacks,
}: {
  index: number;
  form: WorkFormState;
  missing: string[];
  duplicate: boolean;
  expanded: boolean;
  isActive: boolean;
  canRemove: boolean;
  triggerRef: (el: HTMLButtonElement | null) => void;
  titleInputRef: (el: HTMLInputElement | null) => void;
  callbacks: WorkFormCallbacks;
}): React.JSX.Element {
  const { draft } = form;
  const label = draft.title.trim() || `作品${index + 1}`;
  const state = missing.length > 0 ? "missing" : duplicate ? "duplicate" : "ok";
  const missingSet = new Set(missing);
  const showErrors = form.dirty;

  const titleInvalid = showErrors && missingSet.has("タイトル");
  const genreInvalid = showErrors && missingSet.has("ジャンル");
  const authorInvalid = showErrors && missingSet.has("作者");
  const youtubeInvalid = showErrors && missingSet.has("YouTube URL");
  const youtubeErrorText =
    draft.youtube.trim() && youtubeInvalid
      ? "YouTube URLの形式が正しくありません"
      : "YouTube URLは必須です";

  return (
    <section className={expanded ? "work-item is-open" : "work-item"} data-work-panel id={`work-item-${form.key}`} data-work-key={form.key}>
      <h2 className="work-item__head">
        <button
          className="work-item__trigger"
          type="button"
          data-work-tab={form.key}
          data-state={state}
          id={`work-trigger-${form.key}`}
          aria-controls={`work-body-${form.key}`}
          aria-expanded={expanded}
          aria-label={`${index + 1}作品目: ${label}${state === "ok" ? "" : "（要確認）"}`}
          tabIndex={isActive ? 0 : -1}
          ref={triggerRef}
          onClick={callbacks.onToggle}
          onKeyDown={callbacks.onTriggerKeyDown}
        >
          <span className="material-symbols-outlined work-item__marker" aria-hidden="true">
            chevron_right
          </span>
          <span className="work-item__label">{label}</span>
          <span className="work-item__status" aria-hidden="true">
            {state === "ok" ? "" : "!"}
          </span>
        </button>
      </h2>
      <div
        className="work-item__body"
        data-work-body
        id={`work-body-${form.key}`}
        role="region"
        aria-labelledby={`work-trigger-${form.key}`}
        hidden={!expanded}
      >
        <div className="gen-card">
          <div className="work-card-head">
            <div className="gen-card__title">
              <Icon name="movie" />
              作品情報
            </div>
            <button
              className="btn btn--danger-text btn--small work-remove"
              type="button"
              data-remove-work
              disabled={!canRemove}
              aria-label={isActive ? "現在の作品を削除" : "この作品を削除"}
              onClick={callbacks.onRemove}
            >
              <Icon name="close" />
              作品を削除
            </button>
          </div>
          <div className="repeater" style={{ gap: "14px" }}>
            <label className={titleInvalid ? "field has-error" : "field"}>
              <span className="field__label type-label-large">
                タイトル<span className="req">*</span>
              </span>
              <input
                className="field__control"
                data-field="title"
                id={fieldId(form.key, "title")}
                type="text"
                placeholder="例:JapEn 17th"
                required
                value={draft.title}
                aria-invalid={titleInvalid || undefined}
                ref={titleInputRef}
                onChange={(e) => callbacks.onDraftChange({ title: e.target.value })}
              />
              <span className="field__error">タイトルは必須です</span>
            </label>

            <label className={genreInvalid ? "field has-error" : "field"}>
              <span className="field__label type-label-large">
                ジャンル<span className="req">*</span>
              </span>
              <span className="select" style={{ width: "100%" }}>
                <select
                  className="field__control"
                  data-field="genre"
                  id={fieldId(form.key, "genre")}
                  style={{ height: "44px", width: "100%" }}
                  required
                  value={draft.genre}
                  aria-invalid={genreInvalid || undefined}
                  onChange={(e) => callbacks.onDraftChange({ genre: e.target.value as WorkDraft["genre"] })}
                >
                  <option value="">選択してください</option>
                  <option value="CV">CV</option>
                  <option value="SV">SV</option>
                  <option value="PV">PV</option>
                </select>
              </span>
              <span className="field__error">ジャンルは必須です</span>
              <span className="field__hint">CV / SV / PV のいずれかを選択</span>
            </label>

            <label className="field">
              <span className="field__label type-label-large">作品の概要</span>
              <textarea
                className="field__control textarea"
                data-field="description"
                placeholder="作品の紹介文（任意）"
                value={draft.description}
                onChange={(e) => callbacks.onDraftChange({ description: e.target.value })}
              />
            </label>

            <label className={youtubeInvalid ? "field has-error" : "field"}>
              <span className="field__label type-label-large">
                YouTube URL<span className="req">*</span>
              </span>
              <div className="youtube-row">
                <input
                  className="field__control"
                  data-field="youtube"
                  type="url"
                  placeholder="https://youtu.be/..."
                  value={draft.youtube}
                  aria-invalid={youtubeInvalid || undefined}
                  onChange={(e) => callbacks.onYoutubeChange(e.target.value)}
                  onPaste={callbacks.onYoutubePaste}
                />
                <button
                  className={form.fetching ? "btn btn--tonal btn--small is-spinning" : "btn btn--tonal btn--small"}
                  data-fetch
                  id={form.key === "1" ? "auto-fetch-btn" : undefined}
                  type="button"
                  disabled={form.fetching}
                  onClick={callbacks.onFetch}
                >
                  <span className="material-symbols-outlined">
                    {form.fetching ? "progress_activity" : "auto_awesome"}
                  </span>
                  自動入力
                </button>
              </div>
              <span className="field__error" data-role="youtube-error">
                {youtubeErrorText}
              </span>
              <span
                className="field__hint"
                data-role="youtube-hint"
                id={form.key === "1" ? "youtube-hint" : undefined}
              >
                {form.metadataHintShown ? form.metadataHint : DEFAULT_METADATA_HINT}
              </span>
            </label>

            <label className={authorInvalid ? "field has-error" : "field"}>
              <span className="field__label type-label-large">
                作者<span className="req">*</span>
              </span>
              <input
                className="field__control"
                data-field="author"
                type="text"
                placeholder="例: JapEn Project"
                value={draft.author}
                aria-invalid={authorInvalid || undefined}
                onChange={(e) => callbacks.onDraftChange({ author: e.target.value })}
              />
              <span className="field__error">作者は必須です</span>
            </label>

            <label className="field">
              <span className="field__label type-label-large">追加日（任意）</span>
              <input
                className="field__control"
                data-field="added"
                type="date"
                value={draft.added}
                onChange={(e) => callbacks.onDraftChange({ added: e.target.value })}
              />
            </label>
          </div>
        </div>

        <div className="gen-card">
          <div className="gen-card__title">
            <Icon name="groups" />
            出演者
          </div>
          <div className="repeater" data-repeater="performers" id={form.key === "1" ? "repeat-performers" : undefined}>
            <PerformerRows
              values={draft.performers}
              onRowChange={(i, v) => callbacks.onRowChange("performers", i, "", v)}
              onRemoveRow={(i) => callbacks.onRemoveRow("performers", i)}
            />
          </div>
          <button
            className="btn btn--tonal btn--small repeater-add"
            type="button"
            data-add="performers"
            style={{ marginTop: "12px" }}
            onClick={() => callbacks.onAddRow("performers")}
          >
            <Icon name="add" />
            出演者を追加
          </button>
        </div>

        <div className="gen-card">
          <div className="gen-card__title">
            <Icon name="music_note" />
            使用楽曲と作曲者
          </div>
          <div className="repeater" data-repeater="music" id={form.key === "1" ? "repeat-music" : undefined}>
            <MusicRows
              values={draft.music}
              onRowChange={(i, f, v) => callbacks.onRowChange("music", i, f, v)}
              onRemoveRow={(i) => callbacks.onRemoveRow("music", i)}
            />
          </div>
          <button
            className="btn btn--tonal btn--small repeater-add"
            type="button"
            data-add="music"
            style={{ marginTop: "12px" }}
            onClick={() => callbacks.onAddRow("music")}
          >
            <Icon name="add" />
            楽曲を追加
          </button>
        </div>

        <div className="gen-card">
          <div className="gen-card__title">
            <Icon name="forum" />
            コミュニティ
          </div>
          <div className="repeater" data-repeater="communities" id={form.key === "1" ? "repeat-communities" : undefined}>
            <CommunityRows
              values={draft.communities}
              onRowChange={(i, v) => callbacks.onRowChange("communities", i, "", v)}
              onRemoveRow={(i) => callbacks.onRemoveRow("communities", i)}
            />
          </div>
          <button
            className="btn btn--tonal btn--small repeater-add"
            type="button"
            data-add="communities"
            style={{ marginTop: "12px" }}
            onClick={() => callbacks.onAddRow("communities")}
          >
            <Icon name="add" />
            コミュニティを追加
          </button>
        </div>
      </div>
    </section>
  );
}
