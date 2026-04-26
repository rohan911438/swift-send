import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Globe } from 'lucide-react';
import {
  LanguageCode,
  SUPPORTED_LANGUAGES,
  useLanguage,
} from '@/contexts/LanguageContext';

const LABEL_KEYS: Record<LanguageCode, string> = {
  en: 'language.english',
  es: 'language.spanish',
  fr: 'language.french',
  pt: 'language.portuguese',
};

/**
 * Language switcher (#95). Drop in anywhere — Settings page, header,
 * onboarding. Reads + writes through `useLanguage`, persists to
 * `localStorage` via the provider.
 */
export function LanguageSwitcher({ className }: { className?: string }) {
  const { language, setLanguage, t } = useLanguage();

  return (
    <div
      className={['flex items-center gap-2', className].filter(Boolean).join(' ')}
      data-testid="language-switcher"
    >
      <Globe className="w-4 h-4 text-muted-foreground" aria-hidden="true" />
      <label className="text-xs text-muted-foreground" htmlFor="language-switcher-select">
        {t('language.label')}
      </label>
      <Select
        value={language}
        onValueChange={(value) => setLanguage(value as LanguageCode)}
      >
        <SelectTrigger
          id="language-switcher-select"
          className="h-8 w-[140px] text-xs"
          data-testid="language-switcher-trigger"
        >
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {SUPPORTED_LANGUAGES.map((code) => (
            <SelectItem key={code} value={code} data-testid={`language-option-${code}`}>
              {t(LABEL_KEYS[code])}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}

export default LanguageSwitcher;
