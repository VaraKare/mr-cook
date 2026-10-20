import type { AnimalClass } from "../types";

/** Lowercase, strip accents and punctuation, collapse whitespace. */
export function cleanName(raw: string): string {
  return raw
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/['’]/g, "")
    .replace(/[^a-z0-9\s-]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    // Spelling variants that should never split one ingredient into two.
    .replace(/\bchil(e|i)s?\b/g, (m) => (m.endsWith("s") ? "chillies" : "chilli"))
    .replace(/\bchillis\b/g, "chillies")
    .replace(/\byoghurt\b/g, "yogurt")
    .replace(/\bgarbanzo beans?\b/g, "chickpeas");
}

export function slugify(value: string): string {
  return cleanName(value).replace(/\s+/g, "-").replace(/-+/g, "-");
}

export function titleCase(value: string): string {
  return value.replace(/\b([a-z])/g, (c) => c.toUpperCase());
}

/**
 * Synonyms and regional names -> canonical name. Keys and values are already
 * in `cleanName` form. Plural/singular pairs are handled separately.
 */
export const ALIASES: Record<string, string> = {
  cilantro: "coriander",
  "fresh coriander": "coriander",
  "coriander leaves": "coriander",
  "coriander leaf": "coriander",
  scallion: "spring onion",
  scallions: "spring onion",
  "green onion": "spring onion",
  "green onions": "spring onion",
  "garlic clove": "garlic",
  "garlic cloves": "garlic",
  "cloves garlic": "garlic",
  "garlic glove": "garlic",
  "bay leaves": "bay leaf",
  "all purpose flour": "plain flour",
  "all-purpose flour": "plain flour",
  "self raising flour": "self-raising flour",
  "self rising flour": "self-raising flour",
  "self-rising flour": "self-raising flour",
  cornstarch: "cornflour",
  "corn starch": "cornflour",
  eggplant: "aubergine",
  eggplants: "aubergine",
  "egg plant": "aubergine",
  "egg plants": "aubergine",
  aubergines: "aubergine",
  zucchini: "courgette",
  zucchinis: "courgette",
  shrimp: "prawns",
  shrimps: "prawns",
  prawn: "prawns",
  "ground beef": "minced beef",
  "beef mince": "minced beef",
  "lean minced beef": "minced beef",
  "ground pork": "minced pork",
  "pork mince": "minced pork",
  "ground lamb": "minced lamb",
  "lamb mince": "minced lamb",
  "superfine sugar": "caster sugar",
  "powdered sugar": "icing sugar",
  "confectioners sugar": "icing sugar",
  "heavy cream": "double cream",
  "whipping cream": "double cream",
  "light cream": "single cream",
  "baking soda": "bicarbonate of soda",
  "bicarbonate soda": "bicarbonate of soda",
  "natural yogurt": "plain yogurt",
  yogurt: "plain yogurt",
  "sesame seed oil": "sesame oil",
  arugula: "rocket",
  "snow peas": "mangetout",
  rutabaga: "swede",
  beets: "beetroot",
  "red bell pepper": "red pepper",
  "green bell pepper": "green pepper",
  "yellow bell pepper": "yellow pepper",
  "tomato puree": "tomato puree",
  "tomato paste": "tomato puree",
  "gruyere cheese": "gruyere",
  "parmesan cheese": "parmesan",
  "parmigiano reggiano": "parmesan",
  "spring onions": "spring onion",
  "red onions": "red onion",
  onions: "onion",
  eggs: "egg",
  "free-range eggs": "egg",
  "free range eggs": "egg",
  "large eggs": "egg",
  "tomatoes": "tomato",
  potatoes: "potato",
  carrots: "carrot",
  "black pepper corns": "black peppercorns",
  "ground black pepper": "black pepper",
  "freshly ground black pepper": "black pepper",
  "sea salt": "salt",
  "kosher salt": "salt",
  "table salt": "salt",
  "cold water": "water",
  "warm water": "water",
  "hot water": "water",
  "boiling water": "water",
  "ice water": "water",
};

/**
 * Collapse a plural to an existing singular in the vocabulary (and nothing
 * else), so "chicken thighs" and "chicken thigh" become one record without
 * mangling words like "molasses" that have no singular form in the data.
 */
export function singularise(name: string, vocabulary: Set<string>): string {
  const words = name.split(" ");
  const last = words[words.length - 1];
  const stem = words.slice(0, -1);
  const candidates: string[] = [];
  if (last.endsWith("ies")) candidates.push(last.slice(0, -3) + "y");
  if (last.endsWith("oes") || last.endsWith("ches") || last.endsWith("shes")) candidates.push(last.slice(0, -2));
  if (last.endsWith("ves")) candidates.push(last.slice(0, -3) + "f");
  if (last.endsWith("s") && !last.endsWith("ss")) candidates.push(last.slice(0, -1));
  for (const c of candidates) {
    const candidate = [...stem, c].join(" ");
    if (vocabulary.has(candidate)) return candidate;
  }
  return name;
}

/** Resolve a raw source name to its canonical cleaned name. */
export function canonicalName(raw: string, vocabulary: Set<string>): string {
  let name = cleanName(raw);
  if (ALIASES[name]) return ALIASES[name];
  name = singularise(name, vocabulary);
  return ALIASES[name] ?? name;
}

/**
 * Ingredient families. A specific ingredient satisfies its family and the
 * family satisfies the specific one ("chicken" <-> "chicken thighs"), but
 * siblings never satisfy each other. Exclusions keep non-substitutes apart
 * ("coconut milk" is not milk, "rice flour" is not wheat flour).
 */
const SUFFIX_FAMILIES: { head: string; exclude?: RegExp }[] = [
  { head: "onion", exclude: /\b(spring|ground|crispy|fried|powder)\b/ },
  { head: "tomato", exclude: /\b(sun[ -]?dried|green)\b/ },
  { head: "potato", exclude: /\bsweet\b/ },
  { head: "rice" },
  { head: "flour", exclude: /\b(rice|corn|chickpea|gram|coconut|almond|cassava|buckwheat|rye|semolina|tempura|potato|tapioca|banana)\b/ },
  { head: "sugar", exclude: /\b(icing|palm|coco|vanilla)\b/ },
  { head: "butter", exclude: /\b(peanut|almond|cocoa|nut|apple|shea|cashew)\b/ },
  { head: "milk", exclude: /\b(coconut|almond|oat|soy|soya|condensed|evaporated|rice)\b/ },
  { head: "oil", exclude: /\b(sesame|chilli|truffle|coconut|walnut|garlic)\b/ },
  { head: "mushroom" },
  { head: "chilli", exclude: /\b(dried|flakes|powder|sauce|oil)\b/ },
  { head: "lentil" },
  { head: "prawn", exclude: /\b(dried|paste|stock)\b/ },
];
const PREFIX_FAMILIES = ["chicken", "beef", "pork", "lamb"];
/** Tail words that turn a meat word into a product rather than a cut. */
const NON_CUT_TAILS = /\b(stock|cubes?|gravy|granules|bouillon|broth|powder|seasoning|sauce|fat|dripping|concentrate|tomato|tomatoes)$/;

/** Singular and plural spellings of a family head word. */
function headForms(head: string): string[] {
  return head === "chilli" ? ["chilli", "chillies"] : [head, `${head}s`, `${head}es`];
}

export function familyOf(name: string, vocabulary: Set<string>): string | null {
  const words = name.split(" ");
  if (words.length < 2) return null;
  if (PREFIX_FAMILIES.includes(words[0]) && !NON_CUT_TAILS.test(name) && vocabulary.has(words[0])) {
    return words[0];
  }
  const last = words[words.length - 1];
  for (const { head, exclude } of SUFFIX_FAMILIES) {
    const forms = headForms(head);
    if (!forms.includes(last) || exclude?.test(name)) continue;
    // The family record is whichever spelling the catalogue actually uses.
    const parent = forms.find((f) => vocabulary.has(f));
    if (parent && parent !== name) return parent;
  }
  return null;
}

const MEAT_WORDS = new Set([
  "chicken", "beef", "pork", "lamb", "mutton", "goat", "veal", "bacon", "ham",
  "pancetta", "prosciutto", "chorizo", "salami", "pepperoni", "sausage",
  "sausages", "duck", "turkey", "goose", "venison", "rabbit", "kidney",
  "liver", "oxtail", "brisket", "steak", "gelatine", "gelatin", "lard", "suet",
  "gammon", "pheasant", "quail", "meat", "meatballs", "bresaola", "speck",
  "kielbasa", "kabanos", "frankfurter", "frankfurters", "pigeon", "tripe",
  "haggis", "giblets", "morcilla", "trotters", "chuck", "jamon", "frogs",
  "lardon", "lardons", "sirloin", "tenderloin",
]);
const SEAFOOD_WORDS = new Set([
  "fish", "codfish", "salmon", "tuna", "cod", "haddock", "prawns", "prawn",
  "shrimp", "crab", "lobster", "mussels", "clams", "squid", "octopus",
  "anchovy", "anchovies", "sardines", "mackerel", "trout", "herring",
  "scallops", "oyster", "oysters", "monkfish", "tilapia", "halibut", "bass",
  "plaice", "kipper", "kippers", "dashi", "bonito", "caviar", "roe", "pollock",
  "hake", "swordfish", "snapper", "eel", "crayfish", "calamari", "cockles",
  "whitebait", "barramundi", "conchs", "conch", "seafood", "worcestershire",
]);
/** Names that contain an animal word but are not animal products. */
const NOT_ANIMAL = [
  /\bvegetable (stock|broth)\b/,
  /\b(vegan|vegetarian)\b/,
  /\bbeef tomato(es)?\b/,
  /\bkidney beans?\b/,
  /\bmushrooms?\b/,
  /\bduck sauce\b/,
  /\bjackfruit\b/,
  /\bmincemeat\b/,
  /\bcoconut\b/,
];
/** Known mistakes in the source's ingredient `strType` field. */
const SOURCE_TYPE_ERRORS = new Set(["pistachio", "rye", "bok choi", "galangal paste"]);

/**
 * Classify an ingredient as meat or seafood from its name and source type.
 * Deliberately errs towards "animal" when the source says so, because this
 * powers a "no meat or fish listed" filter. It is never a dietary guarantee.
 */
export function animalClass(name: string, sourceType: string | null): AnimalClass | null {
  if (NOT_ANIMAL.some((re) => re.test(name))) return null;
  const words = name.split(" ");
  if (words.some((w) => SEAFOOD_WORDS.has(w))) return "seafood";
  if (words.some((w) => MEAT_WORDS.has(w))) return "meat";
  if (SOURCE_TYPE_ERRORS.has(name)) return null;
  const type = sourceType?.toLowerCase() ?? "";
  if (type === "fish" || type === "seafood") return "seafood";
  if (type === "meat") return "meat";
  return null;
}

export interface ParsedMeasure {
  quantity: number | null;
  unit: string | null;
  isOptional: boolean;
}

const UNIT_ALIASES: Record<string, string> = {
  g: "g", gr: "g", gram: "g", grams: "g", gm: "g", gms: "g",
  kg: "kg", kgs: "kg", kilogram: "kg", kilograms: "kg",
  mg: "mg",
  ml: "ml", millilitre: "ml", milliliter: "ml", millilitres: "ml", milliliters: "ml",
  cl: "cl", dl: "dl",
  l: "l", litre: "l", liter: "l", litres: "l", liters: "l", ltr: "l",
  tsp: "tsp", tsps: "tsp", teaspoon: "tsp", teaspoons: "tsp", t: "tsp",
  tbsp: "tbsp", tbsps: "tbsp", tbs: "tbsp", tbls: "tbsp", tblsp: "tbsp", tblspn: "tbsp",
  tablespoon: "tbsp", tablespoons: "tbsp", tbl: "tbsp", tb: "tbsp",
  cup: "cup", cups: "cup", c: "cup",
  oz: "oz", ounce: "oz", ounces: "oz",
  "fl oz": "fl oz",
  lb: "lb", lbs: "lb", pound: "lb", pounds: "lb",
  clove: "clove", cloves: "clove",
  pinch: "pinch", pinches: "pinch",
  can: "can", cans: "can", tin: "can", tins: "can",
  slice: "slice", slices: "slice",
  handful: "handful", handfuls: "handful",
  bunch: "bunch", bunches: "bunch",
  sprig: "sprig", sprigs: "sprig",
  stick: "stick", sticks: "stick",
  dash: "dash", dashes: "dash",
  splash: "splash",
  piece: "piece", pieces: "piece",
  pint: "pint", pints: "pint",
  packet: "packet", packets: "packet", pack: "packet", package: "packet",
  sheet: "sheet", sheets: "sheet",
  leaf: "leaf", leaves: "leaf",
  jar: "jar",
  knob: "knob",
  drop: "drop", drops: "drop",
};

const UNICODE_FRACTIONS: Record<string, number> = {
  "½": 0.5, "⅓": 1 / 3, "⅔": 2 / 3, "¼": 0.25, "¾": 0.75, "⅕": 0.2,
  "⅛": 0.125, "⅜": 0.375, "⅝": 0.625, "⅞": 0.875,
};

const OPTIONAL_MARKERS = /\b(optional|to serve|for serving|serving|garnish|to garnish|to decorate|decoration|for dusting)\b/i;

function parseNumberToken(token: string): number | null {
  if (UNICODE_FRACTIONS[token] !== undefined) return UNICODE_FRACTIONS[token];
  const mixedUnicode = token.match(/^(\d+)([½⅓⅔¼¾⅕⅛⅜⅝⅞])$/);
  if (mixedUnicode) return Number(mixedUnicode[1]) + UNICODE_FRACTIONS[mixedUnicode[2]];
  const frac = token.match(/^(\d+)\/(\d+)$/);
  if (frac) return Number(frac[2]) === 0 ? null : Number(frac[1]) / Number(frac[2]);
  if (/^\d+(\.\d+)?$/.test(token)) return Number(token);
  return null;
}

/**
 * Parse a free-text measure. The raw text is always kept for display; these
 * structured values are only filled in when the text is unambiguous.
 */
export function parseMeasure(raw: string | null | undefined): ParsedMeasure {
  const text = (raw ?? "").trim();
  const isOptional = OPTIONAL_MARKERS.test(text);
  if (!text) return { quantity: null, unit: null, isOptional };

  const spaced = text
    .toLowerCase()
    .replace(/(\d)([½⅓⅔¼¾⅕⅛⅜⅝⅞])/g, "$1 $2")
    .replace(/(\d)\s*-\s*(\d)/g, "$1-$2")
    .replace(/(\d)([a-z])/g, "$1 $2")
    .replace(/\./g, (m, offset: number, s: string) => (/\d/.test(s[offset - 1] ?? "") && /\d/.test(s[offset + 1] ?? "") ? m : " "))
    .replace(/[(),]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  const tokens = spaced.split(" ");

  let quantity: number | null = null;
  let i = 0;
  const range = tokens[0]?.match(/^(\d+(?:\.\d+)?)-(\d+(?:\.\d+)?)$/);
  if (range) {
    // A range like "2-3" keeps its lower bound; the raw text shows the range.
    quantity = Number(range[1]);
    i = 1;
  } else {
    const first = parseNumberToken(tokens[0] ?? "");
    if (first !== null) {
      quantity = first;
      i = 1;
      const second = parseNumberToken(tokens[1] ?? "");
      if (second !== null && second < 1) {
        quantity += second;
        i = 2;
      }
    }
  }

  // Single letters ("t", "c") only count as units directly after a number.
  const next = tokens[i] ?? "";
  const candidate = UNIT_ALIASES[tokens.slice(i, i + 2).join(" ")] ?? UNIT_ALIASES[next];
  const terse = next.length === 1 || next === "tb";
  const unit = candidate && (!terse || quantity !== null) ? candidate : null;

  if (quantity !== null) quantity = Math.round(quantity * 1000) / 1000;
  return { quantity, unit, isOptional };
}

/** Split free-text instructions into steps without rewriting them. */
export function splitInstructions(raw: string | null | undefined): string[] {
  if (!raw) return [];
  return raw
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line.length > 0)
    .filter((line) => !/^(step\s*)?\d+\s*[.):-]?$/i.test(line))
    .map((line) => line.replace(/^step\s*\d+\s*[.):-]?\s+/i, "").replace(/^\d+\s*[.)]\s+/, ""))
    .filter((line) => line.length > 0);
}

/** Extract an 11-character YouTube video id from a URL; never guesses. */
export function youtubeIdFromUrl(url: string | null | undefined): string | null {
  if (!url) return null;
  const match =
    url.match(/[?&]v=([A-Za-z0-9_-]{11})(?![A-Za-z0-9_-])/) ??
    url.match(/youtu\.be\/([A-Za-z0-9_-]{11})(?![A-Za-z0-9_-])/) ??
    url.match(/\/(?:embed|shorts|v)\/([A-Za-z0-9_-]{11})(?![A-Za-z0-9_-])/);
  return match ? match[1] : null;
}

export function isValidYoutubeId(id: string): boolean {
  return /^[A-Za-z0-9_-]{11}$/.test(id);
}
