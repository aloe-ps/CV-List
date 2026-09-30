import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  bulkTargetIndexes,
  collectWork,
  commonFieldValue,
  draftFromNormalized,
  emptyDraft,
  findDuplicates,
  hasBulkValue,
  hasIdentity,
  parseBulkList,
  readDraftFieldValue,
  slugify,
  stringifyWorks,
  validateWork,
  writeDraftFieldValue,
} from "../src/generator-model.js";
import { normalizeWorks } from "../src/works-core.js";

describe("slugify / parseBulkList", () => {
  it("タイトルスラグ化する", () => {
    assert.equal(slugify("JapEn 17th"), "japen-17th");
    assert.equal(slugify("  A  B__C  "), "a-b-c");
    assert.equal(slugify(""), "untitled");
    assert.equal(slugify("日本語 タイトル"), "日本語-タイトル");
  });

  it("区切り文字で分割し重複除去する", () => {
    assert.deepEqual(parseBulkList("JEB, ESP、JEB\nABC\tDEF"), ["JEB", "ESP", "ABC", "DEF"]);
    assert.deepEqual(parseBulkList(""), []);
  });
});

describe("collectWork", () => {
  it("旧実装と同一キー順・空値扱いで収集する", () => {
    const obj = collectWork(
      {
        ...emptyDraft(),
        title: " T ",
        genre: "CV",
        author: " A ",
        youtube: "https://youtu.be/MQaIQ-U6oSk",
        performers: [" Alice ", ""],
        music: [{ title: " M ", url: "", composer: " C " }, { title: "", url: "", composer: "" }],
        communities: [" JEB ", ""],
      },
      null,
    );
    assert.deepEqual(Object.keys(obj), [
      "id",
      "title",
      "genre",
      "author",
      "performers",
      "music",
      "communities",
      "youtube",
    ]);
    assert.deepEqual(obj, {
      id: "MQaIQ-U6oSk",
      title: "T",
      genre: "CV",
      author: "A",
      performers: ["Alice"],
      music: [{ title: "M", composer: "C" }],
      communities: ["JEB"],
      youtube: "https://youtu.be/MQaIQ-U6oSk",
    });
  });

  it("editId・タイトルスラグでid解決する", () => {
    assert.equal(collectWork({ ...emptyDraft(), title: "My Title" }, null).id, "my-title");
    assert.equal(collectWork({ ...emptyDraft(), title: "T" }, "fixed-id").id, "fixed-id");
  });

  it("description・addedは空なら省略する", () => {
    const obj = collectWork(
      { ...emptyDraft(), title: "T", description: " D ", added: "2024-01-02" },
      null,
    );
    assert.equal(obj.description, "D");
    assert.equal(obj.added, "2024-01-02");
    assert.equal(collectWork({ ...emptyDraft(), title: "T" }, null).description, undefined);
  });
});

describe("validateWork / hasIdentity / findDuplicates", () => {
  it("必須不足を検出する", () => {
    assert.deepEqual(validateWork({ title: "", genre: "", author: "", youtube: "" }), [
      "タイトル",
      "ジャンル",
      "作者",
      "YouTube URL",
    ]);
    assert.deepEqual(
      validateWork({ title: "T", genre: "CV", author: "A", youtube: "https://example.com" }),
      ["YouTube URL"],
    );
    assert.deepEqual(
      validateWork({ title: "T", genre: "CV", author: "A", youtube: "https://youtu.be/MQaIQ-U6oSk" }),
      [],
    );
  });

  it("重複を検出する", () => {
    const all = normalizeWorks([{ id: "old", title: "Old" }]);
    const entries = [
      { id: "old", title: "X", youtube: "", editId: null },
      { id: "new1", title: "Y", youtube: "", editId: null },
      { id: "new1", title: "Z", youtube: "", editId: null },
      { id: "x", title: "", youtube: "", editId: null },
    ];
    assert.deepEqual(findDuplicates(entries, all), [true, true, true, false]);
    assert.equal(hasIdentity({ title: "", youtube: "" }), false);
  });

  it("編集中IDは既存重複から除外する", () => {
    const all = normalizeWorks([{ id: "old", title: "Old" }]);
    assert.deepEqual(
      findDuplicates([{ id: "old", title: "Old", youtube: "", editId: "old" }], all),
      [false],
    );
  });
});

describe("stringifyWorks", () => {
  it("カンマ区切り・配列外枠なしで連結する", () => {
    const a = collectWork({ ...emptyDraft(), title: "A" }, null);
    const b = collectWork({ ...emptyDraft(), title: "B" }, null);
    const text = stringifyWorks([a, b]);
    assert.ok(text.includes(",\n"));
    assert.ok(!text.trimStart().startsWith("["));
    assert.deepEqual(JSON.parse(`[${text}]`).map((o: { title: string }) => o.title), ["A", "B"]);
  });
});

describe("bulk helpers", () => {
  it("読み書き・共通値・対象・空判定", () => {
    const d = { ...emptyDraft(), author: "A", communities: ["X", ""] };
    assert.equal(readDraftFieldValue(d, "author"), "A");
    assert.equal(readDraftFieldValue(d, "communities"), "X");
    const updated = writeDraftFieldValue(d, "communities", "JEB, ESP");
    assert.deepEqual(updated.communities, ["JEB", "ESP"]);
    assert.deepEqual(writeDraftFieldValue(d, "communities", "").communities, [""]);
    assert.equal(commonFieldValue([d, { ...emptyDraft(), author: "A" }], "author"), "A");
    assert.equal(commonFieldValue([d, { ...emptyDraft(), author: "B" }], "author"), "");
    assert.deepEqual(
      bulkTargetIndexes([d, { ...emptyDraft(), author: "" }], "author", "empty"),
      [1],
    );
    assert.deepEqual(
      bulkTargetIndexes([d, { ...emptyDraft(), author: "" }], "author", "all"),
      [0, 1],
    );
    assert.equal(hasBulkValue("author", " x "), true);
    assert.equal(hasBulkValue("author", "  "), false);
    assert.equal(hasBulkValue("communities", " , "), false);
  });

  it("既存作品をドラフト化する", () => {
    const [w] = normalizeWorks([
      { id: "a", title: "T", author: "A", performers: ["P"], communities: ["C"] },
    ]);
    const draft = draftFromNormalized(w!);
    assert.equal(draft.title, "T");
    assert.deepEqual(draft.performers, ["P"]);
    assert.deepEqual(draft.communities, ["C"]);
    assert.deepEqual(emptyDraft().performers, [""]);
  });
});
