import { describe, it, before } from "node:test";
import assert from "node:assert/strict";
import { renderToStaticMarkup } from "react-dom/server";
import { IndexPage } from "../src/pages/index-page.js";
import { WorkDetailPage } from "../src/pages/work-detail-page.js";
import { GeneratorPage } from "../src/pages/generator-page.js";

// SSR相当の静的レンダーでクラッシュ・文言欠落を検出する。
// ブラウザの実動作確認の代替ではない。
function installDomStubs(): void {
  const globals = globalThis as unknown as Record<string, unknown>;
  globals.window = {
    location: { href: "http://localhost/", search: "" },
    localStorage: {
      getItem: () => null,
      setItem: () => undefined,
    },
    matchMedia: undefined,
    scrollY: 0,
    addEventListener: () => undefined,
    removeEventListener: () => undefined,
    history: { replaceState: () => undefined },
  };
  const classList = { add: () => undefined, remove: () => undefined, toggle: () => undefined };
  globals.document = {
    documentElement: { getAttribute: () => null, setAttribute: () => undefined, classList },
  };
}

describe("render smoke", () => {
  before(() => {
    installDomStubs();
  });

  it("一覧ページの骨格と空状態が描画される", () => {
    const html = renderToStaticMarkup(<IndexPage />);
    for (const text of [
      "PENSPINNING-FILMS-LIST",
      "登録されている作品",
      "作品を追加",
      "0 件の作品",
      "該当する作品が見つかりませんでした",
      "search-input",
      "sort-select",
      "result-count",
      "data-view",
      "表示形式を切り替え",
    ]) {
      assert.ok(html.includes(text), text);
    }
  });

  it("詳細ページの読み込み中表示が描画される", () => {
    const html = renderToStaticMarkup(<WorkDetailPage />);
    for (const text of ["作品詳細", "データを読み込み中", "generator.html", "一覧に戻る"]) {
      assert.ok(html.includes(text), text);
    }
  });

  it("ジェネレーターの初期フォームが描画される", () => {
    const html = renderToStaticMarkup(<GeneratorPage />);
    for (const text of [
      "JSONジェネレーター",
      "プレイリストから一括追加",
      "作品情報",
      "生成されるJSON",
      "1作品",
      "JSONをコピー",
      "登録する作品を追加",
      "work-item",
      "json-view",
    ]) {
      assert.ok(html.includes(text), text);
    }
    // 1作品時は一括編集カードを表示しない
    assert.ok(!html.includes("bulk-card"));
  });
});
