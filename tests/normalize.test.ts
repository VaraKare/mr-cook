import { describe, expect, it } from "vitest";
import {
  animalClass,
  canonicalName,
  cleanName,
  familyOf,
  parseMeasure,
  singularise,
  splitInstructions,
  youtubeIdFromUrl,
} from "@/lib/ingest/normalize";

describe("cleanName", () => {
  it("lowercases, strips accents and punctuation", () => {
    expect(cleanName("  Tomato Purée ")).toBe("tomato puree");
    expect(cleanName("Gruyère")).toBe("gruyere");
    expect(cleanName("Salt & Pepper")).toBe("salt and pepper");
  });
  it("unifies chilli spellings", () => {
    expect(cleanName("Red Chili")).toBe("red chilli");
    expect(cleanName("Green Chile")).toBe("green chilli");
  });
});

describe("canonicalName", () => {
  const vocab = new Set(["chicken thigh", "onion", "egg", "coriander"]);
  it("maps synonyms to one canonical record", () => {
    expect(canonicalName("Cilantro", vocab)).toBe("coriander");
    expect(canonicalName("Scallions", vocab)).toBe("spring onion");
    expect(canonicalName("Garlic Clove", vocab)).toBe("garlic");
    expect(canonicalName("Cornstarch", vocab)).toBe("cornflour");
    expect(canonicalName("Shrimp", vocab)).toBe("prawns");
  });
  it("collapses plurals only onto singulars that exist", () => {
    expect(canonicalName("Chicken Thighs", vocab)).toBe("chicken thigh");
    expect(singularise("molasses", vocab)).toBe("molasses");
    expect(singularise("peas", vocab)).toBe("peas");
  });
});

describe("familyOf", () => {
  const vocab = new Set(["chicken", "milk", "flour", "onion", "beef", "rice"]);
  it("groups cuts and varieties", () => {
    expect(familyOf("chicken thighs", vocab)).toBe("chicken");
    expect(familyOf("whole milk", vocab)).toBe("milk");
    expect(familyOf("plain flour", vocab)).toBe("flour");
    expect(familyOf("red onion", vocab)).toBe("onion");
    expect(familyOf("basmati rice", vocab)).toBe("rice");
  });
  it("matches plural spellings to the family the catalogue uses", () => {
    const v = new Set(["tomato", "mushrooms", "chilli"]);
    expect(familyOf("plum tomatoes", v)).toBe("tomato");
    expect(familyOf("shiitake mushrooms", v)).toBe("mushrooms");
    expect(familyOf("birds eye chillies", v)).toBe("chilli");
    expect(familyOf("sun-dried tomatoes", v)).toBeNull();
    expect(familyOf("dried chillies", v)).toBeNull();
  });
  it("keeps non-substitutes apart", () => {
    expect(familyOf("chicken stock", vocab)).toBeNull();
    expect(familyOf("coconut milk", vocab)).toBeNull();
    expect(familyOf("rice flour", vocab)).toBeNull();
    expect(familyOf("spring onion", vocab)).toBeNull();
    expect(familyOf("beef tomatoes", vocab)).toBeNull();
    expect(familyOf("rice noodles", vocab)).toBeNull();
  });
});

describe("animalClass", () => {
  it("detects meat and seafood by name", () => {
    expect(animalClass("chicken stock", null)).toBe("meat");
    expect(animalClass("streaky bacon", null)).toBe("meat");
    expect(animalClass("fish sauce", null)).toBe("seafood");
    expect(animalClass("worcestershire sauce", null)).toBe("seafood");
  });
  it("does not flag look-alikes", () => {
    expect(animalClass("kidney beans", null)).toBeNull();
    expect(animalClass("oyster mushrooms", null)).toBeNull();
    expect(animalClass("vegetable stock", null)).toBeNull();
    expect(animalClass("beef tomatoes", null)).toBeNull();
    expect(animalClass("minced garlic", null)).toBeNull();
  });
  it("trusts the source type except for known errors", () => {
    expect(animalClass("morcilla", "Meat")).toBe("meat");
    expect(animalClass("barramundi", "Fish")).toBe("seafood");
    expect(animalClass("pistachio", "Meat")).toBeNull();
    expect(animalClass("bok choi", "Fish")).toBeNull();
  });
});

describe("parseMeasure", () => {
  it.each([
    ["200g", 200, "g"],
    ["1 tsp", 1, "tsp"],
    ["2 tablespoons", 2, "tbsp"],
    ["3  tbs", 3, "tbsp"],
    ["1/2 cup", 0.5, "cup"],
    ["1 1/2 cups", 1.5, "cup"],
    ["½ tsp", 0.5, "tsp"],
    ["1½ tbsp", 1.5, "tbsp"],
    ["2-3 cloves", 2, "clove"],
    ["1 lb", 1, "lb"],
    ["1.5 kg", 1.5, "kg"],
    ["4", 4, null],
    ["1 large", 1, null],
    ["pinch", null, "pinch"],
    ["to taste", null, null],
  ])("%s -> %s %s", (raw, quantity, unit) => {
    const parsed = parseMeasure(raw);
    expect(parsed.quantity).toBe(quantity);
    expect(parsed.unit).toBe(unit);
  });
  it("marks garnish/serving measures optional but not 'to taste'", () => {
    expect(parseMeasure("to serve").isOptional).toBe(true);
    expect(parseMeasure("For garnish").isOptional).toBe(true);
    expect(parseMeasure("handful (optional)").isOptional).toBe(true);
    expect(parseMeasure("to taste").isOptional).toBe(false);
    expect(parseMeasure("").quantity).toBeNull();
  });
});

describe("splitInstructions", () => {
  it("drops step labels and numbering without rewriting text", () => {
    expect(splitInstructions("step 1\r\nChop it.\r\n\r\nSTEP 2\r\nCook it.")).toEqual(["Chop it.", "Cook it."]);
    expect(splitInstructions("1. Preheat oven.\n2) Bake.")).toEqual(["Preheat oven.", "Bake."]);
    expect(splitInstructions(null)).toEqual([]);
  });
});

describe("youtubeIdFromUrl", () => {
  it("extracts ids from common URL forms", () => {
    expect(youtubeIdFromUrl("https://www.youtube.com/watch?v=XnA-wcVb4l0")).toBe("XnA-wcVb4l0");
    expect(youtubeIdFromUrl("https://youtu.be/XnA-wcVb4l0")).toBe("XnA-wcVb4l0");
    expect(youtubeIdFromUrl("https://www.youtube.com/embed/XnA-wcVb4l0?x=1")).toBe("XnA-wcVb4l0");
  });
  it("never guesses", () => {
    expect(youtubeIdFromUrl("")).toBeNull();
    expect(youtubeIdFromUrl("https://www.youtube.com/watch?v=short")).toBeNull();
    expect(youtubeIdFromUrl("https://example.com/watch?v=XnA-wcVb4l0extra")).toBeNull();
  });
});
