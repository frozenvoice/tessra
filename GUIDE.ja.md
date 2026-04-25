# Tessra ガイド

Tessra は VS Code 向けのローカル優先 REST API クライアントです。

ログイン、クラウド同期、有料制限なしで主要なワークフローを使えます。

## クイックスタート

1. Activity Bar から Tessra を開きます。
2. `Tessra: New Request` を実行するか、`+` をクリックします。
3. HTTP メソッドを選び、URL を入力します。
4. params、headers、body、auth、scripts、request settings を入力します。
5. `Send` をクリックするか、URL 入力欄で `Enter` を押します。

環境変数の使用例:

```text
URL: {{baseUrl}}/users
Header: Authorization: Bearer {{token}}
Body: {"env":"{{envName}}"}
```

## リクエスト作成

- メソッド: `GET`, `POST`, `PUT`, `PATCH`, `DELETE`, `HEAD`, `OPTIONS`
- Body タイプ: `json`, `xml`, `form-urlencoded`, `form-data`, `binary`, `raw`
- 認証: No Auth, Basic, Bearer Token, API Key
- ピン留めタブ付きのマルチタブ編集
- URL 入力欄で `Enter` を押すと、アクティブなリクエストを送信します。
- 上部のサマリーチップには、現在の環境、認証方式、デフォルトヘッダーの使用、スクリプト、履歴動作が表示されます。
- 機密性のある認証値は、表示操作をするまでマスクされます。
- ヘッダーやクエリパラメータを 1 行ずつ追加せず、一括貼り付けできます。
- 送信前に未解決の `{{variables}}` がある場合、Tessra が警告します。

## レスポンスワークスペース

- タブ: `Body`, `Headers`, `Cookies`, `Tests`、意味のある静的 HTML がある場合の `Preview`
- 動的 HTML ページは `Body` に残し、HTTP/HTTPS として解決されたページは `Open URL` で開けます。
- レスポンスメタデータには、読みやすい duration とリクエスト/受信時刻が表示されます。
- 固定レスポンスツールバーから検索、比較、コピー、保存アクションを使えます。
- レスポンス本文検索は、次/前への移動、大文字小文字の区別、正規表現モードに対応します。
- JSON tree viewer
- XML format: `Pretty`, `Compact`, `Inline Children`
- レスポンス本文の保存またはコピー
- `Raw`, `Normalized`, `Pretty` モードでレスポンスを比較
- 比較状態チップには、現在のモード、メタデータ要約の使用、ピン留めレスポンスの準備状態が表示されます。

## コレクション、履歴、環境

- コレクション、フォルダー、保存済みリクエストを作成
- Drag and drop でリクエストを整理
- コレクション全体を実行
- コレクション実行では、アクティブなリクエスト、現在の試行回数、リトライのカウントダウンを表示
- 実行済みスナップショットと timing metadata を履歴に保存
- アクティブ環境の切り替えと、リクエスト全体での `{{variables}}` 解決

## ワークスペースプロファイル

- `default` は普段の Tessra 作業に使うメインのローカル保存領域です。
- 別のプロジェクト、インポートした spec、実験を現在のコレクションや履歴と混ぜたくないときは、別のプロファイルを作成します。
- プロファイルは collections、history、environments、default headers、saved tabs を分離します。
- 実用的な目安:
  - 異なるプロジェクトや作業フローはプロファイルで分けます。
  - 同じプロジェクト内の `local`, `staging`, `prod` は環境で分けます。
- `Tessra: Change Workspace Profile` でプロファイルを切り替えたり作成したりできます。
- リクエストヘッダーには現在のプロファイルが表示され、`default` プロファイルチップに hover すると意味が表示されます。

## Scripts

- Pre-request script
- Test script
- `pm.test`, `pm.expect`, `pm.environment`
- script logs と test 結果の表示

## リクエスト別 Settings

- Timeout
- Follow redirects
- Save to history
- リクエストツールバーまたは Headers タブのバナーから `Default Headers` を開く
- TLS override
- 最大レスポンスサイズ
- Retry count と retry delay
- Stop after headers
- Skip default headers
- Disable scripts
- 安全性や動作を変える設定は視覚的に強調されます。
- レスポンスに意味のある静的 HTML が含まれる場合、Preview を自動的に開きます。

## 表示言語

- `Tessra: Change Display Language` で `English`, `Korean`, `Japanese` を切り替えられます。
- Tessra はパネル、プロンプト、通知、アプリ内ガイドに独自の表示言語設定を使います。
- VS Code Settings のラベルと Command Palette のタイトルは引き続き VS Code locale に従います。

## キーボードショートカット

- `Ctrl+T`: 新しいリクエストタブ
- `Ctrl+W`: 現在のタブを閉じる
- `Enter`: URL 入力欄から送信
- `Ctrl+Enter`: リクエスト送信

macOS では `Ctrl` の代わりに `Cmd` を使用します。

## ローカル保存

すべての Tessra データは VS Code `globalStorage` 配下の JSON ファイルにローカル保存されます。

- `collections.json`
- `history.json`
- `environments.json`
- `active-environment.json`
- `default-headers.json`
- `tab-state.json`

Tessra は、ユーザーが明示的に API リクエストを送信したときだけネットワークを使用します。
