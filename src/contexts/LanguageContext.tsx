import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';

/**
 * Language localization (#95).
 *
 * The foundation: a React context, a translation dictionary scoped to the
 * UI strings already shipped, a `useT(key)` hook for callers, and
 * `localStorage` persistence of the user's choice. Adding a new language
 * is mechanical — copy `en` to `es`, translate the values, and append the
 * code to `SUPPORTED_LANGUAGES`. The dictionary is intentionally narrow at
 * launch; the issue's acceptance criteria are about establishing the
 * primitive, not translating every string in the app.
 */

export const SUPPORTED_LANGUAGES = ['en', 'es', 'fr', 'pt'] as const;
export type LanguageCode = (typeof SUPPORTED_LANGUAGES)[number];

export const LANGUAGE_STORAGE_KEY = 'swiftsend.language';
const DEFAULT_LANGUAGE: LanguageCode = 'en';

type Translations = Record<string, string>;

const DICTIONARY: Record<LanguageCode, Translations> = {
  en: {
    'app.name': 'SwiftSend',
    'common.back': 'Back',
    'common.continue': 'Continue',
    'common.retry': 'Retry',
    'common.cancel': 'Cancel',
    'language.label': 'Language',
    'language.english': 'English',
    'language.spanish': 'Español',
    'language.french': 'Français',
    'language.portuguese': 'Português',
    'history.title': 'Transaction History',
    'history.summary.totalSent': 'Total Sent',
    'history.summary.feesPaid': 'Fees Paid',
    'history.filters.advancedRange': 'Advanced range',
    'history.filters.dateFrom': 'Date from',
    'history.filters.dateTo': 'Date to',
    'history.filters.amountMin': 'Min amount',
    'history.filters.amountMax': 'Max amount',
    'wallet.creating.title': 'Creating your personal wallet…',
    'wallet.failed.title': "Wallet setup didn't finish",
    'wallet.success.title': 'Your wallet is ready!',
  },
  es: {
    'app.name': 'SwiftSend',
    'common.back': 'Atrás',
    'common.continue': 'Continuar',
    'common.retry': 'Reintentar',
    'common.cancel': 'Cancelar',
    'language.label': 'Idioma',
    'language.english': 'English',
    'language.spanish': 'Español',
    'language.french': 'Français',
    'language.portuguese': 'Português',
    'history.title': 'Historial de transacciones',
    'history.summary.totalSent': 'Total enviado',
    'history.summary.feesPaid': 'Comisiones pagadas',
    'history.filters.advancedRange': 'Rango avanzado',
    'history.filters.dateFrom': 'Desde',
    'history.filters.dateTo': 'Hasta',
    'history.filters.amountMin': 'Monto mínimo',
    'history.filters.amountMax': 'Monto máximo',
    'wallet.creating.title': 'Creando tu billetera personal…',
    'wallet.failed.title': 'No pudimos crear tu billetera',
    'wallet.success.title': 'Tu billetera está lista',
  },
  fr: {
    'app.name': 'SwiftSend',
    'common.back': 'Retour',
    'common.continue': 'Continuer',
    'common.retry': 'Réessayer',
    'common.cancel': 'Annuler',
    'language.label': 'Langue',
    'language.english': 'English',
    'language.spanish': 'Español',
    'language.french': 'Français',
    'language.portuguese': 'Português',
    'history.title': 'Historique des transactions',
    'history.summary.totalSent': 'Total envoyé',
    'history.summary.feesPaid': 'Frais payés',
    'history.filters.advancedRange': 'Plage avancée',
    'history.filters.dateFrom': 'À partir du',
    'history.filters.dateTo': "Jusqu'au",
    'history.filters.amountMin': 'Montant min.',
    'history.filters.amountMax': 'Montant max.',
    'wallet.creating.title': 'Création de votre portefeuille…',
    'wallet.failed.title': "La configuration n'a pas abouti",
    'wallet.success.title': 'Votre portefeuille est prêt',
  },
  pt: {
    'app.name': 'SwiftSend',
    'common.back': 'Voltar',
    'common.continue': 'Continuar',
    'common.retry': 'Tentar novamente',
    'common.cancel': 'Cancelar',
    'language.label': 'Idioma',
    'language.english': 'English',
    'language.spanish': 'Español',
    'language.french': 'Français',
    'language.portuguese': 'Português',
    'history.title': 'Histórico de transações',
    'history.summary.totalSent': 'Total enviado',
    'history.summary.feesPaid': 'Taxas pagas',
    'history.filters.advancedRange': 'Intervalo avançado',
    'history.filters.dateFrom': 'De',
    'history.filters.dateTo': 'Até',
    'history.filters.amountMin': 'Valor mínimo',
    'history.filters.amountMax': 'Valor máximo',
    'wallet.creating.title': 'Criando sua carteira pessoal…',
    'wallet.failed.title': 'A configuração da carteira falhou',
    'wallet.success.title': 'Sua carteira está pronta',
  },
};

export interface LanguageContextValue {
  language: LanguageCode;
  /**
   * Translate a key. Falls back to the English value, then to the raw key
   * itself, so a missing translation never renders an empty string.
   */
  t: (key: string) => string;
  setLanguage: (next: LanguageCode) => void;
  supportedLanguages: readonly LanguageCode[];
}

const LanguageContext = createContext<LanguageContextValue | undefined>(undefined);

function readPersistedLanguage(): LanguageCode {
  if (typeof window === 'undefined') return DEFAULT_LANGUAGE;
  try {
    const raw = window.localStorage.getItem(LANGUAGE_STORAGE_KEY);
    if (raw && (SUPPORTED_LANGUAGES as readonly string[]).includes(raw)) {
      return raw as LanguageCode;
    }
  } catch {
    // localStorage unavailable (private mode, sandboxed iframes) — fall through.
  }
  return DEFAULT_LANGUAGE;
}

export function LanguageProvider({
  children,
  initialLanguage,
}: {
  children: React.ReactNode;
  /** Test seam: bypass localStorage so unit tests are deterministic. */
  initialLanguage?: LanguageCode;
}) {
  const [language, setLanguageState] = useState<LanguageCode>(
    () => initialLanguage ?? readPersistedLanguage(),
  );

  useEffect(() => {
    if (typeof window === 'undefined') return;
    try {
      window.localStorage.setItem(LANGUAGE_STORAGE_KEY, language);
      // Surface to assistive tech so the html lang attribute matches.
      document.documentElement.setAttribute('lang', language);
    } catch {
      // ignore — persistence is best-effort
    }
  }, [language]);

  const setLanguage = useCallback((next: LanguageCode) => {
    if ((SUPPORTED_LANGUAGES as readonly string[]).includes(next)) {
      setLanguageState(next);
    }
  }, []);

  const t = useCallback(
    (key: string): string => {
      const direct = DICTIONARY[language]?.[key];
      if (direct !== undefined) return direct;
      const fallback = DICTIONARY.en[key];
      if (fallback !== undefined) return fallback;
      return key;
    },
    [language],
  );

  const value = useMemo<LanguageContextValue>(
    () => ({ language, t, setLanguage, supportedLanguages: SUPPORTED_LANGUAGES }),
    [language, t, setLanguage],
  );

  return (
    <LanguageContext.Provider value={value}>{children}</LanguageContext.Provider>
  );
}

export function useLanguage(): LanguageContextValue {
  const ctx = useContext(LanguageContext);
  if (!ctx) {
    throw new Error('useLanguage must be used inside <LanguageProvider>');
  }
  return ctx;
}

/** Convenience hook — returns just the `t` function. */
export function useT() {
  return useLanguage().t;
}
