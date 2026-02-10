import React, { createContext, useState, useContext, useEffect } from 'react';
import es from '../locales/es';
import en from '../locales/en';
import zh from '../locales/zh';
import ja from '../locales/ja';

const locales = { es, en, zh, ja };

const I18nContext = createContext();

export const useTranslation = () => {
  const context = useContext(I18nContext);
  if (!context) throw new Error('useTranslation must be used within an I18nProvider');
  return context;
};

export const I18nProvider = ({ children, initialLanguage = 'es' }) => {
  const [language, setLanguage] = useState(initialLanguage);

  // Allow updating initialLanguage when config loads
  useEffect(() => {
    if (initialLanguage && locales[initialLanguage]) {
      setLanguage(initialLanguage);
    }
  }, [initialLanguage]);

  const t = (path, params = {}) => {
    const keys = path.split('.');
    let current = locales[language];
    for (const key of keys) {
      if (current === undefined || current[key] === undefined) {
        // Fallback to Spanish
        let fallback = locales['es'];
        for (const k of keys) {
            if (fallback === undefined || fallback[k] === undefined) return path;
            fallback = fallback[k];
        }
        current = fallback;
        break;
      }
      current = current[key];
    }
    
    // Interpolate parameters
    if (typeof current === 'string' && params) {
      return current.replace(/\{(\w+)\}/g, (match, key) => {
        return params[key] !== undefined ? params[key] : match;
      });
    }
    
    return current;
  };

  const changeLanguage = (lang) => {
    if (locales[lang]) {
      setLanguage(lang);
    }
  };

  return (
    <I18nContext.Provider value={{ t, language, changeLanguage, languages: Object.keys(locales) }}>
      {children}
    </I18nContext.Provider>
  );
};
