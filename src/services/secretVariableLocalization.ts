const translations: Record<string, [string, string, string]> = {
  'webview.workspaceVariables': ['Workspace variables', 'Workspace 변수', 'Workspace 変数'],
  'webview.workspaceVariablesBackupOnly': ['Workspace variables are stored in backups. Requests use the active environment.', 'Workspace 변수는 백업에 저장됩니다. 요청 치환은 활성 환경을 사용합니다.', 'Workspace 変数はバックアップに保存されます。リクエストにはアクティブ環境を使用します。'],
  'webview.openWorkspaceVariables': ['Edit workspace variables', 'Workspace 변수 편집', 'Workspace 変数を編集'],
  'webview.secretProtect': ['Protect', '비밀 보호', '秘密として保護'],
  'webview.secretSet': ['Set value', '값 설정', '値を設定'],
  'webview.secretReveal': ['Reveal', '값 보기', '値を表示'],
  'webview.secretHide': ['Hide', '숨기기', '隠す'],
  'webview.secretResume': ['Retry protection', '보호 재시도', '保護を再試行'],
  'webview.secretCancel': ['Cancel protection', '보호 취소', '保護を取消'],
  'webview.secretRemove': ['Delete secret variable', '비밀 변수 삭제', '秘密変数を削除'],
  'webview.secretStateSet': ['Protected', '보호됨', '保護済み'],
  'webview.secretStateMissing': ['Value needed', '값 입력 필요', '値が必要'],
  'webview.secretStateUnavailable': ['Keychain unavailable', '키체인 사용 불가', 'キーチェーン利用不可'],
  'webview.secretStatePending': ['Protection pending', '보호 진행 중', '保護待ち'],
  'webview.secretProtectedValue': ['Protected value', '보호된 값', '保護された値'],
  'webview.secretActionPending': ['Working…', '처리 중…', '処理中…'],
  'webview.secretConversionHelp': ['Protect explicitly stores a value in VS Code SecretStorage. Failed conversion keeps the original for Retry or Cancel. Reveal is temporary.', '비밀 보호를 선택하면 VS Code SecretStorage에 저장합니다. 전환 실패 시 원본을 유지하며 재시도하거나 취소할 수 있습니다. 값 보기는 일시적입니다.', '保護を選ぶと VS Code SecretStorage に保存します。失敗時は元の値を保持し、再試行または取消できます。値の表示は一時的です。'],
  'secret.inputPrompt': ['Enter the protected variable value (stored in VS Code SecretStorage)', '비밀 변수 값을 입력하세요 (VS Code SecretStorage에 저장)', '秘密変数の値を入力してください (VS Code SecretStorage に保存)'],
  'secret.error.invalid-id': ['The variable identity is invalid. Reload the editor.', '변수 식별자가 유효하지 않습니다. 편집기를 다시 여세요.', '変数の識別子が無効です。エディターを開き直してください。'],
  'secret.error.not-found': ['Variable "{key}" no longer exists. Reload the editor.', '변수 "{key}"가 더 이상 존재하지 않습니다. 편집기를 다시 여세요.', '変数「{key}」は存在しません。エディターを開き直してください。'],
  'secret.error.conversion-pending': ['Protection of "{key}" is pending. Retry or cancel in the variable editor before sending.', '"{key}" 보호가 완료되지 않았습니다. 전송 전에 변수 편집기에서 재시도하거나 취소하세요.', '「{key}」の保護が未完了です。送信前に変数エディターで再試行または取消してください。'],
  'secret.error.missing': ['Protected variable "{key}" needs a value. Set it in the variable editor before sending.', '비밀 변수 "{key}"의 값이 필요합니다. 전송 전에 변수 편집기에서 설정하세요.', '秘密変数「{key}」の値が必要です。送信前に変数エディターで設定してください。'],
  'secret.error.unavailable': ['VS Code SecretStorage is unavailable for "{key}". The request was not sent.', '"{key}"의 VS Code SecretStorage를 사용할 수 없어 요청을 보내지 않았습니다.', '「{key}」の VS Code SecretStorage が利用できないため、送信しませんでした。'],
  'secret.error.verification-failed': ['Could not verify protection of "{key}". The original remains for Retry or Cancel.', '"{key}" 보호를 검증하지 못했습니다. 원본을 유지하므로 재시도하거나 취소할 수 있습니다.', '「{key}」の保護を検証できませんでした。元の値を保持しているので再試行または取消できます。'],
  'secret.error.conflict': ['Variables or workspace changed during the operation. Reload the variable editor.', '처리 중 변수 또는 Workspace가 변경되었습니다. 변수 편집기를 다시 여세요.', '処理中に変数または Workspace が変更されました。変数エディターを開き直してください。'],
};

export const SECRET_VARIABLE_STRINGS = Object.fromEntries(['en', 'ko', 'ja'].map((language, index) =>
  [language, Object.fromEntries(Object.entries(translations).map(([key, values]) => [key, values[index]]))]
)) as Record<string, Record<string, string>>;
