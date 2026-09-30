/** `checkin` - self check-in and the arrival guide. Session 5 adds here. */

export const en = {
  /* The flow, and its three steps */
  'checkin.title': 'Self check-in',
  'checkin.stepDocument': 'Document',
  'checkin.stepPhoto': 'Photo',
  'checkin.stepAddress': 'Address',
  'checkin.notFoundTitle': 'This check-in is not open',
  'checkin.notFoundBody':
    'Self check-in opens 24 hours before you arrive, at properties that offer it.',
  'checkin.autosaved': 'Saved as you go. You can leave and come back to it.',

  /* Step 1 — the identity document. `IdentityDocumentInput` is the contract */
  'checkin.documentQuestion': 'Which document are you using?',
  'checkin.documentTypeLegend': 'Document type',
  'checkin.docNationalId': 'National ID',
  'checkin.docPassport': 'Passport',
  'checkin.numberLabel': 'Document number',
  'checkin.numberPlaceholderNid': '1 1990 8 0012345 6 78',
  'checkin.numberPlaceholderPassport': 'PC1234567',
  'checkin.numberHelperNid':
    'The 16 digits printed on the card. Spaces are fine — type it as you see it.',
  'checkin.numberHelperPassport': 'As printed on the photo page, without spaces.',
  'checkin.countryLabel': 'Issuing country',
  'checkin.countryHelper': 'The country that issued the passport.',
  'checkin.countryPlaceholder': 'Two-letter code, e.g. KE',
  'checkin.nidIsRwandan': 'A Rwandan National ID is issued in Rwanda, so there is nothing to pick.',
  'checkin.notAnIdentityCheck':
    'This is the number printed on the document. It is not a national identity check.',

  /* Step 2 — the photograph */
  'checkin.photoTitle': 'Photograph the document',
  'checkin.photoBody':
    'Fit the whole document in the frame, flat and in good light. The photo is stored in Rwanda and only the property’s front desk can open it.',
  'checkin.photoHint': 'It leads the check-in',
  'checkin.photoQueue': 'A poor connection is fine — the upload queues and resumes.',
  'checkin.photoUploadNote':
    'The photo is sent when you finish, and kept with your booking until the front desk checks you in.',
  'checkin.sendFailed':
    'We could not send your check-in. Nothing you entered is lost — try again when you have a connection.',

  /* Step 3 — where the guest lives */
  'checkin.addressTitle': 'Where do you live?',
  'checkin.countryOfResidence': 'Country of residence',
  'checkin.streetLabel': 'Street address',
  'checkin.streetPlaceholder': 'KG 11 Ave 24',
  'checkin.districtLabel': 'District',
  'checkin.districtHelper': 'The district you live in, not the one you are travelling to.',
  'checkin.addressTextLabel': 'Address',
  'checkin.addressTextPlaceholder': 'The whole address, as you would write it at home.',
  'checkin.attested':
    'Self check-in is self-attested and is never marked verified. The front desk can verify it on arrival.',

  /* The bar at the foot */
  'checkin.back': 'Back',
  'checkin.continue': 'Continue',
  'checkin.finish': 'Finish check-in',
  'checkin.finishing': 'Checking you in',

  /* Why a step cannot be left. Every disabled control carries its reason */
  'checkin.blockedNumberEmpty': 'Add the number printed on your document.',
  'checkin.blockedNidShape': 'A Rwandan National ID is 16 digits.',
  'checkin.blockedPassportShort': 'That is shorter than any passport number.',
  'checkin.blockedCountry': 'Use the two-letter country code, e.g. KE or UG.',
  'checkin.blockedPhoto': 'Add one photograph of the document.',
  'checkin.blockedStreet': 'Add the street line of where you live.',
  'checkin.blockedDistrict': 'Add the district you live in.',
  'checkin.blockedAddressText': 'Add the address where you live.',

  /* What it says when it lands */
  'checkin.doneToast': 'You are checked in — the arrival guide is open',
  'checkin.reviewTitle': 'Ready to check in',
  'checkin.reviewBody': 'Everything below goes to {property}. Nothing else is shared.',

  /* The arrival guide (F-B18) */
  'checkin.guideTitle': 'Arrival guide',
  'checkin.guideSubtitle': '{property} · {dates}',
  'checkin.guideLockedTitle': 'The arrival guide is still locked',
  'checkin.guideLockedBody': 'It opens the moment you are checked in.',
  'checkin.guideWifi': 'Wifi',
  'checkin.guideNetwork': 'Network',
  'checkin.guidePassword': 'Password',
  'checkin.guideAccess': 'Getting in',
  'checkin.guideCode': 'Door code',
  'checkin.guideDirections': 'Directions',
  'checkin.guideRules': 'House rules',
  'checkin.guideCheckOut': 'Check out by {time} on {day}.',
  'checkin.guideCopy': 'Copy {label}',
  'checkin.guideCopied': '{label} copied',
  'checkin.guideCopyFailed': 'Could not copy. Press and hold to select it instead.',
  'checkin.guideHelp': 'Anything wrong? Message the property and they will sort it.',
} as const;

/**
 * Parity is a type error here, not a review note: `rw` is keyed off this
 * file's own `en`, so a key added to one and not the other fails `tsc` in
 * this file rather than in the merge.
 */
