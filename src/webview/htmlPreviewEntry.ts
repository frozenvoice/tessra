import { hasMeaningfulStaticPreview, syncPreviewFrame } from './htmlPreview';

// 문자열 클라이언트가 호출하는 실제 미리보기 경계만 Webview 전역에 제공한다.
Object.assign(globalThis, {
  TessraHtmlPreview: Object.freeze({ hasMeaningfulStaticPreview, syncPreviewFrame }),
});
