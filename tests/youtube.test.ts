import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  buildOfficialVideoUrl,
  buildPlaylistUrl,
  buildVideoMetaUrl,
  detectGenre,
  fetchPlaylistPage,
  fetchVideoMeta,
  clearVideoMetaCache,
  parseEndpointVideoResponse,
  parseInnerTubeResponse,
  parseOfficialVideoResponse,
  parsePlaylistPageResponse,
  toDateInput,
} from "../src/youtube.js";

describe("URL構築", () => {
  it("Worker・公式APIのURLを作る", () => {
    assert.equal(
      buildVideoMetaUrl("https://w.example.dev/", "abc123XYZ_-"),
      "https://w.example.dev/?url=https%3A%2F%2Fyoutu.be%2Fabc123XYZ_-",
    );
    assert.equal(
      buildVideoMetaUrl("https://w.example.dev", "abc123XYZ_-"),
      "https://w.example.dev/?url=https%3A%2F%2Fyoutu.be%2Fabc123XYZ_-",
    );
    assert.ok(
      buildPlaylistUrl("https://w.example.dev/", "PL123", 50, "").includes(
        "playlist%3Flist%3DPL123",
      ),
    );
    assert.ok(buildPlaylistUrl("https://w.example.dev/", "PL123", 50, "tok").includes("pageToken=tok"));
    assert.equal(
      buildOfficialVideoUrl("key", "abc123XYZ_-"),
      "https://www.googleapis.com/youtube/v3/videos?part=snippet&id=abc123XYZ_-&key=key",
    );
  });
});

describe("応答パース", () => {
  it("公式API応答を解釈する", () => {
    const meta = parseOfficialVideoResponse({
      items: [{ snippet: { title: "T", description: "D", publishedAt: "2024-05-06T00:00:00Z" } }],
    });
    assert.deepEqual(meta, {
      source: "api",
      title: "T",
      description: "D",
      publishedAt: "2024-05-06T00:00:00Z",
    });
    assert.throws(() => parseOfficialVideoResponse({ items: [] }), /video-not-found/);
    assert.throws(() => parseOfficialVideoResponse({}), /video-not-found/);
  });

  it("InnerTube応答を解釈する", () => {
    const meta = parseInnerTubeResponse({
      videoDetails: { title: "T", shortDescription: "D" },
      microformat: { playerMicroformatRenderer: { uploadDate: "2024-01-02" } },
    });
    assert.equal(meta.source, "innertube");
    assert.equal(meta.publishedAt, "2024-01-02");
    assert.throws(() => parseInnerTubeResponse({ videoDetails: {} }), /video-not-found/);
  });

  it("Worker応答を解釈する", () => {
    assert.deepEqual(parseEndpointVideoResponse({ title: "T" }), {
      source: "endpoint",
      title: "T",
      description: "",
      publishedAt: "",
    });
    assert.deepEqual(parsePlaylistPageResponse({ items: [] }), {
      title: "",
      totalResults: 0,
      nextPageToken: "",
      items: [],
    });
    assert.throws(() => parsePlaylistPageResponse({ error: "ng" }), /ng/);
  });
});

describe("toDateInput / detectGenre", () => {
  it("日付先頭を抜き出す", () => {
    assert.equal(toDateInput("2024-05-06T00:00:00Z"), "2024-05-06");
    assert.equal(toDateInput("2024-05-06"), "2024-05-06");
    assert.equal(toDateInput(""), "");
    assert.equal(toDateInput(null), "");
  });

  it("ジャンルを推測する", () => {
    assert.equal(detectGenre("My CV 2024"), "CV");
    assert.equal(detectGenre("[SV] test"), "SV");
    assert.equal(detectGenre("pv video"), "PV");
    assert.equal(detectGenre("SCV test"), "");
    assert.equal(detectGenre(""), "");
  });
});

describe("fetchVideoMeta", () => {
  it("endpoint経由で取得しキャッシュする", async () => {
    clearVideoMetaCache();
    let calls = 0;
    const fetcher = (async () => {
      calls += 1;
      return new Response(JSON.stringify({ title: "T", description: "D" }), { status: 200 });
    }) as typeof fetch;
    const first = await fetchVideoMeta("vid1", { endpoint: "https://w.example.dev/", apiKey: "", fetcher });
    assert.equal(first.source, "endpoint");
    assert.equal(first.title, "T");
    const second = await fetchVideoMeta("vid1", { endpoint: "https://w.example.dev/", apiKey: "", fetcher });
    assert.equal(second.title, "T");
    assert.equal(calls, 1);
  });

  it("失敗時はoEmbedローダーにフォールバックする", async () => {
    clearVideoMetaCache();
    const fetcher = (async () => new Response("ng", { status: 500 })) as typeof fetch;
    const meta = await fetchVideoMeta("vid2", {
      endpoint: "https://w.example.dev/",
      apiKey: "",
      fetcher,
      oembedLoader: async () => "OT",
    });
    assert.deepEqual(meta, { source: "oembed", title: "OT", description: "", publishedAt: "" });
  });
});

describe("fetchPlaylistPage", () => {
  it("endpoint未設定は例外", async () => {
    await assert.rejects(fetchPlaylistPage("PL1", { endpoint: " " }), /no-endpoint/);
  });

  it("1ページ分を取得する", async () => {
    const fetcher = (async () =>
      new Response(
        JSON.stringify({
          title: "PL",
          totalResults: 1,
          nextPageToken: "next",
          items: [{ videoId: "abc123XYZ_-", title: "T", description: "D", publishedAt: "2024-01-02", position: 0 }],
        }),
        { status: 200 },
      )) as typeof fetch;
    const page = await fetchPlaylistPage("PL1", { endpoint: "https://w.example.dev/", fetcher });
    assert.equal(page.title, "PL");
    assert.equal(page.nextPageToken, "next");
    assert.deepEqual(page.items, [
      {
        videoId: "abc123XYZ_-",
        title: "T",
        description: "D",
        publishedAt: "2024-01-02",
        position: 0,
      },
    ]);
  });
});
