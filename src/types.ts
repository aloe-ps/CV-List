/**
 * CV-List の共有型定義。
 *
 * docs/data/works.json の実際の形式に一致させることが目的。
 * 調査結果 (57件): 全作品が id/title/author/performers/music/communities/genre/youtube/added
 * を持ち、description は任意 (47/57件)。music の各項目は title/url/composer が
 * それぞれ欠ける場合がある。genre は CV/SV/PV のみ。
 *
 * 人物・コミュニティは現時点では名前文字列のまま (JSON変更なし)。
 * 将来のプロフィール機能で ID ベースに育てるための別名を用意している。
 */

/** 作品ジャンル。docs/assets/js/works.js の GENRES と一致する。 */
export type Genre = "CV" | "SV" | "PV";

/** 使用楽曲。3項目とも欠ける場合がある (実データで確認済み)。 */
export interface Music {
  title?: string;
  url?: string;
  composer?: string;
}

/**
 * 信頼できない入力 (works.json / ネットワーク経由) の1作品分。
 * 外部データを無条件に信頼しないため、すべて unknown として受けて
 * works-core.ts 側で検証・正規化する。
 */
export interface RawWork {
  id?: unknown;
  title?: unknown;
  description?: unknown;
  youtube?: unknown;
  author?: unknown;
  performers?: unknown;
  music?: unknown;
  communities?: unknown;
  genre?: unknown;
  added?: unknown;
}

/**
 * 正規化済みの作品。works.js の normalize() の出力形式と一致する。
 * genre は未知値の場合 "" になる (既存の扱いを維持)。
 */
export interface NormalizedWork {
  id: string;
  genre: Genre | "";
  title: string;
  description: string;
  youtube: string;
  author: string;
  performers: string[];
  music: Music[];
  communities: string[];
  added: string;
}

/** works.json のトップレベル構造 ({ version: 1, works: [...] })。 */
export interface WorksData {
  version: number;
  works: RawWork[];
}

/** 作者・出演者の名前。将来のプロフィール機能でエンティティ化する前提の別名。 */
export type PersonName = string;

/** コミュニティ名。将来のプロフィール機能でエンティティ化する前提の別名。 */
export type CommunityName = string;
