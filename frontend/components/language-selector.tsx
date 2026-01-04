'use client';

import { Locale, availableLocales, useTranslation } from '@/lib/i18n';

interface LanguageSelectorProps {
  className?: string;
}

export function LanguageSelector({ className = '' }: LanguageSelectorProps) {
  const { locale, setLocale } = useTranslation();

  return (
    <div className={`flex gap-2 ${className}`}>
      {availableLocales.map(({ code, name, flag }) => (
        <button
          key={code}
          onClick={() => setLocale(code as Locale)}
          className={`rounded p-1 text-4xl transition-opacity hover:scale-110 ${
            locale === code ? 'opacity-100' : 'opacity-50 hover:opacity-75'
          }`}
          title={name}
          aria-label={`Switch to ${name}`}
        >
          {flag}
        </button>
      ))}
    </div>
  );
}
