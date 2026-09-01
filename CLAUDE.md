# RITHMOS

Mobilspiel nach dem mittelalterlichen Zahlenkampfspiel *Rithmomachia* — von ἀριθμός,
der Zahl. Das Tagesrätsel im Spiel heißt **Middles**.

Diese Datei ist die verbindliche Projektbeschreibung. Lies sie zu Beginn jeder
Sitzung vollständig. Was hier steht, gilt; Abweichungen sind ein Wolf-Ping.

---

## 1. Worum es geht

Rithmos gewinnt man durch drei Zahlenproportionen. Diese drei sind exakt die drei
pythagoreischen Mittel — arithmetisch, geometrisch, harmonisch — also genau die
Mittelwerte, mit denen heute Durchschnitte, Wachstumsraten und Klassifikationsmodelle
bewertet werden. Ein tausend Jahre altes Spiel trainiert damit unverändert die
Fähigkeit, die wir gerade an Maschinen abgeben: verborgene Proportionsstruktur in
einem Zahlenfeld zu sehen.

**Produktversprechen:** Dieses Spiel benutzt KI, um eine menschliche Fähigkeit
aufzubauen statt sie zu ersetzen — und misst, ob das gelingt.

**Daraus die Regel, die jede Entwurfsentscheidung bindet:**

> Jedes KI-Feature muss die Fähigkeit des Spielers *ohne* Hilfe messbar erhöhen.
> Was das nicht leistet, gehört nicht ins Produkt.

Begegnet dir ein Feature, das dieser Regel widerspricht, ist das ein Wolf-Ping und
keine Ermessensfrage.

Das historische Spiel starb nicht an fehlendem Reiz, sondern an der Rechenlast.
Alle bekannten digitalen Umsetzungen bilden Brett und Regeln korrekt ab — und
reproduzieren damit genau das Hindernis. Rithmos beseitigt es.

---

## 2. Stack

| Schicht | Wahl |
|---|---|
| App | Expo, TypeScript — SDK 57, React Native 0.86, React 19.2.3 |
| Web | dasselbe Codebase über react-native-web 0.21 |
| Brettdarstellung | **normale React-Native-Views + Reanimated. Keine Spiel-Engine.** |
| Engine | eigenständiges TypeScript-Paket, keine React-, keine I/O-Importe |
| Backend | FastAPI auf Railway |
| Datenbank | PostgreSQL auf Railway |
| Abo | `react-native-purchases` (RevenueCat), braucht Development Build |
| Auslieferung | EAS Build und EAS Submit, Web-Build nach Netlify |

**Zur Brettdarstellung:** Ein 8 × 16-Feld mit rund fünfzig Steinen und
rundenbasiertem Ablauf ist eine Oberfläche, kein Spiel-Loop.
`react-native-game-engine` wird seit 2020 nicht gepflegt und scheidet aus. Skia ist
erst die richtige Antwort, wenn eine Messung auf einem günstigen Android-Gerät zeigt,
dass normale Views zu langsam sind.

### Verzeichnisse

```
/engine     reines TypeScript, keine React-, keine I/O-Importe
   rules/   die Regelfassung als Daten
   board.ts     Brett, Steine, Werte
   moves.ts     Zugerzeugung, Zugvalidierung
   capture.ts   die vier Schlagarten
   explain.ts   warum ein versuchter Schlag nicht zulässig ist
   harmony.ts   Proportionserkennung und Siegbedingungen
   claims.ts    Prüfung strukturierter Behauptungen
   search.ts    Gegner, Stärke parametrisierbar, gibt Absicht mit heraus
   solver.ts    Rätselverifikation
/app        Expo-App
/api        FastAPI: Konten, Abo, KI-Proxy, Rätselauslieferung
/ai         Provider-Adapter, Prompts, Übersetzer Sprache→Behauptung
/jobs       nächtlicher Rätselgenerator (Node, nutzt /engine)
/infra      docker-compose.yml, .env.example, Dump-Skripte
```

`engine/` ist das Kronjuwel und hat keine Abhängigkeit zu React Native, Datenbank,
Hosting oder Modellanbieter. **Ein Test prüft die Importe von `engine/` und schlägt
fehl, sobald dort etwas aus `react`, `react-native`, `fs`, `http` oder einem
Anbieter-SDK importiert wird.**

---

