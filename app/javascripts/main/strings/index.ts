import { createEnglishStrings } from './english';
import { createFrenchStrings } from './french';
import { Strings } from './types';

let strings: Strings;

/**
 * MUST be called (once) before using any other export in this file.
 * @param locale The user's locale
 * @see https://www.electronjs.org/docs/api/locales
 */
export function initializeStrings(locale: string) {
  if (process.env.NODE_ENV === 'development') {
    if (strings) {
      throw new Error('`strings` has already been initialized');
    }
  }
  if (strings) return;
  strings = stringsForLocale(locale);
}

export function s(): Strings {
  if (process.env.NODE_ENV === 'development') {
    if (!strings) {
      throw new Error('tried to access strings before they were initialized.');
    }
  }
  return strings;
}

export function appMenu() {
  return s().appMenu;
}

export function tray() {
  return s().tray;
}

export function extensions() {
  return s().extensions;
}

function stringsForLocale(locale: string): Strings {
  if (locale === 'en' || locale.startsWith('en-')) {
    return createEnglishStrings();
  } else if (locale === 'fr' || locale.startsWith('fr-')) {
    return createFrenchStrings();
  }

  return createEnglishStrings();
}

export const AppName = 'Standard Notes';
