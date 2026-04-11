# Arc Client ガイド

Arc Client は VS Code 内で動作するローカルファーストの REST API クライアントです。

ログイン不要、クラウド同期なし、主要機能に課金の壁もありません。

## クイックスタート

1. Activity Bar から Arc Client を開きます。
2. `Arc: New Request` を実行するか `+` をクリックします。
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
- 動的 HTML ページは `Body` タブに残り、`URL を開く` アクションで元のページを開けます
- JSON ツリービューアー
- XML フォーマット: `Pretty`, `Compact`, `Inline Children`
- レスポンス本文の保存とコピー
- `Raw`, `Normalized`, `Pretty` モードでレスポンス比較

## Collections / History / Environments

- コレクション、フォルダー、保存済みリクエストの作成
- Drag & Drop で整理
- コレクション全体を実行
- 実行時スナップショットとして履歴を保存
- アクティブ環境の切り替えと `{{variables}}` の利用

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

- `Arc: Change Display Language` で `English`, `Korean`, `Japanese` を切り替えられます。
- Arc Client は VS Code locale を自動では使わず、独自の表示言語設定を使います。

## キーボードショートカット

- `Ctrl+T`: 新しいリクエストタブ
- `Ctrl+W`: 現在のタブを閉じる
- `Enter`: URL 入力欄から送信
- `Ctrl+Enter`: リクエスト送信

macOS では `Cmd` を使います。

## ローカル保存

Arc Client のデータはすべて VS Code `globalStorage` 配下の JSON ファイルとしてローカル保存されます。

- `collections.json`
- `history.json`
- `environments.json`
- `active-environment.json`
- `default-headers.json`
- `tab-state.json`

Arc Client がネットワークを使うのは、ユーザーが明示的に API リクエストを送るときだけです。
