var WORKS = (function () {
  var GENRES = ["CV", "SV", "PV"];

  var PLAYLIST_ID_RE = /^[A-Za-z0-9_-]{13,128}$/;

  var DEFAULT_WORKS = [
    {
      id: "MQaIQ-U6oSk",
      title: "JapEn 17th │ PenSpinning",
      author: "MEL",
      performers: [],
      music: [
        {
          title: "Finale",
          url: "https://soundcloud.com/akiza1004/akiza-finale",
          composer: "Akiza",
        },
      ],
      communities: ["JEB"],
      genre: "CV",
      youtube: "https://youtu.be/MQaIQ-U6oSk",
      added: "2021-12-25",
    },
  ];

  function parseYouTubeId(url) {
    if (!url) return null;
    var m = String(url).match(
      /(?:youtube\.com\/(?:watch\?v=|shorts\/|embed\/|live\/)|youtu\.be\/)([A-Za-z0-9_-]{6,15})/,
    );
    return m ? m[1] : null;
  }

  function parsePlaylistId(url) {
    if (!url) return null;
    var raw = String(url).trim();
    if (PLAYLIST_ID_RE.test(raw)) return raw;
    var u;
    try {
      u = new URL(raw);
    } catch (e) {
      return null;
    }
    if (u.protocol !== "http:" && u.protocol !== "https:") return null;
    var host = u.hostname.toLowerCase();
    var hosts = [
      "youtube.com",
      "www.youtube.com",
      "m.youtube.com",
      "music.youtube.com",
      "youtu.be",
      "www.youtu.be",
    ];
    if (hosts.indexOf(host) === -1) return null;
    var list = u.searchParams.get("list");
    return list && PLAYLIST_ID_RE.test(list) ? list : null;
  }

  function thumbUrl(id, size) {
    size = size || "mqdefault";
    return (
      "https://img.youtube.com/vi/" +
      encodeURIComponent(id) +
      "/" +
      size +
      ".jpg"
    );
  }

  function resolveId(work) {
    return (
      work.id ||
      parseYouTubeId(work.youtube) ||
      "work-" + (work.title || "").replace(/\s+/g, "-").toLowerCase()
    );
  }

  function normalize(works) {
    return (works || []).map(function (w) {
      return {
        id: resolveId(w),
        genre: GENRES.indexOf(w.genre) !== -1 ? w.genre : "",
        title: w.title || "（無題）",
        description: w.description || "",
        youtube: w.youtube || "",
        author: w.author || "",
        performers: Array.isArray(w.performers) ? w.performers : [],
        music: Array.isArray(w.music) ? w.music : [],
        communities: Array.isArray(w.communities) ? w.communities : [],
        added: w.added || "",
      };
    });
  }

  async function load() {
    try {
      var res = await fetch("data/works.json", { cache: "no-store" });
      if (!res.ok) throw new Error("fetch failed");
      var json = await res.json();
      if (json && Array.isArray(json.works)) return normalize(json.works);
    } catch (e) {}
    return normalize(DEFAULT_WORKS);
  }

  function byId(works, id) {
    return works.find(function (w) {
      return w.id === id;
    });
  }

  return {
    load: load,
    byId: byId,
    parseYouTubeId: parseYouTubeId,
    parsePlaylistId: parsePlaylistId,
    thumbUrl: thumbUrl,
    normalize: normalize,
    GENRES: GENRES,
  };
})();
