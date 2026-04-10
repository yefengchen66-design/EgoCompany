import { createContext, useContext, useState, useCallback, type ReactNode } from 'react';
import { t as translate, agentName as parseAgentName, deptName as parseDeptName, type Lang, type TranslationKey } from './translations';

interface I18nContextValue {
  lang: Lang;
  setLang: (lang: Lang) => void;
  t: (key: TranslationKey) => string;
  agentName: (fullName: string) => string;
  deptName: (deptId: string) => string;
}

const I18nContext = createContext<I18nContextValue>({
  lang: 'en',
  setLang: () => {},
  t: (key) => key,
  agentName: (n) => n,
  deptName: (id) => id,
});

export function I18nProvider({ children }: { children: ReactNode }) {
  const [lang, setLangState] = useState<Lang>(() => {
    const saved = localStorage.getItem('ego-lang');
    return (saved === 'zh' || saved === 'en') ? saved : 'en';
  });

  const setLang = useCallback((l: Lang) => {
    setLangState(l);
    localStorage.setItem('ego-lang', l);
  }, []);

  const t = useCallback((key: TranslationKey) => translate(key, lang), [lang]);
  const agentName = useCallback((fullName: string) => parseAgentName(fullName, lang), [lang]);
  const deptName = useCallback((deptId: string) => parseDeptName(deptId, lang), [lang]);

  return (
    <I18nContext.Provider value={{ lang, setLang, t, agentName, deptName }}>
      {children}
    </I18nContext.Provider>
  );
}

export function useI18n() {
  return useContext(I18nContext);
}
