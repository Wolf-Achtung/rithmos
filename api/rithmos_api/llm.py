"""The one file that talks to a language model (CLAUDE.md 9 and 11). The key comes
from the environment, the provider is the Anthropic SDK, and every number the
model writes is checked against the facts before anything leaves this module.

The narrator (CLAUDE.md 8.1): two voices, the monk and the analyst, one sentence
each; and "Wer lügt?": the true explanation and two lies. The facts — which
statement is true, which are the lies — come from the generator; the model only
phrases them. It never decides."""

from __future__ import annotations

import os
import re
from dataclasses import dataclass
from typing import Any, Literal, Protocol

from pydantic import BaseModel, Field, ValidationError

PROMPT_VERSION = 2
MODEL = os.environ.get("RITHMOS_LLM_MODEL", "claude-opus-5")

KIND_NAME = {"arithmetic": "arithmetisch", "geometric": "geometrisch", "musical": "musikalisch"}
MEAN_NAME = {"arithmetic": "arithmetische Mittel", "geometric": "geometrische Mittel", "musical": "harmonische Mittel"}
# the patterns in plain words, as the app names them before the solve (CLAUDE.md 2)
PATTERN_NAME = {
    "arithmetic": "gleiche Schritte",
    "geometric": "gleiche Faktoren",
    "musical": "die Schritte verhalten sich wie die Außenzahlen",
}

SYSTEM = """Du formulierst für Rithmos, ein Zahlenrätsel nach dem mittelalterlichen Rithmomachia. Drei Zahlen
a, b, c bilden ein Muster: gleiche Schritte (b − a = c − b), gleiche Faktoren (a : b = b : c) oder die
Schritte verhalten sich wie die Außenzahlen ((b − a) : (c − b) = a : c). Du bekommst die Fakten als JSON. Du
erfindest keine Zahl und keine Zuordnung: Jede Zahl in deinem Text muss in den Fakten vorkommen, jede
Zuordnung muss genau so lauten wie angegeben, auch bei den beiden Lügen, die absichtlich falsch sind.

Sprache: einfaches, klares Deutsch, wie man es einem Freund sagt. Kurze Sätze. Richtige Umlaute (ä, ö, ü, ß).
Keine Fachwörter außer den drei Musterwörtern oben; „arithmetisch“, „geometrisch“, „harmonisch“ höchstens
einmal, und nur als Name hinter dem Muster. Kein Emoji, keine Anführungszeichen.

Vier Texte:
- monk: ein Mönch um 1050, der Boethius gelesen hat. Ein Satz, höchstens 140 Zeichen: was er an den drei
  Zahlen hört oder sieht, konkret, ruhig.
- analyst: eine Datenanalystin heute. Ein Satz, höchstens 140 Zeichen, mit einem Beispiel aus dem Alltag, in
  dem genau dieses Muster steckt (Durchschnitt, Wachstum, hin und zurück fahren, F1-Score, Blenden), mit den
  Zahlen des Rätsels.
- truth: ein Satz, höchstens 120 Zeichen, warum b in die Mitte gehört: die Zahl, das Muster in seinen
  Worten (gleiche Schritte / gleiche Faktoren / die Schritte verhalten sich wie die Außenzahlen) und die
  Schritte oder Faktoren als Zahlen. Muster: „8 gehört in die Mitte, weil sich die Schritte 2 und 4 verhalten
  wie die Außenzahlen 6 und 12.“
- lies: zwei Sätze im selben Bau wie truth, mit der angegebenen Zahl und dem angegebenen Muster in seinen
  Worten, jede mit einer Begründung, die plausibel klingt und beim Nachrechnen nicht stimmt. Kein Hinweis,
  dass sie falsch sind."""


class Narration(BaseModel):
    monk: str = Field(max_length=220)
    analyst: str = Field(max_length=220)
    truth: str = Field(max_length=220)
    lies: list[str] = Field(min_length=2, max_length=2)


class Facts(BaseModel):
    kind: str
    a: int
    b: int
    c: int
    truth: dict[str, Any]
    lies: list[dict[str, Any]]
    ratio: list[int]
    find: dict[str, Any] | None = None


class Provider(Protocol):
    def narrate(self, system: str, facts_json: str) -> Narration: ...


