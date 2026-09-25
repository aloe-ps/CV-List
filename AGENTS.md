# AGENTS.md

## About Project
* これはcv,sv,pvと呼ばれる映像作品を一覧で見ることができるサイトです。Github Pagesで公開され、Pull Requestを通じて誰でも作品を登録することができます


## Project Structure

* `docs/` は完全な静的サイトです。バンドラーやビルド出力はありません。`index.html`、`work.html`、`generator.html` は、`config.js` → `works.js` → `theme.js` → 各ページのコントローラーの順でスクリプトを読み込みます。共有グローバル変数を変更する際は、この順序を維持してください。

* `docs/data/works.json` が実行時の一次情報源（Source of Truth）です。各ページは `cache: "no-store"` を指定してこれを取得しており、カタログデータはバンドルされていません。

* `worker/` は YouTube メタデータを処理するための独立した Cloudflare Worker です。静的サイトと一緒にビルドやデプロイが行われることはありません。

## Command

* Node.js 22 以上（固定された Wrangler で必要）を使用し、`npm ci` を実行してロックファイル通りの正確なパッケージをインストールしてください。

* サイトのプレビューは `npx --no-install http-server docs -p 8080 -c-1` で行います。`npm run serve` は `site` ターゲットが存在しないため使用しないでください。また、`file://` 経由で HTML を開くのではなく、HTTP 経由で配信してください。

* Worker をローカルで実行するには `npx wrangler dev --config worker/wrangler.toml` を使用し、デプロイするには `npm run deploy:worker` を実行します。リポジトリのルートディレクトリから他の Wrangler コマンドを実行する場合も、`worker/wrangler.toml` 内のコメントで省略されている場合を含め、`--config worker/wrangler.toml` の指定が必要です。

* ビルド、リント、型チェック、テスト、CI 用のスクリプトは用意されていません。変更箇所の重点チェックを行う場合は、以下のコマンドを使用してください。

  * JavaScript 変更のチェック: `node --check <変更したJSファイル>`

  * JSON 変更のパースチェック: `node -e "JSON.parse(require('fs').readFileSync('docs/data/works.json', 'utf8'))"`

  * Worker 変更のバンドルチェック: `npx --no-install wrangler deploy --dry-run --config worker/wrangler.toml`（※ドライランは型チェックを行わず、デプロイも実行されません）

## Data Contracts

* `works.json` のトップレベルは `{ "version": 1, "works": [...] }` という構造になっています。ジェネレーターは `works` 配下に挿入する1つの作品オブジェクトを出力するのみで、この外枠ラッパーは出力しません。

* `docs/assets/js/works.js` 内のブラウザノーマライザーは、`CV`、`SV`、`PV` のジャンルのみを許可し、未知のフィールドは破棄します。スキーマを変更する際は、ノーマライザー、ジェネレーター、および影響を受けるすべてのページをまとめて更新する必要があります。

* 作品 ID（Work ID）は一覧、詳細、編集のフローを紐付けます。ID は `id`、YouTube ID、タイトルスラグの順で解決されます。一度公開した ID は重複を避け、安定して保持してください。

## Worker and secrets

* `YOUTUBE_API_KEY` と `ALLOWED_ORIGIN` はリモートの Worker シークレットとして設定してください。ブラウザ側のコードは公開されるため、`docs/assets/js/config.js` に空でない YouTube Data API キーを絶対に配置しないでください。

* `ALLOWED_ORIGIN` が設定されていない場合、Worker はすべてのオリジンからのアクセスを許可します。本番環境では、デプロイ先サイトの正確なオリジンを設定してください。