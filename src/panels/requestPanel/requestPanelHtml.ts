import * as vscode from 'vscode';
import { LocalizationService } from '../../services/LocalizationService';
import { getRequestPanelClientScript } from './requestPanelClientScript';
import { getRequestPanelMarkup } from './requestPanelMarkup';
import { getRequestPanelStyles } from './requestPanelStyles';

export interface RequestPanelHtmlInput {
  webview: vscode.Webview;
  extensionUri: vscode.Uri;
  nonce: string;
}

/**
 * Request panel webview HTML composition.
 * Styles / markup / client script live in sibling modules; this file only assembles CSP + HTML shell.
 */
export function getRequestPanelHtml(input: RequestPanelHtmlInput): string {
  const { webview, extensionUri, nonce } = input;
  const hljsUri = webview.asWebviewUri(
    vscode.Uri.joinPath(extensionUri, 'dist', 'hljs.js')
  );
  const bodyConversionUri = webview.asWebviewUri(
    vscode.Uri.joinPath(extensionUri, 'dist', 'bodyConversion.js')
  );
  const displayLanguage = LocalizationService.getDisplayLanguage();
  const requestPanelTheme = LocalizationService.getRequestPanelTheme();
  const localizedStrings = JSON.stringify(LocalizationService.getStrings(displayLanguage)).replace(/</g, '\\u003c');
  const dateLocale = LocalizationService.getDateLocale(displayLanguage);
  const csp = [
    "default-src 'none'",
    `img-src ${webview.cspSource} data:`,
    `style-src ${webview.cspSource} 'unsafe-inline'`,
    `script-src ${webview.cspSource} 'nonce-${nonce}'`,
    `font-src ${webview.cspSource}`,
  ].join('; ');

  const styles = getRequestPanelStyles();
  const markup = getRequestPanelMarkup({ displayLanguage });
  const clientScript = getRequestPanelClientScript({
    localizedStrings,
    dateLocale,
    displayLanguage,
    requestPanelTheme,
  });

  return /*html*/ `<!DOCTYPE html>
<html lang="${displayLanguage}">
<head>
<meta charset="UTF-8"/>
<meta name="viewport" content="width=device-width,initial-scale=1.0"/>
<meta http-equiv="Content-Security-Policy" content="${csp}"/>
<title>Tessra</title>
<style nonce="${nonce}">
${styles}
</style>
</head>
<body data-panel-theme="${requestPanelTheme}">
${markup}

<script nonce="${nonce}">
${clientScript}
</script>
<script nonce="${nonce}" src="${bodyConversionUri}"></script>
<script nonce="${nonce}" src="${hljsUri}"></script>
</body>
</html>`;
}
