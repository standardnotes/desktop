import buildEditorContextMenu from 'electron-editor-context-menu';
import { Store, StoreKeys } from './store';
import { isMac } from './platforms';

function log(...message: any) {
  console.log('spellcheckerMaager:', ...message);
}

function initializeContextMenuListener(webContents: Electron.WebContents) {
  webContents.on('context-menu', (_event, params) => {
    /** Only show a context menu on editable items. */
    if (!params.isEditable) return;
    const menu = buildEditorContextMenu({
      isMisspelled: params.misspelledWord.length > 0,
      spellingSuggestions: params.dictionarySuggestions
    });
    menu.popup();
  });
}

export interface SpellcheckerManager {
  languages(): Array<{
    code: string;
    name: string;
    enabled: boolean;
  }>;
  addLanguage(code: string): void;
  removeLanguage(code: string): void;
}

/**
 * @param userLocale the current locale
 * @returns `null` if we're on MacOS.
 */
export function createSpellcheckerManager(
  store: Store,
  webContents: Electron.WebContents,
  userLocale: string
): SpellcheckerManager | null {
  initializeContextMenuListener(webContents);

  /**
   * On MacOS the system spellchecker is used and every related Electron method
   * is a no-op. Return early to prevent unnecessary code execution/allocations
   */
  if (isMac) return null;

  const session = webContents.session;

  /**
   * Mapping of language codes predominantly based on
   * https://en.wikipedia.org/wiki/List_of_ISO_639-1_codes
   */
  const LanguageCodes: Readonly<Record<string, string | undefined>> = {
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

  setSpellcheckerLanguages();

  function setSpellcheckerLanguages() {
    const { session } = webContents;
    let selectedCodes = store.get(StoreKeys.SelectedSpellCheckerLanguageCodes);

    if (selectedCodes === null) {
      /** First-time setup or corrupted data. Set a default language */
      selectedCodes = determineDefaultSpellcheckerLanguageCodes(
        session.availableSpellCheckerLanguages,
        userLocale
      );
      store.set(StoreKeys.SelectedSpellCheckerLanguageCodes, selectedCodes);
    } else {
      /**
       * Vet the codes. If for some reason (like data corruption) there is
       * an unsupported code, remove it from the list.
       */
      const modified = deleteUnknownCodes(selectedCodes);
      if (modified) {
        store.set(StoreKeys.SelectedSpellCheckerLanguageCodes, selectedCodes);
      }
    }
    session.setSpellCheckerLanguages([...selectedCodes]);
  }

  function determineDefaultSpellcheckerLanguageCodes(
    availableSpellCheckerLanguages: string[],
    userLocale: string
  ): Set<string> {
    const localeIsSupported = availableSpellCheckerLanguages.includes(
      userLocale
    );
    if (localeIsSupported) {
      return new Set([userLocale]);
    } else {
      log(`Spellchecker doesn't support locale '${userLocale}'.`);
      return new Set();
    }
  }

  /**
   * @returns true if the set was modified, false otherwise
   */
  function deleteUnknownCodes(codes: Set<string>): boolean {
    let modified = false;
    for (const code of codes) {
      if (!LanguageCodes[code]) {
        codes.delete(code);
        modified = true;
      }
    }
    return modified;
  }

  function selectedLanguageCodes(): Set<string> {
    return store.get(StoreKeys.SelectedSpellCheckerLanguageCodes) || new Set();
  }

  if (process.env.NODE_ENV === 'development') {
    /** Make sure every available language is accounted for. */
    for (const code of session.availableSpellCheckerLanguages) {
      if (!(code in LanguageCodes)) {
        throw new Error(`Found unsupported language code: ${code}`);
      }
    }
  }
  /**
   * All the available spellchecker language codes,
   * sorted by their actual names. We use `!` knowing that we've already checked
   * for unknown languages in `session.availableSpellCheckerLanguages`
   */
  const availableLanguageCodes = session.availableSpellCheckerLanguages.sort(
    (code1, code2) => LanguageCodes[code1]!.localeCompare(LanguageCodes[code2]!)
  );

  return {
    languages() {
      const codes = selectedLanguageCodes();
      return availableLanguageCodes.map(code => ({
        code,
        /**
         * We use `!` here knowing that availableLanguageCodes
         * has already been vetted.
         */
        name: LanguageCodes[code]!,
        enabled: codes.has(code)
      }));
    },
    addLanguage(code: string) {
      const selectedCodes = selectedLanguageCodes();
      selectedCodes.add(code);
      store.set(StoreKeys.SelectedSpellCheckerLanguageCodes, selectedCodes);
      session.setSpellCheckerLanguages(Array.from(selectedCodes));
    },
    removeLanguage(code: string) {
      const selectedCodes = selectedLanguageCodes();
      selectedCodes.delete(code);
      store.set(StoreKeys.SelectedSpellCheckerLanguageCodes, selectedCodes);
      session.setSpellCheckerLanguages(Array.from(selectedCodes));
    }
  };
}
