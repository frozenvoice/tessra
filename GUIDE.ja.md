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
- URL 下の status strip には、アクティブ環境の変数数、スクリプト、履歴保存、適用する既定ヘッダー数、安全設定、リクエストで参照した変数数 が表示されます。
- Environment セグメントをクリックすると変数を編集できます。アクティブ環境がない場合は環境を選べます。
- リクエスト変数の領域（未解決変数の警告を含む）をクリックすると、現在のリクエストでの変数使用箇所を確認できます。
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
- URL path に `/users/{{userId}}` のように segment 全体が placeholder のとき、URL 下に Path Variables が表示されます。
- Path Variables は既定で Environment 値を使い、Override でリクエストローカル値を置き、Reset すると Environment に戻ります（Environment 自体は変更しません）。
- URL 警告も同じ occurrence 規則に従います。Request-local の path 値は missing になりませんが、同じ名前が query / headers / body / auth にある場合は Environment に無ければ unresolved のままです。
- Path override は該当 path segment にのみ適用され、query / headers / body / auth には影響しません。WebSocket URL と Collection Runner / cURL / codegen の解決にも同じ規則が適用されます。
- URL、headers、body、auth、scripts などの入力欄で変数 autocomplete を使えます。
- 環境の変数数（`N 変数`）はアクティブ環境の大きさ、リクエストの変数数（`リクエスト変数 N`）は現在のリクエストで参照した一意の変数名の数です。
- workspace variables はバックアップに保持できますが、リクエスト解決は引き続きアクティブ environment に従います。
- `Tessra: Import Environment` で `.env` / `.env.*` / `*.env` を一度だけローカル Environment として取り込みます。元ファイルは変更せず、取り込んだ環境を自動でアクティブにはしません。

## 秘密変数

- 環境または workspace-variable の編集画面で `保護(Protect)` を明示的に選びます。既存の変数は自動分類しません。`値を設定(Set)` は VS Code のパスワード入力欄で入力・置換し、`表示(Reveal)` は一時的に表示し、`削除(Delete)` は選択した変数と正確に対応する秘密参照を削除します。
- 確認済みの値は VS Code SecretStorage に保存し、JSON には安定したプロファイル・環境・変数 ID と参照を残します。名前を変更しても変数 ID は変わりません。Webview は既定でマスクと値の有無だけを受け取り、プロファイル切り替え・パネル終了時に表示した値を破棄します。
- SecretStorage への保存を確認してから現在の平文を取り除きます。中断や保存先の障害では元の値を保持した変換待ち状態になり、実行を停止します。`再試行(Retry)` で完了するか、`キャンセル(Cancel)` で平文に戻せます。未設定や保存先の障害は送信前に通知されます。
- 新しい環境・ワークスペースのエクスポートには保護された変数の参照だけが含まれます。インポート・復元後は同じコンピューターでも `値を設定` が必要です。過去のバックアップ・エクスポート・平文変数は自動検査・削除しません。Workspace variables はバックアップ用で、リクエストの置換はアクティブ環境に従います。
- アプリが生成するリクエストのプレビュー・コード・リクエスト履歴・エラー・スクリプトログは、既知の秘密値をマスクするか変数参照を保持します。実際のリクエストと、サーバー echo を含む受信レスポンスは変更しません。信頼したスクリプトは実行時に環境の秘密値を読めます。任意に変換された値を完全に検出する保証はなく、VM は OS サンドボックスではありません。
- 復旧とエクスポートの詳細は [秘密変数の保存と露出の境界](docs/secret-variables.md) を参照してください。

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

## Server-Sent Events (SSE)

- `text/event-stream` レスポンスは受信中にイベントを表示します。`Events` に data と標準の `event`、`id`、`retry` を表示しますが、これらのフィールドで自動再接続・再送はしません。内容はテキストとして表示し、特定の vendor JSON 形式を前提にしません。
- 受信中に `Stop` を使えます。受信中・完了・中断・タイムアウト・エラーを区別し、受信済みの部分データを保持します。プロファイル切り替え・パネル終了・Runner Stop はストリームを取り消し、その実行からの遅い更新を破棄します。
- リクエスト全体の timeout とレスポンスサイズ制限は引き続き適用されます。期限なしで受信する場合は timeout `0` を明示的に選んでください。ストリーミングでも制限や TLS 検証を無効にせず、受信開始後の自動再試行・再接続・POST 再送はしません。
- UTF-8 の chunk 境界、BOM、CR/LF/CRLF、複数の `data` 行、comment、空行のイベント境界を逐次処理します。EOF で未完了の最終イベントを完成させず、transport エラーはエラーとして保持します。
- イベントサイズ・待機入力・保持イベント・Raw バイトには上限があり、切り詰めや欠落を表示します。`Raw` はストリーム終了後に使え、コピー・保存には保持した先頭部分だけが含まれます。画面はまとめて更新します。
- 現在の上限と取り消し動作は [SSE の受信と制限](docs/sse.md) を参照してください。

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
- Postman 互換寄りの API: `pm.test`、`pm.expect`、`pm.environment`
- Tessra Script utilities（Postman 公式の `pm.crypto` ではありません）: `pm.crypto.sha256(value)`、`pm.crypto.hmacSha256(message, secret)`（小文字 hex）、`pm.encoding.base64Encode` / `base64Decode`（UTF-8 ↔ 標準 Base64）、`pm.uuid()`（UUID v4）、`pm.time.unix()`（秒）、`pm.time.unixMs()`（ミリ秒）
- hash/encode の入力は string/number/boolean/bigint/null/undefined。オブジェクトは `JSON.stringify(...)` を使います。
- 例: `pm.environment.set("signature", pm.crypto.hmacSha256(pm.environment.get("payload") || "", pm.environment.get("secret") || ""));`
- Scripts タブから例の挿入と Open Guide を使えます。
- インポートしたスクリプトは、リクエストタブで信頼するまで無効です。
- スクリプトの変数変更は開始時の環境に適用され、同じキーの同時編集は保持して警告します。プロファイル変更で実行中の処理を取り消します。
- スクリプトにホストのオブジェクトや関数を渡しません。VMはOSサンドボックスではないため、内容を理解して信頼するスクリプトだけを実行してください。
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

リクエストと metadata は VS Code `globalStorage` 配下の JSON ファイルにローカル保存されます。確認済みの秘密変数の値は別の VS Code SecretStorage に保存し、JSON には参照を残します。default プロファイルはルートに、他のプロファイルは `profiles/` 配下のエンコードされたディレクトリに同じファイルを置きます。

- `collections.json`
- `history.json`
- `environments.json`
- `active-environment.json`
- `default-headers.json`
- `variables.json`
- `tab-state.json`

JSON を解析できない場合、Tessra は横に `.corrupt-*` バックアップを残して警告し、そのファイルはデフォルト値で動作します。

Tessra は、ユーザーが明示的にリクエストを送信するか WebSocket を接続したときだけネットワークを使用します。
