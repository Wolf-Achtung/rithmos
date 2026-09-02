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
from typing import Any, Protocol

from pydantic import BaseModel, Field, ValidationError

PROMPT_VERSION = 1
MODEL = os.environ.get("RITHMOS_LLM_MODEL", "claude-opus-5")

KIND_NAME = {"arithmetic": "arithmetisch", "geometric": "geometrisch", "musical": "musikalisch"}
MEAN_NAME = {"arithmetic": "arithmetische Mittel", "geometric": "geometrische Mittel", "musical": "harmonische Mittel"}

SYSTEM = """Du formulierst für Middles, ein Zahlenrätsel nach dem mittelalterlichen Rithmomachia.
Drei Zahlen a, b, c bilden eine Harmonie: b ist das arithmetische, geometrische oder harmonische
(bei Boethius: musikalische) Mittel von a und c. Du bekommst die Fakten als JSON. Du erfindest
keine Zahl und keine Zuordnung: Jede Zahl in deinem Text muss in den Fakten vorkommen, jede
Mittelart-Zuordnung muss genau so lauten wie angegeben — auch bei den beiden Lügen, die absichtlich
falsch sind und trotzdem überzeugend klingen sollen.

Vier Texte, jeder ein einziger deutscher Satz, höchstens 200 Zeichen, kein Emoji, keine Anführungszeichen:
- monk: die Stimme eines Mönchs um 1050, der Boethius gelesen hat. Ruhig, konkret, über Proportion und Ordnung.
- analyst: die Stimme einer Datenanalystin heute. Nennt, wo dieses Mittel heute gebraucht wird (Durchschnitt,
  Wachstumsrate, Durchschnittsgeschwindigkeit, F1-Score, Parallelschaltung, Blenden), mit den Zahlen des Rätsels.
- truth: erklärt in einem Satz, warum b das genannte Mittel von a und c ist (mit der Rechnung).
- lies: zwei Sätze im selben Ton wie truth, die die angegebenen falschen Behauptungen aufstellen,
  je mit einer plausibel klingenden Begründung. Kein Hinweis, dass sie falsch sind.
Die beiden Stimmen dürfen sich widersprechen; beide haben recht."""


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
    if str(f.b) not in n.truth or KIND_NAME[f.kind] not in n.truth.lower() and MEAN_NAME[f.kind] not in n.truth:
        problems.append("truth: does not name b and its kind")
    for i, lie in enumerate(f.lies):
        text = n.lies[i]
        if str(lie["value"]) not in text or (
            KIND_NAME[lie["kind"]] not in text.lower() and MEAN_NAME[lie["kind"]] not in text
        ):
            problems.append(f"lie{i + 1}: does not state its number and kind")
    return problems


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
        "mittelart_von_b": KIND_NAME[f.kind],
        "verhaeltnis_a_b_c": f.ratio,
        "truth": {"zahl": f.truth["value"], "mittelart": KIND_NAME[f.truth["kind"]]},
        "lies": [{"zahl": lie["value"], "mittelart": KIND_NAME[lie["kind"]]} for lie in f.lies],
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
