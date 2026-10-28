import { describe, expect, it } from 'vitest';

import { CORE_PACKAGE_VERSION } from './index.js';

describe('@ofrenda/core scaffold', () => {
  it('resolves a relative import written with the .js extension', () => {
    expect(CORE_PACKAGE_VERSION).toBe('0.0.0');
  });
});
