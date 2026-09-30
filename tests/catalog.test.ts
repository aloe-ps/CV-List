import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  countText,
  filterAndSortWorks,
  groupWorks,
  matchesWork,
  readCatalogParams,
} from "../src/catalog.js";
import { normalizeWorks } from "../src/works-core.js";
import type { NormalizedWork } from "../src/types.js";

function sample(): NormalizedWork[] {
  return normalizeWorks([
    { id: "a", title: "あいうえお", author: "Bob", added: "2024-01-02", genre: "CV" },
    {
      id: "b",
      title: "ABC",
      author: "alice",
      added: "2024-01-02",
      genre: "PV",
      performers: ["Carol"],
      music: [{ title: "Song", composer: "Dave" }],
      communities: ["JEB"],
    },
    { id: "c", title: "ZZZ", author: "", added: "", genre: "SV", description: "hello" },
  ]);
}

describe("matchesWork", () => {
  it("空クエリは全件一致する", () => {
    for (const w of sample()) assert.equal(matchesWork(w, "  "), true);
  });

  it("タイトル・作者・概要・出演者・楽曲・コミュニティを横断検索する", () => {
    const [a, b, c] = sample();
    assert.equal(matchesWork(a!, "あいう"), true);
    assert.equal(matchesWork(a!, "BOB"), true);
    assert.equal(matchesWork(b!, "carol"), true);
    assert.equal(matchesWork(b!, "song dave"), true);
    assert.equal(matchesWork(b!, "jeb"), true);
    assert.equal(matchesWork(c!, "hello"), true);
    assert.equal(matchesWork(a!, "zzz"), false);
  });
});

describe("filterAndSortWorks", () => {
  it("追加日降順・同日はタイトル順に並べる", () => {
    const sorted = filterAndSortWorks(sample(), { query: "", genre: "" });
    assert.deepEqual(
      sorted.map((w) => w.id),
      ["b", "a", "c"],
    );
  });

  it("ジャンルで絞り込む", () => {
    const sorted = filterAndSortWorks(sample(), { query: "", genre: "CV" });
    assert.deepEqual(sorted.map((w) => w.id), ["a"]);
  });
});

describe("groupWorks", () => {
  it("作者順にグループ化し日本語照合順に並べる", () => {
    const groups = groupWorks(filterAndSortWorks(sample(), { query: "", genre: "" }), "author");
    assert.deepEqual(groups.map((g) => g.name), ["alice", "Bob", "未設定"]);
    assert.deepEqual(groups[0]!.works.map((w) => w.id), ["b"]);
  });

  it("空配列は未設定にまとめる", () => {
    const groups = groupWorks(sample(), "communities");
    const names = groups.map((g) => g.name).sort();
    assert.deepEqual(names, ["JEB", "未設定"]);
  });
});

describe("countText", () => {
  it("件数と検索語を含む文言を作る", () => {
    assert.equal(countText(3, ""), "3 件の作品");
    assert.equal(countText(1, " abc "), "1 件の作品（検索: abc）");
  });
});

describe("readCatalogParams", () => {
  it("URLクエリを読み取り不正値は既定に戻す", () => {
    assert.deepEqual(readCatalogParams("?q=a&sort=author&genre=CV"), {
      query: "a",
      sort: "author",
      genre: "CV",
    });
    assert.deepEqual(readCatalogParams("?sort=xxx&genre=XX"), {
      query: "",
      sort: "date",
      genre: "",
    });
    assert.deepEqual(readCatalogParams(""), { query: "", sort: "date", genre: "" });
  });
});
