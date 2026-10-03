import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  collectAddedYears,
  countActiveFacets,
  countText,
  effectiveGenres,
  emptyCatalogFilter,
  filterAndSortWorks,
  groupWorks,
  matchesWork,
  parseFilterYear,
  readCatalogParams,
  splitMultiValue,
  workAddedYear,
  writeCatalogParams,
} from "../src/catalog.js";
import type { CatalogFilter } from "../src/catalog.js";
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
    { id: "c", title: "ZZZ", author: "", added: "2020-05-01", genre: "SV", description: "hello" },
  ]);
}

function baseFilter(patch: Partial<CatalogFilter> = {}): CatalogFilter {
  return { ...emptyCatalogFilter(), ...patch };
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
    const sorted = filterAndSortWorks(sample(), baseFilter());
    assert.deepEqual(
      sorted.map((w) => w.id),
      ["b", "a", "c"],
    );
  });

  it("ジャンルで絞り込む (旧来の単一指定)", () => {
    const sorted = filterAndSortWorks(sample(), baseFilter({ genre: "CV" }));
    assert.deepEqual(sorted.map((w) => w.id), ["a"]);
  });

  it("ジャンルを複数組み合わせて絞り込む", () => {
    const sorted = filterAndSortWorks(sample(), baseFilter({ genres: ["CV", "PV"] }));
    assert.deepEqual(sorted.map((w) => w.id), ["b", "a"]);
  });

  it("作者・出演者・コミュニティの複数条件で絞り込む", () => {
    const byAuthors = filterAndSortWorks(sample(), baseFilter({ authors: ["bob", "alice"] }));
    assert.deepEqual(byAuthors.map((w) => w.id), ["b", "a"]);
    const byPerformer = filterAndSortWorks(sample(), baseFilter({ performers: ["carol"] }));
    assert.deepEqual(byPerformer.map((w) => w.id), ["b"]);
    const byCommunity = filterAndSortWorks(sample(), baseFilter({ communities: ["jeb"] }));
    assert.deepEqual(byCommunity.map((w) => w.id), ["b"]);
    const combined = filterAndSortWorks(
      sample(),
      baseFilter({ authors: ["alice"], communities: ["JEB"] }),
    );
    assert.deepEqual(combined.map((w) => w.id), ["b"]);
  });

  it("楽曲名・作曲者で絞り込む", () => {
    assert.deepEqual(
      filterAndSortWorks(sample(), baseFilter({ musicTitle: "song" })).map((w) => w.id),
      ["b"],
    );
    assert.deepEqual(
      filterAndSortWorks(sample(), baseFilter({ musicComposer: "dave" })).map((w) => w.id),
      ["b"],
    );
    assert.deepEqual(
      filterAndSortWorks(sample(), baseFilter({ musicComposer: "nobody" })).map((w) => w.id),
      [],
    );
  });

  it("追加年・期間で絞り込む", () => {
    assert.deepEqual(
      filterAndSortWorks(sample(), baseFilter({ yearFrom: "2024", yearTo: "2024" })).map(
        (w) => w.id,
      ),
      ["b", "a"],
    );
    assert.deepEqual(
      filterAndSortWorks(sample(), baseFilter({ yearFrom: "2021" })).map((w) => w.id),
      ["b", "a"],
    );
    assert.deepEqual(
      filterAndSortWorks(sample(), baseFilter({ yearTo: "2020" })).map((w) => w.id),
      ["c"],
    );
  });

  it("ジャンルと期間を組み合わせて絞り込む", () => {
    const sorted = filterAndSortWorks(
      sample(),
      baseFilter({ genres: ["CV", "SV"], yearFrom: "2024" }),
    );
    assert.deepEqual(sorted.map((w) => w.id), ["a"]);
  });

  it("不正な年指定は無視する", () => {
    assert.deepEqual(
      filterAndSortWorks(sample(), baseFilter({ yearFrom: "abcd" })).map((w) => w.id),
      ["b", "a", "c"],
    );
  });
});

describe("splitMultiValue / parseFilterYear / workAddedYear", () => {
  it("カンマ・読点・改行区切りを配列化する", () => {
    assert.deepEqual(splitMultiValue("MEL, futemi.， HAL\n"), ["MEL", "futemi.", "HAL"]);
    assert.deepEqual(splitMultiValue("  "), []);
  });

  it("年の形式を検証する", () => {
    assert.equal(parseFilterYear("2024"), 2024);
    assert.equal(parseFilterYear(" 2020 "), 2020);
    assert.equal(parseFilterYear("24"), null);
    assert.equal(parseFilterYear("abcd"), null);
    assert.equal(parseFilterYear(""), null);
  });

  it("追加日から年を取り出す", () => {
    const [a, , c] = sample();
    assert.equal(workAddedYear(a!), 2024);
    assert.equal(workAddedYear(c!), 2020);
    assert.equal(workAddedYear({ ...a!, added: "" }), null);
  });
});

