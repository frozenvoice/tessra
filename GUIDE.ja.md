# Tessra ガイド

Tessra は VS Code 向けのローカル優先 REST API クライアントです。

ログイン、クラウド同期、有料制限なしで主要なワークフローを使えます。

## クイックスタート

1. Activity Bar から Tessra を開きます。
2. `Tessra: New Request` を実行するか、`+` をクリックします。
3. HTTP メソッドを選び、URL を入力します。
4. リクエストタブで params、headers、body、auth、scripts、settings を入力します。
5. `Send` をクリックするか、URL 入力欄で `Enter` / `Ctrl+Enter`（macOS では `Cmd+Enter`）を押します。

環境変数の使用例:

```text
URL: {{baseUrl}}/users
Header: Authorization: Bearer {{token}}
Body: {"env":"{{envName}}"}
```

## リクエスト作成

- メソッド: `GET`, `POST`, `PUT`, `PATCH`, `DELETE`, `HEAD`, `OPTIONS`
- リクエストタブ: `Params`, `Headers`, `Body`, `Auth`, `Scripts`, `Settings`
- ピン留めタブ付きのマルチタブ編集
- URL 入力欄の `Enter`、または `Ctrl+Enter` / `Cmd+Enter` でアクティブなリクエストを送信します。
- URL 下の status strip には、アクティブ Environment（`N 変数`）、Scripts、History on/off、Defaults、risk override、リクエストの `使用 N` が表示されます。
- Environment セグメントをクリックすると変数を編集できます。アクティブ環境がない場合は環境を選べます。
- `使用 N`（または未解決 Vars）をクリックすると、現在のリクエストでの変数使用箇所を確認できます。
- status strip を展開すると、workspace profile、環境切り替え、Default Headers、追加詳細を確認できます。
- 機密性のある認証値は、表示操作をするまでマスクされます。
- ヘッダーやクエリパラメータを 1 行ずつ追加せず、一括貼り付けできます。
- 送信前に未解決または循環する `{{variables}}` がある場合、Tessra が警告します。

## Body

- Body タイプ: `none`, `json`, `xml`, `form-urlencoded`, `form-data`, `binary`, `raw`
- JSON/XML Body は textarea 編集を維持したまま syntax highlighting を提供します。
- Body の undo/redo は Send 後やリクエストタブ切り替え後も動作します。
- 空でない Body を対応する形式間で切り替えるとき、Tessra が安全な変換を提案できます。`変換` / `テキストを維持` / キャンセルから選べます。
- 未対応または曖昧な変換（入れ子構造、file form-data、Binary の自動生成）は拒否され、元の Body が維持されます。

## レスポンスワークスペース

- レスポンス要約には status、duration、size、content type、resolved URL が表示されます。
- タブ: `Body`, `Cookies`, `Headers`, `Tests`、意味のある静的 HTML がある場合の `Preview`
- 動的 HTML は `Body` に残り、HTTP/HTTPS として解決されたページは `Open URL` で開けます。
- `Pin` と `Compare` はレスポンス要約に常に表示されます。
- Copy、Copy URL、Save、Copy Status、Copy Headers などのユーティリティは `⋯` メニューにあります。
- レスポンス本文検索は、次/前への移動、大文字小文字の区別、正規表現モードに対応します。
- JSON は Tree と Raw ビューをサポートします。
- XML format: `Pretty`, `Compact`, `Inline Children`、および XPath helper
- Content-Type ベースの syntax highlighting
- gzip、deflate、Brotli レスポンスの自動デコード
- Compare は `Raw`、`Normalized`、`Pretty` モードをサポートし、metadata summary を含められます。

## コレクション、ランナー、履歴

- コレクション、フォルダー、保存済みリクエストを作成
- Drag and drop で項目を整理
- Run All Requests は設定画面を開き、最初はすべてのリクエストが選択された状態です。この実行だけ外したいリクエストのチェックを外します。
- 選択は安定した request id を使い元の順序を保ち、次に Runner を開くと再び全選択に戻ります。
- delay、iterations、stop-on-failure は選択したリクエストにだけ適用されます。
- ランナーはアクティブなリクエスト、進捗、passed / failed / skipped の要約を表示し、実行前に除外したリクエストは skipped に数えません。
- Stop でアクティブなリクエスト、retry 待機、リクエスト間 delay をキャンセルできます。
- ランナー要約から失敗したリクエストだけを再実行できます。
- 各リクエストの Save to history が有効なときだけ、ランナー結果が履歴に保存されます。
- 履歴はグループ化、フィルタ、pin、`tessra.historyMaxItems` による保持（ピン留め項目は維持）をサポートします。

## 環境と変数

- Environment の CRUD とアクティブ環境の切り替え
- リクエストの `{{variable}}` 解決はアクティブ environment を基準にします。
- 入れ子の `{{variables}}` は再帰的に解決され、未解決/循環参照は送信前に報告されます。
- URL、headers、body、auth、scripts などの入力欄で変数 autocomplete を使えます。
- Environment の `N 変数` はアクティブ環境の変数数、リクエストの `使用 N` は現在のリクエストが使う変数数です。
- workspace variables はバックアップに保持できますが、リクエスト解決は引き続きアクティブ environment に従います。
- `Tessra: Import Environment` で `.env` / `.env.*` / `*.env` を一度だけローカル Environment として取り込みます。元ファイルは変更せず、取り込んだ環境を自動でアクティブにはしません。

