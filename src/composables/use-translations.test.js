import { afterEach, describe, it, expect, vi } from 'vitest';
import { useTranslations } from '@/composables/use-translations.js';

// Exercise real locale imports and translated labels, not a mocked loader.
describe('useTranslations case-insensitive BCP-47 locales', () => {
  afterEach(() => vi.restoreAllMocks());

  it.each(['FR', 'FR-CA'])('loads French for %s and uses it by default', async (locale) => {
    const { messages, t, ready } = useTranslations(locale);
    await ready;

    expect(messages.fr).toHaveProperty('other', expect.any(String));
    expect(messages.fr.other).not.toBe(messages.en.other);
    expect(t('other')).toBe(messages.fr.other);
  });

  it.each(['FR', 'FR-CA'])('looks up an already loaded French label using %s', async (locale) => {
    const { messages, t, ready } = useTranslations('fr');
    await ready;

    expect(messages.fr).toHaveProperty('other', expect.any(String));
    expect(messages.fr.other).not.toBe(messages.en.other);
    expect(t('other', locale)).toBe(messages.fr.other);
  });

  it('uses bundled English for EN-US without warning about a missing locale', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const { messages, t, ready } = useTranslations('EN-US');
    await ready;

    expect(messages.en).toHaveProperty('other', expect.any(String));
    expect(Object.keys(messages)).toEqual(['en']);
    expect(t('other')).toBe(messages.en.other);
    expect(t('other', 'EN-US')).toBe(messages.en.other);
    expect(warn).not.toHaveBeenCalled();
  });
});
