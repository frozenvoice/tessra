# HTTP response encoding

Tessra assembles response bytes, decompresses supported Content-Encoding layers, and then decodes text. The response size remains the decompressed byte count. Compressed and decompressed size limits both remain enforced. Binary responses retain their existing body/base64 handling.

## Charset selection

Content-Type parameter names and encoding labels are case-insensitive. Whitespace and double- or single-quoted charset values are accepted. The first charset parameter wins. Other quoted parameters may contain semicolons without becoming charset parameters.

| Text media type | Selection order when supported |
| --- | --- |
| XML: application/xml, text/xml, and +xml | BOM → Content-Type charset → XML declaration → UTF-8 |
| JSON, other text, or absent Content-Type | Content-Type charset → BOM → UTF-8 |

XML BOM precedence follows [RFC 7303 §3.2](https://www.rfc-editor.org/rfc/rfc7303.html#section-3.2). Only an explicit ASCII-compatible XML declaration in the first 1,024 bytes is considered. Tessra does not guess encodings from arbitrary content, unmarked UTF-16 patterns, or HTML meta tags.

JSON's standard default is UTF-8; the media type defines no charset parameter. Tessra accepts an explicit supported charset or Unicode BOM as a compatibility policy for legacy servers. See [RFC 8259](https://www.rfc-editor.org/rfc/rfc8259.html#section-8.1).

UTF-8 and UTF-16 LE/BE BOMs are recognized and removed from decoded text when they match the selected encoding. UTF-32 BOMs are recognized as unsupported rather than misread as UTF-16. For non-XML text, an explicit charset takes precedence over a conflicting BOM.

## Warnings and original bytes

Supported labels are those accepted by the runtime's built-in TextDecoder. UTF-8, EUC-KR and Shift_JIS work in the tested runtimes below; WHATWG aliases such as windows-949 and windows-31j also work. An arbitrary label such as cp949 is not assumed to be an alias. See [Node's encoding support table](https://nodejs.org/download/release/v16.17.1/docs/api/util.html#whatwg-supported-encodings).

An unsupported charset produces a visible warning and a UTF-8 fallback preview. XML with a supported BOM can still use that BOM for the preview, while retaining an unsupported explicit-header warning. Invalid bytes in a supported charset produce replacement characters and a warning. A literal, correctly encoded replacement character is not itself an error.

These cases remain HTTP responses with their original status, not transport errors that trigger automatic retries. A real retryable HTTP status still follows the configured retry policy. The response viewer and Runner show the warning in `tessra.displayLanguage`.

Original decompressed bytes are retained in bodyBase64 for warnings, non-UTF-8 text, BOM-bearing text, and binary responses. **Save Response Body** uses those bytes; copying displayed text uses the decoded preview. Normal UTF-8 text keeps its existing behavior. The compressed wire representation is not saved.

## Verified runtime support

The same fixed bytes (`b0a1` → 가; `82a0` → あ) were decoded with `fatal: true`, along with UTF-8 and encoding aliases:

| Runtime | Node | Electron | ICU |
| --- | --- | --- | --- |
| VS Code 1.74.0 (minimum supported version) | 16.14.2 | 19.1.8 | 70.1 |
| VS Code 1.99.3 (pinned E2E version) | 20.18.3 | 34.3.2 | 74.2 |
| Local test Node | 24.12.0 | — | 77.1 |

The VS Code probes used its Electron executable in Node mode. They verify encoding support in the bundled runtime, not a complete UI run on every VS Code version. No encoding dependency or VS Code engine bump was added. A runtime lacking a requested decoder follows the same warning/original-byte preservation path.
