# RITHMOS

Mobilspiel nach dem mittelalterlichen Zahlenkampfspiel *Rithmomachia* — von ἀριθμός,
der Zahl. Das Tagesrätsel heißt **Middles** und ist das Produkt.

Diese Datei ist die verbindliche Projektbeschreibung. Lies sie zu Beginn jeder
Sitzung vollständig. Was hier steht, gilt; Abweichungen sind ein Wolf-Ping.

Zweite Fassung, September 2026. Die erste Fassung setzte das Vollspiel an den
Anfang; nach Phase 3 stellte sich das als falsch heraus (Abschnitt 13). Engine,
API und Regelfassung sind unverändert übernommen.

---

## 1. Worum es geht

Rithmos gewinnt man durch drei Zahlenproportionen. Diese drei sind exakt die drei
pythagoreischen Mittel — arithmetisch, geometrisch, harmonisch — also genau die
Mittelwerte, mit denen heute Durchschnitte, Wachstumsraten und Klassifikationsmodelle
bewertet werden. Ein tausend Jahre altes Spiel trainiert damit unverändert die
Fähigkeit, die wir gerade an Maschinen abgeben: verborgene Proportionsstruktur in
einem Zahlenfeld zu sehen.

**Der Kern in einem Satz, den ein Fremder in zehn Sekunden versteht:**

> Drei Zahlen. Eine fehlt. Welche macht die Reihe harmonisch?

2 – ? – 6: die Vier, arithmetisch. 5 – ? – 20: die Zehn, geometrisch.
6 – ? – 12: die Acht, musikalisch. Das ist die ganze Substanz. Alles andere —
Brett, Steine, Schlagarten — ist Ausbau für die, die tiefer wollen.

**Was kein anderes Zahlenspiel kann:** „Musikalisch" ist kein Name, sondern wörtlich.
6 : 8 : 12 sind die Frequenzverhältnisse Quarte und Quinte, 6 : 12 die Oktave.
Jede Harmonie dieses Spiels lässt sich hören. Der Dreiklang nach dem Lösen gehört
zum Produkt, nicht zur Dekoration.

**Produktversprechen:** Dieses Spiel benutzt KI, um eine menschliche Fähigkeit
aufzubauen statt sie zu ersetzen — und misst, ob das gelingt.

**Daraus die Regel, die jede Entwurfsentscheidung bindet:**

> Jedes KI-Feature muss die Fähigkeit des Spielers *ohne* Hilfe messbar erhöhen.
> Was das nicht leistet, gehört nicht ins Produkt.

Begegnet dir ein Feature, das dieser Regel widerspricht, ist das ein Wolf-Ping und
keine Ermessensfrage.

Das historische Spiel starb nicht an fehlendem Reiz, sondern an der Rechenlast.
Die erste Fassung dieses Projekts nahm die Rechenlast weg und ließ die
Verständnislast stehen: 48 Steine, vier Schlagarten, drei Harmonien mit
Lagebedingungen auf dem ersten Bildschirm. Das tut heute niemand mehr. Rithmos
beseitigt beides — in dieser Reihenfolge: erst die Verständnislast, dann die
Rechenlast.

---

## 2. Das Erlebnis

### Stufen

