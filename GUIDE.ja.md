# Tessra ガイド

Tessra は VS Code 内で動作するローカルファーストの REST API クライアントです。

ログイン不要、クラウド同期なし、主要機能に課金の壁もありません。

## クイックスタート

1. Activity Bar から Tessra を開きます。
2. `Tessra: New Request` を実行するか `+` をクリックします。
3. HTTP メソッドを選び、URL を入力します。
4. params、headers、body、auth、scripts、request settings を入力します。
5. `Send` を押すか、URL 入力欄で `Enter` を押します。

変数の使用例:

```text
URL: {{baseUrl}}/users
Header: Authorization: Bearer {{token}}
Body: {"env":"{{envName}}"}
```

## リクエスト作成

- メソッド: `GET`, `POST`, `PUT`, `PATCH`, `DELETE`, `HEAD`, `OPTIONS`
- ボディタイプ: `json`, `xml`, `form-urlencoded`, `form-data`, `binary`, `raw`
- 認証: No Auth, Basic, Bearer Token, API Key
- マルチタブ編集とタブのピン留め
- URL 入力欄で `Enter` を押すとすぐ送信

## レスポンスワークスペース

- `Body`、`Headers`、`Cookies`、`Tests` タブに加えて、意味のある静的 HTML がある場合のみ `Preview` タブが表示されます
- 動的 HTML ページは `Body` タブに残り、HTTP/HTTPS の元ページは `URL を開く` アクションで開けます
- レスポンスメタデータに読みやすい所要時間と送信/受信時刻を表示します
- JSON ツリービューアー
- XML フォーマット: `Pretty`, `Compact`, `Inline Children`
- レスポンス本文の保存とコピー
- `Raw`, `Normalized`, `Pretty` モードでレスポンス比較

## Collections / History / Environments

- コレクション、フォルダー、保存済みリクエストの作成
- Drag & Drop で整理
- コレクション全体を実行
- 実行時スナップショットと timing metadata として履歴を保存
- アクティブ環境の切り替えと `{{variables}}` の利用

## ワークスペースプロファイル

- `default` は普段の Tessra 作業を置くメインのローカル保存領域です
- 別プロジェクト、取り込んだ OpenAPI / Postman データ、試験用ワークフローを既存作業と混ぜたくないときは新しいプロファイルを作ってください
- プロファイルは collections、history、environments、default headers、saved tabs を丸ごと分離します
- 実運用では次の分け方が分かりやすいです
  - プロファイル: 別プロジェクトや別ワークフロー
  - 環境: 同一プロジェクト内の `local`, `staging`, `prod`
- `Tessra: Change Workspace Profile` から切り替えや新規作成ができます
- リクエスト上部のプロファイルチップに現在のプロファイルが表示され、`default` には意味を説明するツールチップが付きます

## Scripts

- Pre-request script
- Test script
- `pm.test`, `pm.expect`, `pm.environment`
- script logs と test 結果の表示

## リクエストごとの Settings

- Timeout
- Follow redirects
- Save to history
- TLS override
- 最大レスポンスサイズ
- Retry count / retry delay
- Headers 受信後に停止
- Default headers をスキップ
- Scripts を無効化
- 意味のある静的 HTML がある場合は Preview を自動で開く

## 表示言語

- `Tessra: Change Display Language` で `English`, `Korean`, `Japanese` を切り替えられます。
- Tessra はパネル、プロンプト、通知、アプリ内ガイドに独自の表示言語設定を使います。
- VS Code の設定ラベルと Command Palette のコマンド名は引き続き VS Code locale に従います。

## キーボードショートカット

- `Ctrl+T`: 新しいリクエストタブ
- `Ctrl+W`: 現在のタブを閉じる
- `Enter`: URL 入力欄から送信
- `Ctrl+Enter`: リクエスト送信

macOS では `Cmd` を使います。

## ローカル保存

Tessra のデータはすべて VS Code `globalStorage` 配下の JSON ファイルとしてローカル保存されます。

- `collections.json`
- `history.json`
- `environments.json`
- `active-environment.json`
- `default-headers.json`
- `tab-state.json`

Tessra がネットワークを使うのは、ユーザーが明示的に API リクエストを送るときだけです。
