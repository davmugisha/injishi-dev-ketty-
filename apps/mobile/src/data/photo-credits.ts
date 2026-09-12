/**
 * GENERATED FILE — do not edit by hand.
 *
 * Written by `scripts/import-photos.mjs` from
 * `apps/web/public/assets/sourced/MANIFEST.json`, which is the licence chain's
 * source of truth. To change a credit, change the manifest and re-run.
 *
 * **Every photograph this app ships has a row here, and nothing ships without
 * one.** That is not a convention, it is the import rule: the script walks the
 * manifest, not the asset folder, so a file with no licence row is never copied
 * in and therefore cannot reach a screen.
 *
 * 22 of the 25 do not show the property they illustrate. They are
 * Rwandan landscape and city photography standing in for stock the project does
 * not hold, and [ADR-015](../../../../injishi.context/dox/adrs) call 5 requires
 * each of them to carry a **visible** credit where it appears — on the screen,
 * not only on a credits page. `PhotoCredit` in `src/components` is what draws
 * it, and `depictsActualProperty` is the flag that decides whether it must.
 *
 * The 23 `stay-NN` tiles in `apps/web/public/assets` are deliberately NOT here.
 * They carry no manifest row, no generated credit row, and no script that emits
 * them; a perceptual comparison against every sourced original found no match,
 * and decoding them shows non-Rwandan stock photography. Their licence cannot
 * be stated, so they are not imported. The reasoning is in the script header.
 */

export interface PhotoCredit {
  /** The file stem, and the key into `PHOTOS`. */
  stem: string;
  subject: string;
  author: string;
  licence: string;
  licenceUrl: string;
  sourceUrl: string;
  /** The full sentence the licence asks to travel with the work. */
  attribution: string;
  attributionRequired: boolean;
  /**
   * Whether this photograph shows the property it illustrates.
   *
   * False means it is a stand-in, and a stand-in owes a visible credit
   * wherever it is drawn — a card that shows one without saying so implies the
   * guest is looking at the place they would book.
   */
  depictsActualProperty: boolean;
}