| Stufe | Inhalt | Zustand |
|---|---|---|
| **0** | Engine, API, Konten, Generator, Deploy-Kette | fertig, bleibt unverändert |
| **1** | **Middles ohne Brett.** Ein Rätsel am Tag, drei Versuche, teilbares Ergebnis, Dreiklang zum Anhören, ein Satz dazu, wo dieses Mittel heute in der Welt steckt (fester Text) | gebaut |
| **2** | Progression: erst arithmetisch, dann geometrisch, dann musikalisch, dann gemischt („welches Mittel?"), dann vier Zahlen mit zwei Mitteln. Deckung je Mittelart über Wochen | **jetzt**, auf dem Gerät gebaut |
| **3** | Die Erzählerin: nach dem Lösen zwei Stimmen (Mönch, Analystin) und „Wer lügt?“ mit drei Erklärungen, eine stimmt. Der Generator liefert Wahrheit und Lügen als Fakten, das Modell formuliert, der Server prüft jede Zahl. Cachebar pro Rätsel, Tageslimit, AI-Act-Kennzeichnung | gebaut, Schlüssel auf Railway offen |
| **4** | Das kleine Brett: 4 × 8, vier Steine je Seite (Weiß 2 · 4 · 6 · 8, Schwarz 3 · 6 · 9 · 12), nur die Begegnung, Sieg = eine Harmonie im gegnerischen Feld. Begründung vor dem Zug aus Engine-Angeboten, vier Felder, Gegner mit offenen Karten (fester Text). Öffnet sich mit der fünften Übungsstufe | gebaut; Freitext-Begründung über das Modell offen |
| **5** | Das volle Brett nach Mebben hinter einer Wahl „Welches Brett?“, mit Markierungsschritt vor jedem eigenen Zug (Deckung auf dem Brett, `PUT /v1/coverage`, auf der Deckungsseite unter „Auf dem Brett“). Regelchat im Regelblatt: `POST /v1/rules/ask`, die Regelfassung als einziger Kontext, jede Zahl geprüft, „steht nicht in der Regelfassung“ als fester Satz, Antwort je Frage gecacht, zwanzig Fragen pro Konto und Tag | gebaut; auf dem Web nicht mit laufendem Modell durchgespielt |
| **6** | Abo, serverseitige Belegprüfung. **Wolf-Ping vorher** | zuletzt |

Die vorhandene Brett-Oberfläche aus der ersten Fassung (`app/src/screens/GameScreen`,
`Board`, `SetupScreen`) bleibt im Repo, verschwindet aber aus der Navigation, bis
Stufe 4 sie in vereinfachter Form zurückholt.

### Middles, Stufe 1, genau

- Ein Bildschirm. Drei große Felder, zwei Zahlen stehen, die dritte fehlt. Vier
  Angebote zum Antippen. Keine Koordinaten, keine Steine, keine Zugregeln.
- Drei Versuche. Nach dem dritten Fehlversuch wird aufgelöst.
- Richtig: die drei Zahlen schwingen zusammen, der Dreiklang erklingt, ein Satz
  erscheint. Ein Satz, nicht drei.
- Serie („12 Tage in Folge") und ein teilbares Ergebnis in Textform:
  `Middles Nº 47 · 2/3` plus drei Kästchen. Kein Emoji im Produkt.
- Verteilung nach dem Lösen wie bisher, über die API.
- Ohne Server läuft alles lokal, wie bisher. Die Rätsel kommen dann aus
  `jobs/src/middles.ts` im Bundle.
- Die vier Angebote enthalten immer die beiden anderen Mittel als Ablenker,
  wenn sie ganzzahlig sind. Wer 9 statt 8 tippt, hat arithmetisch gedacht — das
  ist die Rückmeldung wert.
- Die Zahlen kommen nicht aus den Steinen der Regelfassung, sondern aus allen
  ganzzahligen Tripeln bis 64 mit c höchstens 4·a. Grund: die Steine Mebbens
  ergeben nur zwei musikalische Tripel für Weiß und keins für Schwarz. Die
  Brettform desselben Tages bleibt im Datensatz für Stufe 4.
- Der Dreiklang klingt in den Verhältnissen der drei Zahlen selbst, a : b : c über
  einem freien Grundton. Durch c ≤ 4·a bleibt er innerhalb von zwei Oktaven.
- **Stimmen statt Tippen.** Wo ein Dauerton möglich ist (Web Audio) und der Klang an
  ist, gibt es keine Angebote: Der Spieler zieht den fehlenden Ton zwischen die
  beiden gegebenen, ganzzahlige Mittel rasten ein, Loslassen ist die Antwort
  (± 25 Cent). Die Abweichung in Cent wird mit dem Ergebnis gespeichert. Stumm oder
  ohne Dauerton bleiben die vier Angebote. Auf iOS und Android braucht der Dauerton
  eine weitere Abhängigkeit (`react-native-audio-api`) — Wolf-Ping, bis dahin Angebote.

- **Fundstück des Tages.** Jeder zweite Tag ist ein echtes Vorkommen aus
  `engine/rules/finds.ts` (Monochord, Villa Emo, Blendenreihe, F1-Score, …): die
  Zahlen des Fundstücks, nach dem Lösen sein Satz, Ort und Quelle. Ein Test lässt
  jedes Fundstück durch die Erkennung; was nicht verifiziert, kommt nicht ins
  Produkt. Die Übung nimmt an jedem vierten Rätsel der Stufen 1–3 ein Fundstück
  ihrer Mittelart.

- **Die Kette.** Ein zweites Tagesrätsel, konstruktiv statt abfragend: zwölf Zahlen
  liegen aus, der Spieler legt sie zu einer Kette, in der je drei aufeinander
  folgende eine Harmonie bilden (2 · 4 · 6 · 9 · 12 · 16 · 24 · 48). Die längste
  Kette kennt die Suche (`jobs/src/chain.ts`); Ergebnis ist die erreichte Länge,
  teilbar als `Kette Nº 47 · 6/7`. Auf dem Gerät erzeugt, kein Server.

- **Harmonie-Jagd.** Ein Foto von etwas Zählbarem; der Spieler tippt zuerst, ob
  darin eine Harmonie steckt; dann zählt das Bildmodell nur (Namen und Anzahlen,
  `POST /v1/hunt`, sechs Jagden pro Konto und Tag, kein Bild wird gespeichert),
  und die Engine in der App entscheidet, welche Anzahlen ein Mittel bilden. Das
  Modell nennt nie eine Harmonie. Erreichbar hinter dem Zahnrad.

### Üben, Stufe 2, genau

- Das Tagesrätsel bleibt für alle gleich. Die Progression ist ein zweiter Bereich
  „Üben": unbegrenzt viele Rätsel, auf dem Gerät erzeugt und geprüft, kein Server.
- Fünf Stufen: arithmetisch, geometrisch, musikalisch, „welches Mittel?" (drei
  Zahlen stehen, die Mittelart wird getippt, zwei Versuche), vier Zahlen (a und d
  stehen, harmonisches und arithmetisches Mittel fehlen, sechs Angebote, zwei
  Tipps — die Tetraktys 6 : 8 : 9 : 12).
- Eine Stufe öffnet sich nach fünf gelösten Rätseln der vorigen. Jedes dritte
  Rätsel nimmt die Mittelart dran, die in der Trefferquote hinterherhinkt.
- Die Trefferquote je Mittelart (Abschnitt 7) speist sich aus Tagesrätsel und
  Übung, gleitendes Fenster über die letzten fünfzig, Verlauf nach Wochen. Sie
  liegt vorerst nur auf dem Gerät; der Server-Schnitt ist ein offener Wolf-Ping.

### Gestaltung

Die Gestaltungsrichtung wird einmal gewählt und dann nicht mehr verhandelt. Sie
steht in `app/src/theme.ts` als Tokens; nichts in der App trägt eine Farbe oder
Schrift, die dort nicht steht.

Grundsätze, unabhängig von der Richtung:

- Ein Satz pro Bildschirm. Regelbuch-Ton („eigene Steine als Angreifer antippen")
  kommt nicht vor. Wenn ein Bildschirm eine Anleitung braucht, ist der Bildschirm
  falsch.
- Zahlen sind das Bild. Sie sind groß, gesetzt, und haben Luft.
- Klang ist Teil der Rückmeldung, nie Hintergrund. Stumm schaltbar.
- Bewegung erklärt, sie schmückt nicht: die Zahlen schwingen zusammen, wenn eine
  Harmonie schließt. Sonst bewegt sich nichts.
- Dunkel- und Hellmodus von Anfang an.
- Keine Chips-Reihen zur Konfiguration auf dem ersten Bildschirm. Einstellungen
  liegen hinter einem Zahnrad.

---

## 3. Stack

| Schicht | Wahl |
|---|---|
| App | Expo, TypeScript — SDK 57, React Native 0.86, React 19.2.3 |
| Web | dasselbe Codebase über react-native-web 0.21, Auslieferung Netlify |
| Darstellung | **normale React-Native-Views + Reanimated. Keine Spiel-Engine.** |
| Klang | `expo-audio` für die Dreiklänge; auf dem Web die Web Audio API. Töne werden erzeugt, nicht als Dateien mitgeliefert |
| Engine | eigenständiges TypeScript-Paket, keine React-, keine I/O-Importe |
| Backend | FastAPI auf Railway, `api/` |
| Datenbank | PostgreSQL auf Railway, Schema als SQL in `api/schema/` |
| Rätsel | nächtlicher Generator in `jobs/`, verifiziert mit dem Solver |
| Abo | `react-native-purchases` (RevenueCat), braucht Development Build. Stufe 6 |
| Auslieferung | EAS Build und EAS Submit; Web-Build nach Netlify über `netlify.toml` |

### Verzeichnisse

```
/engine     reines TypeScript, keine React-, keine I/O-Importe
   rules/   die Regelfassung als Daten
   board.ts moves.ts capture.ts explain.ts harmony.ts claims.ts search.ts solver.ts
/app        Expo-App
/api        FastAPI: Konten, Deckung, Rätsel, später KI-Proxy und Abo
/jobs       nächtlicher Rätselgenerator (Node, nutzt /engine)
/infra      docker-compose.yml, .env.example, Dump-Skript
```

`engine/` ist das Kronjuwel und hat keine Abhängigkeit zu React Native, Datenbank,
Hosting oder Modellanbieter. **Ein Test prüft die Importe von `engine/` und schlägt
fehl, sobald dort etwas aus `react`, `react-native`, `fs`, `http` oder einem
Anbieter-SDK importiert wird.**

Das API-Image wird aus dem `Dockerfile` im Repo-Root gebaut; Railway baut aus dem
Root-Verzeichnis, das Root Directory des Dienstes bleibt leer. Der Generator hat
sein eigenes `jobs/Dockerfile` für den Cron-Dienst.

---

## 4. Die Regelfassung

Verbindlich: **Peter Mebben nach Selenus 1616** —
https://jducoeur.org/game-hist/mebben.ryth.html

Die Regeln liegen als **Daten** in `engine/rules/`, nicht als Bedingungen im Code
verstreut. Andere Fassungen sollen später als Modus nachrüstbar sein. Punkte, die
gegen die Quelle noch nicht geprüft sind, stehen dort unter `unverified` und werden
im Regelbildschirm angezeigt.

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

Das ist die wahrscheinlichste Fehlerquelle im ganzen Projekt — sie ist in der
ersten Fassung einmal in der Anzeige aufgetreten und hat seitdem einen eigenen
Wortlaut-Test.

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

| Harmonie | Bedingung | Testbeispiel | Was b tatsächlich ist | Klang |
|---|---|---|---|---|
| Arithmetisch | b − a = c − b | 2, 4, 6 | arithmetisches Mittel von a und c | 1 : 2 : 3, Oktave und Quinte darüber |
| Geometrisch | a : b = b : c | 5, 10, 20 | geometrisches Mittel von a und c | 1 : 2 : 4, zwei Oktaven |
| Musikalisch | a : c = (b − a) : (c − b) | 6, 8, 12 | harmonisches Mittel von a und c | 3 : 4 : 6, Quarte und Quinte, Oktave außen |

Die Mittelwert-Spalte ist nachgerechnet und stimmt für alle drei. Daraus die
Testvorschrift, die in `engine/harmony.ts` umgesetzt ist: **Die Erkennung läuft
einmal über Mebbens Bedingungen und einmal über die Mittelwertformeln. Beide müssen
für jede Stellung dasselbe liefern; Abweichung bricht den Testlauf.**

Die Klang-Spalte ist die Grundlage des Dreiklangs. Die Grundfrequenz ist frei, die
Verhältnisse sind es nicht.

---

## 5. Die Laufzeitanforderung an `harmony.ts`

Die Funktion, die alle erreichbaren Harmonien einer Stellung aufzählt, hat zwei
Kunden: den Deckungsgrad auf dem Brett und die Bewertungsfunktion des Gegners.

Der Sieg in diesem Spiel ist **konstruktiv, nicht destruktiv** — man baut eine
Anordnung, statt einen König zu schlagen. Materialzählung ist damit fast wertlos.
Eine brauchbare Bewertung braucht ein Maß für **Harmonienähe**, und genau das ist
diese Aufzählung. Deshalb haben die bekannten Umsetzungen dieses Spiels keinen
brauchbaren Gegner.

`harmony.ts` wird gemessen, Ergebnis in `engine/BENCHMARK.md`. Zu langsam für einen
Suchbaum ist ein Wolf-Ping, kein stiller Kompromiss.

---

## 6. Die claims-Schicht

Der Spieler soll vor einem Zug in eigenen Worten sagen können, *warum*. Das System
prüft getrennt: ob der Zug gut ist (weiß die Engine) und ob die Begründung zutrifft.

**Die Wahrheit kommt immer aus der Engine, nie aus dem Sprachmodell.** Das Modell
übersetzt nur Freitext in eine prüfbare Behauptung. `verifyClaim` in
`engine/claims.ts` ist eine reine Funktion, deterministisch und getestet.

Die vier Felder der Rückmeldung:

| | Zug ist stark | Zug ist schwach |
|---|---|---|
| **Begründung trifft zu** | Verstanden | Rechenfehler |
| **Begründung trifft nicht zu** | **Glück** | Missverständnis |

Das Feld **Glück** ist der Grund, warum es dieses Feature gibt. Der Ton in allen vier
Feldern ist neugierig, nie prüfend. Die Formulierungen legt Wolf fest. Der Modus ist
freiwillig, überspringbar und blockiert nie einen Zug. Gehört zu Stufe 4.

---

## 7. Die Maschinen-Deckung

Die Kennzahl ist nicht ELO, sondern: **Wie viel von dem, was die Engine sieht, sieht
der Spieler ohne Hilfe?**

**In Middles (Stufe 2):** Trefferquote je Mittelart, gleitendes Fenster über die
letzten fünfzig Rätsel, als Trend über Wochen. Wer arithmetisch bei 90 % steht und
musikalisch bei 40 %, sieht das — und die Progression zieht die Mittelart nach vorn,
die hinterherhinkt.

**Auf dem Brett (Stufe 4 und 5):** Der Spieler markiert vor dem Zug Felder, von denen
er glaubt, dass sie eine erreichbare Harmonie bilden. Die Engine gleicht ab.

```
Deckung eines Zuges = |markiert ∩ tatsächlich| / |tatsächlich|
```

Beides funktioniert vollständig ohne Sprachmodell und wird über Geräte hinweg
gespeichert (`PUT /v1/coverage`, seit Phase 3).

---

## 8. Die erklärenden Funktionen

Alle nach demselben Muster: **Die Engine liefert den Sachverhalt, das Modell
formuliert ihn.** Jede läuft zuerst mit festem Text und bekommt das Modell erst,
wenn der feste Text sich bewährt hat.

### 8.1 Die Erzählerin — Stufe 1 fest, Stufe 3 Modell

Nach jedem gelösten Rätsel ein Satz: welches Mittel es war und wo es heute in der
Welt steckt. Zwei Stimmen, jederzeit umschaltbar, technisch eine Prompt-Variante:

> **Mönch:** „Du hast eine musikalische Proportion geschlossen. Boethius nannte sie
> so, weil sie den Abstand selbst ins Verhältnis setzt."
>
> **Analystin:** „8 ist das harmonische Mittel von 6 und 12 — so berechnet man die
> Durchschnittsgeschwindigkeit, wenn du hin 6 und zurück 12 fährst. Und so bewertet
> man Klassifikationsmodelle: der F1-Score ist genau dieses Mittel."

Die Zuordnung Harmonie → Anwendungsfall liegt als Datentabelle in
`engine/rules/applications.ts`. Das Modell darf daraus wählen und formulieren, nicht
erfinden. Ein Satz pro Rätsel, cachebar über die Rätsel-ID; die Kosten sind damit
pro Tag begrenzt, nicht pro Spieler.

### 8.2 Der Fehlschlag-Erklärer — Stufe 4

`engine/explain.ts` liefert bei einem abgelehnten Schlag strukturiert, welche
Bedingung fehlt. Fester Text existiert seit Phase 2. In einem Zahlenspiel kann der
Spieler nicht unterscheiden, ob das Programm falsch rechnet oder er die Regel falsch
verstanden hat — der Erklärer ist eine Vertrauensfrage.

### 8.3 Der Gegner mit offenen Karten — Stufe 4

`search.ts` gibt die Absicht als strukturiertes Ergebnis mit heraus; das Modell
formuliert sie und entscheidet nichts.

### 8.4 Der Regelchat — Stufe 5

Die Regelfassung liegt als Text im API-Dienst (`RULES_TEXT` in `llm.py`, aus
Abschnitt 4 und den ungeprüften Punkten). Das Modell antwortet nur daraus und
meldet, wenn die Frage dort nicht beantwortet ist; dann zeigt der Server einen
festen Satz, nie den Modelltext. Zahlen in der Antwort müssen in der Regelfassung
oder in der Frage stehen. Gleiche Frage, gleiche Antwort: gecacht über die
normalisierte Frage und die Prompt-Version.

---

## 9. Zuständigkeitsgrenze der KI

| Funktion | Zuständig |
|---|---|
| Zugvalidierung, Harmonieerkennung, Siegprüfung | Engine |
| Rätselerzeugung und -verifikation | Generator und Solver, deterministisch |
| Rätselprüfung auf dem Server | Vergleich mit der gespeicherten Lösung, keine Engine im Server |
| Deckungsgrad | Engine, beziehungsweise Trefferquote in Middles |
| `verifyClaim`, Grund für abgelehnten Schlag, Absicht des Gegners | Engine |
| Erzählerin, Coach, Regelchat, Übersetzung Spielertext → Behauptung | Sprachmodell |

**Das Sprachmodell formuliert und übersetzt. Es entscheidet nie.** Jede Modellausgabe,
die einen Zug, eine Zahl oder eine Stellung benennt, wird vor der Anzeige gegen die
Engine geprüft und bei Abweichung verworfen.

Alle Modellaufrufe laufen über den API-Dienst (`api/`), nie aus der App. Der
Schlüssel liegt nur auf Railway. Eine einzige Datei kapselt den Anbieter. Eigenes
Kontingent pro Konto und Tag, Deckel, der still auf „heute nicht mehr verfügbar"
schaltet. Fällt das Modell aus, bleibt das Spiel vollständig spielbar. Die KI-Schicht
ist additiv, niemals tragend. Kennzeichnung nach AI Act Artikel 50 ab Stufe 3.

Die verwendete Regelfassung wird im Spiel sichtbar genannt, mit Quellenangabe.

---

## 10. Tests

- **Importprüfung** für `engine/`
- **Doppelte Harmonieerkennung** — Mebben-Bedingungen gegen Mittelwertformeln
- **Benchmark für `harmony.ts`**, Ergebnis im Repo
- **Je Schlagart** positive und negative Fälle, inklusive Randfälle
- **`explain.ts`**, **`verifyClaim`** — je Fall zutreffend und nicht zutreffend
- **Regressionskorpus** fester Stellungen
- **Generator:** dreißig Tage Rätsel, jedes eindeutig, der mittlere Stein zieht
- **API:** pytest gegen ein echtes PostgreSQL
- **Middles-Oberfläche:** Store-Logik als reine Funktionen getestet; Web-Build per
  Chromium-Screenshot durchgespielt
- **Modellausgaben** — gegen das Schema validiert, jede Zahl gegen das Rätsel
  geprüft, bevor sie angezeigt wird

Prüfliste vor jeder Auslieferung: Testlauf grün, Regressionskorpus unverändert,
ein Tagesrätsel von Hand gelöst, der Dreiklang gehört.

---

## 11. Ablösbarkeit

1. `engine/` bleibt frei von Framework-, Datenbank- und Anbieterabhängigkeiten
2. Alle Modellaufrufe über **eine einzige Datei** im API-Dienst, Schlüssel aus
   Umgebungsvariablen. Keine plattformverwalteten Sammel-Schlüssel.
3. Eigene Datenbankinstanz, Schema als SQL im Repo, Dump-Skript
4. `docker-compose.yml`, `.env.example`, `netlify.toml`, beide `Dockerfile`s im Repo
5. Ablöse-Test alle vier Wochen: klonen, starten, ein Rätsel lösen

---

## 12. Betriebsmodus

**Autonom:** Engine, Tests, Gerüst, Oberfläche innerhalb der gewählten Gestaltung,
Infrastrukturdateien.

**Wolf-Ping:** die Gestaltungsrichtung (einmal); Datenmodell-Schnitt; jede
Abhängigkeit über Expo, React Native, Reanimated, Vitest, FastAPI, psycopg,
PostgreSQL hinaus; alles was Schlüssel oder Zugänge berührt; jede Mehrdeutigkeit
der Regelfassung; die Formulierungen der vier Felder aus Abschnitt 6 und die
Stimmen der Erzählerin; `harmony.ts` zu langsam; vor Stufe 6.

Format: kurze klare Frage, zwei bis drei Varianten mit je einem Satz Konsequenz,
dazu eine Empfehlung mit Begründung.

**Abbruchkriterien — hier stoppen und fragen:**

- Die Regelfassung ist mehrdeutig und du müsstest raten
- Ein Testfall ist nicht erfüllbar, ohne die Regeln zu beugen
- Die beiden Harmonieerkennungen widersprechen sich
- Der Solver findet für erzeugte Rätsel systematisch mehrere Lösungen
- Ein Bildschirm braucht eine Anleitung
- **Eine Festlegung dieser Datei stellt sich als falsch heraus**

Der letzte Punkt ist ausdrücklich erwünscht — er hat zu dieser zweiten Fassung geführt.

**Arbeitsweise:** Ein Fix pro Commit. Diagnose vor Änderung. Nie auf `main`
committen — immer Branch, dann Pull Request. Tagesreport statt Zwischenmeldungen.

---

## 13. Was sich gegenüber der ersten Fassung geändert hat

- Middles war Phase 3, das Vollspiel Phase 2. Jetzt ist Middles Stufe 1 und das
  Produkt; das Brett kommt klein in Stufe 4 und voll in Stufe 5.
- Die Erzählerin ist neu und die erste KI-Funktion. Regelchat, Begründungsmodus und
  offene Karten rücken hinter das Brett, weil sie ein Brett voraussetzen.
- Klang ist Teil des Produkts.
- Ein Abschnitt Gestaltung ist neu; die Richtung ist ein Wolf-Ping.
- Die Deckung bekommt eine Middles-Form (Trefferquote je Mittelart), die Brettform
  bleibt.
- Der Stack nennt `expo-audio` und die Deploy-Dateien, die inzwischen existieren.
- Unverändert: Regelfassung, Engine, API, Generator, Zuständigkeitsgrenze der KI,
  Ablösbarkeit.
