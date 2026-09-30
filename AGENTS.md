# AGENTS.md

## Project Overview

- `PENSPINNING-FILMS-LIST` は、ペンスピニングの映像作品（CV・SV・PV）を、タイトル・作者・出演者・使用楽曲・コミュニティから探せる日本語のアーカイブです。
- `docs/index.html` はトップページ兼作品一覧です。YouTube のサムネイル付きカードを表示し、キーワード検索、ジャンル（CV・SV・PV）による絞り込み、追加日・作者・出演者・コミュニティ順の並び替えに対応します。検索条件は URL のクエリに保存され、共有できます。
- `docs/work.html?id=<作品ID>` は作品詳細ページです。YouTube 動画の埋め込み再生、ジャンル・追加日・概要、作者・出演者・使用楽曲・コミュニティを表示し、詳細 URL のコピーや編集提案ができます。
- `docs/generator.html` は作品登録・編集提案用のフォームです。作品ごとにアコーディオンを展開・折りたたみして複数の作品を登録でき、タイトル・作者・YouTube URL を入力すると全作品の JSON を生成します。入力検証、既存作品との ID 重複確認、YouTube のメタデータ自動入力、YouTube プレイリストから作品フォームの一括生成、JSON のコピー、GitHub Issue への提案に対応します。
- 作品を2つ以上登録している場合は「一括編集」カードから作者・ジャンル・コミュニティをまとめて反映できます（反映範囲は「すべての作品」／「未入力の作品のみ」から選択）。
- 作品の公開はサイト内から直接保存するのではなく、生成した JSON を `docs/data/works.json` の `works` 配列に追加して Pull Request で提案する流れです。データセットが一次情報源であり、ブラウザは各ページで取得して表示します。
- 全ページでライト／ダークテーマ、レスポンシブ表示、キーボード操作に対応しています。`worker/` は作品カタログの保存や閲覧を担うのではなく、ジェネレーターが YouTube のタイトル・概要・公開日を取得し、プレイリストから作品フォームを一括生成するための独立した Cloudflare Worker です。

## Project Structure

- `index.html` / `work.html` / `generator.html`（リポジトリ直下）は Vite の MPA エントリです。React + TypeScript で実装され、`npm run build` で `docs/` に静的ファイルとして出力されます。出力先 URL（`index.html`、`work.html?id=`、`generator.html?id=`）は従来通りです。
- `src/` が開発用コードです。`main-*.tsx`（マウント）、`pages/`（3ページ）、`components/`（共通UI・ジェネレーター部品）、`catalog.ts`（検索・絞り込み・並び替え）、`youtube.ts`（メタデータ取得）、`generator-model.ts`（収集・検証・一括編集）、`works-core.ts`（正規化・取得）、`types.ts`（型定義）、`config.ts`（サイト設定）、`theme.tsx`（テーマ）で構成されます。状態管理ライブラリは使わず素の React のみです。
- `public/` はそのまま `docs/` 直下にコピーされます。`public/data/works.json` が作品データの一次情報源（Source of Truth）で、出力は `docs/data/works.json` です。`public/assets/css/style.css` は従来と同一 URL で配信されます。
- `docs/` はビルド成果物であり、GitHub Pages（legacy publish）がそのまま公開します。**`docs/` 配下は直接編集しないでください。** ビルドは `emptyOutDir: true` のため `docs/` を一旦全削除して再生成します（失敗時は再実行で復元できます）。
- `worker/` は YouTube メタデータとプレイリストを処理するための独立した Cloudflare Worker です。`GET /?url=` は動画 URL（1本の snippet）にも再生リスト URL（`playlistItems` + `videos.list`、最大50件/回、`maxResults`・`pageToken` で分割）にも対応します。静的サイトと一緒にビルドやデプロイが行われることはありません。

## Command

- Node.js 22 以上（固定された Wrangler で必要）を使用し、`npm ci` を実行してロックファイル通りの正確なパッケージをインストールしてください。

- サイトのプレビューは `npx --no-install http-server docs -p 8080 -c-1`（または `npm run serve`）で行います。`file://` 経由で HTML を開くのではなく、HTTP 経由で配信してください。

- Worker をローカルで実行するには `npx wrangler dev --config worker/wrangler.toml` を使用し、デプロイするには `npm run deploy:worker` を実行します。リポジトリのルートディレクトリから他の Wrangler コマンドを実行する場合も、`worker/wrangler.toml` 内のコメントで省略されている場合を含め、`--config worker/wrangler.toml` の指定が必要です。

- TypeScript の型チェック、ビルド、テストには以下のスクリプトを使用してください。
  - 型チェック: `npm run typecheck`（`tsc --noEmit`、`strict` 有効）
  - 本番ビルド: `npm run build`（`vite build`、`docs/` に出力。`docs/` は成果物のため直接編集しない）
  - テスト: `npm test`（`tsc` で `dist/` にコンパイル後、`node --test` で `dist/tests/*.test.js` を実行）
  - 依存追加時: 必要性を確認してから追加し、ロックファイルを更新する

- リント、CI 用のスクリプトは用意されていません。変更箇所の重点チェックを行う場合は、以下のコマンドを使用してください。

  - JSON 変更のパースチェック: `node -e "JSON.parse(require('fs').readFileSync('docs/data/works.json', 'utf8'))"`

  - Worker 変更のバンドルチェック: `npx --no-install wrangler deploy --dry-run --config worker/wrangler.toml`（※ドライランは型チェックを行わず、デプロイも実行されません）

## Code Style

- ファイル名: kebab-case (`user-profile.tsx`)
- コンポーネント: PascalCase の関数コンポーネント

## Git

- コミットメッセージ: Conventional Commits 準拠
  - `feat:`, `fix:`, `docs:`, `refactor:`, `test:`, `chore:`
- ブランチ名: `feature/xxx`, `fix/xxx`
- PRは必ずテストを通してから作成

## Data Contracts

- `works.json` のトップレベルは `{ "version": 1, "works": [...] }` という構造になっています。ジェネレーターは作品オブジェクトを出力し、複数作品を登録している場合はそれらをカンマ区切りで連結した文字列として出力します。配列の外枠 `[ ]` は出力しないので、そのまま `works` 配列の中に貼り付けられます。

- 作品データ層の単一ソースは `src/works-core.ts` です。ブラウザの正規化処理は、`CV`、`SV`、`PV` のジャンルのみを許可し、未知のフィールドは破棄します。スキーマを変更する際は、ノーマライザー、ジェネレーター、および影響を受けるすべてのページをまとめて更新する必要があります。

- 作品 ID（Work ID）は一覧、詳細、編集のフローを紐付けます。ID は `id`、YouTube ID、タイトルスラグの順で解決されます。一度公開した ID は重複を避け、安定して保持してください。

## Worker and secrets

- `YOUTUBE_API_KEY` と `ALLOWED_ORIGIN` はリモートの Worker シークレットとして設定してください。ブラウザ側のコードは公開されるため、`src/config.ts` の `youtubeApiKey` に空でない YouTube Data API キーを絶対に配置しないでください。

- `ALLOWED_ORIGIN` が設定されていない場合、Worker はすべてのオリジンからのアクセスを許可します。本番環境では、デプロイ先サイトの正確なオリジンを設定してください。
