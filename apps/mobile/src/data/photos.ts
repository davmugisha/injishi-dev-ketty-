/**
 * GENERATED FILE — do not edit by hand.
 *
 * Written by `scripts/import-photos.mjs`. Every entry has a licence row in
 * `./photo-credits`, because the script walks the manifest rather than the
 * folder — see that file's header.
 *
 * `placeholder` is the photograph's own average colour, sampled at import.
 * `expo-image` paints it while the file decodes, so a card fills with the
 * picture's own tone instead of flashing grey. **It is the one hex in `src/`
 * that is not a palette key, and it is not a design decision** — it is derived
 * from the photograph and could not come from the palette if it tried. No
 * screen or component may write one; they read it from here.
 */
import type { ImageSourcePropType } from 'react-native';

export interface PhotoAsset {
  source: ImageSourcePropType;
  /** The photograph's average colour. Data, not a token. */
  placeholder: string;
  width: number;
  height: number;
}

export const PHOTOS: Record<string, PhotoAsset> = {
  'akagera-np-01': {
    source: require('../../assets/photos/akagera-np-01.jpg'),
    placeholder: '#96A79E',
    width: 1080,
    height: 717,
  },
  'akagera-np-02': {
    source: require('../../assets/photos/akagera-np-02.jpg'),
    placeholder: '#868A7D',
    width: 1080,
    height: 718,
  },
  'akagera-np-03': {
    source: require('../../assets/photos/akagera-np-03.jpg'),
    placeholder: '#AA9681',
    width: 1080,
    height: 720,
  },
  'karongi-01': {
    source: require('../../assets/photos/karongi-01.jpg'),
    placeholder: '#7F7967',
    width: 1080,
    height: 810,
  },
  'karongi-02': {
    source: require('../../assets/photos/karongi-02.jpg'),
    placeholder: '#858686',
    width: 1080,
    height: 810,
  },
  'kigali-cbd-buildings-01': {
    source: require('../../assets/photos/kigali-cbd-buildings-01.jpg'),
    placeholder: '#768089',
    width: 1080,
    height: 810,
  },
  'kigali-city-street-01': {
    source: require('../../assets/photos/kigali-city-street-01.jpg'),
    placeholder: '#71868C',
    width: 1080,
    height: 743,
  },
  'kigali-convention-centre-02': {
    source: require('../../assets/photos/kigali-convention-centre-02.jpg'),
    placeholder: '#5F695E',
    width: 1080,
    height: 720,
  },
  'kigali-hills-view-01': {
    source: require('../../assets/photos/kigali-hills-view-01.jpg'),
    placeholder: '#7F92A9',
    width: 1080,
    height: 720,
  },
  'kigali-night-panorama-02': {
    source: require('../../assets/photos/kigali-night-panorama-02.jpg'),
    placeholder: '#1A191F',
    width: 1080,
    height: 720,
  },
  'kigali-parliament-aerial-01': {
    source: require('../../assets/photos/kigali-parliament-aerial-01.jpg'),
    placeholder: '#8F8C8D',
    width: 1080,
    height: 518,
  },
  'kigali-skyline-01': {
    source: require('../../assets/photos/kigali-skyline-01.jpg'),
    placeholder: '#ACAEA6',
    width: 1080,
    height: 512,
  },
  'lake-kivu-01': {
    source: require('../../assets/photos/lake-kivu-01.jpg'),
    placeholder: '#97928C',
    width: 1080,
    height: 608,
  },
  'lake-kivu-02': {
    source: require('../../assets/photos/lake-kivu-02.jpg'),
    placeholder: '#3A4047',
    width: 1080,
    height: 608,
  },
  'lake-kivu-03': {
    source: require('../../assets/photos/lake-kivu-03.jpg'),
    placeholder: '#95A7A3',
    width: 1080,
    height: 810,
  },
  'mille-collines-01': {
    source: require('../../assets/photos/mille-collines-01.jpg'),
    placeholder: '#616577',
    width: 1080,
    height: 810,
  },
  'mille-collines-02': {
    source: require('../../assets/photos/mille-collines-02.jpg'),
    placeholder: '#433E44',
    width: 1080,
    height: 810,
  },
  'mountain-gorilla-01': {
    source: require('../../assets/photos/mountain-gorilla-01.jpg'),
    placeholder: '#5E5652',
    width: 1080,
    height: 720,
  },
  'mountain-gorilla-02': {
    source: require('../../assets/photos/mountain-gorilla-02.jpg'),
    placeholder: '#58534E',
    width: 1080,
    height: 540,
  },
  'nyungwe-forest-02': {
    source: require('../../assets/photos/nyungwe-forest-02.jpg'),
    placeholder: '#75868B',
    width: 1080,
    height: 154,
  },
  'nyungwe-forest-03': {
    source: require('../../assets/photos/nyungwe-forest-03.jpg'),
    placeholder: '#5A6A64',
    width: 1080,
    height: 810,
  },
  'rwanda-tea-01': {
    source: require('../../assets/photos/rwanda-tea-01.jpg'),
    placeholder: '#959A96',
    width: 1080,
    height: 720,
  },
  'rwanda-tea-02': {
    source: require('../../assets/photos/rwanda-tea-02.jpg'),
    placeholder: '#8A9483',
    width: 1080,
    height: 720,
  },
  'volcanoes-np-02': {
    source: require('../../assets/photos/volcanoes-np-02.jpg'),
    placeholder: '#9EAC81',
    width: 1080,
    height: 720,
  },
  'volcanoes-np-03': {
    source: require('../../assets/photos/volcanoes-np-03.jpg'),
    placeholder: '#8BA16C',
    width: 1080,
    height: 720,
  },
};

export type PhotoStem = keyof typeof PHOTOS;

export const PHOTO_STEMS = Object.keys(PHOTOS);

export function photo(stem: string): PhotoAsset | undefined {
  return PHOTOS[stem];
}
