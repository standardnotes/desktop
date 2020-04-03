import { Strings } from './types';
import { createEnglishStrings } from './english';
import { isDev } from '../utils';

export function createFrenchStrings(): Strings {
  const fallback = createEnglishStrings();
  if (isDev()) {
    /**
     * Le Français est une langue expérimentale.
     * Don't show it in production yet.
     */
    return fallback;
  }
  return {
    appMenu: {
      ...fallback.appMenu,
      edit: 'Édition',
      view: 'Affichage',
    },
    tray: {
      show: 'Afficher',
      hide: 'Masquer',
      quit: 'Quitter'
    },
    extensions: fallback.extensions,
    updates: fallback.updates
  };
}
