/**
 * Brand webfonts, loaded natively via expo-google-fonts.
 * Display serif: Spectral · Everything else (body, money, IDs): Figtree.
 */
// Imported from per-weight subpaths, not the package root. The root index of an
// @expo-google-fonts package `require`s every weight and italic it ships (14
// files each for Spectral and Figtree), and Metro does not tree-shake in dev, so
// the barrel registered 28 font assets for the 6 the app uses. Each one is a
// separate HTTP fetch from the device before the splash can hide.
import { Spectral_500Medium } from '@expo-google-fonts/spectral/500Medium';
import { Spectral_600SemiBold } from '@expo-google-fonts/spectral/600SemiBold';
import { Figtree_400Regular } from '@expo-google-fonts/figtree/400Regular';
import { Figtree_500Medium } from '@expo-google-fonts/figtree/500Medium';
import { Figtree_600SemiBold } from '@expo-google-fonts/figtree/600SemiBold';
import { Figtree_700Bold } from '@expo-google-fonts/figtree/700Bold';

export const fontMap = {
  Spectral_500Medium,
  Spectral_600SemiBold,
  Figtree_400Regular,
  Figtree_500Medium,
  Figtree_600SemiBold,
  Figtree_700Bold,
};