export const rw: Record<keyof typeof en, string> = {
  'checkin.title': 'Kwinjira wenyine',
  'checkin.stepDocument': 'Icyangombwa',
  'checkin.stepPhoto': 'Ifoto',
  'checkin.stepAddress': 'Aderesi',
  'checkin.notFoundTitle': 'Uku kwinjira ntikurafunguka',
  'checkin.notFoundBody':
    'Kwinjira wenyine bifungurwa amasaha 24 mbere yo kugera, ahantu hemera ubwo buryo.',
  'checkin.autosaved': 'Bibikwa uko ugenda. Urashobora kuva hano ugataha ukagaruka.',

  'checkin.documentQuestion': 'Ni icyangombwa ki urimo gukoresha?',
  'checkin.documentTypeLegend': 'Ubwoko bw’icyangombwa',
  'checkin.docNationalId': 'Indangamuntu',
  'checkin.docPassport': 'Pasiporo',
  'checkin.numberLabel': 'Nomero y’icyangombwa',
  'checkin.numberPlaceholderNid': '1 1990 8 0012345 6 78',
  'checkin.numberPlaceholderPassport': 'PC1234567',
  'checkin.numberHelperNid':
    'Imibare 16 yanditse ku ikarita. Uduce twagati ntacyo tutwaye — andika nk’uko ubibona.',
  'checkin.numberHelperPassport': 'Nk’uko byanditse ku ipaji y’ifoto, nta twanya.',
  'checkin.countryLabel': 'Igihugu cyayitanze',
  'checkin.countryHelper': 'Igihugu cyatanze pasiporo.',
  'checkin.countryPlaceholder': 'Inyuguti ebyiri, urugero KE',
  'checkin.nidIsRwandan': 'Indangamuntu y’u Rwanda itangwa mu Rwanda, nta cyo gutoranya.',
  'checkin.notAnIdentityCheck':
    'Iyi ni nomero yanditse ku cyangombwa. Si igenzura ry’irangamuntu.',

  'checkin.photoTitle': 'Fata ifoto y’icyangombwa',
  'checkin.photoBody':
    'Shyira icyangombwa cyose mu ikadiri, kirambitse ahantu hamurika. Ifoto ibikwa mu Rwanda kandi ni abakozi bo ku biro bonyine bashobora kuyifungura.',
  'checkin.photoHint': 'Ni yo ibanza mu kwinjira',
  'checkin.photoQueue': 'Umurongo muke ntacyo utwaye — kohereza birategereza bikongera bigakomeza.',
  'checkin.photoUploadNote':
    'Ifoto yoherezwa igihe urangije, ikabikwa hamwe n’ibyo wabitse kugeza abakozi bo ku biro bakwakiriye.',
  'checkin.sendFailed':
    'Ntitwashoboye kohereza ibyo wujuje. Nta cyo wanditse cyatakaye — ongera ugerageze ukibona interineti.',

  'checkin.addressTitle': 'Utuye he?',
  'checkin.countryOfResidence': 'Igihugu utuyemo',
  'checkin.streetLabel': 'Umuhanda n’inomero',
  'checkin.streetPlaceholder': 'KG 11 Ave 24',
  'checkin.districtLabel': 'Akarere',
  'checkin.districtHelper': 'Akarere utuyemo, si ako ugiyemo.',
  'checkin.addressTextLabel': 'Aderesi',
  'checkin.addressTextPlaceholder': 'Aderesi yose, nk’uko wayandika iwanyu.',
  'checkin.attested':
    'Kwinjira wenyine ni ukwiyemerera, ntibigira icyemezo. Abakozi bo ku biro bashobora kubigenzura ugeze.',

  'checkin.back': 'Subira inyuma',
  'checkin.continue': 'Komeza',
  'checkin.finish': 'Rangiza kwinjira',
  'checkin.finishing': 'Turimo kukwinjiza',

  'checkin.blockedNumberEmpty': 'Andika nomero yanditse ku cyangombwa cyawe.',
  'checkin.blockedNidShape': 'Indangamuntu y’u Rwanda igizwe n’imibare 16.',
  'checkin.blockedPassportShort': 'Iyo ni ngufi ugereranyije na nomero ya pasiporo iyo ari yo yose.',
  'checkin.blockedCountry': 'Koresha inyuguti ebyiri z’igihugu, urugero KE cyangwa UG.',
  'checkin.blockedPhoto': 'Ongeraho ifoto imwe y’icyangombwa.',
  'checkin.blockedStreet': 'Andika umuhanda utuyeho.',
  'checkin.blockedDistrict': 'Andika akarere utuyemo.',
  'checkin.blockedAddressText': 'Andika aderesi utuyeho.',

  'checkin.doneToast': 'Wamaze kwinjira — ubuyobozi bwo kugera burafunguye',
  'checkin.reviewTitle': 'Witeguye kwinjira',
  'checkin.reviewBody': 'Ibiri hepfo byose bijya kuri {property}. Nta kindi gisangirwa.',

  'checkin.guideTitle': 'Ubuyobozi bwo kugera',
  'checkin.guideSubtitle': '{property} · {dates}',
  'checkin.guideLockedTitle': 'Ubuyobozi bwo kugera buracyafunze',
  'checkin.guideLockedBody': 'Bufungurwa ako kanya umaze kwinjira.',
  'checkin.guideWifi': 'Wifi',
  'checkin.guideNetwork': 'Izina rya rezo',
  'checkin.guidePassword': 'Ijambobanga',
  'checkin.guideAccess': 'Uko winjira',
  'checkin.guideCode': 'Kode y’urugi',
  'checkin.guideDirections': 'Inzira',
  'checkin.guideRules': 'Amategeko y’inzu',
  'checkin.guideCheckOut': 'Sohoka mbere ya saa {time} ku wa {day}.',
  'checkin.guideCopy': 'Koporora {label}',
  'checkin.guideCopied': '{label} yakoporowe',
  'checkin.guideCopyFailed': 'Ntibyashobotse gukopora. Kanda utegereze kugira ngo uyitoranye.',
  'checkin.guideHelp': 'Hari ikitagenda? Andikira aho uraramo barabikemura.',
};
