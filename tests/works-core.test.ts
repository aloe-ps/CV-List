import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  byId,
  DEFAULT_WORKS,
  isWorksData,
  loadWorks,
  normalizeWork,
  normalizeWorks,
  parsePlaylistId,
  parseYouTubeId,
  resolveId,
  thumbUrl,
} from "../src/works-core.js";
import type { WorksData } from "../src/types.js";

describe("parseYouTubeId", () => {
  it("主要なURL形式からIDを抽出する", () => {
    assert.equal(parseYouTubeId("https://youtu.be/MQaIQ-U6oSk"), "MQaIQ-U6oSk");
    assert.equal(
      parseYouTubeId("https://www.youtube.com/watch?v=MQaIQ-U6oSk"),
      "MQaIQ-U6oSk",
    );
    assert.equal(
      parseYouTubeId("https://www.youtube.com/shorts/MQaIQ-U6oSk"),
      "MQaIQ-U6oSk",
    );
    assert.equal(
      parseYouTubeId("https://www.youtube.com/embed/MQaIQ-U6oSk"),
      "MQaIQ-U6oSk",
    );
    assert.equal(
      parseYouTubeId("https://www.youtube.com/live/MQaIQ-U6oSk"),
      "MQaIQ-U6oSk",
    );
  });

  it("非対応URL・空文字・非文字列はnull", () => {
    assert.equal(parseYouTubeId("https://example.com/abc"), null);
    assert.equal(parseYouTubeId(""), null);
    assert.equal(parseYouTubeId(null), null);
    assert.equal(parseYouTubeId(undefined), null);
    assert.equal(parseYouTubeId(123), null);
  });
});

describe("parsePlaylistId", () => {
  it("IDそのまま・再生リストURLを受け付ける", () => {
    assert.equal(parsePlaylistId("PL0123456789abcdef"), "PL0123456789abcdef");
    assert.equal(
      parsePlaylistId("https://www.youtube.com/playlist?list=PL0123456789abcdef"),
      "PL0123456789abcdef",
    );
  });

  it("許可外ホスト・不正値はnull", () => {
    assert.equal(parsePlaylistId("https://example.com/playlist?list=PL0123456789abcdef"), null);
    assert.equal(parsePlaylistId("https://www.youtube.com/watch?v=MQaIQ-U6oSk"), null);
    assert.equal(parsePlaylistId(""), null);
    assert.equal(parsePlaylistId(null), null);
  });
});

describe("thumbUrl / resolveId", () => {
  it("サムネイルURLを組み立てる", () => {
    assert.equal(
      thumbUrl("MQaIQ-U6oSk"),
      "https://img.youtube.com/vi/MQaIQ-U6oSk/mqdefault.jpg",
    );
    assert.equal(
      thumbUrl("MQaIQ-U6oSk", "hqdefault"),
      "https://img.youtube.com/vi/MQaIQ-U6oSk/hqdefault.jpg",
    );
  });

  it("id → YouTube ID → タイトルスラグの順で解決する", () => {
    assert.equal(resolveId({ id: "abc", youtube: "https://youtu.be/xyz", title: "T" }), "abc");
    assert.equal(
      resolveId({ youtube: "https://youtu.be/MQaIQ-U6oSk", title: "T" }),
      "MQaIQ-U6oSk",
    );
    assert.equal(resolveId({ title: "My Title" }), "work-my-title");
    assert.equal(resolveId({}), "work-");
  });
});

