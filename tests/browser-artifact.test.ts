import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import * as vm from "node:vm";
import {
  byId,
  GENRES,
  normalizeWorks,
  parsePlaylistId,
  parseYouTubeId,
  WORKS,
} from "../src/works-core.js";

// dist/tests から見た docs 成果物 (コミット対象の生成物)。
const artifactUrl = new URL("../../docs/assets/js/works.js", import.meta.url);

interface WorksApi {
  load: unknown;
  byId: unknown;
  parseYouTubeId: unknown;
  parsePlaylistId: unknown;
  thumbUrl: unknown;
  normalize: unknown;
  GENRES: unknown;
}

function loadArtifactWorks(): WorksApi {
  const code = readFileSync(artifactUrl, "utf8");
  // parsePlaylistId が new URL を使うため注入する。
  const sandbox: Record<string, unknown> = { URL };
  vm.createContext(sandbox);
  const result: unknown = vm.runInContext(`${code}\nWORKS;`, sandbox);
  assert.ok(typeof result === "object" && result !== null);
  return result as WorksApi;
}

// vm レルムで生成された値はプロトタイプが異なるため、構造比較は JSON 経由で行う。
function jsonOf(value: unknown): string {
  return JSON.stringify(value);
}

describe("browser artifact (docs/assets/js/works.js)", () => {
  it("旧 works.js と同じ公開キーを持つ", () => {
    const api = loadArtifactWorks();
    assert.deepEqual(Object.keys(api).sort(), [
      "GENRES",
      "byId",
      "load",
      "normalize",
      "parsePlaylistId",
      "parseYouTubeId",
      "thumbUrl",
    ]);
    for (const key of ["load", "byId", "parseYouTubeId", "parsePlaylistId", "thumbUrl", "normalize"] as const) {
      assert.equal(typeof api[key], "function", key);
    }
    assert.equal(jsonOf(api.GENRES), jsonOf([...GENRES]));
  });

  it("normalize が src と等価", () => {
    const api = loadArtifactWorks();
    assert.equal(typeof api.normalize, "function");
    const normalize = api.normalize as (works: unknown) => unknown;
    const fixtures = [
      {},
      { id: "a", title: "T", genre: "CV" },
      { genre: "XX", title: "T", unknownField: 1 },
      { youtube: "https://youtu.be/MQaIQ-U6oSk", title: "T" },
      {
        title: "T",
        performers: ["Alice", 7],
        music: [{ title: "M", composer: "C", extra: 1 }, "x"],
        communities: ["JEB"],
      },
    ];
    assert.equal(jsonOf(normalize(fixtures)), jsonOf(normalizeWorks(fixtures)));
  });

  it("パーサ・検索が src と等価", () => {
    const api = loadArtifactWorks();
    const artifactParseYouTubeId = api.parseYouTubeId as (url: unknown) => string | null;
    const artifactParsePlaylistId = api.parsePlaylistId as (url: unknown) => string | null;
    const urls = [
      "https://youtu.be/MQaIQ-U6oSk",
      "https://www.youtube.com/watch?v=MQaIQ-U6oSk",
      "https://example.com/abc",
      "",
      null,
    ];
    for (const url of urls) {
      assert.equal(artifactParseYouTubeId(url), parseYouTubeId(url), String(url));
    }
    const lists = [
      "PL0123456789abcdef",
      "https://www.youtube.com/playlist?list=PL0123456789abcdef",
      "https://example.com/",
      "",
      null,
    ];
    for (const list of lists) {
      assert.equal(artifactParsePlaylistId(list), parsePlaylistId(list), String(list));
    }
    const works = normalizeWorks([{ id: "a", title: "A" }]);
    const artifactById = api.byId as typeof byId;
    assert.equal(jsonOf(artifactById(works, "a")), jsonOf(byId(works, "a")));
  });

  it("src の WORKS 名前空間が旧API名で委譲している", () => {
    assert.equal(WORKS.load.name, "loadWorks");
    assert.equal(WORKS.normalize.name, "normalizeWorks");
    assert.equal(WORKS.byId, byId);
    assert.equal(WORKS.parseYouTubeId, parseYouTubeId);
    assert.equal(WORKS.parsePlaylistId, parsePlaylistId);
    assert.equal(jsonOf([...WORKS.GENRES]), jsonOf([...GENRES]));
  });
});