## 3. Die Regelfassung

Verbindlich: **Peter Mebben nach Selenus 1616** —
https://jducoeur.org/game-hist/mebben.ryth.html

Die Regeln liegen als **Daten** in `engine/rules/`, nicht als Bedingungen im Code
verstreut. Andere Fassungen sollen später als Modus nachrüstbar sein.

### Brett und Steine

8 × 16 Felder.
Weiße Pyramide = 91 aus 36 + 25 + 16 + 9 + 4 + 1.
Schwarze Pyramide = 190 aus 64 + 49 + 36 + 25 + 16.

### Zugweiten — die Falle

Mebben zählt Start- und Zielfeld mit. „Ins zweite Feld" heißt **ein** Schritt.

| Stein | Wortlaut | Schritte | Richtung |
|---|---|---|---|
| Runde | ins zweite Feld | 1 | gerade, nicht diagonal |
| Dreieck | ins dritte Feld | 2 | ausschließlich diagonal |
| Quadrat | ins vierte Feld | 3 | alle Richtungen inkl. diagonal |
| Pyramide | — | — | nach ihren Bestandteilen |

Das ist die wahrscheinlichste Fehlerquelle im ganzen Projekt. Kommentar an die
Zugerzeugung, eigener Testfall im Korpus.

### Schlagarten

Der schlagende Stein bleibt stehen und betritt das Zielfeld nicht.

- **Begegnung** — könnte im nächsten regulären Zug auf einen gegnerischen Stein
  gleichen Werts ziehen
- **Hinterhalt** — zwei oder mehr eigene Steine könnten im nächsten Zug auf das Feld
  eines gegnerischen Steins ziehen, und ihre **Summe oder Differenz** ergibt dessen
  Wert
- **Angriff** — könnte in regulärer Richtung auf einen gegnerischen Stein treffen,
  und der eigene Wert ergibt **mal oder geteilt durch** die Zahl der Felder dazwischen
  dessen Wert
- **Belagerung** — der gegnerische Stein kann weder ziehen noch von einem einzelnen
  eigenen Stein befreit werden

### Siege

- **Kleiner Sieg:** eine Harmonie aus drei Steinen
- **Großer Sieg:** vier Steine mit zwei — nicht mehr als zwei — verschiedenen Harmonien
- **Größter Sieg:** vier Steine mit allen dreien

Lage: im gegnerischen Feld, in aufsteigender Reihe, im rechten Winkel oder bei vieren
im Quadrat, **mit gleichem Abstand zueinander**.

### Die drei Harmonien

| Harmonie | Bedingung | Testbeispiel | Was b tatsächlich ist |
|---|---|---|---|
| Arithmetisch | b − a = c − b | 2, 4, 6 | arithmetisches Mittel von a und c |
| Geometrisch | a : b = b : c | 5, 10, 20 | geometrisches Mittel von a und c |
| Musikalisch | a : c = (b − a) : (c − b) | 6, 8, 12 | harmonisches Mittel von a und c |

Die rechte Spalte ist nachgerechnet und stimmt für alle drei. Daraus die
Testvorschrift: **Implementiere die Erkennung einmal über Mebbens Bedingungen und
einmal über die Mittelwertformeln. Beide müssen für jede Stellung dasselbe liefern;
Abweichung bricht den Testlauf.**

Dieser doppelte Prüfweg ist zugleich ein Verkaufsargument und gehört in den Store-Text.

---

## 4. Die Laufzeitanforderung an `harmony.ts`

Der wichtigste technische Punkt des Projekts.

Die Funktion, die alle erreichbaren Harmonien einer Stellung aufzählt, hat **zwei
Kunden**: den Deckungsgrad (Abschnitt 6) und die Bewertungsfunktion des Gegners.

Das ist kein Zufall. Der Sieg in diesem Spiel ist **konstruktiv, nicht destruktiv** —
man baut eine Anordnung, statt einen König zu schlagen. Materialzählung, die Grundlage
jeder klassischen Spielengine, ist damit fast wertlos: Man kann materiell führen und
beliebig weit vom Sieg entfernt sein. Eine brauchbare Bewertung braucht ein Maß für
**Harmonienähe** — und genau das ist diese Aufzählung. Deshalb haben die bekannten
Umsetzungen dieses Spiels keinen brauchbaren Gegner.

