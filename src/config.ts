/**
 * サイト設定。旧 docs/assets/js/config.js と同値。
 * APIキーは含めない (公開リポジトリに配置するため)。
 */
export interface SiteConfig {
  owner: string;
  repo: string;
  branch: string;
  dataFile: string;
  siteTitle: string;
  /** YouTubeメタデータ取得用プロキシ (Cloudflare Worker) のURL。 */
  youtubeMetadataEndpoint: string;
  /** ローカル開発専用。公開物には空文字のまま置くこと。 */
  youtubeApiKey: string;
}

export const SITE_CONFIG: SiteConfig = {
  owner: "aloe-ps",
  repo: "CV-List",
  branch: "master",
  dataFile: "docs/data/works.json",
  siteTitle: "PENSPINNING-FILMS-LIST",
  youtubeMetadataEndpoint: "https://youtube-metadata.aloeps314.workers.dev/",
  youtubeApiKey: "",
};
