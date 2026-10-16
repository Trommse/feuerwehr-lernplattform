# Inhalte bearbeiten und neue Themen anlegen

Alle Inhalte liegen im Ordner `content/` als einfache Textdateien (Markdown). Man kann sie direkt auf GitHub im Browser bearbeiten (Stift-Symbol) und danach auf dem Server `git pull` ausführen.

## Aufbau

```
content/
  modul-2/                              ← ein Modul (Ordnername = Adresse)
    modul.json                          ← Name des Moduls
    gefahren-der-einsatzstelle/         ← ein Thema
      thema.json                        ← Name, Beschreibung, Quelle
      01-ueberblick.md                  ← Lernseiten, sortiert nach Dateiname
      02-atemgifte.md
      …
      pruefung.md                       ← Prüfungsfragen zum Aufklappen
      uebung.md                         ← Fragen für die Übungsprüfung
```

Ordnernamen: nur Kleinbuchstaben, Zahlen und Bindestriche (keine Umlaute, keine Leerzeichen).

## Neues Thema anlegen

1. Im passenden Modul einen Ordner anlegen, z. B. `content/modul-2/atemschutz/`.
2. Darin `thema.json`:
   ```json
   {
     "titel": "Atemschutz",
     "beschreibung": "Kurze Beschreibung für die Startseite",
     "quelle": "Folien „Atemschutz“, Stand …"
   }
   ```
3. Lernseiten als `01-name.md`, `02-name.md` … Die erste Zeile `# Überschrift` ist der Seitentitel.
4. Optional `pruefung.md` und `uebung.md` (Format siehe unten).

**Seite ausblenden:** Dateinamen mit `_` beginnen lassen (z. B. `_11-fehler-in-den-folien.md`). Die Seite bleibt erhalten, wird aber nicht angezeigt. Zum Einblenden den `_` wieder entfernen. Einzelne Absätze blendet man aus, indem man sie zwischen `<!--` und `-->` setzt.

Ein neues Modul geht genauso: Ordner `content/modul-3/` mit `modul.json` (`{ "titel": "Modul 3" }`).

## Lernseiten (Markdown)

```markdown
# Seitentitel

## Abschnitt

Normaler Text, **fett**, *kursiv*.

- Aufzählung
- noch ein Punkt

| Spalte 1 | Spalte 2 |
|---|---|
| Wert | Wert |

> [!MERKE] Lila Merke-Kasten
> [!INFO] Blauer Info-Kasten
> [!WARNUNG] Gelber Achtung-Kasten
> [!GEFAHR] Roter Gefahr-Kasten
```

(Jeder Kasten ist eine eigene Zeile mit Leerzeile dazwischen.)

## Bilder

Bilder (JPG/PNG) in den Unterordner `bilder/` des Themas legen und in der Lernseite so einbinden:

```markdown
![Kurze Beschreibung](bilder/dateiname.jpg)
*Bildunterschrift (Folie 12)*
```

Dateinamen: Kleinbuchstaben, Zahlen, Bindestriche. Bilder sind nur nach der Anmeldung abrufbar.

## Prüfungsfragen (`pruefung.md`)

```markdown
## Abschnitt (z. B. Atemgifte)

### Wie lautet die Frage? (Folie 12)
Hier steht die Antwort. Sie wird erst beim Aufklappen angezeigt.
Aufzählungen und **fett** gehen auch.
```

## Übungsprüfung (`uebung.md`)

```markdown
## Abschnitt

### Wie lautet die Frage?
- [x] richtige Antwort
- [ ] falsche Antwort
- [ ] falsche Antwort
- [ ] falsche Antwort
> Erklärung, die nach dem Beantworten angezeigt wird.
```

- `[x]` = richtig, `[ ]` = falsch. Mehrere `[x]` = Mehrfachauswahl (wird in der Prüfung angezeigt).
- Die Antworten werden in der Prüfung automatisch gemischt.

Prüfen, ob alles stimmt:

```sh
docker compose exec lernplattform npm run check
```

## Stundenplan (`stundenplan.json`, optional)

Liegt direkt im Modul-Ordner, z. B. `content/modul-2/stundenplan.json`. Dann erscheint im Menü unter dem Modul der Punkt **Stundenplan**, und auf der Startseite steht der nächste Termin mit einem Countdown bis zur Prüfung.

```json
{
  "titel": "Lehrgangsplan TM – Modul 2",
  "zeitraum": "09.10.2026 – 31.10.2026",
  "lehrgangsleiter": "…",
  "termine": [
    {
      "datum": "2026-10-21", "beginn": "19:00", "ende": "21:25",
      "einheiten": [
        { "ue": 3, "thema": "Grundtätigkeiten Retten", "ausbilder": "…", "link": "knoten-und-leitern" }
      ]
    },
    { "datum": "2026-10-31", "beginn": "08:30", "ende": "13:00", "pruefung": true, "einheiten": [ … ] }
  ]
}
```

- `datum` immer als `JJJJ-MM-TT`, Uhrzeiten als `HH:MM`.
- `link` (optional) = Ordnername eines Themas → das Thema wird im Stundenplan verlinkt.
- `"pruefung": true` markiert den Prüfungstag (für den Countdown).
