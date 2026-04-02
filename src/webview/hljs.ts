// Webview용 highlight.js 번들 (필요한 언어만 포함)
import hljs from 'highlight.js/lib/core';
import html from 'highlight.js/lib/languages/xml';
import json from 'highlight.js/lib/languages/json';
import javascript from 'highlight.js/lib/languages/javascript';
import css from 'highlight.js/lib/languages/css';
import plaintext from 'highlight.js/lib/languages/plaintext';

hljs.registerLanguage('html', html);
hljs.registerLanguage('xml', html);
hljs.registerLanguage('json', json);
hljs.registerLanguage('javascript', javascript);
hljs.registerLanguage('css', css);
hljs.registerLanguage('plaintext', plaintext);

// Webview 전역에 노출
(globalThis as any).hljs = hljs;
