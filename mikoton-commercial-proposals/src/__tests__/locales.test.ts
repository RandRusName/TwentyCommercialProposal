import { describe, expect, it } from 'vitest';

import english from '../../locales/en.json';
import russian from '../../locales/ru-RU.json';

describe('application locale catalogs', () => {
  it('keeps English and Russian catalogs complete and aligned', () => {
    const englishKeys = Object.keys(english).sort();
    const russianKeys = Object.keys(russian).sort();

    expect(russianKeys).toEqual(englishKeys);
    expect(Object.values(english).every((value) => value.trim() !== '')).toBe(true);
    expect(Object.values(russian).every((value) => value.trim() !== '')).toBe(true);
  });

  it('localizes the two navigation labels consistently', () => {
    expect(russian['Commercial Proposals']).toBe('Коммерческие предложения');
    expect(russian['Work and Services Catalog']).toBe('Каталог работ и услуг');
  });
});
