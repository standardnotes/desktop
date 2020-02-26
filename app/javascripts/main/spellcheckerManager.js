import { StoreKeys } from './store';
import buildEditorContextMenu from 'electron-editor-context-menu';

function initializeContextMenuListener(webContents) {
  webContents.on('context-menu', (_event, params) => {
    /** Only show a context menu on editable items. */
    if (!params.isEditable) return;
    const menu = buildEditorContextMenu({
      isMisspelled: params.misspelledWord.length > 0,
      spellingSuggestions: params.dictionarySuggestions
    });
    menu.popup({ window: webContents });
  });
}

/**
 * @param {Store} store
 * @param {Electron.WebContents} webContents
 * @param {string} userLocale the current locale
 */
export function createSpellcheckerManager(store, webContents, userLocale) {
  initializeContextMenuListener(webContents);

  /**
   * On MacOS the system spellchecker is used and every related Electron method
   * is a no-op. Return early to prevent unnecessary code execution/allocation
   */
  /** TODO(baptiste): precompute `process.platform` at compile-time */
  if (process.platform === 'darwin') return;

  const { session } = webContents;

  /**
   * Mapping of language codes predominantly based on
   * https://en.wikipedia.org/wiki/List_of_ISO_639-1_codes
   */
  const LanguageCodes = {
    af: 'Afrikaans' /** Afrikaans */,
    id: 'Bahasa Indonesia' /** Indonesian */,
    ca: 'Català, Valencià' /** Catalan, Valencian */,
    cs: 'Čeština, Český Jazyk' /** Czech */,
    cy: 'Cymraeg' /** Welsh */,
    da: 'Dansk' /** Danish */,
    de: 'Deutsch' /** German */,
    sh: 'Deutsch, Schaffhausen' /** German, Canton of Schaffhausen */,
    et: 'Eesti, Eesti Keel' /** Estonian */,
    'en-AU': 'English, Australia',
    'en-CA': 'English, Canada',
    'en-GB': 'English, Great Britain',
    'en-US': 'English, United States',
    es: 'Español' /** Spanish, Castilian */,
    'es-419': 'Español, America Latina' /** Spanish, Latin American */,
    'es-ES': 'Español, España' /** Spanish, Spain */,
    'es-US': 'Español, Estados Unidos de América' /** Spanish, United States */,
    'es-MX': 'Español, Estados Unidos Mexicanos' /** Spanish, Mexico */,
    'es-AR': 'Español, República Argentina' /** Spanish, Argentine Republic */,
    fo: 'Føroyskt' /** Faroese */,
    fr: 'Français' /** French */,
    hr: 'Hrvatski Jezik' /** Croatian */,
    it: 'Italiano' /** Italian */,
    pl: 'Język Polski, Polszczyzna' /** Polish */,
    lv: 'Latviešu Valoda' /** Latvian */,
    lt: 'Lietuvių Kalba' /** Lithuanian */,
    hu: 'Magyar' /** Hungarian */,
    nl: 'Nederlands, Vlaams' /** Dutch, Flemish */,
    nb: 'Norsk Bokmål' /** Norwegian Bokmål */,
    'pt-BR': 'Português, Brasil' /** Portuguese, Brazil */,
    'pt-PT': 'Português, República Portuguesa' /** Portuguese, Portugal */,
    ro: 'Română' /** Romanian, Moldavian, Moldovan */,
    sq: 'Shqip' /** Albanian */,
    sk: 'Slovenčina, Slovenský Jazyk' /** Slovak */,
    sl: 'Slovenski Jezik, Slovenščina' /** Slovenian */,
    sv: 'Svenska' /** Swedish */,
    vi: 'Tiếng Việt' /** Vietnamese */,
    tr: 'Türkçe' /** Turkish */,
    el: 'ελληνικά' /** Greek */,
    bg: 'български език' /** Bulgarian */,
    ru: 'Русский' /** Russian */,
    sr: 'српски језик' /** Serbian */,
    tg: 'тоҷикӣ, toçikī, تاجیکی‎' /** Tajik */,
    uk: 'Українська' /** Ukrainian */,
    hy: 'Հայերեն' /** Armenian */,
    he: 'עברית' /** Hebrew */,
    fa: 'فارسی' /** Persian */,
    hi: 'हिन्दी, हिंदी' /** Hindi */,
    ta: 'தமிழ்' /** Tamil */,
    ko: '한국어' /** Korean */
  };

  /**
   * All the available spellchecker language codes,
   * sorted by their actual names.
   */
  const availableLanguageCodes = session.availableSpellCheckerLanguages.sort(
    (code1, code2) => LanguageCodes[code1].localeCompare(LanguageCodes[code2])
  );

  setSpellcheckerLanguages();

  function setSpellcheckerLanguages() {
    const { session } = webContents;
    let selectedCodes = selectedLanguageCodes();

    if (selectedCodes instanceof Set) {
      /**
       * Vet the codes. If for some reason (like data corruption) there is
       * an unsupported code, remove it from the list.
       */
      const modified = deleteUnknownCodes(selectedCodes);
      if (modified) {
        store.set(StoreKeys.SelectedSpellCheckerLanguageCodes, selectedCodes);
      }
    } else {
      /** First-time setup or corrupted data. Set a default language */
      selectedCodes = determineDefaultSpellcheckerLanguageCodes(
        session.availableSpellCheckerLanguages,
        userLocale
      );
      store.set(StoreKeys.SelectedSpellCheckerLanguageCodes, selectedCodes);
    }
    session.setSpellCheckerLanguages([...selectedCodes]);
  }

  /**
   * @param {Array<String>} availableSpellCheckerLanguages
   * @param {String} userLocale
   * @returns {Set<String>}
   */
  function determineDefaultSpellcheckerLanguageCodes(
    availableSpellCheckerLanguages,
    userLocale
  ) {
    const localeIsSupported = availableSpellCheckerLanguages.includes(
      userLocale
    );
    if (localeIsSupported) {
      return new Set([userLocale]);
    } else {
      console.log(`Spellchecker doesn't support locale '${userLocale}'.`);
      return new Set();
    }
  }

  /**
   * @param {Set<String>} codes
   * @returns {boolean} true if the set was modified, false otherwise
   */
  function deleteUnknownCodes(codes) {
    let modified = false;
    for (const code of codes) {
      if (!LanguageCodes[code]) {
        codes.delete(code);
        modified = true;
      }
    }
    return modified;
  }

  /**
   * @returns {Set<String> | null}
   */
  function selectedLanguageCodes() {
    return store.get(StoreKeys.SelectedSpellCheckerLanguageCodes);
  }

  return {
    languages() {
      const codes = selectedLanguageCodes();
      return availableLanguageCodes.map(code => ({
        code,
        name: LanguageCodes[code],
        enabled: codes.has(code)
      }));
    },
    addLanguage(code) {
      const selectedCodes = selectedLanguageCodes();
      selectedCodes.add(code);
      store.set(StoreKeys.SelectedSpellCheckerLanguageCodes, selectedCodes);
      session.setSpellCheckerLanguages(Array.from(selectedCodes));
    },
    removeLanguage(code) {
      const selectedCodes = selectedLanguageCodes();
      selectedCodes.delete(code);
      store.set(StoreKeys.SelectedSpellCheckerLanguageCodes, selectedCodes);
      session.setSpellCheckerLanguages(Array.from(selectedCodes));
    }
  };
}
