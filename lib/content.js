'use strict';

// Liest die Lerninhalte aus dem Ordner "content".
//
// Aufbau:
//   content/<modul>/modul.json                 { "titel": "...", "beschreibung": "..." }
//   content/<modul>/<thema>/thema.json         { "titel": "...", "beschreibung": "...", "quelle": "..." }
//   content/<modul>/<thema>/01-irgendwas.md    Lernseiten (Reihenfolge nach Dateiname)
//   content/<modul>/<thema>/pruefung.md        Prüfungsfragen (zum Aufklappen)
//   content/<modul>/<thema>/uebung.md          Fragen für die Übungsprüfung (Multiple Choice)

const fs = require('fs');
const path = require('path');
const { marked } = require('marked');

const CONTENT_DIR = process.env.CONTENT_DIR || path.join(__dirname, '..', 'content');
const SPECIAL_FILES = ['pruefung.md', 'uebung.md', 'readme.md'];
const SLUG = /^[a-z0-9][a-z0-9_-]*$/i;

marked.setOptions({ gfm: true, breaks: false });

function readJson(file, fallback) {
  try {
    return JSON.parse(fs.readFileSync(file, 'utf8'));
  } catch (e) {
    return fallback;
  }
}

function listDirs(dir) {
  try {
    return fs
      .readdirSync(dir, { withFileTypes: true })
      .filter((d) => d.isDirectory() && SLUG.test(d.name))
      .map((d) => d.name)
      .sort((a, b) => a.localeCompare(b, 'de', { numeric: true }));
  } catch (e) {
    return [];
  }
}

