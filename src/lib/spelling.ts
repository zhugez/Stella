import { normalize } from "./text";

/**
 * UK→US stems, matched at the start of a word so inflections follow. The -ise verbs list their endings, so organism and analysis stay untouched.
 * Left out on purpose because the US spelling is a different word or sense: storey, practise, licence,
 * tyre, kerb, draught, programme, metre. "cheque/check" is handled by the slash rule in accepts().
 */
const STEMS = [
  ...[
    "agon", "apolog", "author", "character", "civil", "computer", "critic", "dramat", "general", "global", "industrial", "jeopard", "material",
    "maxim", "mobil", "modern", "monopol", "neutral", "normal", "organ", "oxid", "plagiar", "popular", "real", "recogn", "special", "stabil",
    "subsid", "summar", "sympath", "tantal", "util", "visual",
  ].flatMap((b) => ["e", "ed", "es", "ing", "ation", "ations", "er", "ers"].map((e) => [`${b}is${e}`, `${b}iz${e}`])),
  ...["anal", "paral"].flatMap((b) => ["e", "ed", "es", "ing"].map((e) => [`${b}ys${e}`, `${b}yz${e}`])),
  ...["armour", "behaviour", "clamour", "colour", "dishonour", "endeavour", "favour", "flavour", "harbour", "honour", "humour", "labour", "neighbour", "odour", "tumour", "vapour"].map((b) => [
    b,
    b.replace("our", "or"),
  ]),
  ...["centimetre", "centre", "kilometre", "litre", "millimetre", "theatre"].map((b) => [b, b.replace(/tre$/, "ter")]),
  ...["catalogue", "dialogue"].map((b) => [b, b.slice(0, -2)]),
  ...["defence", "offence"].map((b) => [b, b.replace("ence", "ense")]),
  ...["travell", "cancell", "counsell", "marvell", "fuell", "modell", "labell", "levell", "channell", "tunnell"].map((b) => [b, b.slice(0, -1)]),
  ["gramme", "gram"],
  ["aesthetic", "esthetic"],
  ["archaeolog", "archeolog"],
  ["encyclopaedia", "encyclopedia"],
  ["aeroplane", "airplane"],
  ["grey", "gray"],
  ["plough", "plow"],
  ["mould", "mold"],
  ["aluminium", "aluminum"],
  ["jewellery", "jewelry"],
  ["jeweller", "jeweler"],
  ["pyjama", "pajama"],
  ["sceptic", "skeptic"],
  ["manoeuvre", "maneuver"],
  ["manoeuvred", "maneuvered"],
  ["manoeuvring", "maneuvering"],
  ["enrol", "enroll"],
  ["fulfil", "fulfill"],
  ["skilful", "skillful"],
  ["judgement", "judgment"],
  ["ageing", "aging"],
  ["cosy", "cozy"],
  ["moustache", "mustache"],
  ["sulph", "sulf"],
] as [string, string][];
STEMS.sort((a, b) => b[0].length - a[0].length);

/** Map a UK word to its US form; a word that already starts with a longer US stem (enrol → enroll) is left alone. */
function canonWord(w: string) {
  for (const [uk, us] of STEMS) if (w.startsWith(uk) && !(w.startsWith(us) && us.length > uk.length)) return us + w.slice(uk.length);
  return w;
}

const canon = (s: string) => normalize(s).replace(/[a-z]+/g, canonWord);

/** True when the typed text matches the target, any "/" alternative, or the UK/US spelling of either. */
export const accepts = (input: string, target: string) => target.split("/").some((part) => canon(part) === canon(input));

/** Headword pairs that both exist in the open atlas as separate words (checked against public/atlas/index.json). */
const TWINS = new Map(
  (
    "aeroplane airplane|grey gray|favourite favorite|organise organize|jewellery jewelry|kilometre kilometer|litre liter|gramme gram|" +
    "behaviour behavior|organisation organization|favour favor|marvellous marvelous|apologise apologize|recognise recognize|" +
    "realise realize|dialogue dialog|catalogue catalog|honour honor|counsellor counselor|encyclopaedia encyclopedia|aluminium aluminum|" +
    "analyse analyze|endeavour endeavor|jeopardise jeopardize|utilise utilize|paralyse paralyze|aesthetic esthetic"
  )
    .split("|")
    .map((row) => row.split(" "))
    .flatMap(([uk, us]) => [[uk, us] as const, [us, uk] as const]),
);

/** The other spelling of a headword, when the atlas holds both. */
export const twinOf = (word: string) => TWINS.get(normalize(word));
