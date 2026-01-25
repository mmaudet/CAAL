import { getRequestConfig } from 'next-intl/server';
import { cookies } from 'next/headers';
import { type Locale, defaultLocale, locales } from './config';

export default getRequestConfig(async () => {
  const cookieStore = await cookies();
  const cookieLocale = cookieStore.get('CAAL_LOCALE')?.value;

  // Validate locale is supported, fallback to default
  const locale: Locale = locales.includes(cookieLocale as Locale)
    ? (cookieLocale as Locale)
    : defaultLocale;

  // Load English as base, overlay with target locale for missing translation fallback
  const englishMessages = (await import('../../messages/en.json')).default;
  const localeMessages =
    locale !== 'en' ? (await import(`../../messages/${locale}.json`)).default : {};

  return {
    locale,
    messages: { ...englishMessages, ...localeMessages },
  };
});