Also: `harmony.ts` wird nicht nur auf Korrektheit gebaut, sondern **gemessen**.
Ein Benchmark für eine typische Mittelspielstellung, Ergebnis im Repo festgehalten.
Zu langsam für einen Suchbaum ist ein Wolf-Ping, kein stiller Kompromiss.

---

## 5. Die claims-Schicht

Der Spieler soll vor einem Zug in eigenen Worten sagen können, *warum*. Das System
prüft getrennt: ob der Zug gut ist (weiß die Engine) und ob die Begründung zutrifft.

**Die Wahrheit kommt immer aus der Engine, nie aus dem Sprachmodell.** Das Modell
übersetzt nur Freitext in eine prüfbare Behauptung.

```ts
type Claim =
  | { kind: 'capture_threat'; from: PieceId; to: PieceId;
      method?: 'meeting' | 'ambush' | 'assault' | 'siege' }
  | { kind: 'harmony_reachable'; pieces: PieceId[];
      harmony?: 'arithmetic' | 'geometric' | 'musical'; withinMoves: number }
  | { kind: 'defends'; piece: PieceId; against: PieceId }
  | { kind: 'escapes'; piece: PieceId; from: PieceId }
  | { kind: 'blocks_harmony'; opponentPieces: PieceId[] }
  | { kind: 'unverifiable'; reason: string }

type ClaimResult = { holds: boolean; evidence: string; checkedAt: 'before' | 'after' }

function verifyClaim(pos: Position, move: Move, claim: Claim): ClaimResult
```

`verifyClaim` ist eine reine Funktion, deterministisch und vollständig getestet,
bevor ein Sprachmodell sie zu sehen bekommt.

**Regeln für die Übersetzung, nicht verhandelbar:**

1. Das Modell bekommt Stellung, geplanten Zug und Spielertext — **nicht** die
   Bewertung des Zuges. Sonst leitet es die Begründung aus dem Urteil ab.
2. Ausschließlich strukturierte Ausgabe nach obigem Schema. Kein Fließtext.
3. Nicht übersetzbar → `unverifiable`. Die App sagt dann ehrlich „Das kann ich nicht
   gegen die Stellung prüfen" und wertet nichts.
4. Nennt die Behauptung Steine, die es nicht gibt: einmal neu übersetzen, dann
   `unverifiable`.

### Die vier Felder der Rückmeldung

| | Zug ist stark | Zug ist schwach |
|---|---|---|
| **Begründung trifft zu** | Verstanden | Rechenfehler — richtig gedacht, falsch gerechnet |
| **Begründung trifft nicht zu** | **Glück** | Missverständnis |

Das Feld **Glück** ist der Grund, warum es dieses Feature gibt: Kein klassisches Spiel
kann es finden, weil die Engine nur sieht, dass der Zug gut war. Erst der Sprachanteil
macht sichtbar, dass jemand aus dem falschen Grund richtig gezogen hat.

Der Ton in allen vier Feldern ist neugierig, nie prüfend. Bei „Glück" darf sich der
Spieler nicht bestraft fühlen — er hat einen guten Zug gemacht. Bei Unsicherheit über
eine Formulierung: Wolf-Ping. Der Modus ist immer freiwillig, überspringbar und
blockiert nie einen Zug.

---

## 6. Die Maschinen-Deckung

Die Kennzahl ist nicht ELO, sondern: **Wie viel von dem, was die Engine sieht, sieht
der Spieler ohne Hilfe?**

Die Harmonie-Anzeige ist ein Regler:

| Stufe | Anzeige |
|---|---|
| 3 | alle erreichbaren Harmonien hervorgehoben — der Einstieg |
| 2 | nur die Anzahl, nicht wo |
| 1 | nur ein Hinweis, dass eine existiert |
| 0 | nichts |

Ab Stufe 1 markiert der Spieler vor dem Zug Felder, von denen er glaubt, dass sie eine
erreichbare Harmonie bilden. Die Engine gleicht ab.

```
Deckung eines Zuges = |markiert ∩ tatsächlich| / |tatsächlich|
```

Gleitendes Fenster über die letzten fünfzig Züge, Verlauf pro Nutzer, angezeigt als
Trend über Wochen — nie als Momentwert.

**Sie funktioniert vollständig ohne Sprachmodell.** Deshalb steht das
Alleinstellungsmerkmal in einer auslieferbaren App, bevor ein Cent Modellkosten
anfällt.