## ワークスペースプロファイル

- `default` は普段の Tessra 作業に使うメインのローカル保存領域です。
- 別のプロジェクト、インポートした spec、実験を混ぜたくないときは別のプロファイルを作成します。
- プロファイルは collections、history、environments、default headers、workspace variables、saved tabs を分離します。
- 異なるプロジェクト/作業フローはプロファイルで、同じプロジェクト内の `local` / `staging` / `prod` は environment で分けます。
- `Tessra: Change Workspace Profile` でプロファイルを切り替えたり作成したりできます。
- 現在のプロファイルは status strip を展開した詳細から確認できます。

## ワークスペースバックアップ / 復元

- `Tessra: Export Workspace Backup` と `Tessra: Import Workspace Backup` を使います。
- バックアップには collections、environments、active environment、default headers、workspace variables が含まれます。
- history と open tabs / tab state は含まれません。
- import は現在のプロファイルのデータを置き換えます。merge ではありません。
- import 前に Tessra が pre-import backup を自動作成します。
- バックアップファイルには token、API key などの機密情報が含まれることがあるため、安全に保管してください。

## WebSocket

- `ws://` または `wss://` URL（原文、または `{{variable}}` 解決後）を入力すると WebSocket モードに切り替わります。
- 主アクションで Connect / Disconnect を使います。
- Body タブが出ていくテキストメッセージの作成欄です。
- inbound / outbound / close の診断は WebSocket message log に表示されます。
- inbound binary frame は base64 で表示されます。
- frame/message size limit で過大なペイロードを防ぎます。
- Settings の optional ping keepalive はデフォルトで off です。

## Scripts

- Pre-request script は送信前、Test script はレスポンス後に実行されます。
- 流れ: Environment → Pre-request → Send → Tests
- 対応 API: `pm.test`、`pm.expect`、`pm.environment`
- Scripts タブから例の挿入と Open Guide を使えます。
- インポートしたスクリプトは、リクエストタブで信頼するまで無効です。
- スクリプト timeout は `tessra.scriptTimeoutMs` で設定します。
- script logs と pass/fail 結果はレスポンスの Tests タブに表示されます。

## リクエスト別 Settings

- Timeout
- Max response size
- Retry count と retry delay
- TLS: `Default`, `Strict`, `Insecure`
- Follow redirects
- Stop after headers
- Save to history
- Skip default headers
- Disable scripts
- Default Headers は Headers タブのバナー、または status strip 詳細から開けます。
- 安全性や動作を変える非デフォルト設定は status strip の警告/表示として現れます。

## Import / Export

- cURL import と Copy as cURL
- OpenAPI import。`{userId}` のような path parameter は `{{userId}}` として取り込まれます。
- Tessra collection import
- Postman collection / environment の import・export
- `.env` ファイルを Tessra Environment としてインポート（一度きりのコピー。sync / watcher / 書き戻しなし）
- Tessra Workspace Backup の export・import

## 表示言語とテーマ

- `Tessra: Change Display Language` で `English`、`Korean`、`Japanese` を切り替えます。
- Tessra のパネル、プロンプト、通知、このガイドはその設定に従います。
- VS Code Settings のラベルと Command Palette のタイトルは VS Code locale に従います。
- `Tessra: Change Request Panel Theme` で color/token skin（`default`、`minimal-cool`、`product`、`bold-color`）を切り替えます。
- テーマ preset は accent と surface token だけを変え、パネルレイアウトは変えません。

## キーボードショートカット

- `Ctrl+T`: 新しいリクエストタブ
- `Ctrl+W`: 現在のタブを閉じる
- `Enter`: URL 入力欄から送信
- `Ctrl+Enter`: リクエスト送信
- `Ctrl+S`: 現在のリクエストを保存
- `Ctrl+Shift+S`: Save As
- `Ctrl+F`: レスポンス検索にフォーカス
- `Alt+1` … `Alt+6`: リクエストタブ切り替え
- `Alt+Shift+1` … `Alt+Shift+5`: レスポンスタブ切り替え

macOS では `Ctrl` の代わりに `Cmd` を使用します。

## ローカル保存

すべての Tessra データは VS Code `globalStorage` 配下の JSON ファイルにローカル保存されます。default プロファイルはルートに、他のプロファイルは `profiles/<name>/` に同じファイルを置きます。

- `collections.json`
- `history.json`
- `environments.json`
- `active-environment.json`
- `default-headers.json`
- `variables.json`
- `tab-state.json`

JSON を解析できない場合、Tessra は横に `.corrupt-*` バックアップを残して警告し、そのファイルはデフォルト値で動作します。

Tessra は、ユーザーが明示的にリクエストを送信するか WebSocket を接続したときだけネットワークを使用します。
