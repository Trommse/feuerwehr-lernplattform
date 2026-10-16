// Prüft die Inhalte: zeigt alle Module/Themen und meldet Übungsfragen ohne richtige Antwort.
// Aufruf:  docker compose exec lernplattform npm run check
const fs = require('fs');
const path = require('path');
const content = require('../lib/content');

let fehler = 0;
for (const m of content.getStructure().module) {
  console.log(`\n${m.titel}`);
  const planDatei = path.join(content.CONTENT_DIR, m.slug, 'stundenplan.json');
  if (fs.existsSync(planDatei)) {
    if (!m.stundenplan || !Array.isArray(m.stundenplan.termine)) {
      fehler++;
      console.log('  ! stundenplan.json ist kein gültiges JSON oder hat keine "termine"');
    } else {
      console.log(`  Stundenplan: ${m.stundenplan.termine.length} Termine`);
      for (const t of m.stundenplan.termine) {
        if (!/^\d{4}-\d{2}-\d{2}$/.test(t.datum || '') || !/^\d{2}:\d{2}$/.test(t.beginn || '') || !/^\d{2}:\d{2}$/.test(t.ende || '')) {
          fehler++;
          console.log(`  ! Termin mit ungültigem Datum/Uhrzeit: ${JSON.stringify(t.datum)}`);
        }
        for (const e of t.einheiten || []) {
          if (e.link && !m.themen.some((th) => th.slug === e.link)) {
            fehler++;
            console.log(`  ! Termin ${t.datum}: Link auf unbekanntes Thema "${e.link}"`);
          }
        }
      }
    }
  }
  for (const t of m.themen) {
    console.log(`  ${t.titel}: ${t.seiten.length} Seiten, ${t.pruefungsfragen} Prüfungsfragen, ${t.uebungsfragen} Übungsfragen`);
    const datei = path.join(content.CONTENT_DIR, m.slug, t.slug, 'uebung.md');
    if (!fs.existsSync(datei)) continue;
    let frage = null;
    let optionen = 0;
    let richtig = 0;
    const pruefe = () => {
      if (frage && (optionen < 2 || richtig < 1)) {
        fehler++;
        console.log(`    ! Frage ohne gültige Antworten: "${frage}"`);
      }
    };
    for (const line of fs.readFileSync(datei, 'utf8').split(/\r?\n/)) {
      if (/^###\s+/.test(line)) { pruefe(); frage = line.slice(4).trim(); optionen = 0; richtig = 0; }
      else if (/^\s*[-*]\s+\[( |x|X)\]/.test(line)) { optionen++; if (/\[(x|X)\]/.test(line)) richtig++; }
    }
    pruefe();
  }
}
console.log(fehler ? `\n${fehler} Problem(e) gefunden.` : '\nAlles in Ordnung.');
process.exit(fehler ? 1 : 0);