---

## 7. Die erklärenden Funktionen

Alle nach demselben Muster: **Die Engine liefert den Sachverhalt, das Modell
formuliert ihn.** Zwei davon laufen auch ohne Modell mit festem Text — deshalb
kommt der deterministische Teil in Phase 2 und die Ausformulierung in Phase 4.

### 7.1 Der Fehlschlag-Erklärer

Bei einem unzulässigen Schlag sagt die App in einem Satz, **welche Bedingung fehlt**:

> „Angriff über zwei Felder: 5 × 2 = 10, dein Ziel hat 15. Mit einem Feld Abstand
> würde es passen."

`engine/explain.ts` liefert das strukturiert: welche Schlagart geprüft wurde und
woran es scheiterte. Je Schlagart ein Testfall.

Das ist keine Bequemlichkeit, sondern eine Vertrauensfrage. Die einzige dokumentierte
Nutzerkritik im gesamten Feld vergleichbarer Umsetzungen lautet, dass gültige Schläge
nicht registriert würden. In einem Zahlenspiel kann der Spieler nicht unterscheiden,
ob das Programm falsch rechnet oder er die Regel falsch verstanden hat — und diese
Unsicherheit zerstört das Vertrauen in alles andere.

### 7.2 Der Gegner mit offenen Karten

Ein Lernmodus, in dem der Computergegner seine Absicht offenlegt:

> „Ich baue an einer geometrischen Harmonie in der linken Hälfte. Dein Stein 12 steht
> mir im Weg."

`search.ts` gibt die Absicht als strukturiertes Ergebnis mit heraus; das Modell
formuliert sie und entscheidet nichts. Damit wird der schwerste Teil des Spiels
lernbar: die Absicht des Gegners lesen.

### 7.3 Der Zwei-Stimmen-Coach

Wahlweise **Mönch** oder **Analystin**. Gleicher Inhalt, zwei Rahmungen, jederzeit
umschaltbar. Technisch eine Prompt-Variante, kein zweites System.

> **Mönch:** „Du hast eine musikalische Proportion geschlossen. Boethius nannte sie so,
> weil sie den Abstand selbst ins Verhältnis setzt."
>
> **Analystin:** „Du hast eine harmonische Proportion geschlossen — dieselbe Beziehung
> steckt im harmonischen Mittel, mit dem man Durchschnittsgeschwindigkeiten bildet und
> Klassifikationsmodelle bewertet. Der F1-Score ist genau das."

Die Zuordnung Harmonie → moderner Anwendungsfall gehört als Datentabelle nach
`engine/rules/`, nicht in den Prompt. Sonst erfindet das Modell Anwendungsfälle.

---

## 8. Zuständigkeitsgrenze der KI

| Funktion | Zuständig |
|---|---|
| Zugvalidierung, Harmonieerkennung, Siegprüfung | Engine |
| `verifyClaim` | Engine |
| Grund für abgelehnten Schlag | Engine (`explain.ts`) |
| Absicht des Gegners | Engine (`search.ts`) |
| Gegnerstärke | Engine — Suchtiefe und Bewertungsrauschen |
| Rätselerzeugung und -verifikation | Generator und Solver, deterministisch |
| Deckungsgrad | Engine |
| Übersetzung Spielertext → Behauptung | Sprachmodell, strukturierte Ausgabe |
| Ausformulierung, Coach, Regelchat | Sprachmodell |

**Das Sprachmodell formuliert und übersetzt. Es entscheidet nie.** Jede Modellausgabe,
die einen Zug oder eine Stellung benennt, wird vor der Anzeige gegen die Engine
geprüft und bei Abweichung verworfen.

Die verwendete Regelfassung wird im Spiel sichtbar genannt, mit Quellenangabe, und
ist später als Modus umschaltbar.

---

## 9. Phasen

