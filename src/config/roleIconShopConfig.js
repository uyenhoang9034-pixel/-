import path from 'path';

export const ROLE_ICON_DONOR_ROLE_ID = '1568129166979764244';

export const ROLE_ICON_EMOJIS = {
  headerLeft: '<a:trangtrig50:1567818385306165301>',
  headerRight: '<a:trangtrig51:1567818549794439229>',
  welcome: '<a:trangtrig57:1567819726371946578>',
  ruleTitle: '<a:trangtrig59:1567821308077539341>',
  bullet: '<a:trangtrig58:1567821225282244648>',
  warning: '<a:trangtrig49:1567818140375851018>',
  button: '<a:trangtrig56:1567819562320134234>',
  menuSpark: '<a:trangtrig18:1546068102817775626>',
  crown: '<a:trangtrig14:1546047912969113622>',
  roleIdTag: '<a:trangtrig27:1546093546178748426>',
  roleEmojiTag: '<a:trangtrig29:1546385117478527016>',
  cmdTag: '<a:trangtrig30:1546905942476464178>',
  success: '<a:trangtrig38:1547237720332439574>',
  error: '<a:bang3:1546891744237461635>',
  info: '<a:trangtrig2:1546040703375904801>',
  usagi: '<:usagi9:1541422359960092813>',
};

export const ROLE_ICON_ITEMS = [
  {
    id: 1,
    padId: '01',
    name: 'Rune Affinity',
    roleId: '1568133464891588709',
    emoji: '<:roleicon1:1568117364858421329>',
    emojiName: 'roleicon1',
    emojiId: '1568117364858421329',
    price: 100000,
    isSpecial: true,
    file: 'roleicon1.png',
  },
  {
    id: 2,
    padId: '02',
    name: 'Sigil Resonance',
    roleId: '1568134048537256121',
    emoji: '<:roleicon2:1568121378388054036>',
    emojiName: 'roleicon2',
    emojiId: '1568121378388054036',
    price: 20000,
    isSpecial: false,
    file: 'roleicon2.png',
  },
  {
    id: 3,
    padId: '03',
    name: 'Arcane Imprint',
    roleId: '1568134162798346311',
    emoji: '<:roleicon3:1568121424076603554>',
    emojiName: 'roleicon3',
    emojiId: '1568121424076603554',
    price: 20000,
    isSpecial: false,
    file: 'roleicon3.png',
  },
  {
    id: 4,
    padId: '04',
    name: 'Crest Synergy',
    roleId: '1568134233967427676',
    emoji: '<:roleicon4:1568121580255576126>',
    emojiName: 'roleicon4',
    emojiId: '1568121580255576126',
    price: 20000,
    isSpecial: false,
    file: 'roleicon4.png',
  },
  {
    id: 5,
    padId: '05',
    name: 'Mystic Bond',
    roleId: '1568134318449102920',
    emoji: '<:roleicon5:1568122698612080821>',
    emojiName: 'roleicon5',
    emojiId: '1568122698612080821',
    price: 20000,
    isSpecial: false,
    file: 'roleicon5.png',
  },
  {
    id: 6,
    padId: '06',
    name: 'Glyph Attunement',
    roleId: '1568134889235026010',
    emoji: '<:roleicon6:1568122750441234472>',
    emojiName: 'roleicon6',
    emojiId: '1568122750441234472',
    price: 20000,
    isSpecial: false,
    file: 'roleicon6.png',
  },
  {
    id: 7,
    padId: '07',
    name: 'Astral Ward',
    roleId: '1568134902346547301',
    emoji: '<:roleicon7:1568123004276449331>',
    emojiName: 'roleicon7',
    emojiId: '1568123004276449331',
    price: 20000,
    isSpecial: false,
    file: 'roleicon7.png',
  },
  {
    id: 8,
    padId: '08',
    name: 'Cipher Echo',
    roleId: '1568135072727703632',
    emoji: '<:roleicon8:1568124305127112714>',
    emojiName: 'roleicon8',
    emojiId: '1568124305127112714',
    price: 20000,
    isSpecial: false,
    file: 'roleicon8.png',
  },
  {
    id: 9,
    padId: '09',
    name: 'Relic Harmony',
    roleId: '1568135172178845786',
    emoji: '<:roleicon9:1568124665577082970>',
    emojiName: 'roleicon9',
    emojiId: '1568124665577082970',
    price: 20000,
    isSpecial: false,
    file: 'roleicon9.png',
  },
  {
    id: 10,
    padId: '10',
    name: 'Emblem Essence',
    roleId: '1568135455264743535',
    emoji: '<:roleicon10:1568125663762845836>',
    emojiName: 'roleicon10',
    emojiId: '1568125663762845836',
    price: 20000,
    isSpecial: false,
    file: 'roleicon10.png',
  },
];

export const ALL_ROLE_ICON_ROLE_IDS = ROLE_ICON_ITEMS.map((item) => item.roleId);

export function getRoleIconAssetPath(fileName) {
  return path.resolve(process.cwd(), 'assets', 'roleicon', fileName);
}

export function getRoleIconById(id) {
  const num = parseInt(id, 10);
  return ROLE_ICON_ITEMS.find((item) => item.id === num) || null;
}

export function parseRoleIconInput(input) {
  if (!input) return null;
  const raw = String(input).trim();

  // Match emoji ID directly (e.g. <:roleicon1:1568117364858421329>)
  const emojiIdMatch = raw.match(/<a?:[a-zA-Z0-9_]+:(\d+)>/);
  if (emojiIdMatch) {
    const found = ROLE_ICON_ITEMS.find((item) => item.emojiId === emojiIdMatch[1]);
    if (found) return found;
  }

  // Match emoji name directly (e.g. roleicon1, roleicon10)
  const nameMatch = raw.match(/\+?(?:roleicon)?(\d{1,2})/i);
  if (nameMatch) {
    const num = parseInt(nameMatch[1], 10);
    const found = ROLE_ICON_ITEMS.find((item) => item.id === num);
    if (found) return found;
  }

  // Match by item title (case-insensitive)
  const clean = raw.toLowerCase().replace(/[^a-z0-9]/g, '');
  const titleFound = ROLE_ICON_ITEMS.find((item) => {
    const itemClean = item.name.toLowerCase().replace(/[^a-z0-9]/g, '');
    return itemClean.includes(clean) || clean.includes(itemClean);
  });
  if (titleFound) return titleFound;

  return null;
}
