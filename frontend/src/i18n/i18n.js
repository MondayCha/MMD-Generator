import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import intlMessagesZH from '@i18n/locales/zh.json';
import intlMessagesEN from '@i18n/locales/en.json';
import appConfig from '@config/app.config';

// the translations
// (tip move them in a JSON file and import them,
// or even better, manage them separated from your code: https://react.i18next.com/guides/multiple-translation-files)
const resources = {
  en: {
    translation: intlMessagesEN,
  },
  zh: {
    translation: intlMessagesZH,
  },
};

i18n.use(initReactI18next).init({
  resources,
  lng: localStorage.getItem(appConfig.local_storage.locale) ?? appConfig.locale.default_locale,
  fallbackLng: appConfig.locale.default_locale,
});

export default i18n;
