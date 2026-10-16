/* Lernplattform – Oberfläche im Browser (ohne Framework) */
(function () {
  'use strict';

  var main = document.getElementById('main');
  var sidebar = document.getElementById('sidebar');
  var struktur = { module: [] };
  var quiz = null; // laufende Übungsprüfung

  // ---------------------------------------------------------------- Hilfen
  function esc(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  }

  function api(url) {
    return fetch(url, { credentials: 'same-origin' }).then(function (r) {
      if (r.status === 401) { location.href = '/login'; throw new Error('401'); }
      if (!r.ok) throw new Error('HTTP ' + r.status);
      return r.json();
    });
  }

  function store(key, value) {
    try {
      if (value === undefined) return JSON.parse(localStorage.getItem(key) || 'null');
      localStorage.setItem(key, JSON.stringify(value));
    } catch (e) { return null; }
  }

  function shuffle(arr) {
    var a = arr.slice();
    for (var i = a.length - 1; i > 0; i--) {
      var j = Math.floor(Math.random() * (i + 1));
      var t = a[i]; a[i] = a[j]; a[j] = t;
    }
    return a;
  }

  function findThema(modul, thema) {
    for (var i = 0; i < struktur.module.length; i++) {
      var m = struktur.module[i];
      if (m.slug !== modul) continue;
      for (var k = 0; k < m.themen.length; k++) {
        if (m.themen[k].slug === thema) return { modul: m, thema: m.themen[k] };
      }
    }
    return null;
  }

  function setTitle(t) {
    document.title = (t ? t + ' – ' : '') + (document.getElementById('siteTitle').textContent || 'Lernplattform');
  }

  function render(html) {
    main.innerHTML = html;
    main.scrollTop = 0;
    window.scrollTo(0, 0);
    closeMenu();
    highlightNav();
  }

  function notFound() {
    render('<h1>Nicht gefunden</h1><p>Diese Seite gibt es nicht (mehr).</p><p><a class="btn" href="#/">Zur Startseite</a></p>');
  }

  // ---------------------------------------------------------------- Menü
  function closeMenu() { document.body.classList.remove('menu-open'); }
  document.getElementById('menuBtn').addEventListener('click', function () {
    document.body.classList.toggle('menu-open');
  });
  document.getElementById('backdrop').addEventListener('click', closeMenu);

  function buildSidebar() {
    var h = '<a class="nav-top" href="#/">Startseite</a>';
    struktur.module.forEach(function (m) {
      h += '<div class="nav-modul">' + esc(m.titel) + '</div>';
      if (m.stundenplan) h += '<a class="nav-plan" href="#/stundenplan/' + m.slug + '">Stundenplan</a>';
      m.themen.forEach(function (t) {
        var base = '#/m/' + m.slug + '/' + t.slug;
        var open = store('nav-open:' + m.slug + '/' + t.slug);
        h += '<details class="nav-thema" data-key="' + esc(m.slug + '/' + t.slug) + '"' + (open === false ? '' : ' open') + '>';
        h += '<summary>' + esc(t.titel) + '</summary><ul>';
        t.seiten.forEach(function (s) {
          h += '<li><a href="' + base + '/' + s.slug + '">' + esc(s.titel) + '</a></li>';
        });
        if (t.pruefungsfragen) {
          h += '<li><a class="nav-exam" href="#/pruefung/' + m.slug + '/' + t.slug + '">Prüfungsfragen (' + t.pruefungsfragen + ')</a></li>';
        }
        h += '</ul></details>';
      });
    });
    if (!struktur.module.length) h += '<p class="muted pad">Noch keine Inhalte vorhanden.</p>';
    h += '<div class="nav-sep"></div><a class="nav-top nav-quiz" href="#/uebung">Übungsprüfung</a>';
    sidebar.innerHTML = h;
    Array.prototype.forEach.call(sidebar.querySelectorAll('details.nav-thema'), function (d) {
      d.addEventListener('toggle', function () { store('nav-open:' + d.getAttribute('data-key'), d.open); });
    });
  }

  function highlightNav() {
    var hash = location.hash || '#/';
    Array.prototype.forEach.call(sidebar.querySelectorAll('a'), function (a) {
      a.classList.toggle('active', a.getAttribute('href') === hash);
    });
  }

  // ---------------------------------------------------------------- Seiten
  function viewStart() {
    setTitle('');
    var last = store('quiz-verlauf') || [];
    var h = '<section class="hero"><h1>Willkommen</h1>' +
      '<p>Hier findest du alle Lerninhalte aus der Ausbildung – zum Nachlesen und mit Prüfungsfragen zum Aufklappen.</p></section>';
    struktur.module.forEach(function (m) {
      h += '<h2 class="modul-title">' + esc(m.titel) + '</h2>';
      if (m.beschreibung) h += '<p class="muted">' + esc(m.beschreibung) + '</p>';
      if (m.stundenplan) h += naechsterTerminHinweis(m);
      h += '<div class="cards">';
      m.themen.forEach(function (t) {
        h += '<a class="card" href="#/m/' + m.slug + '/' + t.slug + '">' +
          '<h3>' + esc(t.titel) + '</h3>' +
          (t.beschreibung ? '<p>' + esc(t.beschreibung) + '</p>' : '') +
          '<div class="chips"><span class="chip">' + t.seiten.length + ' Seiten</span>' +
          (t.pruefungsfragen ? '<span class="chip">' + t.pruefungsfragen + ' Prüfungsfragen</span>' : '') +
          (t.uebungsfragen ? '<span class="chip">' + t.uebungsfragen + ' Übungsfragen</span>' : '') +
          '</div></a>';
      });
      h += '</div>';
    });
    h += '<p class="quiz-hint">Wissen testen? <a href="#/uebung">Zur Übungsprüfung →</a></p>';
    if (last.length) {
      h += '<h2 class="modul-title">Deine letzten Übungsprüfungen</h2><div class="table-wrap"><table><thead><tr><th>Datum</th><th>Themen</th><th>Ergebnis</th></tr></thead><tbody>';
      last.slice(0, 5).forEach(function (r) {
        h += '<tr><td>' + esc(r.datum) + '</td><td>' + esc(r.themen) + '</td><td><strong>' + r.richtig + ' / ' + r.gesamt + '</strong> (' + Math.round(r.richtig / r.gesamt * 100) + ' %)</td></tr>';
      });
      h += '</tbody></table></div><p class="muted small">Wird nur in diesem Browser gespeichert.</p>';
    }
    render(h);
  }

  // ---------------------------------------------------------------- Stundenplan
  var WOCHENTAGE = ['Sonntag', 'Montag', 'Dienstag', 'Mittwoch', 'Donnerstag', 'Freitag', 'Samstag'];

  function terminDatum(t, uhrzeit) {
    var d = t.datum.split('-');
    var z = (uhrzeit || '00:00').split(':');
    return new Date(+d[0], +d[1] - 1, +d[2], +z[0], +z[1]);
  }

  function datumText(t, kurz) {
    var d = terminDatum(t);
    var tag = WOCHENTAGE[d.getDay()];
    var dm = ('0' + d.getDate()).slice(-2) + '.' + ('0' + (d.getMonth() + 1)).slice(-2) + '.';
    return (kurz ? tag.slice(0, 2) + ', ' : tag + ', ') + dm + (kurz ? '' : d.getFullYear());
  }

  // Status eines Termins: vorbei / heute (läuft oder kommt noch) / kommend
  function terminStatus(t, jetzt) {
    if (terminDatum(t, t.ende) < jetzt) return 'vorbei';
    if (terminDatum(t) <= jetzt) return 'heute';
    return 'kommend';
  }

  function naechsterTermin(plan, jetzt) {
    for (var i = 0; i < plan.termine.length; i++) {
      if (terminStatus(plan.termine[i], jetzt) !== 'vorbei') return plan.termine[i];
    }
    return null;
  }

  function tageBis(t, jetzt) {
    var heute = new Date(jetzt.getFullYear(), jetzt.getMonth(), jetzt.getDate());
    return Math.round((terminDatum(t) - heute) / 86400000);
  }

  function naechsterTerminHinweis(m) {
    var jetzt = new Date();
    var n = naechsterTermin(m.stundenplan, jetzt);
    var link = '<a href="#/stundenplan/' + m.slug + '">Stundenplan →</a>';
    if (!n) return '<p class="plan-hint">Lehrgang abgeschlossen. ' + link + '</p>';
    var tage = tageBis(n, jetzt);
    var wann = tage === 0 ? 'Heute' : tage === 1 ? 'Morgen' : datumText(n, true);
    var themen = n.einheiten.map(function (e) { return e.thema; }).join(' · ');
    var h = '<p class="plan-hint"><strong>Nächster Termin:</strong> ' + esc(wann) + ', ' + esc(n.beginn) + ' Uhr – ' + esc(themen) + '. ' + link;
    var pruefung = m.stundenplan.termine.filter(function (t) { return t.pruefung; })[0];
    if (pruefung && pruefung !== n && terminStatus(pruefung, jetzt) === 'kommend') {
      var p = tageBis(pruefung, jetzt);
      h += '<br><span class="muted">Noch ' + p + ' ' + (p === 1 ? 'Tag' : 'Tage') + ' bis zur Prüfung.</span>';
    }
    return h + '</p>';
  }

  function viewStundenplan(modul) {
    var m = struktur.module.filter(function (x) { return x.slug === modul; })[0];
    if (!m || !m.stundenplan) return notFound();
    var plan = m.stundenplan;
    var jetzt = new Date();
    var naechster = naechsterTermin(plan, jetzt);
    setTitle('Stundenplan ' + m.titel);
    var themen = {};
    m.themen.forEach(function (t) { themen[t.slug] = t; });
    var gesamtUE = 0;
    plan.termine.forEach(function (t) { t.einheiten.forEach(function (e) { gesamtUE += e.ue || 0; }); });

    var h = '<p class="crumbs"><a href="#/">Start</a> › ' + esc(m.titel) + '</p>' +
      '<h1>' + esc(plan.titel || 'Stundenplan') + '</h1>' +
      '<p class="muted">' + esc(plan.veranstalter || '') + (plan.zeitraum ? ' · ' + esc(plan.zeitraum) : '') +
      ' · ' + plan.termine.length + ' Termine, ' + gesamtUE + ' UE</p>';
    if (plan.lehrgangsleiter) {
      h += '<p class="small">Lehrgangsleiter: <strong>' + esc(plan.lehrgangsleiter) + '</strong>' +
        (plan.stellvertreter ? ' · Stellvertreter: ' + esc(plan.stellvertreter) : '') + '</p>';
    }
    h += '<ol class="plan">';
    plan.termine.forEach(function (t) {
      var status = terminStatus(t, jetzt);
      var cls = 'plan-tag ' + status + (t === naechster ? ' naechster' : '') + (t.pruefung ? ' pruefungstag' : '');
      var badge = t === naechster ? (status === 'heute' ? 'Heute' : 'Nächster Termin') : (status === 'vorbei' ? 'Erledigt' : '');
      h += '<li class="' + cls + '"><div class="plan-kopf"><span class="plan-datum">' + esc(datumText(t)) + '</span>' +
        '<span class="plan-zeit">' + esc(t.beginn) + ' – ' + esc(t.ende) + ' Uhr</span>' +
        (t.pruefung ? '<span class="plan-badge pruefung">Prüfung</span>' : '') +
        (badge ? '<span class="plan-badge">' + badge + '</span>' : '') + '</div><ul>';
      t.einheiten.forEach(function (e) {
        var th = e.link && themen[e.link];
        var titel = th ? '<a href="#/m/' + m.slug + '/' + e.link + '">' + esc(e.thema) + '</a>' : esc(e.thema);
        h += '<li><span class="plan-ue">' + (e.ue || '') + ' UE</span><div><div class="plan-thema">' + titel +
          (e.zeit ? ' <span class="muted small">(' + esc(e.zeit) + ')</span>' : '') + '</div>' +
          (e.ausbilder ? '<div class="muted small">' + esc(e.ausbilder) + '</div>' : '') + '</div></li>';
      });
      h += '</ul></li>';
    });
    h += '</ol>';
    h += '<p class="muted small">UE = Unterrichtseinheit (45 Minuten). Verlinkte Themen führen zu den passenden Lernseiten.</p>';
    render(h);
    var el = main.querySelector('.plan-tag.naechster');
    if (el && el.previousElementSibling) el.scrollIntoView({ block: 'center' });
  }

  function viewThema(modul, thema) {
    var f = findThema(modul, thema);
    if (!f) return notFound();
    var t = f.thema;
    setTitle(t.titel);
    var base = '#/m/' + modul + '/' + thema;
    var h = '<nav class="crumbs"><a href="#/">Start</a> › ' + esc(f.modul.titel) + '</nav>';
    h += '<h1>' + esc(t.titel) + '</h1>';
    if (t.beschreibung) h += '<p class="lead">' + esc(t.beschreibung) + '</p>';
    if (t.quelle) h += '<p class="muted small">Quelle: ' + esc(t.quelle) + '</p>';
    h += '<div class="actions">';
    if (t.seiten.length) h += '<a class="btn btn-primary" href="' + base + '/' + t.seiten[0].slug + '">Mit dem Lernen beginnen</a>';
    if (t.pruefungsfragen) h += '<a class="btn" href="#/pruefung/' + modul + '/' + thema + '">Prüfungsfragen</a>';
    if (t.uebungsfragen) h += '<a class="btn" href="#/uebung?themen=' + encodeURIComponent(modul + '/' + thema) + '">Übungsprüfung zu diesem Thema</a>';
    h += '</div><ol class="toc">';
    t.seiten.forEach(function (s) {
      h += '<li><a href="' + base + '/' + s.slug + '">' + esc(s.titel) + '</a></li>';
    });
    h += '</ol>';
    render(h);
  }

  function viewSeite(modul, thema, seite) {
    var f = findThema(modul, thema);
    if (!f) return notFound();
    api('/api/seite/' + modul + '/' + thema + '/' + seite).then(function (p) {
      setTitle(p.titel);
      var seiten = f.thema.seiten;
      var idx = seiten.map(function (s) { return s.slug; }).indexOf(seite);
      var base = '#/m/' + modul + '/' + thema + '/';
      var h = '<nav class="crumbs"><a href="#/">Start</a> › <a href="#/m/' + modul + '/' + thema + '">' + esc(f.thema.titel) + '</a></nav>';
      h += '<article class="prose"><h1>' + esc(p.titel) + '</h1>' + p.html + '</article>';
      h += '<nav class="pager">';
      h += idx > 0 ? '<a class="btn" href="' + base + seiten[idx - 1].slug + '">← ' + esc(seiten[idx - 1].titel) + '</a>' : '<span></span>';
      if (idx >= 0 && idx < seiten.length - 1) {
        h += '<a class="btn btn-primary" href="' + base + seiten[idx + 1].slug + '">' + esc(seiten[idx + 1].titel) + ' →</a>';
      } else if (f.thema.pruefungsfragen) {
        h += '<a class="btn btn-primary" href="#/pruefung/' + modul + '/' + thema + '">Zu den Prüfungsfragen →</a>';
      }
      h += '</nav>';
      render(h);
      Array.prototype.forEach.call(main.querySelectorAll('.prose img'), function (img) {
        img.addEventListener('click', function () { window.open(img.src, '_blank'); });
      });
    }).catch(function (e) { if (e.message !== '401') notFound(); });
  }

  function viewPruefung(modul, thema) {
    var f = findThema(modul, thema);
    if (!f) return notFound();
    api('/api/pruefung/' + modul + '/' + thema).then(function (d) {
      setTitle('Prüfungsfragen ' + d.titel);
      var total = d.abschnitte.reduce(function (n, a) { return n + a.fragen.length; }, 0);
      var h = '<nav class="crumbs"><a href="#/">Start</a> › <a href="#/m/' + modul + '/' + thema + '">' + esc(f.thema.titel) + '</a></nav>';
      h += '<h1>Prüfungsfragen</h1><p class="lead">' + esc(d.titel) + ' · ' + total + ' Fragen</p>';
      h += '<blockquote class="callout info"><p><span class="callout-label">So geht\'s</span> Erst selbst antworten, dann aufklappen. Die Zahlen in Klammern sind die Foliennummern.</p></blockquote>';
      h += '<div class="actions"><button class="btn" id="openAll">Alle aufklappen</button><button class="btn" id="closeAll">Alle zuklappen</button>';
      if (f.thema.uebungsfragen) h += '<a class="btn btn-primary" href="#/uebung?themen=' + encodeURIComponent(modul + '/' + thema) + '">Übungsprüfung starten</a>';
      h += '</div>';
      d.abschnitte.forEach(function (a) {
        h += '<h2>' + esc(a.titel) + '</h2><div class="qa-list">';
        a.fragen.forEach(function (q) {
          h += '<details class="qa"><summary>' + esc(q.frage) + '</summary><div class="qa-answer prose">' + q.html + '</div></details>';
        });
        h += '</div>';
      });
      render(h);
      document.getElementById('openAll').onclick = function () { toggleAll(true); };
      document.getElementById('closeAll').onclick = function () { toggleAll(false); };
    }).catch(function (e) { if (e.message !== '401') notFound(); });
  }

  function toggleAll(open) {
    Array.prototype.forEach.call(main.querySelectorAll('details.qa'), function (d) { d.open = open; });
  }

  // ---------------------------------------------------------------- Suche
  document.getElementById('searchForm').addEventListener('submit', function (e) {
    e.preventDefault();
    var q = document.getElementById('searchInput').value.trim();
    if (q) location.hash = '#/suche?q=' + encodeURIComponent(q);
  });

  function viewSuche(q) {
    setTitle('Suche');
    document.getElementById('searchInput').value = q;
    api('/api/suche?q=' + encodeURIComponent(q)).then(function (hits) {
      var h = '<h1>Suche: „' + esc(q) + '“</h1>';
      if (!hits.length) h += '<p>Keine Treffer.</p>';
      h += '<ul class="hits">';
      hits.forEach(function (x) {
        var href = x.typ === 'seite' ? '#/m/' + x.modul + '/' + x.thema + '/' + x.seite : '#/pruefung/' + x.modul + '/' + x.thema;
        h += '<li><a href="' + href + '"><strong>' + esc(x.titel) + '</strong></a> <span class="chip">' +
          (x.typ === 'seite' ? esc(x.themaTitel) : 'Prüfungsfrage') + '</span><p>' + mark(esc(x.auszug), q) + '</p></li>';
      });
      render(h + '</ul>');
    });
  }

  function mark(text, q) {
    var re = new RegExp('(' + esc(q).replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + ')', 'gi');
    return text.replace(re, '<mark>$1</mark>');
  }

  // ---------------------------------------------------------------- Übungsprüfung
  function viewUebungStart(preselect) {
    setTitle('Übungsprüfung');
    quiz = null;
    var themen = [];
    struktur.module.forEach(function (m) {
      m.themen.forEach(function (t) {
        if (t.uebungsfragen) themen.push({ key: m.slug + '/' + t.slug, titel: t.titel, modul: m.titel, n: t.uebungsfragen });
      });
    });
    var h = '<h1>Übungsprüfung</h1>';
    if (!themen.length) return render(h + '<p>Es gibt noch keine Übungsfragen.</p>');
    var sel = preselect.length ? preselect : themen.map(function (t) { return t.key; });
    h += '<p class="lead">Multiple Choice wie in der echten Prüfung. Bei manchen Fragen sind mehrere Antworten richtig – das steht dann dabei.</p>';
    h += '<form id="quizSetup" class="panel"><fieldset><legend>Themen</legend>';
    themen.forEach(function (t) {
      h += '<label class="check"><input type="checkbox" name="thema" value="' + esc(t.key) + '"' + (sel.indexOf(t.key) >= 0 ? ' checked' : '') + '> ' +
        esc(t.titel) + ' <span class="muted">(' + esc(t.modul) + ', ' + t.n + ' Fragen)</span></label>';
    });
    h += '</fieldset><fieldset><legend>Anzahl Fragen</legend><div class="seg">';
    [10, 20, 30, 0].forEach(function (n, i) {
      h += '<label><input type="radio" name="anzahl" value="' + n + '"' + (i === 1 ? ' checked' : '') + '><span>' + (n || 'Alle') + '</span></label>';
    });
    h += '</div></fieldset><fieldset><legend>Modus</legend>' +
      '<label class="check"><input type="radio" name="modus" value="lernen" checked> <span><strong>Lernmodus</strong> – nach jeder Frage siehst du, ob es richtig war, mit Erklärung</span></label>' +
      '<label class="check"><input type="radio" name="modus" value="pruefung"> <span><strong>Prüfungsmodus</strong> – Auswertung erst am Ende</span></label>' +
      '</fieldset><button class="btn btn-primary btn-block" type="submit">Prüfung starten</button></form>';
    render(h);
    document.getElementById('quizSetup').addEventListener('submit', function (e) {
      e.preventDefault();
      var fd = new FormData(e.target);
      var gewaehlt = fd.getAll('thema');
      if (!gewaehlt.length) { alertBox('Bitte mindestens ein Thema auswählen.'); return; }
      startQuiz(gewaehlt, parseInt(fd.get('anzahl'), 10), fd.get('modus'));
    });
  }

  function alertBox(msg) {
    var old = main.querySelector('.inline-alert');
    if (old) old.remove();
    var d = document.createElement('div');
    d.className = 'callout warnung inline-alert';
    d.textContent = msg;
    main.insertBefore(d, main.firstChild.nextSibling);
  }

  function startQuiz(themen, anzahl, modus, fragenVorgabe) {
    var load = fragenVorgabe ? Promise.resolve(fragenVorgabe) : api('/api/uebung?themen=' + encodeURIComponent(themen.join(',')));
    load.then(function (fragen) {
      var auswahl = shuffle(fragen);
      if (anzahl > 0) auswahl = auswahl.slice(0, anzahl);
      quiz = {
        themen: themen,
        modus: modus,
        fragen: auswahl.map(function (q) {
          var o = shuffle(q.optionen.map(function (opt, i) { return { text: opt.text, richtig: opt.richtig, i: i }; }));
          return { q: q, optionen: o, gewaehlt: [], geprueft: false, richtig: null };
        }),
        pos: 0,
      };
      if (location.hash.indexOf('#/uebung/laeuft') !== 0) location.hash = '#/uebung/laeuft';
      else renderQuestion();
    });
  }

  function isCorrect(item) {
    var soll = item.optionen.map(function (o, i) { return o.richtig ? i : -1; }).filter(function (i) { return i >= 0; });
    if (soll.length !== item.gewaehlt.length) return false;
    return soll.every(function (i) { return item.gewaehlt.indexOf(i) >= 0; });
  }

  function renderQuestion() {
    if (!quiz) return location.hash = '#/uebung';
    var item = quiz.fragen[quiz.pos];
    if (!item) return renderResult();
    setTitle('Übungsprüfung');
    var n = quiz.fragen.length;
    var lern = quiz.modus === 'lernen';
    var zeigen = lern && item.geprueft;
    var h = '<div class="quiz-head"><span>Frage ' + (quiz.pos + 1) + ' von ' + n + '</span><span class="muted">' + esc(item.q.themaTitel) + '</span></div>';
    h += '<div class="progress"><div style="width:' + Math.round(quiz.pos / n * 100) + '%"></div></div>';
    h += '<div class="panel quiz-card"><h2 class="quiz-q">' + item.q.frage + '</h2>';
    if (item.q.mehrfach) h += '<p class="hint">Mehrere Antworten sind richtig.</p>';
    h += '<div class="options">';
    item.optionen.forEach(function (o, i) {
      var cls = 'option';
      var checked = item.gewaehlt.indexOf(i) >= 0;
      if (checked) cls += ' selected';
      if (zeigen) {
        if (o.richtig) cls += ' correct';
        else if (checked) cls += ' wrong';
      }
      h += '<label class="' + cls + '"><input type="' + (item.q.mehrfach ? 'checkbox' : 'radio') + '" name="opt" value="' + i + '"' +
        (checked ? ' checked' : '') + (zeigen ? ' disabled' : '') + '><span>' + o.text + '</span></label>';
    });
    h += '</div>';
    if (zeigen) {
      h += '<div class="feedback ' + (item.richtig ? 'ok' : 'nok') + '"><strong>' + (item.richtig ? 'Richtig!' : 'Leider falsch.') + '</strong> ' +
        (item.q.erklaerung || '') + '</div>';
    }
    h += '</div><div class="pager">';
    h += quiz.pos > 0 && !lern ? '<button class="btn" id="prevQ">← Zurück</button>' : '<button class="btn" id="cancelQ">Abbrechen</button>';
    if (lern && !item.geprueft) h += '<button class="btn btn-primary" id="checkQ">Antwort prüfen</button>';
    else h += '<button class="btn btn-primary" id="nextQ">' + (quiz.pos === n - 1 ? 'Auswerten' : 'Weiter →') + '</button>';
    h += '</div>';
    render(h);

    Array.prototype.forEach.call(main.querySelectorAll('input[name=opt]'), function (inp) {
      inp.addEventListener('change', function () {
        item.gewaehlt = Array.prototype.filter.call(main.querySelectorAll('input[name=opt]'), function (x) { return x.checked; })
          .map(function (x) { return parseInt(x.value, 10); });
        Array.prototype.forEach.call(main.querySelectorAll('.option'), function (l, i) {
          l.classList.toggle('selected', item.gewaehlt.indexOf(i) >= 0);
        });
      });
    });
    var btn;
    if ((btn = document.getElementById('checkQ'))) btn.onclick = function () {
      if (!item.gewaehlt.length) return alertBox('Bitte eine Antwort auswählen.');
      item.geprueft = true; item.richtig = isCorrect(item); renderQuestion();
    };
    if ((btn = document.getElementById('nextQ'))) btn.onclick = function () {
      if (!lern && !item.gewaehlt.length && !confirmSkip()) return;
      item.richtig = isCorrect(item); quiz.pos++; renderQuestion();
    };
    if ((btn = document.getElementById('prevQ'))) btn.onclick = function () { quiz.pos--; renderQuestion(); };
    if ((btn = document.getElementById('cancelQ'))) btn.onclick = function () {
      if (window.confirm('Übungsprüfung wirklich abbrechen?')) { quiz = null; location.hash = '#/uebung'; }
    };
  }

  function confirmSkip() {
    return window.confirm('Du hast keine Antwort gewählt. Frage überspringen? Sie zählt dann als falsch.');
  }

  function renderResult() {
    var n = quiz.fragen.length;
    quiz.fragen.forEach(function (it) { it.richtig = isCorrect(it); });
    var ok = quiz.fragen.filter(function (it) { return it.richtig; }).length;
    var pct = Math.round(ok / n * 100);
    var themenTitel = [];
    quiz.fragen.forEach(function (it) { if (themenTitel.indexOf(it.q.themaTitel) < 0) themenTitel.push(it.q.themaTitel); });
    if (!quiz.gespeichert) {
      var verlauf = store('quiz-verlauf') || [];
      verlauf.unshift({ datum: new Date().toLocaleString('de-DE', { dateStyle: 'short', timeStyle: 'short' }), themen: themenTitel.join(', '), richtig: ok, gesamt: n });
      store('quiz-verlauf', verlauf.slice(0, 20));
      quiz.gespeichert = true;
    }
    var h = '<h1>Ergebnis</h1><div class="panel result ' + (pct >= 70 ? 'ok' : 'nok') + '">' +
      '<div class="score">' + ok + ' / ' + n + '</div><div class="pct">' + pct + ' % richtig</div>' +
      '<p>' + (pct >= 90 ? 'Sehr gut – das sitzt!' : pct >= 70 ? 'Gut gemacht! Schau dir die falschen Fragen noch einmal an.' : 'Da geht noch was – wiederhole die falschen Fragen.') + '</p></div>';
    var falsch = quiz.fragen.filter(function (it) { return !it.richtig; });
    h += '<div class="actions">';
    if (falsch.length) h += '<button class="btn btn-primary" id="retryWrong">Nur die ' + falsch.length + ' falschen wiederholen</button>';
    h += '<button class="btn" id="newQuiz">Neue Übungsprüfung</button></div>';
    if (falsch.length) {
      h += '<h2>Falsch beantwortet</h2>';
      falsch.forEach(function (it) {
        var richtige = it.optionen.filter(function (o) { return o.richtig; }).map(function (o) { return o.text; });
        var deine = it.gewaehlt.map(function (i) { return it.optionen[i].text; });
        h += '<div class="panel review"><p class="quiz-q">' + it.q.frage + '</p>' +
          '<p class="nok-text">Deine Antwort: ' + (deine.length ? deine.join(' · ') : '<em>keine</em>') + '</p>' +
          '<p class="ok-text">Richtig: ' + richtige.join(' · ') + '</p>' +
          (it.q.erklaerung ? '<p class="muted">' + it.q.erklaerung + '</p>' : '') + '</div>';
      });
    }
    render(h);
    var b;
    if ((b = document.getElementById('retryWrong'))) b.onclick = function () {
      startQuiz(quiz.themen, 0, quiz.modus, falsch.map(function (it) { return it.q; }));
    };
    document.getElementById('newQuiz').onclick = function () { quiz = null; location.hash = '#/uebung'; };
  }

  // ---------------------------------------------------------------- Router
  function route() {
    var hash = location.hash.replace(/^#/, '') || '/';
    var query = {};
    var qi = hash.indexOf('?');
    if (qi >= 0) {
      hash.slice(qi + 1).split('&').forEach(function (p) {
        var kv = p.split('=');
        query[decodeURIComponent(kv[0])] = decodeURIComponent((kv[1] || '').replace(/\+/g, ' '));
      });
      hash = hash.slice(0, qi);
    }
    var parts = hash.split('/').filter(Boolean);
    if (!parts.length) return viewStart();
    if (parts[0] === 'm' && parts.length === 3) return viewThema(parts[1], parts[2]);
    if (parts[0] === 'm' && parts.length === 4) return viewSeite(parts[1], parts[2], parts[3]);
    if (parts[0] === 'pruefung' && parts.length === 3) return viewPruefung(parts[1], parts[2]);
    if (parts[0] === 'stundenplan' && parts.length === 2) return viewStundenplan(parts[1]);
    if (parts[0] === 'uebung' && parts[1] === 'laeuft') return quiz ? renderQuestion() : (location.hash = '#/uebung');
    if (parts[0] === 'uebung') return viewUebungStart((query.themen || '').split(',').filter(Boolean));
    if (parts[0] === 'suche') return viewSuche(query.q || '');
    notFound();
  }

  window.addEventListener('hashchange', route);

  Promise.all([api('/api/info'), api('/api/struktur')]).then(function (res) {
    document.getElementById('siteTitle').textContent = res[0].titel;
    struktur = res[1];
    buildSidebar();
    route();
  }).catch(function (e) {
    if (e.message !== '401') main.innerHTML = '<p>Die Inhalte konnten nicht geladen werden.</p>';
  });
})();
