import { getRequestConfig } from 'next-intl/server';

export const locales = ['ru', 'en'] as const;
export type Locale = (typeof locales)[number];

// Пока без i18n-routing: одна локаль на весь сайт.
// Чтобы переключать — поменяйте DEFAULT_LOCALE или добавьте [locale]-routing.
const DEFAULT_LOCALE: Locale = 'ru';

export default getRequestConfig(async () => ({
  locale: DEFAULT_LOCALE,
  messages: (await import(`../messages/${DEFAULT_LOCALE}.json`)).default,
}));