function prettyName(slug) {
  return slug
    .replace(/^\d+[-_]/, '')
    .replace(/[-_]+/g, ' ')
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

function splitTitle(markdown, fallback) {
  const match = markdown.match(/^\s*#\s+(.+)\s*$/m);
  if (match && markdown.trimStart().startsWith('#') && !markdown.trimStart().startsWith('##')) {
    return { titel: match[1].trim(), body: markdown.replace(match[0], '').trim() };
  }
  return { titel: fallback, body: markdown };
}

// Hinweis-Kästen: "> [!MERKE]", "> [!WARNUNG]", "> [!GEFAHR]", "> [!INFO]"
const CALLOUTS = {
  MERKE: { klasse: 'merke', label: 'Merke' },
  INFO: { klasse: 'info', label: 'Info' },
  HINWEIS: { klasse: 'info', label: 'Hinweis' },
  WARNUNG: { klasse: 'warnung', label: 'Achtung' },
  ACHTUNG: { klasse: 'warnung', label: 'Achtung' },
  GEFAHR: { klasse: 'gefahr', label: 'Gefahr' },
  FEHLER: { klasse: 'gefahr', label: 'Fehler in den Folien' },
};

function renderMarkdown(markdown) {
  let html = marked.parse(markdown || '');
  html = html.replace(/<blockquote>\s*<p>\[!(\w+)\]\s*/g, (all, type) => {
    const c = CALLOUTS[type.toUpperCase()];
    if (!c) return all;
    return `<blockquote class="callout ${c.klasse}"><p><span class="callout-label">${c.label}</span> `;
  });
  // Tabellen scrollbar machen (Handy)
  html = html.replace(/<table>/g, '<div class="table-wrap"><table>').replace(/<\/table>/g, '</table></div>');
  return html;
}

function pageFiles(themaDir) {
  try {
    return fs
      .readdirSync(themaDir)
      .filter((f) => f.toLowerCase().endsWith('.md') && !f.startsWith('_') && !SPECIAL_FILES.includes(f.toLowerCase()))
      .sort((a, b) => a.localeCompare(b, 'de', { numeric: true }));
  } catch (e) {
    return [];
  }
}

// ---------------------------------------------------------------------------
// Struktur (Navigation)
// ---------------------------------------------------------------------------
function getStructure() {
  const module = listDirs(CONTENT_DIR).map((modulSlug) => {
    const modulDir = path.join(CONTENT_DIR, modulSlug);
    const modulMeta = readJson(path.join(modulDir, 'modul.json'), {});
    const themen = listDirs(modulDir).map((themaSlug) => {
      const themaDir = path.join(modulDir, themaSlug);
      const meta = readJson(path.join(themaDir, 'thema.json'), {});
      const seiten = pageFiles(themaDir).map((file) => {
        const slug = file.replace(/\.md$/i, '');
        const raw = fs.readFileSync(path.join(themaDir, file), 'utf8');
        return { slug, titel: splitTitle(raw, prettyName(slug)).titel };
      });
      const pruefung = parseExam(readText(path.join(themaDir, 'pruefung.md')));
      const uebung = parseQuiz(readText(path.join(themaDir, 'uebung.md')), modulSlug, themaSlug, meta.titel);
      return {
        slug: themaSlug,
        titel: meta.titel || prettyName(themaSlug),
        beschreibung: meta.beschreibung || '',
        quelle: meta.quelle || '',
        seiten,
        pruefungsfragen: pruefung.reduce((n, a) => n + a.fragen.length, 0),
        uebungsfragen: uebung.length,
      };
    });
    return {
      slug: modulSlug,
      titel: modulMeta.titel || prettyName(modulSlug),
      beschreibung: modulMeta.beschreibung || '',
      themen,
    };
  });
  return { module };
}

function themaDir(modul, thema) {
  if (!SLUG.test(modul) || !SLUG.test(thema)) return null;
  const dir = path.join(CONTENT_DIR, modul, thema);
  return fs.existsSync(dir) ? dir : null;
}

function readText(file) {
  try {
    return fs.readFileSync(file, 'utf8');
  } catch (e) {
    return '';
  }
}

// ---------------------------------------------------------------------------
// Einzelne Lernseite
// ---------------------------------------------------------------------------
function getPage(modul, thema, seite) {
  const dir = themaDir(modul, thema);
  if (!dir || !SLUG.test(seite)) return null;
  const file = path.join(dir, `${seite}.md`);
  if (!fs.existsSync(file) || SPECIAL_FILES.includes(`${seite}.md`.toLowerCase())) return null;
  const { titel, body } = splitTitle(fs.readFileSync(file, 'utf8'), prettyName(seite));
  return { titel, html: renderMarkdown(body) };
}

// ---------------------------------------------------------------------------
// Prüfungsfragen: "## Abschnitt", "### Frage", darunter die Antwort
// ---------------------------------------------------------------------------
function parseExam(markdown) {
  const abschnitte = [];
  let abschnitt = null;
  let frage = null;
  const flush = () => {
    if (frage) {
      frage.html = renderMarkdown(frage.antwort.join('\n').trim());
      delete frage.antwort;
      if (!abschnitt) {
        abschnitt = { titel: 'Fragen', fragen: [] };
        abschnitte.push(abschnitt);
      }
      abschnitt.fragen.push(frage);
      frage = null;
    }
  };
  for (const line of (markdown || '').split(/\r?\n/)) {
    if (/^##\s+/.test(line) && !/^###/.test(line)) {
      flush();
      abschnitt = { titel: line.replace(/^##\s+/, '').trim(), fragen: [] };
      abschnitte.push(abschnitt);
    } else if (/^###\s+/.test(line)) {
      flush();
      frage = { frage: line.replace(/^###\s+/, '').trim(), antwort: [] };
    } else if (frage) {
      frage.antwort.push(line);
    }
  }
  flush();
  return abschnitte.filter((a) => a.fragen.length);
}

function getExamQuestions(modul, thema) {
  const dir = themaDir(modul, thema);
  if (!dir) return null;
  const meta = readJson(path.join(dir, 'thema.json'), {});
  return { titel: meta.titel || prettyName(thema), abschnitte: parseExam(readText(path.join(dir, 'pruefung.md'))) };
}

// ---------------------------------------------------------------------------
// Übungsprüfung: "### Frage", Antworten als "- [x] richtig" / "- [ ] falsch",
// Erklärung als "> Text"
// ---------------------------------------------------------------------------
function inline(md) {
  return marked.parseInline(md || '');
}

function parseQuiz(markdown, modul, thema, themaTitel) {
  const fragen = [];
  let q = null;
  let abschnitt = '';
  const flush = () => {
    if (q && q.optionen.length >= 2 && q.optionen.some((o) => o.richtig)) {
      fragen.push({
        id: `${modul}/${thema}#${fragen.length + 1}`,
        thema: `${modul}/${thema}`,
        themaTitel: themaTitel || prettyName(thema),
        abschnitt: q.abschnitt,
        frage: inline(q.frage),
        optionen: q.optionen.map((o) => ({ text: inline(o.text), richtig: o.richtig })),
        mehrfach: q.optionen.filter((o) => o.richtig).length > 1,
        erklaerung: inline(q.erklaerung.join(' ').trim()),
      });
    }
    q = null;
  };
  for (const line of (markdown || '').split(/\r?\n/)) {
    if (/^##\s+/.test(line) && !/^###/.test(line)) {
      flush();
      abschnitt = line.replace(/^##\s+/, '').trim();
    } else if (/^###\s+/.test(line)) {
      flush();
      q = { frage: line.replace(/^###\s+/, '').trim(), optionen: [], erklaerung: [], abschnitt };
    } else if (q && /^\s*[-*]\s+\[( |x|X)\]\s+/.test(line)) {
      const richtig = /\[(x|X)\]/.test(line.slice(0, line.indexOf(']') + 1));
      q.optionen.push({ text: line.replace(/^\s*[-*]\s+\[( |x|X)\]\s+/, '').trim(), richtig });
    } else if (q && /^\s*>/.test(line)) {
      q.erklaerung.push(line.replace(/^\s*>\s?/, ''));
    }
  }
  flush();
  return fragen;
}

function getQuizQuestions(filter) {
  const result = [];
  for (const modul of listDirs(CONTENT_DIR)) {
    for (const thema of listDirs(path.join(CONTENT_DIR, modul))) {
      const key = `${modul}/${thema}`;
      if (filter.length && !filter.includes(key)) continue;
      const dir = path.join(CONTENT_DIR, modul, thema);
      const meta = readJson(path.join(dir, 'thema.json'), {});
      result.push(...parseQuiz(readText(path.join(dir, 'uebung.md')), modul, thema, meta.titel));
    }
  }
  return result;
}

// ---------------------------------------------------------------------------
// Suche über alle Lernseiten und Prüfungsfragen
// ---------------------------------------------------------------------------
function plain(md) {
  return md
    .replace(/<[^>]+>/g, ' ')
    .replace(/\[!(\w+)\]/g, '')
    .replace(/[#>*_`|]/g, ' ')
    .replace(/-{3,}/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function snippet(text, query) {
  const i = text.toLowerCase().indexOf(query.toLowerCase());
  if (i < 0) return text.slice(0, 160);
  const start = Math.max(0, i - 70);
  return (start > 0 ? '…' : '') + text.slice(start, i + query.length + 90) + '…';
}

function search(query) {
  query = query.trim();
  if (query.length < 2) return [];
  const q = query.toLowerCase();
  const hits = [];
  for (const modul of getStructure().module) {
    for (const thema of modul.themen) {
      const dir = path.join(CONTENT_DIR, modul.slug, thema.slug);
      for (const seite of thema.seiten) {
        const text = plain(readText(path.join(dir, `${seite.slug}.md`)));
        if (text.toLowerCase().includes(q)) {
          hits.push({
            typ: 'seite',
            modul: modul.slug,
            thema: thema.slug,
            seite: seite.slug,
            titel: seite.titel,
            themaTitel: thema.titel,
            auszug: snippet(text, query),
          });
        }
      }
      const exam = parseExam(readText(path.join(dir, 'pruefung.md')));
      exam.forEach((a) =>
        a.fragen.forEach((f) => {
          const text = plain(f.frage + ' ' + f.html);
          if (text.toLowerCase().includes(q)) {
            hits.push({
              typ: 'pruefung',
              modul: modul.slug,
              thema: thema.slug,
              titel: f.frage,
              themaTitel: thema.titel,
              auszug: snippet(text, query),
            });
          }
        })
      );
    }
  }
  return hits.slice(0, 50);
}

module.exports = { getStructure, getPage, getExamQuestions, getQuizQuestions, search, CONTENT_DIR };