export const PHOTO_CREDITS: PhotoCredit[] = [
  {
    stem: 'akagera-np-01',
    subject: 'Akagera National Park',
    author: 'Braunov',
    licence: 'CC BY-SA 3.0',
    licenceUrl: 'https://commons.wikimedia.org/wiki/File:Topi_in_Akagera_National_Park.jpg',
    sourceUrl: 'https://commons.wikimedia.org/wiki/File:Topi_in_Akagera_National_Park.jpg',
    attribution: 'Braunov, CC BY-SA 3.0, via Wikimedia Commons',
    attributionRequired: true,
    depictsActualProperty: false,
  },
  {
    stem: 'akagera-np-02',
    subject: 'Akagera National Park',
    author: 'Louis Dewame',
    licence: 'CC BY 3.0',
    licenceUrl: 'https://commons.wikimedia.org/wiki/File:Parc_National_d%27Akagera.jpg',
    sourceUrl: 'https://commons.wikimedia.org/wiki/File:Parc_National_d%27Akagera.jpg',
    attribution: 'Louis Dewame, CC BY 3.0, via Wikimedia Commons',
    attributionRequired: true,
    depictsActualProperty: false,
  },
  {
    stem: 'akagera-np-03',
    subject: 'Akagera National Park',
    author: 'Alex shema',
    licence: 'CC BY-SA 4.0',
    licenceUrl: 'https://commons.wikimedia.org/wiki/File:Akagera_National_Park_Giraffes.jpg',
    sourceUrl: 'https://commons.wikimedia.org/wiki/File:Akagera_National_Park_Giraffes.jpg',
    attribution: 'Alex shema, CC BY-SA 4.0, via Wikimedia Commons',
    attributionRequired: true,
    depictsActualProperty: false,
  },
  {
    stem: 'karongi-01',
    subject: 'Karongi (Kibuye)',
    author: 'Adam Jones, Ph.D.',
    licence: 'CC BY-SA 3.0',
    licenceUrl: 'https://commons.wikimedia.org/wiki/File:Shore_of_Lake_Kivu_-_Karongi-Kibuye_-_Western_Rwanda_-_01.jpg',
    sourceUrl: 'https://commons.wikimedia.org/wiki/File:Shore_of_Lake_Kivu_-_Karongi-Kibuye_-_Western_Rwanda_-_01.jpg',
    attribution: 'Adam Jones, Ph.D., CC BY-SA 3.0, via Wikimedia Commons',
    attributionRequired: true,
    depictsActualProperty: false,
  },
  {
    stem: 'karongi-02',
    subject: 'Karongi (Kibuye)',
    author: 'Adam Jones, Ph.D.',
    licence: 'CC BY-SA 3.0',
    licenceUrl: 'https://commons.wikimedia.org/wiki/File:Shore_of_Lake_Kivu_-_Karongi-Kibuye_-_Western_Rwanda_-_02.jpg',
    sourceUrl: 'https://commons.wikimedia.org/wiki/File:Shore_of_Lake_Kivu_-_Karongi-Kibuye_-_Western_Rwanda_-_02.jpg',
    attribution: 'Adam Jones, Ph.D., CC BY-SA 3.0, via Wikimedia Commons',
    attributionRequired: true,
    depictsActualProperty: false,
  },
  {
    stem: 'kigali-cbd-buildings-01',
    subject: 'Buildings in Kigali central business district',
    author: 'Schlawgclart',
    licence: 'CC0',
    licenceUrl: 'http://creativecommons.org/publicdomain/zero/1.0/deed.en',
    sourceUrl: 'https://commons.wikimedia.org/wiki/File:Buildings_in_Kigali_CBD,_Rwanda.jpg',
    attribution: '"Buildings in Kigali CBD, Rwanda" via Wikimedia Commons (CC0) — credit appreciated but not required.',
    attributionRequired: false,
    depictsActualProperty: false,
  },
  {
    stem: 'kigali-city-street-01',
    subject: 'High angle view of a Kigali city street',
    author: 'Emmanuelkwizera',
    licence: 'CC BY-SA 4.0',
    licenceUrl: 'https://creativecommons.org/licenses/by-sa/4.0',
    sourceUrl: 'https://commons.wikimedia.org/wiki/File:High_Angle_View_Of_Kigali_City_Street_on_November_29,_2018._Emmanuel_Kwizera.jpg',
    attribution: '"High Angle View Of Kigali City Street on November 29, 2018. Emmanuel Kwizera" by Emmanuelkwizera, via Wikimedia Commons, licensed under CC BY-SA 4.0. https://creativecommons.org/licenses/by-sa/4.0',
    attributionRequired: true,
    depictsActualProperty: false,
  },
  {
    stem: 'kigali-convention-centre-02',
    subject: 'Kigali Convention Centre — the Radisson Blu site',
    author: 'Emmanuelkwizera',
    licence: 'CC BY-SA 4.0',
    licenceUrl: 'https://commons.wikimedia.org/wiki/File:An_aerial_of_Kigali_Convention_Center_on_June_19,_2019._Photo_by_Emmanuel_Kwizera.jpg',
    sourceUrl: 'https://commons.wikimedia.org/wiki/File:An_aerial_of_Kigali_Convention_Center_on_June_19,_2019._Photo_by_Emmanuel_Kwizera.jpg',
    attribution: 'Emmanuelkwizera, CC BY-SA 4.0, via Wikimedia Commons',
    attributionRequired: true,
    depictsActualProperty: true,
  },
  {
    stem: 'kigali-hills-view-01',
    subject: 'View over the hills of Kigali',
    author: 'Jenny Paul',
    licence: 'CC BY-SA 4.0',
    licenceUrl: 'https://creativecommons.org/licenses/by-sa/4.0',
    sourceUrl: 'https://commons.wikimedia.org/wiki/File:View_of_Kigali.jpg',
    attribution: '"View of Kigali" by Jenny Paul, via Wikimedia Commons, licensed under CC BY-SA 4.0. https://creativecommons.org/licenses/by-sa/4.0',
    attributionRequired: true,
    depictsActualProperty: false,
  },
  {
    stem: 'kigali-night-panorama-02',
    subject: 'Kigali city panorama at night',
    author: 'Adoscam',
    licence: 'CC BY-SA 4.0',
    licenceUrl: 'https://creativecommons.org/licenses/by-sa/4.0',
    sourceUrl: 'https://commons.wikimedia.org/wiki/File:Panoramic_view_of_Kigali_(Rwanda)_at_night_02.jpg',
    attribution: '"Panoramic view of Kigali (Rwanda) at night 02" by Adoscam, via Wikimedia Commons, licensed under CC BY-SA 4.0. https://creativecommons.org/licenses/by-sa/4.0',
    attributionRequired: true,
    depictsActualProperty: false,
  },
  {
    stem: 'kigali-parliament-aerial-01',
    subject: 'Aerial view of Kimihurura, Kigali with the Parliament building',
    author: 'Emmanuelkwizera',
    licence: 'CC BY-SA 4.0',
    licenceUrl: 'https://creativecommons.org/licenses/by-sa/4.0',
    sourceUrl: 'https://commons.wikimedia.org/wiki/File:An_aerial_view_of_new_look_of_Rwanda_Parliament_Building_in_Kimihurura,_Kigali_on_May_16,_2019._Emmanuel_Kwizera.jpg',
    attribution: '"An aerial view of new look of Rwanda Parliament Building in Kimihurura, Kigali on May 16, 2019. Emmanuel Kwizera" by Emmanuelkwizera, via Wikimedia Commons, licensed under CC BY-SA 4.0. https://creativecommons.org/licenses/by-sa/4.0',
    attributionRequired: true,
    depictsActualProperty: false,
  },
  {
    stem: 'kigali-skyline-01',
    subject: 'Kigali skyline seen from Kimihurura',
    author: 'Honeybarger',
    licence: 'CC BY-SA 4.0',
    licenceUrl: 'https://creativecommons.org/licenses/by-sa/4.0',
    sourceUrl: 'https://commons.wikimedia.org/wiki/File:Kigali_skyline.jpg',
    attribution: '"Kigali skyline" by Honeybarger, via Wikimedia Commons, licensed under CC BY-SA 4.0. https://creativecommons.org/licenses/by-sa/4.0',
    attributionRequired: true,
    depictsActualProperty: false,
  },
  {
    stem: 'lake-kivu-01',
    subject: 'Lake Kivu',
    author: 'MuitaHappy',
    licence: 'CC BY-SA 4.0',
    licenceUrl: 'https://commons.wikimedia.org/wiki/File:A_young_man_jogging_on_Lake_Kivu_public_beach.jpg',
    sourceUrl: 'https://commons.wikimedia.org/wiki/File:A_young_man_jogging_on_Lake_Kivu_public_beach.jpg',
    attribution: 'MuitaHappy, CC BY-SA 4.0, via Wikimedia Commons',
    attributionRequired: true,
    depictsActualProperty: false,
  },
  {
    stem: 'lake-kivu-02',
    subject: 'Lake Kivu',
    author: 'MuitaHappy',
    licence: 'CC BY-SA 4.0',
    licenceUrl: 'https://commons.wikimedia.org/wiki/File:Lake_Kivu_beach_featuring_touring_boats.jpg',
    sourceUrl: 'https://commons.wikimedia.org/wiki/File:Lake_Kivu_beach_featuring_touring_boats.jpg',
    attribution: 'MuitaHappy, CC BY-SA 4.0, via Wikimedia Commons',
    attributionRequired: true,
    depictsActualProperty: false,
  },
  {
    stem: 'lake-kivu-03',
    subject: 'Lake Kivu',
    author: 'Hanah136',
    licence: 'CC BY-SA 4.0',
    licenceUrl: 'https://commons.wikimedia.org/wiki/File:Childhood_by_lake_Kivu.jpg',
    sourceUrl: 'https://commons.wikimedia.org/wiki/File:Childhood_by_lake_Kivu.jpg',
    attribution: 'Hanah136, CC BY-SA 4.0, via Wikimedia Commons',
    attributionRequired: true,
    depictsActualProperty: false,
  },
  {
    stem: 'mille-collines-01',
    subject: 'Hôtel des Mille Collines',
    author: 'Adam Jones, Ph.D.',
    licence: 'CC BY-SA 3.0',
    licenceUrl: 'https://commons.wikimedia.org/wiki/File:Facade_of_Hotel_des_Mille_Collines_-_a.k.a._Hotel_Rwanda_-_Kigali_-_Rwanda.jpg',
    sourceUrl: 'https://commons.wikimedia.org/wiki/File:Facade_of_Hotel_des_Mille_Collines_-_a.k.a._Hotel_Rwanda_-_Kigali_-_Rwanda.jpg',
    attribution: 'Adam Jones, Ph.D., CC BY-SA 3.0, via Wikimedia Commons',
    attributionRequired: true,
    depictsActualProperty: true,
  },
  {
    stem: 'mille-collines-02',
    subject: 'Hôtel des Mille Collines',
    author: 'Adam Jones, Ph.D.',
    licence: 'CC BY-SA 3.0',
    licenceUrl: 'https://commons.wikimedia.org/wiki/File:Garden_Bar_of_Hotel_des_Mille_Collines_-_a.k.a._Hotel_Rwanda_-_Kigali_-_Rwanda.jpg',
    sourceUrl: 'https://commons.wikimedia.org/wiki/File:Garden_Bar_of_Hotel_des_Mille_Collines_-_a.k.a._Hotel_Rwanda_-_Kigali_-_Rwanda.jpg',
    attribution: 'Adam Jones, Ph.D., CC BY-SA 3.0, via Wikimedia Commons',
    attributionRequired: true,
    depictsActualProperty: true,
  },
  {
    stem: 'mountain-gorilla-01',
    subject: 'Mountain gorillas, Volcanoes National Park',
    author: 'Charles J. Sharp',
    licence: 'CC BY-SA 4.0',
    licenceUrl: 'https://commons.wikimedia.org/wiki/File:Mountain_gorilla_(Gorilla_beringei_beringei)_10_month_baby.jpg',
    sourceUrl: 'https://commons.wikimedia.org/wiki/File:Mountain_gorilla_(Gorilla_beringei_beringei)_10_month_baby.jpg',
    attribution: 'Charles J. Sharp, CC BY-SA 4.0, via Wikimedia Commons',
    attributionRequired: true,
    depictsActualProperty: false,
  },
  {
    stem: 'mountain-gorilla-02',
    subject: 'Mountain gorillas, Volcanoes National Park',
    author: 'Charles J. Sharp',
    licence: 'CC BY-SA 4.0',
    licenceUrl: 'https://commons.wikimedia.org/wiki/File:Mountain_gorilla_(Gorilla_beringei_beringei)_eyes.jpg',
    sourceUrl: 'https://commons.wikimedia.org/wiki/File:Mountain_gorilla_(Gorilla_beringei_beringei)_eyes.jpg',
    attribution: 'Charles J. Sharp, CC BY-SA 4.0, via Wikimedia Commons',
    attributionRequired: true,
    depictsActualProperty: false,
  },
  {
    stem: 'nyungwe-forest-02',
    subject: 'Nyungwe Forest National Park',
    author: 'Nyungwe_Foprest_panorama.jpg: Guswen derivative work: Jjtkk',
    licence: 'CC BY-SA 3.0',
    licenceUrl: 'https://commons.wikimedia.org/wiki/File:Nyungwe_Forest_banner.jpg',
    sourceUrl: 'https://commons.wikimedia.org/wiki/File:Nyungwe_Forest_banner.jpg',
    attribution: 'Nyungwe_Foprest_panorama.jpg: Guswen derivative work: Jjtkk, CC BY-SA 3.0, via Wikimedia Commons',
    attributionRequired: true,
    depictsActualProperty: false,
  },
  {
    stem: 'nyungwe-forest-03',
    subject: 'Nyungwe Forest National Park',
    author: 'Ivan Mucyo',
    licence: 'CC BY-SA 4.0',
    licenceUrl: 'https://commons.wikimedia.org/wiki/File:Nyungwe_National_Park.jpg',
    sourceUrl: 'https://commons.wikimedia.org/wiki/File:Nyungwe_National_Park.jpg',
    attribution: 'Ivan Mucyo, CC BY-SA 4.0, via Wikimedia Commons',
    attributionRequired: true,
    depictsActualProperty: false,
  },
  {
    stem: 'rwanda-tea-01',
    subject: 'Tea plantations, southern Rwanda',
    author: 'Ivan Mucyo',
    licence: 'CC BY-SA 4.0',
    licenceUrl: 'https://commons.wikimedia.org/wiki/File:Rwandan_Tea.jpg',
    sourceUrl: 'https://commons.wikimedia.org/wiki/File:Rwandan_Tea.jpg',
    attribution: 'Ivan Mucyo, CC BY-SA 4.0, via Wikimedia Commons',
    attributionRequired: true,
    depictsActualProperty: false,
  },
  {
    stem: 'rwanda-tea-02',
    subject: 'Tea plantations, southern Rwanda',
    author: 'Ivan Mucyo',
    licence: 'CC BY-SA 4.0',
    licenceUrl: 'https://commons.wikimedia.org/wiki/File:Rwanda_Tea_Plantations.jpg',
    sourceUrl: 'https://commons.wikimedia.org/wiki/File:Rwanda_Tea_Plantations.jpg',
    attribution: 'Ivan Mucyo, CC BY-SA 4.0, via Wikimedia Commons',
    attributionRequired: true,
    depictsActualProperty: false,
  },
  {
    stem: 'volcanoes-np-02',
    subject: 'Volcanoes National Park',
    author: 'Derek Keats from Johannesburg, South Africa',
    licence: 'CC BY 2.0',
    licenceUrl: 'https://commons.wikimedia.org/wiki/File:Female_Gorilla_in_Rwanda_at_the_Volcanoes_National_Park_(290812727).jpg',
    sourceUrl: 'https://commons.wikimedia.org/wiki/File:Female_Gorilla_in_Rwanda_at_the_Volcanoes_National_Park_(290812727).jpg',
    attribution: 'Derek Keats from Johannesburg, South Africa, CC BY 2.0, via Wikimedia Commons',
    attributionRequired: true,
    depictsActualProperty: false,
  },
  {
    stem: 'volcanoes-np-03',
    subject: 'Volcanoes National Park',
    author: 'Derek Keats from Johannesburg, South Africa',
    licence: 'CC BY 2.0',
    licenceUrl: 'https://commons.wikimedia.org/wiki/File:Ticklish_gorilla_in_Rwanda_at_the_Volcanoes_National_Park_(290811211).jpg',
    sourceUrl: 'https://commons.wikimedia.org/wiki/File:Ticklish_gorilla_in_Rwanda_at_the_Volcanoes_National_Park_(290811211).jpg',
    attribution: 'Derek Keats from Johannesburg, South Africa, CC BY 2.0, via Wikimedia Commons',
    attributionRequired: true,
    depictsActualProperty: false,
  },
];

const BY_STEM = new Map(PHOTO_CREDITS.map((c) => [c.stem, c]));

export function creditFor(stem: string): PhotoCredit | undefined {
  return BY_STEM.get(stem);
}

/** Whether this photograph owes a visible credit where it is drawn. */
export function needsVisibleCredit(stem: string): boolean {
  const credit = BY_STEM.get(stem);
  return credit ? !credit.depictsActualProperty : false;
}
