var SITE_CONFIG = {
  // GitHub リポジトリ情報（作品データへのPR誘導用）
  owner: "aloe-ps",
  repo: "CV-List",
  branch: "main",
  dataFile: "site/data/works.json",
  siteTitle: "PENSPINNING-FILMS-LIST",

  // YouTubeメタデータ取得用プロキシURL（推奨）
  // GitHub Pagesのような静的サイトではAPIキーをクライアントに置くと公開されます。
  // worker/ を Cloudflare Workers にデプロイし、そのURLをここに設定すると、
  // キーはサーバー側に隠したままタイトル・概要・公開日を自動取得できます。
  // 例: "https://youtube-metadata.example.workers.dev"
  youtubeMetadataEndpoint: "https://youtube-metadata.aloeps314.workers.dev/",

  // ローカル開発専用: YouTube Data API v3 のAPIキー（非推奨）
  // 公開リポジトリに書き込むとAPIキーが漏洩します。使わないでください。
  // https://console.cloud.google.com/apis/credentials で取得し、YouTube Data API v3 を有効化
  youtubeApiKey: ""
};