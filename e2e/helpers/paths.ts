import * as path from 'path';

export const REPO_ROOT = path.resolve(__dirname, '..', '..');
export const E2E_ROOT = path.join(REPO_ROOT, 'e2e');
export const ARTIFACTS_DIR = path.join(E2E_ROOT, '.artifacts');
export const VSCODE_E2E_VERSION = process.env.VSCODE_E2E_VERSION || '1.99.3';
