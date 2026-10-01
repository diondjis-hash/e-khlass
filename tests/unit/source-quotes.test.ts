import { readFileSync, readdirSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const sourceDirectory = path.resolve(__dirname, '../../src');

describe('Source quote conventions', () => {
  it('uses straight quotes for the onboarding client directive', () => {
    const source = readFileSync(
      path.join(sourceDirectory, 'app/onboarding/merchant/page.tsx'),
      'utf8'
    );

    expect(source).toMatch(/^['"]use client['"];\r?\n/);
  });

  it('contains no smart quotes in JavaScript or TypeScript source', () => {
    const sourceFiles = readdirSync(sourceDirectory, { recursive: true })
      .filter(file => /\.[cm]?[jt]sx?$/.test(file));

    expect(sourceFiles.length).toBeGreaterThan(0);

    for (const file of sourceFiles) {
      const source = readFileSync(path.join(sourceDirectory, file), 'utf8');

      expect(source, file).not.toMatch(/[\u2018\u2019\u201c\u201d]/);
    }
  });
});
