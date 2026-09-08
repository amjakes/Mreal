import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

describe('frontend build configuration', () => {
  it('uses the modern Vite entry point', () => {
    const index = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
    expect(index).toContain('/src/main.jsx');
  });

  it('ships a deployment configuration template', () => {
    const template = JSON.parse(fs.readFileSync(path.join(root, 'public', 'contracts.example.json'), 'utf8'));
    expect(template.chainId).toBe(31337);
    expect(template.eventTicketing.address).toBe('');
  });
});
