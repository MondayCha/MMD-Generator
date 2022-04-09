import create from 'flooks';
import appConfig from '@config/app.config';
import i18next from '@i18n/i18n';

const localLocaleTag: string = appConfig.local_storage.locale;

const useFlooksStore = create(({ get, set }) => ({
  localeMode: localStorage.getItem(localLocaleTag) ?? appConfig.locale.default_locale,
  alertCount: 0,
  switchLocaleMode() {
    const { localeMode } = get();
    let newLocale = localeMode === 'en' ? 'zh' : 'en';
    localStorage.setItem(localLocaleTag, newLocale);
    set({ localeMode: newLocale });
    i18next.changeLanguage(newLocale);
  },
  add() {
    const { alertCount } = get();
    set({ alertCount: alertCount + 1 });
  },
}));

export default useFlooksStore;
