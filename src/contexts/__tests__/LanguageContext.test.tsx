import { act, render, renderHook, screen } from '@testing-library/react';
import {
  LANGUAGE_STORAGE_KEY,
  LanguageProvider,
  SUPPORTED_LANGUAGES,
  useLanguage,
  useT,
} from '../LanguageContext';

function wrap(initialLanguage?: 'en' | 'es' | 'fr' | 'pt') {
  return function Wrapper({ children }: { children: React.ReactNode }) {
    return (
      <LanguageProvider initialLanguage={initialLanguage}>{children}</LanguageProvider>
    );
  };
}

describe('LanguageContext (#95)', () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  it('exposes the four supported languages', () => {
    expect(SUPPORTED_LANGUAGES).toEqual(['en', 'es', 'fr', 'pt']);
  });

  it('defaults to English when no preference is stored', () => {
    const { result } = renderHook(() => useLanguage(), { wrapper: wrap() });
    expect(result.current.language).toBe('en');
    expect(result.current.t('history.title')).toBe('Transaction History');
  });

  it('hydrates from a previously persisted preference', () => {
    window.localStorage.setItem(LANGUAGE_STORAGE_KEY, 'es');
    const { result } = renderHook(() => useLanguage(), { wrapper: wrap() });
    expect(result.current.language).toBe('es');
    expect(result.current.t('history.title')).toBe('Historial de transacciones');
  });

  it('persists language changes to localStorage', () => {
    const { result } = renderHook(() => useLanguage(), { wrapper: wrap('en') });
    act(() => result.current.setLanguage('fr'));
    expect(result.current.language).toBe('fr');
    expect(window.localStorage.getItem(LANGUAGE_STORAGE_KEY)).toBe('fr');
    expect(result.current.t('history.title')).toBe('Historique des transactions');
  });

  it('updates the html lang attribute when language changes', () => {
    const { result } = renderHook(() => useLanguage(), { wrapper: wrap('en') });
    act(() => result.current.setLanguage('pt'));
    expect(document.documentElement.getAttribute('lang')).toBe('pt');
  });

  it('falls back through English then to the raw key when a translation is missing', () => {
    const { result } = renderHook(() => useLanguage(), { wrapper: wrap('es') });
    // 'app.name' has the same value across all dictionaries
    expect(result.current.t('app.name')).toBe('SwiftSend');
    // Unknown key returns itself instead of empty string
    expect(result.current.t('this.key.does.not.exist')).toBe(
      'this.key.does.not.exist',
    );
  });

  it('rejects unsupported language codes silently', () => {
    const { result } = renderHook(() => useLanguage(), { wrapper: wrap('en') });
    act(() => result.current.setLanguage('xx' as 'en'));
    expect(result.current.language).toBe('en');
  });

  it('useT returns the translator function', () => {
    function Demo() {
      const t = useT();
      return <span data-testid="demo">{t('common.retry')}</span>;
    }
    render(
      <LanguageProvider initialLanguage="es">
        <Demo />
      </LanguageProvider>,
    );
    expect(screen.getByTestId('demo')).toHaveTextContent('Reintentar');
  });

  it('throws a clear error when used outside the provider', () => {
    // Suppress the React error boundary noise for the negative case.
    const spy = jest.spyOn(console, 'error').mockImplementation(() => {});
    expect(() => renderHook(() => useLanguage())).toThrow(
      /must be used inside <LanguageProvider>/,
    );
    spy.mockRestore();
  });
});
