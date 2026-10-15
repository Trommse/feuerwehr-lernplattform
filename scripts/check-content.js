// Prüft die Inhalte: zeigt alle Module/Themen und meldet Übungsfragen ohne richtige Antwort.
// Aufruf:  docker compose exec lernplattform npm run check
const fs = require('fs');
const path = require('path');
const content = require('../lib/content');

let fehler = 0;
for (const m of content.getStructure().module) {
  console.log(`\n${m.titel}`);
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
