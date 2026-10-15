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