@dataclass
class AnthropicProvider:
    """The real thing. Constructed only when ANTHROPIC_API_KEY is set."""

    model: str = MODEL

    def narrate(self, system: str, facts_json: str) -> Narration:
        import anthropic

        client = anthropic.Anthropic()
        response = client.messages.parse(
            model=self.model,
            max_tokens=2000,
            system=[{"type": "text", "text": system, "cache_control": {"type": "ephemeral"}}],
            messages=[{"role": "user", "content": facts_json}],
            output_format=Narration,
        )
        if response.stop_reason == "refusal" or response.parsed_output is None:
            raise RuntimeError(f"no narration: stop_reason={response.stop_reason}")
        return response.parsed_output


def provider_from_env() -> Provider | None:
    return AnthropicProvider() if os.environ.get("ANTHROPIC_API_KEY") else None


# a number, but not the digit inside a name like F1 or A440
_NUMBER = re.compile(r"(?<![A-Za-z\d])\d+(?:[.,]\d+)?(?![A-Za-z\d])")


def _is_year(m: str) -> bool:
    """A monk may name his century: four digits between 500 and 1700 pass."""
    return m.isdigit() and len(m) == 4 and 500 <= int(m) <= 1700


def allowed_numbers(f: Facts) -> set[str]:
    """The facts themselves, plus what a one-line calculation with them produces:
    sums, differences, products and the halves that the mean formulas use."""
    a, b, c = f.a, f.b, f.c
    allowed = {a, b, c, f.truth["value"], *[lie["value"] for lie in f.lies], *f.ratio}
    allowed |= {2, a + c, c - a, b - a, c - b, a * c, 2 * a * c, b * b, a * b, b * c}
    if (a + c) % 2 == 0:
        allowed.add((a + c) // 2)
    return {str(n) for n in allowed if n > 0}


def check(n: Narration, f: Facts) -> list[str]:
    """Every number in every sentence must be one of the facts; the truth names b and its kind,
    each lie names its own number and kind. Returns the problems, empty when clean."""
    problems: list[str] = []
    allowed = allowed_numbers(f)
    texts = {"monk": n.monk, "analyst": n.analyst, "truth": n.truth, "lie1": n.lies[0], "lie2": n.lies[1]}
    for name, text in texts.items():
        if not text.strip() or "\n" in text:
            problems.append(f"{name}: empty or multi-line")
        for m in _NUMBER.findall(text):
            if m.replace(",", ".").rstrip("0").rstrip(".") not in allowed and m not in allowed and not _is_year(m):
                problems.append(f"{name}: number {m} is not in the facts")
    if str(f.b) not in n.truth or not _names_kind(n.truth, f.kind):
        problems.append("truth: does not name b and its kind")
    for i, lie in enumerate(f.lies):
        text = n.lies[i]
        if str(lie["value"]) not in text or not _names_kind(text, lie["kind"]):
            problems.append(f"lie{i + 1}: does not state its number and kind")
    return problems


# words that name a kind in plain language, any of which counts; the classical names count too
KIND_WORDS = {
    "arithmetic": (
        "gleiche schritte",
        "gleichen schritten",
        "gleich groß",
        "gleich sind",
        "gleich weit",
        "derselbe schritt",
        "arithmet",
        "durchschnitt",
    ),
    "geometric": ("faktor", "geometr", "verdoppel", "mal so"),
    "musical": ("außenzahl", "verhalten sich", "verhält sich", "verhältnis", "harmon", "musikal", "saite"),
}


def _names_kind(text: str, kind: str) -> bool:
    """The kind may be named by its plain pattern words or by its classical name."""
    low = text.lower()
    return any(w in low for w in KIND_WORDS[kind])


def facts_for(row_payload: dict[str, Any], row_solution: dict[str, Any]) -> Facts | None:
    """Facts from a stored puzzle, or None for puzzles ingested before the narrator existed."""
    triad = row_payload.get("triad")
    facts = row_solution.get("facts")
    b = row_solution.get("move", {}).get("b")
    if not triad or not facts or b is None:
        return None
    try:
        return Facts(
            kind=triad["kind"],
            a=triad["a"],
            b=b,
            c=triad["c"],
            truth=facts["truth"],
            lies=facts["lies"],
            ratio=facts["ratio"],
            find=triad.get("find"),
        )
    except (KeyError, ValidationError):
        return None


def facts_json(f: Facts) -> str:
    """What the model sees: names instead of codes, the find when the day has one."""
    payload = {
        "a": f.a,
        "b": f.b,
        "c": f.c,
        "muster_von_b": PATTERN_NAME[f.kind],
        "name_des_musters": KIND_NAME[f.kind],
        "schritte": [f.b - f.a, f.c - f.b],
        "verhaeltnis_a_b_c": f.ratio,
        "truth": {"zahl": f.truth["value"], "muster": PATTERN_NAME[f.truth["kind"]]},
        "lies": [{"zahl": lie["value"], "muster": PATTERN_NAME[lie["kind"]]} for lie in f.lies],
    }
    if f.find:
        payload["fundstueck"] = {"titel": f.find.get("title"), "ort": f.find.get("where")}
    import json

    return json.dumps(payload, ensure_ascii=False)


def narrate(provider: Provider, f: Facts, attempts: int = 2) -> Narration:
    """Ask, check, ask once more; raise when the model cannot stay within the facts."""
    last: list[str] = []
    for _ in range(attempts):
        n = provider.narrate(SYSTEM, facts_json(f))
        last = check(n, f)
        if not last:
            return n
    raise ValueError("narration failed the facts check: " + "; ".join(last))


# ---------------------------------------------------------------------------
# The hunt (Zug F): the model counts what it sees; the engine, in the app,
# decides whether the counts form a harmony. The model never names a harmony.

HUNT_SYSTEM = """Du siehst ein Foto aus dem Alltag. Zähle, was sich darauf in Gruppen zählen lässt: gleichartige Dinge
(Bücher in einem Regal, Fenster einer Fassade, Stufen, Tassen, Fliesen in einer Reihe, Zähne eines Zahnrads,
Tasten, Stühle). Gib bis zu acht Gruppen zurück, jede mit einem kurzen deutschen Namen (Plural, ein bis drei
Wörter) und der Anzahl, die du wirklich abzählen kannst. Zähle nur, was sicher zählbar ist; schätze nicht.
Keine Gruppe mit weniger als 2 oder mehr als 200. Keine Deutung, keine Mathematik — nur Namen und Zahlen."""


class HuntGroup(BaseModel):
    label: str = Field(max_length=60)
    count: int = Field(ge=2, le=200)


class HuntCounts(BaseModel):
    groups: list[HuntGroup] = Field(max_length=8)


class VisionProvider(Protocol):
    def count(self, system: str, image_media_type: str, image_base64: str) -> HuntCounts: ...


@dataclass
class AnthropicVision:
    model: str = MODEL

    def count(self, system: str, image_media_type: str, image_base64: str) -> HuntCounts:
        import anthropic

        client = anthropic.Anthropic()
        response = client.messages.parse(
            model=self.model,
            max_tokens=1500,
            system=[{"type": "text", "text": system, "cache_control": {"type": "ephemeral"}}],
            messages=[
                {
                    "role": "user",
                    "content": [
                        {
                            "type": "image",
                            "source": {"type": "base64", "media_type": image_media_type, "data": image_base64},
                        },
                        {"type": "text", "text": "Was lässt sich hier zählen?"},
                    ],
                }
            ],
            output_format=HuntCounts,
        )
        if response.stop_reason == "refusal" or response.parsed_output is None:
            raise RuntimeError(f"no counts: stop_reason={response.stop_reason}")
        return response.parsed_output


def vision_from_env() -> VisionProvider | None:
    return AnthropicVision() if os.environ.get("ANTHROPIC_API_KEY") else None


def clean_counts(counts: HuntCounts) -> HuntCounts:
    """Distinct labels, distinct counts kept in first-seen order, at most eight."""
    seen_labels: set[str] = set()
    groups: list[HuntGroup] = []
    for g in counts.groups:
        label = g.label.strip()
        if not label or label.lower() in seen_labels:
            continue
        seen_labels.add(label.lower())
        groups.append(HuntGroup(label=label, count=g.count))
    return HuntCounts(groups=groups[:8])


# ---------------------------------------------------------------------------
# The rules chat (CLAUDE.md 8.4): the rule set is the data, the model phrases an
# answer from it and from nothing else. What the text does not settle, it says
# so — the server then shows a fixed sentence, never the model's guess.

RULES_VERSION = 1

RULES_TEXT = """Regelfassung: Peter Mebben nach Selenus 1616 (https://jducoeur.org/game-hist/mebben.ryth.html).

Brett und Steine. 8 × 16 Felder. Weiß und Schwarz haben je 24 Steine: Runde, Dreiecke, Quadrate und eine
Pyramide. Weiße Pyramide = 91 aus 36 + 25 + 16 + 9 + 4 + 1. Schwarze Pyramide = 190 aus 64 + 49 + 36 + 25 + 16.

Zugweiten. Mebben zählt Start- und Zielfeld mit; „ins zweite Feld" heißt ein Schritt.
- Runde: ins zweite Feld, ein Schritt, gerade, nicht diagonal.
- Dreieck: ins dritte Feld, zwei Schritte, ausschließlich diagonal.
- Quadrat: ins vierte Feld, drei Schritte, alle Richtungen einschließlich diagonal.
- Pyramide: zieht nach ihren Bestandteilen.
Kein Springen: die Zwischenfelder eines Zuges müssen frei sein.

Schlagarten. Der schlagende Stein bleibt stehen und betritt das Zielfeld nicht. Schläge werden nach dem
regulären Zug erklärt, gegen die entstandene Stellung.
- Begegnung: ein eigener Stein könnte im nächsten regulären Zug auf einen gegnerischen Stein gleichen Werts ziehen.
- Hinterhalt: zwei oder mehr eigene Steine könnten im nächsten Zug auf das Feld eines gegnerischen Steins
  ziehen, und ihre Summe oder Differenz ergibt dessen Wert.
- Angriff: ein eigener Stein könnte in regulärer Richtung auf einen gegnerischen Stein treffen, und der eigene
  Wert ergibt mal oder geteilt durch die Zahl der Felder dazwischen dessen Wert.
- Belagerung: der gegnerische Stein kann weder ziehen noch von einem einzelnen eigenen Stein befreit werden.
Ein Pyramidenbestandteil kann einzeln auf seinen Wert geschlagen werden.

Die drei Harmonien, für drei Zahlen a, b, c in aufsteigender Reihe.
- Arithmetisch: b − a = c − b. Beispiel 2, 4, 6. b ist das arithmetische Mittel von a und c.
- Geometrisch: a : b = b : c. Beispiel 5, 10, 20. b ist das geometrische Mittel von a und c.
- Musikalisch: a : c = (b − a) : (c − b). Beispiel 6, 8, 12. b ist das harmonische Mittel von a und c.

Siege. Kleiner Sieg: eine Harmonie aus drei Steinen. Großer Sieg: vier Steine mit zwei, nicht mehr als zwei,
verschiedenen Harmonien. Größter Sieg: vier Steine mit allen dreien. Lage: im gegnerischen Feld, in
aufsteigender Reihe, im rechten Winkel oder bei vieren im Quadrat, mit gleichem Abstand zueinander. Im Winkel
trägt der Eckstein den mittleren Wert; im Quadrat aus vieren werden die Werte sortiert gelesen.

Noch nicht gegen die Quelle geprüft: die Felder der Startaufstellung; das Verbot des Springens; dass Schläge
nach dem Zug durch beliebige eigene Steine erklärt werden; die Formen der Pyramidenbestandteile; das
Schlagen einzelner Bestandteile; dass eine Belagerung mindestens einen belagernden Stein braucht und Rand
oder eigene Steine allein nicht belagern; die Lesart von Winkel und Quadrat."""

RULES_SYSTEM = (
    """Du beantwortest Fragen zu den Regeln von Rithmos, einem Spiel nach dem mittelalterlichen
Rithmomachia. Die einzige Quelle ist die folgende Regelfassung. Du beantwortest nur, was darin steht, und
fügst nichts aus anderen Fassungen oder aus eigenem Wissen hinzu. Steht die Antwort nicht in der Regelfassung,
setze grounded auf false und lass answer leer. Sonst grounded true und die Antwort in höchstens drei deutschen
Sätzen, höchstens 400 Zeichen, ohne Emoji, ohne Anführungszeichen, ohne Zahlen, die nicht in der Regelfassung
oder in der Frage vorkommen. Nenne, wenn es passt, den Punkt „noch nicht gegen die Quelle geprüft".

REGELFASSUNG
"""
    + RULES_TEXT
)


class RuleAnswer(BaseModel):
    answer: str = Field(max_length=450)
    grounded: bool


class RulesProvider(Protocol):
    def answer(self, system: str, question: str) -> RuleAnswer: ...


@dataclass
class AnthropicRules:
    model: str = MODEL

    def answer(self, system: str, question: str) -> RuleAnswer:
        import anthropic

        client = anthropic.Anthropic()
        response = client.messages.parse(
            model=self.model,
            max_tokens=800,
            system=[{"type": "text", "text": system, "cache_control": {"type": "ephemeral"}}],
            messages=[{"role": "user", "content": question}],
            output_format=RuleAnswer,
        )
        if response.stop_reason == "refusal" or response.parsed_output is None:
            raise RuntimeError(f"no answer: stop_reason={response.stop_reason}")
        return response.parsed_output


def rules_from_env() -> RulesProvider | None:
    return AnthropicRules() if os.environ.get("ANTHROPIC_API_KEY") else None


def normalize_question(q: str) -> str:
    """Case, whitespace and trailing punctuation do not make a new question."""
    return re.sub(r"\s+", " ", q.strip().lower()).rstrip("?!. ")


def check_answer(a: RuleAnswer, question: str) -> list[str]:
    """An answer may use only numbers that the rules or the question contain, and
    must fit on a few lines. Returns the problems, empty when clean."""
    if not a.grounded:
        return []
    problems: list[str] = []
    text = a.answer.strip()
    if not text:
        problems.append("answer: empty but grounded")
    if text.count("\n") > 2:
        problems.append("answer: too many lines")
    allowed = set(_NUMBER.findall(RULES_TEXT)) | set(_NUMBER.findall(question))
    for m in _NUMBER.findall(text):
        if m not in allowed and not _is_year(m):
            problems.append(f"answer: number {m} is not in the rules")
    return problems


# ---------------------------------------------------------------------------
# "Erklär es mir" (CLAUDE.md 6, on the daily puzzle): the player says in their
# own words why the number is the middle. The model only translates the words
# into one of four patterns; the server compares with the puzzle's kind and
# draws the verdict. The model never judges.

EXPLAIN_VERSION = 1

EXPLAIN_SYSTEM = """Ein Spieler erklärt in eigenen Worten, warum eine Zahl die Mitte einer Zahlenreihe ist. Ordne die
Erklärung genau einem Muster zu, nur nach dem, was der Text sagt:
- steps: gleiche Schritte, gleicher Abstand, plus dieselbe Zahl, Durchschnitt, arithmetisch.
- factors: gleicher Faktor, mal dieselbe Zahl, verdoppelt, Wurzel, geometrisch.
- ratio: die Schritte verhalten sich wie die Außenzahlen, Saiten, Verhältnis, Quarte und Quinte, harmonisch,
  musikalisch, Kehrwerte.
- unclear: nichts davon, geraten, keine Regel, nur die Zahl genannt.
Erfinde nichts dazu und bewerte nicht, ob die Erklärung stimmt. evidence: die Worte des Spielers, die den
Ausschlag geben, wörtlich aus dem Text, höchstens 120 Zeichen."""

Pattern = Literal["steps", "factors", "ratio", "unclear"]
PATTERN_KIND: dict[str, str] = {"steps": "arithmetic", "factors": "geometric", "ratio": "musical"}


class Claim(BaseModel):
    pattern: Pattern
    evidence: str = Field(max_length=160)


class ExplainProvider(Protocol):
    def translate(self, system: str, text: str) -> Claim: ...


@dataclass
class AnthropicExplain:
    model: str = MODEL

    def translate(self, system: str, text: str) -> Claim:
        import anthropic

        client = anthropic.Anthropic()
        response = client.messages.parse(
            model=self.model,
            max_tokens=300,
            system=[{"type": "text", "text": system, "cache_control": {"type": "ephemeral"}}],
            messages=[{"role": "user", "content": text}],
            output_format=Claim,
        )
        if response.stop_reason == "refusal" or response.parsed_output is None:
            raise RuntimeError(f"no claim: stop_reason={response.stop_reason}")
        return response.parsed_output


def explain_from_env() -> ExplainProvider | None:
    return AnthropicExplain() if os.environ.get("ANTHROPIC_API_KEY") else None


def explain_input(text: str, a: int, answer: float, c: int) -> str:
    """What the model sees: the row as the player left it, then their words."""
    return f"Reihe: {a} · {answer:g} · {c}\nErklärung: {text.strip()}"


def judge_explanation(pattern: str, kind: str, solved: bool) -> str:
    """The four fields of CLAUDE.md 6: reason holds or not, answer right or not."""
    if pattern == "unclear":
        return "none"
    holds = PATTERN_KIND.get(pattern) == kind
    if solved:
        return "understood" if holds else "luck"
    return "slip" if holds else "misread"