describe("normalizeWork", () => {
  it("既定値で補完し未知フィールドを破棄する", () => {
    assert.deepEqual(normalizeWork({}), {
      id: "work-",
      genre: "",
      title: "（無題）",
      description: "",
      youtube: "",
      author: "",
      performers: [],
      music: [],
      communities: [],
      added: "",
    });
    assert.deepEqual(normalizeWork({ title: "T", unknownField: 1 }), {
      id: "work-t",
      genre: "",
      title: "T",
      description: "",
      youtube: "",
      author: "",
      performers: [],
      music: [],
      communities: [],
      added: "",
    });
  });

  it("ジャンルはCV/SV/PVのみ許可する", () => {
    assert.equal(normalizeWork({ genre: "CV" }).genre, "CV");
    assert.equal(normalizeWork({ genre: "XX" }).genre, "");
    assert.equal(normalizeWork({}).genre, "");
  });

  it("楽曲は既知キーのみ残し文字列以外を除去する", () => {
    const work = normalizeWork({
      music: [
        { title: "Finale", url: "https://example.com", composer: "Akiza", extra: 1 },
        { title: "名前のみ" },
        "not-an-object",
        42,
      ],
      performers: ["Alice", 7, null],
    });
    assert.deepEqual(work.music, [
      { title: "Finale", url: "https://example.com", composer: "Akiza" },
      { title: "名前のみ" },
    ]);
    assert.deepEqual(work.performers, ["Alice"]);
  });

  it("非レコード入力は空として扱う", () => {
    assert.equal(normalizeWork(null).title, "（無題）");
    assert.equal(normalizeWork("text").title, "（無題）");
  });
});

describe("normalizeWorks / isWorksData / byId", () => {
  it("配列以外は空配列になる", () => {
    assert.deepEqual(normalizeWorks(null), []);
    assert.deepEqual(normalizeWorks({}), []);
    assert.equal(normalizeWorks([{ title: "A" }]).length, 1);
  });

  it("works.json形式を検証する", () => {
    assert.equal(isWorksData({ version: 1, works: [] }), true);
    assert.equal(isWorksData({ version: "1", works: [] }), false);
    assert.equal(isWorksData({ works: [] }), false);
    assert.equal(isWorksData(null), false);
  });

  it("IDで検索する", () => {
    const works = normalizeWorks([{ id: "a", title: "A" }]);
    assert.equal(byId(works, "a")?.title, "A");
    assert.equal(byId(works, "missing"), undefined);
  });
});

describe("loadWorks", () => {
  it("取得成功時は正規化して返す", async () => {
    const works = await loadWorks({
      url: "https://example.test/works.json",
      fetcher: () =>
        Promise.resolve(
          new Response(JSON.stringify({ version: 1, works: [{ id: "a", title: "A" }] }), {
            status: 200,
          }),
        ),
    });
    assert.equal(works.length, 1);
    assert.equal(works[0]?.id, "a");
  });

  it("失敗・形式不正時はDEFAULT_WORKSにフォールバックする", async () => {
    const onError = await loadWorks({
      fetcher: () => Promise.resolve(new Response("ng", { status: 500 })),
    });
    assert.deepEqual(onError, normalizeWorks(DEFAULT_WORKS));

    const onInvalid = await loadWorks({
      fetcher: () =>
        Promise.resolve(new Response(JSON.stringify({ hello: 1 }), { status: 200 })),
    });
    assert.deepEqual(onInvalid, normalizeWorks(DEFAULT_WORKS));

    const onThrow = await loadWorks({
      fetcher: () => Promise.reject(new Error("down")),
    });
    assert.deepEqual(onThrow, normalizeWorks(DEFAULT_WORKS));
  });
});

describe("実データとの整合性", () => {
  // dist/tests から見た docs/data/works.json (常にビルド成果物経由で実行する)。
  const worksJsonUrl = new URL("../../docs/data/works.json", import.meta.url);
  const raw: unknown = JSON.parse(readFileSync(worksJsonUrl, "utf8"));

  it("works.jsonが形式を満たし件数を保って正規化できる", () => {
    assert.equal(isWorksData(raw), true);
    const data = raw as WorksData;
    const normalized = normalizeWorks(data.works);
    assert.equal(normalized.length, data.works.length);
    assert.ok(normalized.length > 0);
    for (const work of normalized) {
      assert.ok(work.id.length > 0);
      assert.ok(work.title.length > 0);
    }
  });

  it("先頭作品の正規化結果が期待通り", () => {
    const data = raw as WorksData;
    const first = normalizeWork(data.works[0]);
    assert.equal(first.id, "MQaIQ-U6oSk");
    assert.equal(first.genre, "CV");
    assert.deepEqual(first.music, [
      {
        title: "Finale",
        url: "https://soundcloud.com/akiza1004/akiza-finale",
        composer: "Akiza",
      },
    ]);
  });
});
