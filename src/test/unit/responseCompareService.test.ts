import * as assert from 'assert';
import * as fs from 'fs/promises';
import * as os from 'os';
import * as path from 'path';
import { ResponseCompareService } from '../../services/ResponseCompareService';

describe('ResponseCompareService', () => {
  it('normalizes JSON responses, applies ignore rules, and reports changed paths', () => {
    const left = {
      label: 'Left',
      body: JSON.stringify({
        data: { price: 100, timestamp: '2026-04-11T10:00:00Z' },
        requestId: 'old-id',
      }),
      contentType: 'application/json',
      status: 200,
      statusText: 'OK',
      resolvedUrl: 'https://example.com/products/1',
    };

    const right = {
      label: 'Right',
      body: JSON.stringify({
        data: { price: 120, timestamp: '2026-04-11T10:05:00Z' },
        requestId: 'new-id',
      }),
      contentType: 'application/json',
      status: 200,
      statusText: 'OK',
      resolvedUrl: 'https://example.com/products/1',
    };

    const comparison = ResponseCompareService.prepareComparison(left, right, {
      mode: 'normalized',
      includeMetadataSummary: true,
      ignoreHeaders: [],
      ignoreJsonPaths: ['$.requestId', '$.data.timestamp'],
    });

    assert.match(comparison.title, /Response Compare: Left vs Right \(normalized\)/);
    assert.match(comparison.left.content, /Changed JSON Paths: \$.data\.price/);
    assert.ok(!comparison.left.content.includes('"timestamp"'));
    assert.ok(!comparison.right.content.includes('"requestId"'));
    assert.ok(comparison.left.content.includes('"price":100'));
    assert.ok(comparison.right.content.includes('"price":120'));
  });

  it('represents binary responses with fingerprints instead of raw body text', () => {
    const binary = Buffer.from([0, 255, 16, 32, 65, 66, 67]);
    const comparison = ResponseCompareService.prepareComparison(
      {
        label: 'Binary A',
        body: '',
        bodyBase64: binary.toString('base64'),
        contentType: 'application/octet-stream',
        status: 200,
        statusText: 'OK',
      },
      {
        label: 'Binary B',
        body: '',
        bodyBase64: Buffer.from([1, 2, 3]).toString('base64'),
        contentType: 'application/octet-stream',
        status: 200,
        statusText: 'OK',
      },
      {
        mode: 'normalized',
        includeMetadataSummary: true,
        ignoreHeaders: [],
        ignoreJsonPaths: [],
      }
    );

    assert.strictEqual(comparison.left.extension, 'txt');
    assert.match(comparison.left.content, /This response body is binary\./);
    assert.match(comparison.left.content, /SHA-256:/);
    assert.match(comparison.left.content, /Base64 Prefix:/);
  });

  it('cleans up stale diff artifacts', async () => {
    const tempRoot = await fs.mkdtemp(path.join(os.tmpdir(), 'arc-compare-'));
    const diffDir = path.join(tempRoot, '.diff');
    await fs.mkdir(diffDir, { recursive: true });

    const staleFile = path.join(diffDir, 'resp_left_old.txt');
    const freshFile = path.join(diffDir, 'resp_right_new.txt');
    await fs.writeFile(staleFile, 'old');
    await fs.writeFile(freshFile, 'new');

    const eightDaysAgo = Date.now() - (1000 * 60 * 60 * 24 * 8);
    await fs.utimes(staleFile, new Date(eightDaysAgo), new Date(eightDaysAgo));

    await ResponseCompareService.cleanupDiffArtifacts(tempRoot);

    await assert.rejects(fs.stat(staleFile));
    await assert.doesNotReject(fs.stat(freshFile));

    await fs.rm(tempRoot, { recursive: true, force: true });
  });
});
