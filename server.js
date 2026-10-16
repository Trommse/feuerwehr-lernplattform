'use strict';

const express = require('express');
const crypto = require('crypto');
const path = require('path');
const content = require('./lib/content');

// ---------------------------------------------------------------------------
// Einstellungen (kommen aus der .env-Datei bzw. docker-compose.yml)
// ---------------------------------------------------------------------------
const PORT = parseInt(process.env.PORT || '8080', 10);
const APP_PASSWORD = process.env.APP_PASSWORD || '';
const SESSION_SECRET = process.env.SESSION_SECRET || crypto.randomBytes(32).toString('hex');
const SESSION_DAYS = parseInt(process.env.SESSION_DAYS || '30', 10);
const SITE_TITLE = process.env.SITE_TITLE || 'Tim’s Feuerwehr Lernplattform';
const COOKIE_SECURE = process.env.COOKIE_SECURE === 'true';
// Optional: geheimer Teil der Adresse, unter der Bilder ohne Anmeldung abrufbar sind (für Confluence)
const BILD_TOKEN = process.env.BILD_TOKEN || '';

if (!APP_PASSWORD) {
  console.error('FEHLER: APP_PASSWORD ist nicht gesetzt. Bitte in der .env-Datei eintragen.');
  process.exit(1);
}
if (!process.env.SESSION_SECRET) {
  console.warn('Hinweis: SESSION_SECRET ist nicht gesetzt – nach jedem Neustart muss man sich neu anmelden.');
}

const COOKIE_NAME = 'lernplattform_session';
const app = express();
app.disable('x-powered-by');
app.set('trust proxy', true);

// ---------------------------------------------------------------------------
// Sitzung: signiertes Cookie (kein Speicher auf dem Server nötig)
// ---------------------------------------------------------------------------
function sign(value) {
  return crypto.createHmac('sha256', SESSION_SECRET).update(value).digest('hex');
}

// Das Passwort fließt mit ein: Wird es geändert, sind alle alten Anmeldungen ungültig.
const PASSWORD_TAG = sign('pw:' + APP_PASSWORD).slice(0, 16);

function createSessionCookie() {
  const expires = Date.now() + SESSION_DAYS * 24 * 60 * 60 * 1000;
  const payload = `${expires}.${PASSWORD_TAG}`;
  return `${payload}.${sign(payload)}`;
}

function isValidSession(cookieValue) {
  if (!cookieValue) return false;
  const parts = cookieValue.split('.');
  if (parts.length !== 3) return false;
  const [expires, tag, signature] = parts;
  const expected = sign(`${expires}.${tag}`);
  if (signature.length !== expected.length) return false;
  if (!crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expected))) return false;
  if (tag !== PASSWORD_TAG) return false;
  return Number(expires) > Date.now();
}

function readCookie(req, name) {
  const header = req.headers.cookie || '';
  for (const part of header.split(';')) {
    const [k, ...v] = part.trim().split('=');
    if (k === name) return decodeURIComponent(v.join('='));
  }
  return null;
}

function passwordMatches(input) {
  const a = crypto.createHash('sha256').update(String(input || '')).digest();
  const b = crypto.createHash('sha256').update(APP_PASSWORD).digest();
  return crypto.timingSafeEqual(a, b);
}

// Einfacher Schutz gegen Durchprobieren: max. 10 Fehlversuche pro 15 Minuten und IP
const failedLogins = new Map();
const LOGIN_WINDOW_MS = 15 * 60 * 1000;
const LOGIN_MAX_FAILS = 10;

function tooManyAttempts(ip) {
  const entry = failedLogins.get(ip);
  if (!entry) return false;
  if (Date.now() - entry.first > LOGIN_WINDOW_MS) {
    failedLogins.delete(ip);
    return false;
  }
  return entry.count >= LOGIN_MAX_FAILS;
}

function registerFail(ip) {
  const entry = failedLogins.get(ip);
  if (!entry || Date.now() - entry.first > LOGIN_WINDOW_MS) {
    failedLogins.set(ip, { first: Date.now(), count: 1 });
  } else {
    entry.count += 1;
  }
}

// ---------------------------------------------------------------------------
// Sicherheits-Header
// ---------------------------------------------------------------------------
app.use((req, res, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('Referrer-Policy', 'same-origin');
  res.setHeader('X-Robots-Tag', 'noindex, nofollow');
  next();
});

app.use(express.urlencoded({ extended: false, limit: '10kb' }));
app.use(express.json({ limit: '10kb' }));

// ---------------------------------------------------------------------------
// Öffentliche Routen: Login-Seite + Logo/Styles
// ---------------------------------------------------------------------------
const publicDir = path.join(__dirname, 'public');

