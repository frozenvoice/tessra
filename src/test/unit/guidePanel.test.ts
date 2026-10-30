import * as assert from 'assert';
import * as fs from 'fs';
import * as path from 'path';

const repoRoot = path.resolve(__dirname, '../../../..');

function readGuidePanelSource(): string {
  return fs.readFileSync(path.join(repoRoot, 'src/panels/GuidePanel.ts'), 'utf8');
}

function readGuide(fileName: string): string {
  return fs.readFileSync(path.join(repoRoot, fileName), 'utf8');
}

function extractHeadings(markdown: string): string[] {
  return markdown
    .split(/\r?\n/)
    .filter((line) => /^#{1,6}\s+/.test(line))
    .map((line) => line.replace(/^#{1,6}\s+/, '').trim());
}

const GUIDE_FILES = ['GUIDE.md', 'GUIDE.ko.md', 'GUIDE.ja.md'] as const;

const EXPECTED_SECTION_COUNT = {
  'GUIDE.md': 18,
  'GUIDE.ko.md': 18,
  'GUIDE.ja.md': 18,
} as const;

const STALE_PHRASES = [
  /top summary chips/i,
  /상단 요약 칩/,
  /上部のサマリーチップ/,
  /sticky response toolbar keeps/i,
  /고정 응답 툴바에서 검색, 비교, 복사, 저장/,
  /固定レスポンスツールバーから検索、比較、コピー、保存/,
  /compare state chips/i,
  /비교 상태 칩/,
  /比較状態チップ/,
  /request header shows the current profile/i,
  /요청 헤더에는 현재 프로필/,
  /リクエストヘッダーには現在のプロファイル/,
  /default profile chip/i,
  /default` 프로필 칩/,
  /default` プロファイルチップ/,
];

describe('GuidePanel source', () => {
  let source: string;

  before(() => {
    source = readGuidePanelSource();
  });

  it('loads dedicated guide files instead of README files for the in-app guide', () => {
    assert.match(source, /path\.join\(this\.extensionUri\.fsPath, 'GUIDE\.ko\.md'\)/);
    assert.match(source, /path\.join\(this\.extensionUri\.fsPath, `GUIDE\.\$\{language\}\.md`\)/);
    assert.match(source, /path\.join\(this\.extensionUri\.fsPath, 'GUIDE\.md'\)/);
    assert.doesNotMatch(source, /README\.ko\.md/);
    assert.doesNotMatch(source, /path\.join\(this\.extensionUri\.fsPath, 'README\.md'\)/);
  });

  it('ships localized guide files for the supported languages', () => {
    for (const fileName of GUIDE_FILES) {
      assert.ok(fs.existsSync(path.join(repoRoot, fileName)), `${fileName} should exist`);
    }
  });
});

describe('In-app Guide content parity', () => {
  const guides = Object.fromEntries(
    GUIDE_FILES.map((fileName) => [fileName, readGuide(fileName)])
  ) as Record<(typeof GUIDE_FILES)[number], string>;

  it('keeps the same section count across English, Korean, and Japanese guides', () => {
    for (const fileName of GUIDE_FILES) {
      const headings = extractHeadings(guides[fileName]);
      assert.strictEqual(
        headings.length,
        EXPECTED_SECTION_COUNT[fileName],
        `${fileName} heading count was ${headings.length}: ${headings.join(' | ')}`
      );
    }
  });

  it('removes pre-redesign UI wording from every guide language', () => {
    for (const fileName of GUIDE_FILES) {
      const content = guides[fileName];
      for (const stale of STALE_PHRASES) {
        assert.doesNotMatch(content, stale, `${fileName} still contains stale phrase: ${stale}`);
      }
    }
  });

  it('covers current major capabilities in every guide language', () => {
    const requiredPatterns: Array<{ name: string; pattern: RegExp }> = [
      { name: 'Body conversion', pattern: /Convert|변환|変換|Keep text|텍스트 유지|テキストを維持/ },
      { name: 'Workspace Backup', pattern: /Workspace Backup|워크스페이스 백업|ワークスペースバックアップ/ },
      { name: 'WebSocket', pattern: /WebSocket/ },
      { name: 'Runner options', pattern: /iterations|stop-on-failure|delay/ },
      { name: 'Runner request selection', pattern: /selected|선택|選択/ },
      { name: 'Environment / Used counts', pattern: /Used N|사용 N|使用 N|N vars|변수 N|N 変数/ },
      { name: 'status strip', pattern: /status strip/ },
      { name: 'variables.json', pattern: /variables\.json/ },
      { name: 'Pin and Compare', pattern: /`Pin`.*`Compare`|`Pin`과 `Compare`|`Pin` と `Compare`/ },
      { name: 'More menu', pattern: /⋯/ },
      { name: 'request panel theme', pattern: /Request Panel Theme|request panel theme|リクエストパネル/ },
    ];

    for (const fileName of GUIDE_FILES) {
      const content = guides[fileName];
      for (const required of requiredPatterns) {
        assert.match(content, required.pattern, `${fileName} missing ${required.name}`);
      }
    }
  });

  it('keeps heading hierarchy shallow enough for the custom markdown renderer', () => {
    for (const fileName of GUIDE_FILES) {
      const deepHeadings = guides[fileName]
        .split(/\r?\n/)
        .filter((line) => /^#{3,6}\s+/.test(line));
      assert.strictEqual(deepHeadings.length, 0, `${fileName} should avoid h3+ for simpler rendering`);
    }
  });
});