describe("effectiveGenres", () => {
  it("genres を優先しなければ genre 単一を使う", () => {
    assert.deepEqual(effectiveGenres({ genre: "CV", genres: [] }), ["CV"]);
    assert.deepEqual(effectiveGenres({ genre: "CV", genres: ["SV", "PV"] }), ["SV", "PV"]);
    assert.deepEqual(effectiveGenres({ genre: "", genres: [] }), []);
  });
});

describe("collectAddedYears", () => {
  it("追加年を昇順で列挙する", () => {
    assert.deepEqual(collectAddedYears(sample()), ["2020", "2024"]);
  });
});

describe("countActiveFacets", () => {
  it("キーワード以外の指定数を数える", () => {
    assert.equal(countActiveFacets(baseFilter()), 0);
    assert.equal(countActiveFacets(baseFilter({ query: "abc" })), 0);
    assert.equal(
      countActiveFacets(baseFilter({ genres: ["CV"], authors: ["a"], yearFrom: "2020" })),
      3,
    );
  });
});

describe("groupWorks", () => {
  it("作者順にグループ化し日本語照合順に並べる", () => {
    const groups = groupWorks(filterAndSortWorks(sample(), baseFilter()), "author");
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
    assert.equal(countText(2, "", 2), "2 件の作品（絞り込み: 2件）");
    assert.equal(countText(2, "abc", 1), "2 件の作品（検索: abc・絞り込み: 1件）");
  });
});

describe("readCatalogParams", () => {
  it("URLクエリを読み取り不正値は既定に戻す", () => {
    const params = readCatalogParams("?q=a&sort=author&genre=CV");
    assert.equal(params.query, "a");
    assert.equal(params.sort, "author");
    assert.equal(params.genre, "CV");
    assert.deepEqual(params.genres, ["CV"]);
    assert.equal(params.view, "grid");
    const invalid = readCatalogParams("?sort=xxx&genre=XX");
    assert.equal(invalid.sort, "date");
    assert.equal(invalid.genre, "");
    assert.deepEqual(invalid.genres, []);
    assert.deepEqual(readCatalogParams("").query, "");
  });

  it("表示形式を読み取り不正値はグリッドに戻す", () => {
    assert.equal(readCatalogParams("?view=list").view, "list");
    assert.equal(readCatalogParams("?view=grid").view, "grid");
    assert.equal(readCatalogParams("?view=xxx").view, "grid");
  });

  it("詳細条件を読み取る", () => {
    const params = readCatalogParams(
      "?genres=CV,PV&author=Bob&author=alice&performer=Carol&community=JEB&music=Song&composer=Dave&from=2020&to=2024",
    );
    assert.deepEqual(params.genres, ["CV", "PV"]);
    assert.deepEqual(params.authors, ["Bob", "alice"]);
    assert.deepEqual(params.performers, ["Carol"]);
    assert.deepEqual(params.communities, ["JEB"]);
    assert.equal(params.musicTitle, "Song");
    assert.equal(params.musicComposer, "Dave");
    assert.equal(params.yearFrom, "2020");
    assert.equal(params.yearTo, "2024");
  });

  it("不正な年は空に戻す", () => {
    const params = readCatalogParams("?from=abc&to=20");
    assert.equal(params.yearFrom, "");
    assert.equal(params.yearTo, "");
  });
});

describe("writeCatalogParams", () => {
  it("詳細条件をURLに保存し読み戻せる", () => {
    const globals = globalThis as unknown as Record<string, unknown>;
    const originalWindow = globals.window;
    const url = new URL("http://localhost/");
    globals.window = {
      location: { href: url.toString() },
      history: {
        replaceState: (_a: unknown, _b: string, next: string) => {
          url.href = next;
        },
      },
    };
    try {
      writeCatalogParams(
        baseFilter({
          query: "pen",
          genres: ["CV", "PV"],
          authors: ["Bob"],
          performers: ["Carol"],
          communities: ["JEB"],
          musicTitle: "Song",
          musicComposer: "Dave",
          yearFrom: "2020",
          yearTo: "2024",
        }),
        "author",
        "list",
      );
      const params = readCatalogParams(url.search);
      assert.equal(params.query, "pen");
      assert.deepEqual(params.genres, ["CV", "PV"]);
      assert.deepEqual(params.authors, ["Bob"]);
      assert.deepEqual(params.performers, ["Carol"]);
      assert.deepEqual(params.communities, ["JEB"]);
      assert.equal(params.musicTitle, "Song");
      assert.equal(params.musicComposer, "Dave");
      assert.equal(params.yearFrom, "2020");
      assert.equal(params.yearTo, "2024");
      assert.equal(params.sort, "author");
      assert.equal(params.view, "list");
    } finally {
      if (originalWindow === undefined) delete globals.window;
      else globals.window = originalWindow;
    }
  });
});