app.get('/titel', (req, res) => res.json({ titel: SITE_TITLE }));
app.get('/health', (req, res) => res.json({ ok: true }));
app.get('/robots.txt', (req, res) => res.type('text/plain').send('User-agent: *\nDisallow: /\n'));

app.get('/login', (req, res) => {
  if (isValidSession(readCookie(req, COOKIE_NAME))) return res.redirect('/');
  res.sendFile(path.join(publicDir, 'login.html'));
});

app.get('/assets/:file', (req, res, next) => {
  // Nur Styles/Icons, die auch die Login-Seite braucht, sind ohne Anmeldung erreichbar
  const allowed = ['style.css', 'icon.svg'];
  if (!allowed.includes(req.params.file)) return next();
  res.sendFile(path.join(publicDir, req.params.file));
});

// Bilder ohne Anmeldung – nur mit geheimem Token in der Adresse (z. B. zum Einbinden in Confluence)
app.get('/oeffentlich/:token/:modul/:thema/:datei', (req, res) => {
  const ok = BILD_TOKEN.length >= 16 && req.params.token.length === BILD_TOKEN.length &&
    crypto.timingSafeEqual(Buffer.from(req.params.token), Buffer.from(BILD_TOKEN));
  const file = ok && content.bildPfad(req.params.modul, req.params.thema, req.params.datei);
  if (!file) return res.status(404).end();
  res.setHeader('Cache-Control', 'public, max-age=86400');
  res.sendFile(file);
});

app.post('/login', (req, res) => {
  const ip = req.ip || 'unbekannt';
  if (tooManyAttempts(ip)) {
    return res.redirect('/login?fehler=gesperrt');
  }
  if (!passwordMatches(req.body.password)) {
    registerFail(ip);
    return res.redirect('/login?fehler=passwort');
  }
  failedLogins.delete(ip);
  const cookie = [
    `${COOKIE_NAME}=${encodeURIComponent(createSessionCookie())}`,
    'Path=/',
    'HttpOnly',
    'SameSite=Lax',
    `Max-Age=${SESSION_DAYS * 24 * 60 * 60}`,
  ];
  if (COOKIE_SECURE) cookie.push('Secure');
  res.setHeader('Set-Cookie', cookie.join('; '));
  res.redirect('/');
});

app.post('/logout', (req, res) => {
  res.setHeader('Set-Cookie', `${COOKIE_NAME}=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0`);
  res.redirect('/login');
});

// ---------------------------------------------------------------------------
// Ab hier: nur mit Anmeldung
// ---------------------------------------------------------------------------
app.use((req, res, next) => {
  if (isValidSession(readCookie(req, COOKIE_NAME))) return next();
  if (req.path.startsWith('/api/')) return res.status(401).json({ fehler: 'Nicht angemeldet' });
  return res.redirect('/login');
});

app.get('/api/info', (req, res) => {
  res.json({ titel: SITE_TITLE });
});

app.get('/api/struktur', (req, res) => {
  res.json(content.getStructure());
});

app.get('/api/seite/:modul/:thema/:seite', (req, res) => {
  const page = content.getPage(req.params.modul, req.params.thema, req.params.seite);
  if (!page) return res.status(404).json({ fehler: 'Seite nicht gefunden' });
  res.json(page);
});

app.get('/api/pruefung/:modul/:thema', (req, res) => {
  const data = content.getExamQuestions(req.params.modul, req.params.thema);
  if (!data) return res.status(404).json({ fehler: 'Keine Prüfungsfragen gefunden' });
  res.json(data);
});

app.get('/api/uebung', (req, res) => {
  // ?themen=modul/thema,modul/thema  (leer = alle)
  const filter = String(req.query.themen || '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
  res.json(content.getQuizQuestions(filter));
});

app.get('/api/suche', (req, res) => {
  res.json(content.search(String(req.query.q || '')));
});

app.get('/bilder/:modul/:thema/:datei', (req, res) => {
  const file = content.bildPfad(req.params.modul, req.params.thema, req.params.datei);
  if (!file) return res.status(404).end();
  res.setHeader('Cache-Control', 'private, max-age=86400');
  res.sendFile(file);
});

app.use(express.static(publicDir, { index: 'index.html', extensions: ['html'] }));

// Alles andere -> App (Navigation läuft im Browser)
app.get('*', (req, res) => res.sendFile(path.join(publicDir, 'index.html')));

app.listen(PORT, () => {
  console.log(`${SITE_TITLE} läuft auf Port ${PORT}`);
  const s = content.getStructure();
  const themen = s.module.reduce((n, m) => n + m.themen.length, 0);
  console.log(`Inhalte geladen: ${s.module.length} Modul(e), ${themen} Thema/Themen`);
});
