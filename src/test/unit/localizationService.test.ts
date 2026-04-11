import * as assert from 'assert';
import * as fs from 'fs';
import * as path from 'path';

function readLocalizationSource(): string {
  return fs.readFileSync(
    path.resolve(__dirname, '../../../../src/services/LocalizationService.ts'),
    'utf8'
  );
}

describe('LocalizationService source', () => {
  let source: string;

  before(() => {
    source = readLocalizationSource();
  });

  it('only exposes display languages that have maintained translations', () => {
    assert.match(
      source,
      /export const SUPPORTED_DISPLAY_LANGUAGES = \[\s*'en',\s*'ko',\s*'ja',\s*\] as const;/
    );
  });
});