| Phase | Inhalt |
|---|---|
| **1** | **Engine, ohne App.** Gerüst und Importtest; Brett, Steine, Zugerzeugung; die vier Schlagarten einzeln; `explain.ts`; `harmony.ts` doppelt plus Benchmark; `claims.ts`; `search.ts` mit Absicht; `solver.ts` |
| **2** | Expo-App, Brett aus Views, Gegner lokal, Assistenzstufen, Deckungsgrad, Fehlschlag-Erklärer mit festem Text, Regelfassungs-Bildschirm. **Erster store-fähiger Stand, ohne Modellkosten** |
| **3** | FastAPI, PostgreSQL, Konten, Deckungsgrad über Geräte, Tagesrätsel **Middles** mit nächtlichem Generator und Verteilungsanzeige nach dem Lösen |
| **4** | Sprachmodell: Übersetzer, Begründungsmodus, Coach, Gegner mit offenen Karten, Regelchat. Ab hier Kennzeichnungspflicht nach AI Act Artikel 50 |
| **5** | Abo, serverseitige Belegprüfung, 3,99–5,99 €/Monat. **Wolf-Ping vorher** |

**Kosten:** Coach-Erklärungen sind über einen Stellungs-Hash cachebar, der
Begründungsmodus **nicht** — jeder Spielersatz ist neu. Eigenes Kontingent, eigene
Messung ab Tag eins, Deckel der still auf „heute nicht mehr verfügbar" schaltet.
Fällt das Modell aus, bleibt das Spiel vollständig spielbar. Die KI-Schicht ist
additiv, niemals tragend.

---

## 10. Tests

- **Importprüfung** für `engine/`
- **Doppelte Harmonieerkennung** — Mebben-Bedingungen gegen Mittelwertformeln
- **Benchmark für `harmony.ts`**, Ergebnis im Repo
- **Je Schlagart** positive und negative Fälle, inklusive Randfälle bei null Feldern
  Abstand und nicht aufgehender Division
- **`explain.ts`** — je Schlagart ein Fall, in dem die Begründung geprüft wird
- **`verifyClaim`** — je Claim-Typ ein zutreffender und ein nicht zutreffender Fall,
  plus ein Fall mit nicht existierendem Stein
- **Regressionskorpus** fester Stellungen mit erwarteter Menge legaler Züge
- **Modellausgaben** — gegen das Schema validiert, jede Stein-ID gegen die Stellung
  geprüft, bevor sie die Engine erreicht

Prüfliste vor jeder Auslieferung: Testlauf grün, Regressionskorpus unverändert, ein
vollständiges Spiel von Hand durchgespielt, ein Tagesrätsel von Hand gelöst.

---

## 11. Ablösbarkeit

1. `engine/` bleibt frei von Framework-, Datenbank- und Anbieterabhängigkeiten,
   überwacht durch den Importtest
2. Alle Modellaufrufe über **eine einzige Datei** mit eigenen Schlüsseln aus
   Umgebungsvariablen. Keine plattformverwalteten Sammel-Schlüssel.
3. Eigene Datenbankinstanz, dokumentiertes Schema, Dump-Skript ab Tag eins
4. `docker-compose.yml` und `.env.example` ab dem ersten Commit gepflegt
5. Ablöse-Test alle vier Wochen: klonen, starten, ein Spiel durchspielen

---

## 12. Betriebsmodus

**Autonom:** Engine, Tests, Gerüst, Oberfläche, Infrastrukturdateien.

**Wolf-Ping:** Datenmodell-Schnitt; jede Abhängigkeit über Expo, React Native,
Reanimated, Vitest, FastAPI, PostgreSQL hinaus; alles was die Ablösbarkeit berührt;
jede Mehrdeutigkeit der Regelfassung; die Formulierungen der vier Felder aus
Abschnitt 5; `harmony.ts` zu langsam; vor Phase 5.

Format: kurze klare Frage, zwei bis drei Varianten mit je einem Satz Konsequenz,
dazu eine Empfehlung mit Begründung.

**Abbruchkriterien — hier stoppen und fragen:**

- Die Regelfassung ist mehrdeutig und du müsstest raten
- Ein Testfall ist nicht erfüllbar, ohne die Regeln zu beugen
- Die beiden Harmonieerkennungen widersprechen sich und der Grund ist nicht auffindbar
- Der Solver findet für erzeugte Rätsel systematisch mehrere Lösungen
- **Eine Festlegung dieser Datei stellt sich als falsch heraus**

Der letzte Punkt ist ausdrücklich erwünscht.

**Arbeitsweise:** Ein Fix pro Commit. Diagnose vor Änderung. Nie auf `main`
committen — immer Branch, dann Pull Request. Tagesreport statt Zwischenmeldungen.
