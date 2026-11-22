(function () {
  'use strict';
  document.documentElement.classList.add('js');
  var $ = function (s, r) { return (r || document).querySelector(s); };
  var $$ = function (s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)); };
  function h(tag, cls, html) { var e = document.createElement(tag); if (cls) e.className = cls; if (html != null) e.innerHTML = html; return e; }
  function de(n, d) { d = d || 0; return Number(n).toLocaleString('de-DE', { minimumFractionDigits: d, maximumFractionDigits: d }); }

  /* ---------- Speicher (nur dieser Browser) ---------- */
  var KEY = 'controlling-lernseite-v1';
  var state = { ex: {}, quiz: {}, plan: {} };
  try { var raw = JSON.parse(localStorage.getItem(KEY)); if (raw && typeof raw === 'object') { state.ex = raw.ex || {}; state.quiz = raw.quiz || {}; state.plan = raw.plan || {}; } } catch (e) {}
  function save() { try { localStorage.setItem(KEY, JSON.stringify(state)); } catch (e) {} }

  /* ---------- Zahlen einlesen: 1.234,56 / 1234.56 / -35.000 / 9,85 % ---------- */
  function parseNum(rawStr) {
    var s = String(rawStr).replace(/T€|Mio\.?|Stück|Stk\.?|kg|EUR/gi, '').replace(/[€%\s ]/g, '').replace(/[−–]/g, '-');
    if (!s) return [];
    if (!/^[-+]?[\d.,]+$/.test(s) || !/\d/.test(s)) return null;
    var out = [], c = s.indexOf(',') >= 0, d = s.indexOf('.') >= 0;
    function add(v) { v = Number(v); if (isFinite(v) && out.indexOf(v) < 0) out.push(v); }
    if (c && d) {
      if (s.lastIndexOf(',') > s.lastIndexOf('.')) add(s.replace(/\./g, '').replace(',', '.'));
      else add(s.replace(/,/g, ''));
    } else if (c) {
      if (s.split(',').length > 2) add(s.replace(/,/g, ''));
      else { add(s.replace(',', '.')); if (/^[-+]?\d{1,3},\d{3}$/.test(s)) add(s.replace(',', '')); }
    } else if (d) {
      if (s.split('.').length > 2) add(s.replace(/\./g, ''));
      else { if (/^[-+]?\d{1,3}\.\d{3}$/.test(s)) add(s.replace('.', '')); add(s); }
    } else add(s);
    return out;
  }
  function tolOf(f) { return f.t != null ? f.t : Math.max(Math.abs(f.a) * 0.005, 0.011); }
  function judge(f, rawStr) {
    var c = parseNum(rawStr);
    if (c === null) return { s: 'invalid', m: 'Bitte nur eine Zahl eintragen.' };
    if (!c.length) return { s: 'empty' };
    var list = c.slice(), tol = tolOf(f), i;
    if (f.u === '%' && Math.abs(f.a) >= 1) c.forEach(function (v) { if (Math.abs(v) < 1) list.push(v * 100); });
    for (i = 0; i < list.length; i++) if (Math.abs(list[i] - f.a) <= tol) return { s: 'ok' };
    if (f.alt) for (i = 0; i < f.alt.length; i++) for (var j = 0; j < list.length; j++) if (Math.abs(list[j] - f.alt[i][0]) <= tol) return { s: 'bad', m: f.alt[i][1] };
    if (f.a !== 0) {
      for (i = 0; i < list.length; i++) if (Math.abs(-list[i] - f.a) <= tol) return { s: 'bad', m: 'Betrag stimmt, Vorzeichen prüfen.' };
      for (i = 0; i < list.length; i++) if (Math.abs(list[i] * 1000 - f.a) <= tol || Math.abs(list[i] / 1000 - f.a) <= tol / 1000 + 1e-9) return { s: 'bad', m: 'Größenordnung prüfen (€ oder T€).' };
    }
    return { s: 'bad', m: 'Noch nicht richtig.' };
  }

  /* ---------- Aufgaben: Lösungen ---------- */
  var TYP = ['Aktivtausch', 'Passivtausch', 'Bilanzverlängerung', 'Bilanzverkürzung', 'erfolgswirksam: Aufwand', 'erfolgswirksam: Ertrag', 'gemischte Buchung'];
  var EX = {
    'rw-stroeme': { grid: { unit: '€', cols: ['I. Einzahlung (+) / Auszahlung (−)', 'II. Einnahme (+) / Ausgabe (−)', 'III. Ertrag (+) / Aufwand (−)'],
      rows: ['(1) Lieferantenkredit bar tilgen', '(2) LKW per Überweisung', '(3) LKW gestohlen', '(4) Waren auf Ziel verkauft', '(5) wie (4), Anzahlung 4.000', '(6) Zuschreibung Grundstück', '(7) Bar aufs Girokonto', '(8) Grundstück zum Buchwert, Zahlung später', '(9) Anleihen bar verkauft', '(10) wie (9), Kredit getilgt'],
      ans: [[-10000, 0, 0], [-25000, -25000, 0], [0, 0, -10000], [0, 12000, 2000], [4000, 12000, 2000], [0, 0, 20000], [0, 0, 0], [0, 60000, 0], [58000, 58000, 8000], [0, 58000, 8000]],
      alt: { '3,2': [12000, 'Zeile (4): 12.000 ist der Bruttoertrag. Dem steht der Warenabgang von 10.000 als Aufwand gegenüber, das Reinvermögen steigt um 2.000.'], '4,2': [12000, 'Zeile (5): Das Reinvermögen steigt nur um 12.000 − 10.000 = 2.000.'], '9,0': [58000, 'Zeile (10): Einzahlung 58.000 und Auszahlung 58.000 heben sich auf.'] } } },
    'rw-baecker': { fields: [
      { l: 'Differenz I (Ein- minus Auszahlungen), Summe', a: -4400, u: '€' }, { l: 'Differenz II (Einnahmen minus Ausgaben), Summe', a: -4400, u: '€' },
      { l: 'Differenz III (Ertrag minus Aufwand), Mai', a: 900, u: '€' }, { l: 'Differenz III, Juni', a: 300, u: '€' },
      { l: 'Differenz III, Summe', a: -800, u: '€' }, { l: 'Differenz IV (Erlöse minus Kosten), Summe', a: 1200, u: '€' }] },
    'rw-edmund-typ': { fields: [
      { l: '(1) Lizenzkauf per Bank', type: 'sel', o: TYP, a: 0 }, { l: '(2) Bankkredit tilgt Lieferantenschuld', type: 'sel', o: TYP, a: 1 },
      { l: '(3) Hopfen und Malz auf Ziel', type: 'sel', o: TYP, a: 2 }, { l: '(4) Tilgung Bankkredit', type: 'sel', o: TYP, a: 3 },
      { l: '(6) Forderung uneinbringlich', type: 'sel', o: TYP, a: 4 }, { l: '(9) Beteiligung für 120.000 verkauft', type: 'sel', o: TYP, a: 6 },
      { l: '(10b) Steuerschuld überwiesen', type: 'sel', o: TYP, a: 3 }] },
    'rw-edmund': { fields: [
      { l: 'Jahresüberschuss vor Steuern 2023', a: 42000, u: '€' }, { l: 'Steueraufwand 2023', a: 21000, u: '€' }, { l: 'Jahresüberschuss nach Steuern', a: 21000, u: '€' },
      { l: 'Kasse/Bankguthaben 31.12.2023', a: 62000, u: '€' }, { l: 'Gez. Kapital und Rücklagen', a: 275000, u: '€' }, { l: 'Verb. ggü. Kreditinstituten', a: 420000, u: '€' },
      { l: 'Verb. aus LuL', a: 427000, u: '€' }, { l: 'Bilanzsumme 31.12.2023', a: 1379000, u: '€' }] },
    'kf-mania': { grid: { unit: 'T€', cols: ['Periodenergebnis', 'CF operativ', 'CF Investition', 'CF Finanzierung'],
      rows: ['1 Grundstückskauf', '2 Gehälter', '3 Verkauf Vorräte', '4 Dividende', '5 Kredit mit Disagio', '6 Abschreibungen', '7 Forderungseingang', '8 Pensionsrückstellung', '9 Ertragsteuer', '10 Zinszahlung'],
      ans: [[0, 0, -40000, 0], [-5000, -5000, 0, 0], [5000, -35000, 0, 0], [0, 0, 0, -1000], [-200, 0, 0, 9800], [-5600, 0, 0, 0], [0, 2000, 0, 0], [-3000, 0, 0, 0], [-1000, -1000, 0, 0], [-1500, 0, 0, -1500]],
      alt: { '2,1': [40000, 'Zeile 3: 40.000 ist der reine Zahlungseingang. Die Vorlesungslösung rechnet indirekt: Ergebnis +5.000 minus Zunahme der Forderungen 40.000.'], '9,1': [-1500, 'Zeile 10: Gezahlte Zinsen gehören nach DRS 21 in den Finanzierungs-Cashflow.'], '0,2': [-50000, 'Zeile 1: 20 % stundet der Verkäufer. Es fließen nur 40.000.'], '4,3': [10000, 'Zeile 5: Ausgezahlt werden nur 98 %.'] } } },
    'kf-borussen': { fields: [{ l: 'Cashflow aus betrieblicher Tätigkeit', a: 895, u: 'T€' }, { l: 'Cashflow aus Investitionstätigkeit', a: -785, u: 'T€', alt: [[-700, '700 ist nur die Zunahme des Buchwerts. Die Abschreibungen von 85 mussten zusätzlich ersetzt werden.']] }, { l: 'Cashflow aus Finanzierungstätigkeit', a: -110, u: 'T€' }, { l: 'Gesamt-Cashflow', a: 0, u: 'T€', t: 0.01 }] },
    'kf-flashcow': { fields: [{ l: 'Cashflow aus betrieblicher Tätigkeit', a: 21450, u: 'T€' }, { l: 'Auszahlungen für Sachanlagen', a: 68100, u: 'T€', alt: [[48100, '48.100 ist nur die Bestandszunahme. Die Abschreibungen von 20.000 mussten zusätzlich ersetzt werden.']] }, { l: 'Cashflow aus Investitionstätigkeit', a: -63350, u: 'T€' }, { l: 'Cashflow aus Finanzierungstätigkeit', a: 30150, u: 'T€' }, { l: 'Veränderung der liquiden Mittel', a: -11750, u: 'T€' }] },
    'kz-a4': { fields: [{ l: '1. Eigenkapitalrentabilität', a: 2.67, t: 0.03, u: '%' }, { l: '2. Gesamtkapitalrentabilität', a: 2.91, t: 0.03, u: '%' }, { l: '3. Verschuldungsgrad (FK/EK)', a: 1.73, t: 0.011 }, { l: '4. Liquidität 2. Grades', a: 112.56, t: 0.15, u: '%' }, { l: '5. Fremdkapitalquote', a: 63.35, t: 0.06, u: '%' }] },
    'kz-pv1': { fields: [{ l: 'Eigenkapitalrentabilität vor Steuern', a: 10.97, t: 0.03, u: '%' }, { l: 'Gesamtkapitalrentabilität vor Steuern', a: 7.16, t: 0.03, u: '%' }, { l: 'Umsatzrentabilität vor Steuern', a: 7.08, t: 0.03, u: '%' }, { l: 'Eigenkapitalquote', a: 41.11, t: 0.06, u: '%' }, { l: 'EBT', a: 85, u: 'Mio. €' }, { l: 'EBIT', a: 135, u: 'Mio. €' }, { l: 'EBITDA', a: 375, u: 'Mio. €' }] },
    'kz-pv2': { fields: [{ l: 'Capital Employed', a: 1485, u: 'Mio. €' }, { l: 'ROCE', a: 9.09, t: 0.03, u: '%' }, { l: 'Eigenkapitalkosten (CAPM)', a: 15, t: 0.011, u: '%' }, { l: 'Zinssatz der Finanzschulden', a: 7.61, t: 0.03, u: '%' }, { l: 'WACC (mit Tax Shield)', a: 9.85, t: 0.04, u: '%' }, { l: 'NOPAT', a: 81, u: 'Mio. €' }, { l: 'EVA', a: -65.27, t: 0.7, u: 'Mio. €' }] },
    'kz-pv3': { fields: [{ l: 'Brutto-Cashflow', a: 321, u: 'Mio. €' }, { l: 'Bruttoinvestitionsbasis', a: 2735, u: 'Mio. €' }, { l: 'Ökonomische Abschreibung', a: 169.25, t: 1.2, u: 'Mio. €' }, { l: 'Statischer CFROI', a: 5.55, t: 0.08, u: '%' }, { l: 'CVA', a: -117.6, t: 3, u: 'Mio. €' }] },
    'kz-europol': { fields: [{ l: 'Jahresüberschuss, hohes Ergebnis', a: 8579, u: 'T€' }, { l: 'Bilanzsumme, hohes Ergebnis', a: 85829, u: 'T€' }, { l: 'Jahresüberschuss, niedriges Ergebnis', a: 3404, u: 'T€' }, { l: 'Bilanzsumme, niedriges Ergebnis', a: 80654, u: 'T€' }] },
    'kz-aktie': { fields: [{ l: 'Total Return to Shareholders', a: 25, t: 0.011, u: '%' }, { l: 'Kurs-Gewinn-Verhältnis', a: 10, t: 0.011 }, { l: 'Dividendenrendite', a: 4.17, t: 0.02, u: '%' }] },
    'ub-bita': { fields: [{ l: '1. Buchwert des Eigenkapitals', a: 4220, u: 'T€' }, { l: '2. Liquidationswert', a: 5000, u: 'T€' }, { l: '3. Ertragswert des Käufers', a: 6250, u: 'T€' }, { l: '4. Ertragswert des Verkäufers', a: 5250, u: 'T€' }, { l: '5. Marktwert des Eigenkapitals', a: 5040, u: 'T€' }] },
    'ub-a10': { fields: [{ l: 'WACC', a: 4.88, t: 0.006, u: '%' }, { l: 'Barwert des Terminal Value', a: 3452.66, t: 4, u: 'Mio. €', alt: [[4381.44, 'Das ist der Terminal Value am Ende von Jahr 5. Er muss noch fünf Jahre abgezinst werden.']] }, { l: 'Gesamtunternehmenswert', a: 4062.85, t: 4, u: 'Mio. €' }, { l: 'Shareholder Value', a: 1062.85, t: 4, u: 'Mio. €' }] },
    'pk-1b': { fields: [{ l: 'WACC', a: 6.25, t: 0.006, u: '%' }, { l: 'Barwert Detailplanungszeitraum', a: 1082.4, t: 1.5, u: 'Mio. €' }, { l: 'Barwert des Restwerts', a: 5213.0, t: 4, u: 'Mio. €', alt: [[7058.82, 'Das ist der Restwert am Ende von Jahr 5. Er muss noch mit 1,0625⁵ abgezinst werden.'], [5317.26, 'Du hast den letzten Cashflow für den Restwert um die Wachstumsrate erhöht (300 × 1,02). Die Vorlesungslösung zu Aufgabe 10 setzt ihn unverändert an. Kläre im Zweifel, welche Variante erwartet wird.']] }, { l: 'Gesamtunternehmenswert', a: 6295.4, t: 4, u: 'Mio. €', alt: [[6399.64, 'Du hast den letzten Cashflow für den Restwert um die Wachstumsrate erhöht (300 × 1,02). Die Vorlesungslösung zu Aufgabe 10 setzt ihn unverändert an. Kläre im Zweifel, welche Variante erwartet wird.']] }, { l: 'Shareholder Value', a: 1295.4, t: 4, u: 'Mio. €', alt: [[1399.64, 'Du hast den letzten Cashflow für den Restwert um die Wachstumsrate erhöht (300 × 1,02). Die Vorlesungslösung zu Aufgabe 10 setzt ihn unverändert an. Kläre im Zweifel, welche Variante erwartet wird.']] }] },
    'pk-2': { fields: [{ l: 'Cashflow aus Investitionstätigkeit', a: -1335, u: 'Mio. €' }] },
    'kr-bonbon': { fields: [{ l: 'a) Gewinn je kg, Sorte A', a: 7.5, t: 0.011, u: '€' }, { l: 'a) Gewinn je kg, Sorte B', a: 13, t: 0.011, u: '€' }, { l: 'a) Gewinn je kg, Sorte C', a: 18.5, t: 0.011, u: '€' }, { l: 'b) Betriebsergebnis (Vollkosten)', a: 78000, u: '€' },
      { l: 'c) Stückdeckungsbeitrag A', a: 13.75, t: 0.011, u: '€' }, { l: 'c) Stückdeckungsbeitrag B', a: 20, t: 0.011, u: '€' }, { l: 'c) Stückdeckungsbeitrag C', a: 26.25, t: 0.011, u: '€' }, { l: 'c) Deckungsbeitrag der Periode', a: 120000, u: '€' }, { l: 'c) Betriebsergebnis (Teilkosten)', a: 78000, u: '€' },
      { l: 'd) Stück-DB von A bei 20 €', a: 3.75, t: 0.011, u: '€' }, { l: 'd) Vollkosten-Ergebnis je kg A bei 20 €', a: -2.5, t: 0.011, u: '€' }] },
    'kr-blech': { fields: [{ l: 'a) Materialgemeinkosten-Zuschlag', a: 8, t: 0.011, u: '%' }, { l: 'a) Stanzerei je qm', a: 25, t: 0.011, u: '€' }, { l: 'a) Formerei je Maschinenstunde', a: 55, t: 0.011, u: '€' }, { l: 'a) Montage je Fertigungsstunde', a: 32, t: 0.011, u: '€' }, { l: 'a) Verwaltungs- und Vertriebszuschlag', a: 12, t: 0.011, u: '%' },
      { l: 'b) Herstellkosten der Serie', a: 3843.6, t: 0.06, u: '€' }, { l: 'b) Selbstkosten der Serie', a: 4304.83, t: 0.06, u: '€' }, { l: 'c) Listenverkaufspreis netto', a: 5400.33, t: 0.2, u: '€' }] },
    'kr-glanz': { fields: [{ l: 'a) Betriebsergebnis März', a: 23500, t: 100, u: '€' }, { l: 'b) Deckungsbeitrag des Zusatzauftrags', a: 10000, t: 120, u: '€' }, { l: 'b) Gewinn mit Zusatzauftrag', a: 33500, t: 180, u: '€' }, { l: 'c) nötige Mehrmenge des Artikels mit dem höchsten Stück-DB', a: 6914, t: 40, u: 'Stück' },
      { l: 'd) Vollkosten je Stück, Artikel A', a: 3.39, t: 0.011, u: '€' }, { l: 'd) Ergebnis je Stück des Zusatzauftrags', a: -0.19, t: 0.016, u: '€' }] },
    'kr-frucht': { fields: [{ l: 'DB 2 Apfelsaft', a: 36900, u: '€' }, { l: 'DB 2 O-Saft', a: 44900, u: '€' }, { l: 'DB 2 Ananas', a: 5800, u: '€' }, { l: 'DB 2 Pfirsich', a: -11000, u: '€' }, { l: 'DB 2 Pflaumenmus', a: 10400, u: '€' }, { l: 'DB 2 Apfelmus', a: 42000, u: '€' },
      { l: 'DB 3 Stückobst', a: -9200, u: '€' }, { l: 'DB 3 Mus', a: 45000, u: '€' }, { l: 'DB 4 Bereich Säfte', a: 60000, u: '€' }, { l: 'DB 4 Bereich Obst', a: 11800, u: '€' }, { l: 'Betriebsergebnis', a: 13800, u: '€' }] },
    'kr-be': { fields: [{ l: 'a) Break-even-Menge', a: 40000, u: 'Paar' }, { l: 'b) Gewinn nach Mieterhöhung', a: 570000, u: '€', alt: [[-60000, 'Das ist die Veränderung. Gefragt ist hier der neue Gewinn.']] }, { l: 'c) neuer Verkaufspreis', a: 225.63, t: 0.03, u: '€' }, { l: 'c) Preiserhöhung', a: 7.44, t: 0.03, u: '%' }] },
    'pb-pkr': { fields: [{ l: 'Planverrechnungssatz', a: 80, t: 0.011, u: '€/h' }, { l: 'Verrechnete Plankosten', a: 64000, u: '€' }, { l: 'Sollkosten', a: 70000, u: '€' }, { l: 'Verbrauchsabweichung', a: 8000, u: '€' }, { l: 'Beschäftigungsabweichung', a: 6000, u: '€' }, { l: 'Gesamtabweichung', a: 14000, u: '€' }] },
    'pb-drink': { fields: [{ l: 'Plankosten (75.000 Liter)', a: 21262.5, t: 0.6, u: '€' }, { l: 'Planverrechnungssatz', a: 0.2835, t: 0.0002, u: '€/l' }, { l: 'Istkosten', a: 21503, t: 0.6, u: '€' }, { l: 'Plankosten bei Istmenge (Sollkosten 1)', a: 17010, t: 0.6, u: '€' }, { l: 'Gesamtabweichung', a: 4493, t: 0.6, u: '€' },
      { l: 'Mixabweichung', a: 315, t: 0.6, u: '€' }, { l: 'Preisabweichung', a: 3689, t: 0.6, u: '€' }, { l: '„Echte“ Verbrauchsabweichung', a: 489, t: 0.6, u: '€' }] },
    'pb-bicycle': { fields: [{ l: 'Umsatzerlöse', a: 6360000, u: '€' }, { l: 'Plan-Gewinn', a: 494000, u: '€' }, { l: 'Operativer Cashflow', a: 634000, u: '€' }, { l: 'Finanzierungs-Cashflow', a: -326000, u: '€' }, { l: 'Wertpapierkauf (Überschussliquidität)', a: 108000, u: '€' },
      { l: 'Investitions-Cashflow inkl. Wertpapiere', a: -258000, u: '€' }, { l: 'Forderungen in der Plan-Bilanz', a: 936000, u: '€' }, { l: 'Bilanzsumme der Plan-Bilanz', a: 3594000, u: '€' }] }
  };

  /* ---------- Formular bauen (feste Aufgaben und Trainer) ---------- */
  function buildForm(def, pid, saved) {
    var wrap = h('div', 'ex-form'), items = [];
    if (def.grid) {
      var g = def.grid, gw = h('div', 'grid-wrap'), tb = h('table', 'grid');
      var th = '<thead><tr><th>Vorfall' + (g.unit ? ' (in ' + g.unit + ')' : '') + '</th>';
      g.cols.forEach(function (c) { th += '<th>' + c + '</th>'; });
      tb.innerHTML = th + '</tr></thead>';
      var body = h('tbody');
      g.rows.forEach(function (r, ri) {
        var tr = h('tr'); tr.appendChild(h('td', '', r));
        g.cols.forEach(function (c, ci) {
          var td = h('td'), inp = h('input'); inp.type = 'text'; inp.inputMode = 'decimal'; inp.autocomplete = 'off';
          inp.id = pid + '-' + ri + '-' + ci; inp.setAttribute('aria-label', r + ', ' + c);
          var alt = g.alt && g.alt[ri + ',' + ci];
          items.push({ el: inp, f: { a: g.ans[ri][ci], t: g.tol != null ? g.tol : 0.5, alt: alt ? [alt] : null }, grid: true });
          td.appendChild(inp); tr.appendChild(td);
        });
        body.appendChild(tr);
      });
      tb.appendChild(body); gw.appendChild(tb); wrap.appendChild(gw);
      wrap.appendChild(h('p', 'note', 'Leere Felder zählen als 0. Abflüsse und Aufwand mit Minus eintragen.'));
    } else {
      var fl = h('div', 'fields');
      def.fields.forEach(function (f, i) {
        var box = h('div', 'fld'), lab = h('label', '', f.l), id = pid + '-' + i; lab.htmlFor = id;
        var row = h('div', 'in'), inp;
        if (f.type === 'sel') {
          inp = h('select'); inp.appendChild(new Option('bitte wählen', ''));
          f.o.forEach(function (o, oi) { inp.appendChild(new Option(o, String(oi))); });
        } else { inp = h('input'); inp.type = 'text'; inp.inputMode = 'decimal'; inp.autocomplete = 'off'; }
        inp.id = id; row.appendChild(inp);
        if (f.u) row.appendChild(h('span', 'unit', f.u));
        var msg = h('div', 'msg'); msg.setAttribute('aria-live', 'polite');
        box.appendChild(lab); box.appendChild(row); box.appendChild(msg); fl.appendChild(box);
        items.push({ el: inp, f: f, msg: msg });
      });
      wrap.appendChild(fl);
    }
    if (saved && saved.length === items.length) items.forEach(function (it, i) { it.el.value = saved[i] || ''; });
    var gridMsg = h('div', 'note'); gridMsg.setAttribute('aria-live', 'polite'); wrap.appendChild(gridMsg);
    function clearMarks() { items.forEach(function (it) { it.el.classList.remove('ok', 'bad'); if (it.msg) { it.msg.textContent = ''; it.msg.className = 'msg'; } }); gridMsg.textContent = ''; }
    return {
      node: wrap,
      values: function () { return items.map(function (it) { return it.el.value; }); },
      reset: function () { items.forEach(function (it) { it.el.value = ''; }); clearMarks(); },
      check: function () {
        clearMarks();
        var filled = items.filter(function (it) { return String(it.el.value).trim() !== ''; }).length;
        if (!filled) return { right: 0, total: items.length, filled: 0 };
        var right = 0, notes = [];
        items.forEach(function (it) {
          var r;
          if (it.f.type === 'sel') r = it.el.value === '' ? { s: 'empty' } : (Number(it.el.value) === it.f.a ? { s: 'ok' } : { s: 'bad', m: 'Noch nicht richtig.' });
          else r = judge(it.f, it.grid && String(it.el.value).trim() === '' ? '0' : it.el.value);
          if (r.s === 'ok') { right++; it.el.classList.add('ok'); if (it.msg) { it.msg.textContent = 'Richtig'; it.msg.className = 'msg ok'; } }
          else if (r.s === 'empty') { if (it.msg) it.msg.textContent = 'Noch offen.'; }
          else { it.el.classList.add('bad'); if (it.msg) it.msg.textContent = r.m || ''; else if (r.m && r.m !== 'Noch nicht richtig.' && notes.indexOf(r.m) < 0) notes.push(r.m); }
        });
        if (notes.length) gridMsg.textContent = notes.join(' ');
        return { right: right, total: items.length, filled: filled };
      }
    };
  }

  function wireSolution(body, actions) {
    var sol = $('.sol', body); if (!sol) return null;
    var b = h('button', 'ghost', 'Lösungsweg zeigen'); b.type = 'button';
    b.addEventListener('click', function () { sol.hidden = !sol.hidden; b.textContent = sol.hidden ? 'Lösungsweg zeigen' : 'Lösungsweg ausblenden'; });
    actions.appendChild(b);
    return { hide: function () { sol.hidden = true; b.textContent = 'Lösungsweg zeigen'; } };
  }

  function renderEx(el) {
    var id = el.dataset.ex, def = EX[id]; if (!def) return;
    var head = $('.ex-head', el), body = $('.ex-body', el), sol = $('.sol', body);
    var pill = h('span', 'pill', 'offen'); head.appendChild(pill);
    var st = state.ex[id] || {};
    var form = buildForm(def, 'f-' + id, st.v);
    var actions = h('div', 'ex-actions'), res = h('span', 'result'); res.setAttribute('aria-live', 'polite');
    var bc = h('button', '', 'Prüfen'); bc.type = 'button';
    var br = h('button', 'ghost', 'Zurücksetzen'); br.type = 'button';
    actions.appendChild(bc);
    form.node.appendChild(actions);
    body.insertBefore(form.node, sol);
    wireSolution(body, actions);
    actions.appendChild(br); actions.appendChild(res);
    function paint() { var s = state.ex[id] || {}; pill.className = 'pill' + (s.done ? ' done' : (s.best ? ' part' : '')); pill.textContent = s.done ? 'gelöst' : (s.best ? s.best + ' von ' + s.total + ' richtig' : 'offen'); }
    bc.addEventListener('click', function () {
      var r = form.check();
      if (!r.filled) { res.className = 'result bad'; res.textContent = 'Trag zuerst deine Ergebnisse ein.'; return; }
      var s = state.ex[id] || {}; s.v = form.values(); s.total = r.total; s.best = Math.max(s.best || 0, r.right); if (r.right === r.total) s.done = true;
      state.ex[id] = s; save(); paint(); progress();
      res.className = 'result ' + (r.right === r.total ? 'ok' : 'bad');
      res.textContent = r.right === r.total ? 'Alles richtig.' : r.right + ' von ' + r.total + ' richtig. Rote Felder noch einmal rechnen.';
    });
    br.addEventListener('click', function () { form.reset(); res.textContent = ''; delete state.ex[id]; save(); paint(); progress(); });
    paint();
  }

  /* ---------- Verständnisfragen ---------- */
  var QUIZ = {
    controlling: [
      { q: 'Welcher Leitsatz gehört zum strategischen Controlling?', o: ['„to do the things right“ (Effizienz)', '„to do the right things“ (Effektivität)', '„cash is king“', '„price is what you pay“'], a: 1, w: 'Strategisch geht es um die richtigen Dinge (Effektivität), operativ darum, die Dinge richtig zu tun (Effizienz).' },
      { q: 'Welches Bild beschreibt die Rolle des Controllers im Skript?', o: ['Kapitän des Schiffes', 'Lotse oder Navigator, der das Schiff auf Kurs hält', 'Eigner des Schiffes', 'Hafenmeister'], a: 1, w: 'Der Controller steuert mit, entscheidet aber nicht selbst. Kapitän bleibt das Management.' },
      { q: 'Welche Zielgröße gehört zum strategischen Controlling?', o: ['Betriebsergebnis', 'Barliquidität', 'Erfolgspotenzial', 'Jahresüberschuss'], a: 2, w: 'Strategisch: Existenzsicherung und Erfolgspotenzial (Chancen/Risiken, Stärken/Schwächen). Die anderen drei sind operative Größen.' },
      { q: 'Was ist keine der vier zentralen Controllingkonzeptionen?', o: ['Informationsversorgungsfunktion', 'Koordinationsfunktion', 'Rationalitätssicherung der Führung', 'Gewinnverwendungsfunktion'], a: 3, w: 'Die vier Konzeptionen: Informationsversorgung, erfolgszielbezogene Steuerung, Koordination, Rationalitätssicherung.' },
      { q: 'Welcher Zeithorizont gilt für das operative Controlling?', o: ['langfristig, 3 bis 5 Jahre', 'kurz- bis mittelfristig, höchstens 2 Jahre', 'ausschließlich das laufende Quartal', 'mehr als 10 Jahre'], a: 1, w: 'Operativ: kurz- bis mittelfristig (max. 2 Jahre). Strategisch: langfristig (3 bis 5 Jahre).' }
    ],
    rechnungswesen: [
      { q: 'Warenverkauf auf Ziel über 15.000 €. Was liegt vor?', o: ['Einzahlung, keine Einnahme', 'Einnahme, keine Einzahlung', 'weder Einzahlung noch Einnahme', 'Einzahlung und Einnahme'], a: 1, w: 'Die Forderung erhöht das Geldvermögen (Einnahme). Geld fließt erst später.' },
      { q: 'Aufnahme eines Bankdarlehens über 100.000 €. Was liegt vor?', o: ['Einzahlung, keine Einnahme', 'Einnahme, keine Einzahlung', 'Ertrag', 'Einzahlung und Einnahme'], a: 0, w: 'Zahlungsmittel steigen, die Verbindlichkeit steigt genauso. Das Geldvermögen bleibt gleich.' },
      { q: 'Der kalkulatorische Unternehmerlohn ist …', o: ['neutraler Aufwand', 'Zweckaufwand', 'Zusatzkosten', 'Anderskosten'], a: 2, w: 'Kosten, denen kein Aufwand gegenübersteht: Zusatzkosten.' },
      { q: 'Eine Spende für wohltätige Zwecke ist …', o: ['Grundkosten', 'neutraler Aufwand', 'Zusatzkosten', 'ein neutraler Ertrag'], a: 1, w: 'Aufwand ohne Bezug zum Betriebszweck: neutraler (betriebsfremder) Aufwand.' },
      { q: 'Was gilt für Gesamtkosten- und Umsatzkostenverfahren?', o: ['Das GKV zeigt immer das höhere Ergebnis', 'Das UKV zeigt immer das höhere Ergebnis', 'Beide führen immer zum gleichen Ergebnis', 'Sie unterscheiden sich nur beim Finanzergebnis'], a: 2, w: 'Unterschied ist nur die Gliederung: GKV nach Aufwandsarten, UKV nach Funktionsbereichen.' },
      { q: 'Rohstoffkauf auf Ziel. Welcher Buchungstyp?', o: ['Aktivtausch', 'Passivtausch', 'Bilanzverlängerung', 'Bilanzverkürzung'], a: 2, w: 'Vorräte steigen, Verbindlichkeiten aus LuL steigen: Aktiv- und Passivmehrung.' }
    ],
    kapitalfluss: [
      { q: 'Wohin gehören gezahlte Zinsen nach DRS 21?', o: ['Betriebliche Tätigkeit', 'Investitionstätigkeit', 'Finanzierungstätigkeit', 'Sie werden nicht ausgewiesen'], a: 2, w: 'DRS 21: gezahlte Zinsen und gezahlte Dividenden gehören zur Finanzierungstätigkeit.' },
      { q: 'Wohin gehören erhaltene Dividenden nach DRS 21?', o: ['Betriebliche Tätigkeit', 'Investitionstätigkeit', 'Finanzierungstätigkeit', 'Finanzmittelfonds'], a: 1, w: 'DRS 21: erhaltene Zinsen und erhaltene Dividenden gehören zur Investitionstätigkeit.' },
      { q: 'Die Forderungen aus LuL sind gestiegen. Was passiert im indirekten Schema?', o: ['Betrag wird addiert', 'Betrag wird abgezogen', 'Kein Einfluss', 'Betrag geht in den Investitions-Cashflow'], a: 1, w: 'Umsatz steckt im Ergebnis, ist aber noch nicht eingegangen. Aktiva rauf heißt Cash runter.' },
      { q: 'Warum werden Abschreibungen im indirekten Schema addiert?', o: ['Weil sie Einzahlungen sind', 'Weil sie Aufwand ohne Auszahlung sind', 'Weil DRS 21 sie als Investition einstuft', 'Weil sie das Ergebnis erhöhen'], a: 1, w: 'Sie haben das Ergebnis gemindert, ohne dass Geld abgeflossen ist.' },
      { q: 'Woraus besteht der Finanzmittelfonds?', o: ['Nur Kassenbestand', 'Zahlungsmittel und Zahlungsmitteläquivalente', 'Gesamtes Umlaufvermögen', 'Liquide Mittel und Forderungen'], a: 1, w: 'Zahlungsmittel plus kurzfristige, risikoarme Anlagen mit weniger als drei Monaten Laufzeit.' },
      { q: 'Welcher Cashflow sollte laut Skript langfristig positiv sein?', o: ['Investitions-Cashflow', 'Finanzierungs-Cashflow', 'Operativer Cashflow', 'Keiner'], a: 2, w: 'Aus dem operativen Cashflow sollen Tilgung, Investitionen und Dividenden ohne Außenfinanzierung bezahlt werden.' }
    ],
    kennzahlen: [
      { q: 'Welche Welt unterstellt das EBITDA?', o: ['Eine Welt ohne Steuern, aber mit Kapitalkosten', 'Eine Welt ohne Kapitalkosten und ohne Investitionsausgaben', 'Eine Welt ohne Umsatzschwankungen', 'Eine Welt ohne Fremdkapital'], a: 1, w: 'Investitionen tauchen weder bei Anschaffung noch über Abschreibungen auf, Kapitalkosten auch nicht.' },
      { q: 'Wann wurde nach der Shareholder-Value-Logik Wert geschaffen?', o: ['Wenn der Jahresüberschuss positiv ist', 'Wenn der ROCE größer ist als der WACC', 'Wenn das EBITDA steigt', 'Wenn die Eigenkapitalquote über 40 % liegt'], a: 1, w: 'Nur wenn die Kapitalkosten verdient werden. Rendite-Spread = ROCE − WACC.' },
      { q: 'Der EVA ist eine …', o: ['relative, cashflow-orientierte Kennzahl', 'absolute, gewinnorientierte Kennzahl', 'relative, gewinnorientierte Kennzahl', 'absolute, cashflow-orientierte Kennzahl'], a: 1, w: 'EVA: absolut und gewinnorientiert. ROCE: relativ/gewinn. CVA: absolut/Cashflow. CFROI: relativ/Cashflow.' },
      { q: 'Was bedeutet ein Beta-Faktor größer 1?', o: ['Das Unternehmensrisiko liegt über dem Marktrisiko', 'Das Unternehmen ist schuldenfrei', 'Die Aktie ist unterbewertet', 'Das Unternehmensrisiko liegt unter dem Marktrisiko'], a: 0, w: 'Beta = 1 entspricht dem Marktportfolio. Größer 1: riskanter als der Markt.' },
      { q: 'Was ist die Hauptkritik an klassischen Kapitalrenditen?', o: ['Sie sind zu aufwendig zu berechnen', 'Sie vernachlässigen die Eigenkapitalkosten', 'Sie berücksichtigen keine Umsätze', 'Sie sind gesetzlich verboten'], a: 1, w: 'Der „Löwenanteil“ der Kapitalkosten fehlt. Dazu kommen Bilanzpolitik und eingeschränkte Vergleichbarkeit.' },
      { q: 'Welche Perspektive gehört nicht zum Grundaufbau der Balanced Scorecard?', o: ['Finanzperspektive', 'Kundenperspektive', 'Lieferantenperspektive', 'Potenzialperspektive'], a: 2, w: 'Finanzen, Kunden, Prozesse, Potenziale. Eine Nachhaltigkeitsperspektive kann ergänzt werden.' },
      { q: 'Liquidität 2. Grades ist …', o: ['liquide Mittel / kurzfristiges FK', '(liquide Mittel + kurzfristige Forderungen) / kurzfristiges FK', '(monetäres UV + Vorräte) / kurzfristiges FK', 'Umlaufvermögen / Bilanzsumme'], a: 1, w: 'Monetäres Umlaufvermögen durch kurzfristiges Fremdkapital.' },
      { q: 'Warum ist „internationale Vergleichbarkeit“ beim EBIT laut Skript ein Scheinargument?', o: ['Weil EBIT nur in Deutschland verwendet wird', 'Weil es zahllose Berechnungsvarianten gibt', 'Weil Steuern weltweit gleich sind', 'Weil Zinsen nie eliminiert werden'], a: 1, w: 'Unternehmen grenzen Zins- und Finanzergebnis unterschiedlich ab, teils mehrere Definitionen in einem Bericht.' }
    ],
    bewertung: [
      { q: 'Wie lässt sich der Liquidationswert interpretieren?', o: ['Als Preisobergrenze des Käufers', 'Als Preisuntergrenze des Verkäufers', 'Als Einigungswert', 'Als Marktwert des Gesamtkapitals'], a: 1, w: 'Wenn die Alternative zum Verkauf nur die Zerschlagung ist. Dem Käufer liefert er eine Risikogrenze.' },
      { q: 'Beim WACC-Ansatz gilt: Unternehmenswert minus Fremdkapital ergibt …', o: ['den Free Cashflow', 'den Shareholder Value', 'den Terminal Value', 'den Substanzwert'], a: 1, w: 'Bruttoverfahren: erst Marktwert des Gesamtkapitals, dann Marktwert des Fremdkapitals abziehen.' },
      { q: 'Welches Verfahren ist ein Einzelbewertungsverfahren?', o: ['Ertragswertverfahren', 'DCF-Verfahren', 'Substanzwertverfahren', 'Multiplikatorverfahren'], a: 2, w: 'Einzelbewertung: Summe der Vermögenswerte minus Schulden, ohne Kombinationseffekte.' },
      { q: 'Wofür werden Multiplikatoren im Controlling meist eingesetzt?', o: ['Zur Plausibilisierung von Ertragswert- und DCF-Werten', 'Zur Ermittlung der Steuerlast', 'Als Ersatz für die Budgetierung', 'Zur Berechnung des WACC'], a: 0, w: 'Vergleichsverfahren ergänzen die anderen Verfahren. Geeignet vor allem für kleinere Unternehmen.' },
      { q: 'Was kennzeichnet das Zwei-Phasen-Modell?', o: ['Zwei Bewerter rechnen parallel', 'Detailplanung über 3 bis 5 Jahre, danach Terminal Value', 'Erst Substanzwert, dann Ertragswert', 'Zwei verschiedene Zinssätze für EK und FK'], a: 1, w: 'Phase 1 mit einzeln geplanten Cashflows, Phase 2 als ewige Rente mit Wachstumsrate.' },
      { q: 'Worin unterscheidet sich das DCF- vom Ertragswertverfahren beim Zinssatz?', o: ['DCF nutzt kapitalmarkttheoretische Modelle (CAPM)', 'DCF nutzt immer 8 %', 'Ertragswert nutzt den WACC', 'Es gibt keinen Unterschied'], a: 0, w: 'Ertragswert: unternehmensindividuell beste Alternativanlage. DCF: Kapitalmarktmodelle, in der Regel CAPM.' }
    ],
    kosten: [
      { q: 'Was ist die kurzfristige Preisuntergrenze?', o: ['Selbstkosten je Stück', 'variable Stückkosten', 'Herstellkosten je Stück', 'fixe Stückkosten'], a: 1, w: 'Kurzfristig: variable Stückkosten. Langfristig: gesamte Stückkosten.' },
      { q: 'Einzelkosten sind Kosten, die …', o: ['sich mit der Beschäftigung ändern', 'dem Kostenträger direkt zurechenbar sind', 'nur über Kostenstellen verrechnet werden', 'bei jeder Menge gleich bleiben'], a: 1, w: 'Einzel/Gemein unterscheidet nach Zurechenbarkeit, fix/variabel nach Abhängigkeit von der Beschäftigung.' },
      { q: 'Für welchen Fertigungstyp passt die Zuschlagskalkulation?', o: ['Massenproduktion im Einproduktbetrieb', 'Kuppelproduktion', 'Serien- und Einzelfertigung', 'Sortenfertigung'], a: 2, w: 'Division: Massenproduktion. Äquivalenzziffern: Sorten. Zuschlag: Serie/Einzel. Restwert/Verteilung: Kuppelprodukte.' },
      { q: 'Was ist der Kern der Kritik an der Vollkostenrechnung?', o: ['Sie ist gesetzlich nicht zulässig', 'Fixkosten werden proportionalisiert und Gemeinkosten geschlüsselt', 'Sie kennt keine Einzelkosten', 'Sie rechnet nur mit Planwerten'], a: 1, w: 'Fixkosten sind kurzfristig entscheidungsirrelevant. Auf Stückbasis verteilt führen sie zu Fehlurteilen.' },
      { q: 'Wie berechnet sich die Break-even-Menge?', o: ['Fixkosten / Deckungsspanne', 'Fixkosten / Preis', 'Gewinn / Deckungsspanne', 'variable Kosten / Preis'], a: 0, w: 'Deckungsspanne = Preis minus variable Stückkosten.' },
      { q: 'Wozu dient die mehrstufige Deckungsbeitragsrechnung?', o: ['Zur kurzfristigen Preisfindung', 'Zur langfristigen Programmoptimierung', 'Zur Bestandsbewertung in der Bilanz', 'Zur Ermittlung der Zuschlagssätze'], a: 1, w: 'Der Fixkostenblock wird ohne Schlüsselung in Schichten zerlegt (Produkt, Gruppe, Bereich, Unternehmen).' }
    ],
    planung: [
      { q: 'Wie ist die Beschäftigungsabweichung definiert?', o: ['Istkosten − Sollkosten', 'Sollkosten − verrechnete Plankosten', 'Istkosten − Plankosten', 'Plankosten − Sollkosten'], a: 1, w: 'Sie entspricht den nicht verrechneten Fixkosten und misst ungenutzte Kapazität.' },
      { q: 'Warum gibt es in der flexiblen Plankostenrechnung auf Teilkostenbasis keine Beschäftigungsabweichung?', o: ['Weil keine Fixkosten auf Kostenträger verrechnet werden', 'Weil die Istbeschäftigung nicht gemessen wird', 'Weil es keine Sollkosten gibt', 'Weil Preise konstant sind'], a: 0, w: 'Fixkosten gehen en bloc ins Betriebsergebnis.' },
      { q: 'Wie wird die Erlösabweichung sinnvoll aufgespalten?', o: ['In Preis- und Mengenabweichung', 'In externe (Marktvolumen) und interne (Marktanteil) Abweichung', 'In fixe und variable Abweichung', 'In Verbrauchs- und Beschäftigungsabweichung'], a: 1, w: 'Der Preis ist auf der Erlösseite ein eigener Aktionsparameter, keine exogene Größe.' },
      { q: 'Welcher Nachteil gehört zum Bottom-up-Ansatz?', o: ['Mangelnde Realitätsnähe', 'Geringe Anforderungshöhe und Vergangenheitsorientierung', 'Im Konflikt dominiert die Führungsspitze', 'Geringere Motivation der Mitarbeiter'], a: 1, w: 'Dazu die Gefahr, dass Puffer eingeplant werden. Mangelnde Realitätsnähe und geringe Akzeptanz gehören zu Top-down.' },
      { q: 'Was kennzeichnet die rollierende Planung?', o: ['Budget wird nur alle zwei Jahre erstellt', 'Ein gleichbleibender Zeitraum (oft fünf Quartale) rückt jedes Quartal weiter', 'Planung endet immer am 31.12.', 'Es werden nur Ist-Zahlen berichtet'], a: 1, w: 'Die Planung löst sich vom Geschäftsjahr und wird verstetigt.' },
      { q: 'Worauf zielt Zero Base Budgeting?', o: ['Dauerhafte Senkung der Gemeinkosten, Start bei null', 'Höhere Umsatzziele im Vertrieb', 'Abschaffung jeder Planung', 'Quartalsweise Forecasts'], a: 0, w: 'Aufgaben, Strukturen und Ressourcen werden von null aus neu begründet, typischerweise alle 3 bis 4 Jahre.' },
      { q: 'Was meint „Dezemberfieber“?', o: ['Hektik bei der Jahresabschlusserstellung', 'Nutzlose Ausgaben, damit das Budget ausgeschöpft wird', 'Sinkende Umsätze im Winter', 'Verspätete Forecasts'], a: 1, w: 'Traditionelle Budgets geben keinen Anreiz, das Budget zu unterschreiten.' }
    ],
    risiko: [
      { q: 'Ein Unternehmen sichert ein Währungsgeschäft mit einem Gegengeschäft ab. Welche Strategie?', o: ['Risikovermeidung', 'Risikoüberwälzung', 'Risikoakzeptanz', 'Risikoverminderung'], a: 1, w: 'Risikoüberwälzung: Zum Geschäft wird ein Gegengeschäft (Hedge) eingegangen.' },
      { q: 'Welcher Schritt folgt im Kreislauf auf die Risikobewertung?', o: ['Risikoidentifikation', 'Risikoaggregation', 'Externes Berichtswesen', 'Risikoüberwachung'], a: 1, w: 'Identifikation, Bewertung, Aggregation, Bewältigung, Überwachung, externes Berichtswesen.' },
      { q: 'Zu welcher Kategorie gehören Wechselkursschwankungen?', o: ['Operative Risiken', 'Marktrisiken', 'Finanzielle Risiken', 'Rechtliche Risiken'], a: 2, w: 'Finanzielle Risiken: Leitzinsänderungen, Wechselkurse, Ausfall- und Liquiditätsrisiken.' },
      { q: 'Was kritisiert das Skript an der Risk Map von Adidas?', o: ['Sie ist zu detailliert', 'Der Aktionär sieht keine absolute Gesamtschadenshöhe', 'Sie enthält keine Eintrittswahrscheinlichkeiten', 'Sie betrachtet nur Finanzrisiken'], a: 1, w: 'Sie zeigt nur, wie das Management Risiken kategorisiert, nicht den Worst Case in Summe.' },
      { q: 'Nach welchen zwei Größen werden Risiken bewertet?', o: ['Umsatz und Gewinn', 'Schadenshöhe und Eintrittswahrscheinlichkeit', 'Beta und Marktrisikoprämie', 'Kosten und Erlöse'], a: 1, w: 'Aus beiden ergibt sich das Risikoportfolio mit den wesentlichen und bestandsgefährdenden Risiken.' }
    ],
    esg: [
      { q: 'Welche Unternehmen erfasst die CSRD laut Skript?', o: ['Mehr als 250 Beschäftigte oder 50 Mio. € Umsatz', 'Mehr als 1.000 Beschäftigte und mehr als 450 Mio. € Nettoumsatz', 'Alle Kapitalgesellschaften', 'Nur DAX-Unternehmen'], a: 1, w: 'Beide Schwellen müssen erfüllt sein (und-Kriterium).' },
      { q: 'Welche Regelung beantwortet die Frage, wie berichtet werden muss?', o: ['EU Green Deal', 'CSRD', 'ESRS', 'ESG'], a: 2, w: 'Warum: Green Deal. Wer: CSRD. Wie: ESRS. Worüber: ESG.' },
      { q: 'Was verlangt das DNSH-Prinzip der EU-Taxonomie?', o: ['Wesentlichen Beitrag zu allen sechs Umweltzielen', 'Keine wesentliche Beeinträchtigung der übrigen fünf Umweltziele', 'Verzicht auf Dividenden', 'Prüfung durch die BaFin'], a: 1, w: '„Do No Significant Harm“. Dazu kommen ein wesentlicher Beitrag zu mindestens einem Ziel und Mindeststandards.' },
      { q: 'Bis wann soll Deutschland laut Klimaschutzgesetz treibhausgasneutral sein?', o: ['2030', '2040', '2045', '2050'], a: 2, w: 'KSG: −65 % bis 2030, −88 % bis 2040, Neutralität 2045. Die EU zielt auf 2050.' },
      { q: 'Was folgt aus § 161 AktG zum Corporate Governance Kodex?', o: ['Rechtspflicht, alle Empfehlungen einzuhalten', 'Jährliche Erklärung, Abweichungen müssen begründet werden', 'Der Kodex gilt nur für GmbHs', 'Der Aufsichtsrat darf den Kodex ändern'], a: 1, w: 'Keine Pflicht zur Einhaltung, aber Entsprechenserklärung mit Begründung der Abweichungen.' },
      { q: 'Was meint „starke Nachhaltigkeit“?', o: ['Gleichrangigkeit der drei Dimensionen', 'Ökologie als Grundlage für Gesellschaft und Wirtschaft', 'Vorrang der Ökonomie', 'Berichtspflicht nach ESRS'], a: 1, w: 'Systemisches Modell. Das 3-Kreise-Modell (Triple Bottom Line) steht für schwache Nachhaltigkeit.' },
      { q: 'Welches EU-Zwischenziel gilt für 2030?', o: ['−40 % gegenüber 1990', '−55 % gegenüber 1990', '−65 % gegenüber 1990', '−90 % gegenüber 1990'], a: 1, w: 'EU-Klimagesetz: mindestens −55 % bis 2030, −90 % bis 2040, Klimaneutralität 2050.' }
    ]
  };
  function renderQuiz(el) {
    var key = el.dataset.quiz, list = QUIZ[key]; if (!list) return;
    list.forEach(function (q, i) {
      var box = h('div', 'q'), id = key + '-' + i;
      box.appendChild(h('p', '', (i + 1) + '. ' + q.q));
      var opts = h('div', 'opts'), why = h('p', 'why'); why.hidden = true; why.setAttribute('aria-live', 'polite');
      q.o.forEach(function (o, oi) {
        var b = h('button', '', o); b.type = 'button';
        b.addEventListener('click', function () {
          $$('button', opts).forEach(function (x) { x.classList.remove('ok', 'bad'); });
          var right = oi === q.a; b.classList.add(right ? 'ok' : 'bad');
          why.hidden = false; why.textContent = (right ? 'Richtig. ' : 'Nicht ganz. ') + (right ? q.w : 'Versuch es noch einmal.');
          if (right && !state.quiz[id]) { state.quiz[id] = 1; save(); progress(); }
        });
        opts.appendChild(b);
      });
      if (state.quiz[id]) { why.hidden = false; why.textContent = 'Schon richtig beantwortet. ' + q.w; }
      box.appendChild(opts); box.appendChild(why); el.appendChild(box);
    });
  }

  /* ---------- Trainer: Aufgaben mit neuen Zahlen ---------- */
  function ri(a, b, step) { step = step || 1; return a + step * Math.floor(Math.random() * (Math.floor((b - a) / step) + 1)); }
  function pick(arr) { return arr[Math.floor(Math.random() * arr.length)]; }
  function row(a, b) { return '<tr><td>' + a + '</td><td class="n">' + b + '</td></tr>'; }
  var GEN = {
    dcf: function () {
      var f = [ri(80, 300, 5)], i; for (i = 1; i < 5; i++) f.push(f[i - 1] + ri(5, 30, 5));
      var rek = pick([7, 8, 9, 10, 11, 12]), rfk = pick([3, 4, 5, 6]), q = pick([30, 40, 50, 60]), s = pick([25, 30, 35]), g = pick([1, 1.5, 2]);
      var w = rek / 100 * q / 100 + rfk / 100 * (1 - q / 100) * (1 - s / 100);
      var pv = 0, lines = ''; f.forEach(function (v, k) { var d = v / Math.pow(1 + w, k + 1); pv += d; lines += row('Jahr ' + (k + 1) + ': ' + v + ' / ' + de(1 + w, 4) + '<sup>' + (k + 1) + '</sup>', de(d, 2)); });
      var tv = f[4] / (w - g / 100), ptv = tv / Math.pow(1 + w, 5), uw = pv + ptv, fk = Math.round(uw * (ri(30, 60, 5) / 100) / 100) * 100;
      return {
        task: '<p>Bewerte das Unternehmen mit dem WACC-Ansatz (alle Angaben in Mio. €). Geplante Free Cashflows der nächsten fünf Jahre: <span class="num">' + f.join(', ') + '</span>. Der letzte Wert gilt auch als Basis für den Terminal Value. Fremdkapitalzins ' + de(rfk) + ' %, Eigenkapitalkosten ' + de(rek) + ' %, Eigenkapitalquote ' + q + ' %, langfristige Wachstumsrate ' + de(g, 1) + ' %, Steuersatz ' + s + ' %, Fremdkapital ' + de(fk) + '.</p>',
        fields: [{ l: 'WACC', a: w * 100, t: 0.006, u: '%' }, { l: 'Barwert der fünf Free Cashflows', a: pv, t: Math.max(1, pv * 0.003), u: 'Mio. €' }, { l: 'Barwert des Terminal Value', a: ptv, t: Math.max(2, ptv * 0.004), u: 'Mio. €' }, { l: 'Gesamtunternehmenswert', a: uw, t: Math.max(2, uw * 0.004), u: 'Mio. €' }, { l: 'Shareholder Value', a: uw - fk, t: Math.max(2, uw * 0.004), u: 'Mio. €' }],
        sol: '<div class="formel">WACC = ' + de(rek) + ' % × ' + de(q / 100, 2) + ' + ' + de(rfk) + ' % × ' + de(1 - q / 100, 2) + ' × (1 − ' + de(s / 100, 2) + ') = ' + de(w * 100, 3) + ' %</div><div class="scroll"><table class="tight">' + lines + '<tr class="sub"><td>Barwert Detailphase</td><td class="n">' + de(pv, 2) + '</td></tr>' + row('Terminal Value: ' + f[4] + ' / (' + de(w, 4) + ' − ' + de(g / 100, 3) + ') = ' + de(tv, 2) + ', abgezinst mit ' + de(1 + w, 4) + '<sup>5</sup>', de(ptv, 2)) + '<tr class="sum"><td>Gesamtunternehmenswert</td><td class="n">' + de(uw, 2) + '</td></tr>' + row('− Fremdkapital', de(fk)) + '<tr class="sum"><td>Shareholder Value</td><td class="n">' + de(uw - fk, 2) + '</td></tr></table></div>'
      };
    },
    be: function () {
      var p = ri(40, 300, 10), kv = Math.round(p * ri(45, 70, 5) / 100), ds = p - kv, bep = ri(4, 60, 2) * 500, kf = ds * bep, x = Math.round(bep * ri(110, 160, 10) / 100 / 100) * 100;
      var up = pick([5, 10, 20]), kf2 = kf * (1 + up / 100), z = pick([5, 10]), p2 = p + kv * z / 100;
      return {
        task: '<p>Ein Händler verkauft ein Produkt für <span class="num">' + de(p, 2) + ' €</span> je Stück. Die variablen Kosten betragen <span class="num">' + de(kv, 2) + ' €</span> je Stück, die Fixkosten <span class="num">' + de(kf) + ' €</span> je Periode. Aktuell setzt er <span class="num">' + de(x) + '</span> Stück ab.</p><ol type="a"><li>Wie hoch ist die Deckungsspanne und bei welcher Menge liegt der Break-even?</li><li>Welchen Gewinn erzielt er aktuell?</li><li>Die Fixkosten steigen um ' + up + ' %. Wie hoch ist der Gewinn dann?</li><li>Zusätzlich zu c) steigen die variablen Stückkosten um ' + z + ' %. Welcher Preis hält bei gleicher Menge den Gewinn aus b)?</li></ol>',
        fields: [{ l: 'a) Deckungsspanne', a: ds, t: 0.011, u: '€' }, { l: 'a) Break-even-Menge', a: bep, t: 0.6, u: 'Stück' }, { l: 'b) Gewinn', a: x * ds - kf, t: 1, u: '€' }, { l: 'c) Gewinn nach Fixkostenanstieg', a: x * ds - kf2, t: 1, u: '€' }, { l: 'd) neuer Preis', a: p2 + (kf2 - kf) / x, t: 0.02, u: '€' }],
        sol: '<div class="formel">Deckungsspanne = ' + de(p, 2) + ' − ' + de(kv, 2) + ' = ' + de(ds, 2) + ' €<br>Break-even-Menge = ' + de(kf) + ' / ' + de(ds, 2) + ' = ' + de(bep) + ' Stück<br>Gewinn = ' + de(x) + ' × ' + de(ds, 2) + ' − ' + de(kf) + ' = ' + de(x * ds - kf) + ' €<br>c) Gewinn = ' + de(x) + ' × ' + de(ds, 2) + ' − ' + de(kf2) + ' = ' + de(x * ds - kf2) + ' €<br>d) (P − ' + de(kv * (1 + z / 100), 2) + ') × ' + de(x) + ' − ' + de(kf2) + ' = ' + de(x * ds - kf) + ' &nbsp;⇒&nbsp; P = ' + de(p2 + (kf2 - kf) / x, 2) + ' €</div>'
      };
    },
    pkr: function () {
      var kf = ri(20, 80, 5) * 1000, kvu = ri(5, 40, 5), xp = ri(2, 10) * 500, xi = Math.round(xp * ri(60, 110, 5) / 100 / 50) * 50; if (xi === xp) xi = xp - 100;
      var kvp = kvu * xp, plan = kf + kvp, pvs = plan / xp, verr = pvs * xi, soll = kf + kvu * xi, ist = Math.round(soll * ri(95, 115) / 100 / 100) * 100;
      return {
        task: '<p>Eine Kostenstelle plant für den Monat <span class="num">' + de(xp) + '</span> Stunden Beschäftigung. Die Plankosten betragen <span class="num">' + de(plan) + ' €</span>, davon <span class="num">' + de(kf) + ' €</span> fix. Tatsächlich wurden <span class="num">' + de(xi) + '</span> Stunden geleistet, die Istkosten liegen bei <span class="num">' + de(ist) + ' €</span>. Führe die Abweichungsanalyse der flexiblen Plankostenrechnung auf Vollkostenbasis durch.</p>',
        fields: [{ l: 'Planverrechnungssatz', a: pvs, t: 0.011, u: '€/h' }, { l: 'Verrechnete Plankosten', a: verr, t: 1, u: '€' }, { l: 'Sollkosten', a: soll, t: 1, u: '€' }, { l: 'Verbrauchsabweichung', a: ist - soll, t: 1, u: '€' }, { l: 'Beschäftigungsabweichung', a: soll - verr, t: 1, u: '€' }, { l: 'Gesamtabweichung', a: ist - verr, t: 1, u: '€' }],
        sol: '<div class="formel">Planverrechnungssatz = ' + de(plan) + ' / ' + de(xp) + ' = ' + de(pvs, 2) + ' €/h<br>Verrechnete Plankosten = ' + de(pvs, 2) + ' × ' + de(xi) + ' = ' + de(verr) + ' €<br>Sollkosten = ' + de(kf) + ' + ' + de(kvp) + ' × ' + de(xi) + ' / ' + de(xp) + ' = ' + de(soll) + ' €<br>Verbrauchsabweichung = ' + de(ist) + ' − ' + de(soll) + ' = ' + de(ist - soll) + ' €<br>Beschäftigungsabweichung = ' + de(soll) + ' − ' + de(verr) + ' = ' + de(soll - verr) + ' €<br>Gesamtabweichung = ' + de(ist) + ' − ' + de(verr) + ' = ' + de(ist - verr) + ' €</div><p class="note">Positive Verbrauchsabweichung: mehr verbraucht oder teurer eingekauft als geplant. Positive Beschäftigungsabweichung: Fixkosten, die wegen der Unterauslastung nicht verrechnet wurden. Bei Überauslastung wird sie negativ.</p>'
      };
    },
    eva: function () {
      var ebit = ri(10, 90) * 10, s = pick([25, 30, 35, 40]), ce = Math.round(ebit * ri(60, 140, 5) / 10 / 50) * 50, q = pick([30, 40, 50, 60]), rf = pick([2, 3, 4, 5, 6]), rm = rf + pick([4, 5, 6]), beta = pick([0.8, 1, 1.2, 1.5, 1.8]), rfk = pick([4, 5, 6, 7]);
      var rek = rf + (rm - rf) * beta, w = rek * q / 100 + rfk * (1 - q / 100) * (1 - s / 100), nopat = ebit * (1 - s / 100), eva = nopat - ce * w / 100;
      return {
        task: '<p>Ein Unternehmen erzielt ein EBIT von <span class="num">' + de(ebit) + ' Mio. €</span> bei einem Capital Employed von <span class="num">' + de(ce) + ' Mio. €</span>. Steuersatz ' + s + ' %, Eigenkapitalquote ' + q + ' %, Fremdkapitalzins ' + rfk + ' %. Der risikolose Zins liegt bei ' + rf + ' %, die erwartete Marktrendite bei ' + rm + ' %, der Beta-Faktor bei ' + de(beta, 1) + '. Beurteile das Unternehmen wertorientiert.</p>',
        fields: [{ l: 'Eigenkapitalkosten (CAPM)', a: rek, t: 0.011, u: '%' }, { l: 'WACC (mit Tax Shield)', a: w, t: 0.011, u: '%' }, { l: 'ROCE', a: ebit / ce * 100, t: 0.03, u: '%' }, { l: 'NOPAT', a: nopat, t: 0.06, u: 'Mio. €' }, { l: 'EVA', a: eva, t: Math.max(0.3, Math.abs(eva) * 0.01), u: 'Mio. €' }],
        sol: '<div class="formel">r<sub>EK</sub> = ' + rf + ' % + (' + rm + ' % − ' + rf + ' %) × ' + de(beta, 1) + ' = ' + de(rek, 2) + ' %<br>WACC = ' + de(rek, 2) + ' % × ' + de(q / 100, 2) + ' + ' + rfk + ' % × ' + de(1 - q / 100, 2) + ' × (1 − ' + de(s / 100, 2) + ') = ' + de(w, 3) + ' %<br>ROCE = ' + de(ebit) + ' / ' + de(ce) + ' = ' + de(ebit / ce * 100, 2) + ' %<br>NOPAT = ' + de(ebit) + ' × (1 − ' + de(s / 100, 2) + ') = ' + de(nopat, 1) + '<br>EVA = ' + de(nopat, 1) + ' − ' + de(ce) + ' × ' + de(w, 3) + ' % = ' + de(eva, 2) + ' Mio. €</div><p class="note">' + (eva >= 0 ? 'Positiver EVA: Die Kapitalkosten wurden verdient, es wurde Wert geschaffen.' : 'Negativer EVA: Die betrieblichen Erträge decken die gesamten Kapitalkosten nicht, es wurde Wert vernichtet.') + '</p>'
      };
    },
    cf: function () {
      var a = ri(20, 90) * 100, fa = ri(2, 15) * 100, ab = ri(5, 40) * 100, de1 = ri(1, 9) * 100, akq = ri(1, 8) * 100, zi = ri(1, 6) * 50, dv = ri(1, 6) * 50;
      var ke = ri(1, 10) * 100, ka = ri(5, 30) * 100, ti = ri(5, 40) * 100, gz = ri(2, 12) * 50, gd = ri(2, 12) * 100, ju = ri(10, 50) * 100, vr = ri(1, 9) * 100, cfo = ri(30, 90) * 100;
      var inv = -a - fa + ab + de1 - akq + zi + dv, fin = ke + ka - ti - gz - gd;
      return {
        task: '<p>Dem Geschäftsbericht sind folgende Daten entnommen (Mio. €). Berechne den Cashflow aus Investitionstätigkeit und den Cashflow aus Finanzierungstätigkeit nach DRS 21. Nicht alle Angaben werden gebraucht.</p><div class="scroll"><table class="tight">' +
          row('Jahresüberschuss', de(ju)) + row('Auszahlungen für Sachanlagen und immaterielle Vermögenswerte', de(a)) + row('Veränderung der Vorräte', '+' + de(vr)) + row('Erhaltene Zinsen', de(zi)) + row('Auszahlungen für Finanzanlagen', de(fa)) + row('Kapitalerhöhung', de(ke)) + row('Gezahlte Dividenden', de(gd)) + row('Einzahlungen aus dem Abgang von Anlagevermögen', de(ab)) + row('Aufnahme von Krediten', de(ka)) + row('Einzahlungen aus Desinvestitionen', de(de1)) + row('Erhaltene Dividenden', de(dv)) + row('Tilgung von Finanzverbindlichkeiten', de(ti)) + row('Gezahlte Zinsen', de(gz)) + row('Auszahlungen für Akquisitionen', de(akq)) + row('Cashflow aus betrieblicher Tätigkeit', '+' + de(cfo)) + '</table></div>',
        fields: [{ l: 'Cashflow aus Investitionstätigkeit', a: inv, t: 0.6, u: 'Mio. €' }, { l: 'Cashflow aus Finanzierungstätigkeit', a: fin, t: 0.6, u: 'Mio. €' }],
        sol: '<div class="formel">CF Investition = −' + de(a) + ' − ' + de(fa) + ' + ' + de(ab) + ' + ' + de(de1) + ' − ' + de(akq) + ' + ' + de(zi) + ' + ' + de(dv) + ' = ' + de(inv) + '<br>CF Finanzierung = +' + de(ke) + ' + ' + de(ka) + ' − ' + de(ti) + ' − ' + de(gz) + ' − ' + de(gd) + ' = ' + de(fin) + '</div><p class="note">Erhaltene Zinsen und Dividenden zählen nach DRS 21 zur Investitionstätigkeit, gezahlte Zinsen und Dividenden zur Finanzierungstätigkeit. Jahresüberschuss, Vorräte und operativer Cashflow sind hier Ablenkung.</p>'
      };
    },
    zk: function () {
      var mek = ri(4, 40) * 5, fek = ri(4, 40) * 5, mg = pick([5, 8, 10, 12, 15, 20]), fg = pick([60, 80, 100, 120, 150]), vv = pick([10, 15, 20, 25]), vm = pick([10, 15, 20]), vf = pick([30, 40, 50]), vvv = pick([5, 8, 10]);
      var mk = mek * (1 + mg / 100), fk = fek * (1 + fg / 100), hk = mk + fk, sk = hk * (1 + vv / 100), p = Math.ceil(sk * ri(105, 130, 5) / 100);
      var vsk = (mek * (1 + vm / 100) + fek * (1 + vf / 100)) * (1 + vvv / 100);
      return {
        task: '<p>Für ein Produkt fallen je Stück <span class="num">' + de(mek, 2) + ' €</span> Materialeinzelkosten und <span class="num">' + de(fek, 2) + ' €</span> Fertigungseinzelkosten an. Vollkosten-Zuschlagssätze: Materialgemeinkosten ' + mg + ' %, Fertigungsgemeinkosten ' + fg + ' %, Verwaltung und Vertrieb ' + vv + ' % auf die Herstellkosten. Der Absatzpreis beträgt <span class="num">' + de(p, 2) + ' €</span>.</p><p>Nach Umstellung auf Teilkostenrechnung gelten variable Zuschlagssätze: Material ' + vm + ' %, Fertigung ' + vf + ' %, Verwaltung und Vertrieb ' + vvv + ' % auf die variablen Herstellkosten.</p>',
        fields: [{ l: 'Herstellkosten', a: hk, t: 0.011, u: '€' }, { l: 'Selbstkosten', a: sk, t: 0.011, u: '€' }, { l: 'Gewinn je Stück (Vollkosten)', a: p - sk, t: 0.011, u: '€' }, { l: 'Variable Selbstkosten', a: vsk, t: 0.011, u: '€' }, { l: 'Stückdeckungsbeitrag', a: p - vsk, t: 0.011, u: '€' }],
        sol: '<div class="scroll"><table class="tight">' + row('Materialkosten = ' + de(mek, 2) + ' × ' + de(1 + mg / 100, 2), de(mk, 2)) + row('Fertigungskosten = ' + de(fek, 2) + ' × ' + de(1 + fg / 100, 2), de(fk, 2)) + '<tr class="sub"><td>Herstellkosten</td><td class="n">' + de(hk, 2) + '</td></tr>' + row('Verwaltung und Vertrieb ' + vv + ' %', de(hk * vv / 100, 2)) + '<tr class="sub"><td>Selbstkosten</td><td class="n">' + de(sk, 2) + '</td></tr>' + row('Gewinn = ' + de(p, 2) + ' − Selbstkosten', de(p - sk, 2)) + row('Variable Herstellkosten = ' + de(mek, 2) + ' × ' + de(1 + vm / 100, 2) + ' + ' + de(fek, 2) + ' × ' + de(1 + vf / 100, 2), de(vsk / (1 + vvv / 100), 2)) + '<tr class="sub"><td>Variable Selbstkosten (+ ' + vvv + ' %)</td><td class="n">' + de(vsk, 2) + '</td></tr><tr class="sum"><td>Stückdeckungsbeitrag</td><td class="n">' + de(p - vsk, 2) + '</td></tr></table></div>'
      };
    },
    liq: function () {
      var av = ri(20, 80) * 50, vo = ri(4, 30) * 50, fo = ri(4, 30) * 50, lm = ri(2, 16) * 50, sum = av + vo + fo + lm;
      var ek = Math.round(sum * ri(20, 50, 5) / 100 / 50) * 50, lfk = Math.round(sum * ri(20, 35, 5) / 100 / 50) * 50, kfk = sum - ek - lfk;
      return {
        task: '<p>Vereinfachte Bilanz (T€):</p><div class="scroll"><table class="tight"><thead><tr><th>Aktiva</th><th class="n"></th><th>Passiva</th><th class="n"></th></tr></thead><tbody><tr><td>Anlagevermögen</td><td class="n">' + de(av) + '</td><td>Eigenkapital</td><td class="n">' + de(ek) + '</td></tr><tr><td>Vorräte</td><td class="n">' + de(vo) + '</td><td>Langfristiges Fremdkapital</td><td class="n">' + de(lfk) + '</td></tr><tr><td>Kurzfristige Forderungen</td><td class="n">' + de(fo) + '</td><td>Kurzfristiges Fremdkapital</td><td class="n">' + de(kfk) + '</td></tr><tr><td>Liquide Mittel</td><td class="n">' + de(lm) + '</td><td></td><td></td></tr><tr class="sum"><td>Summe</td><td class="n">' + de(sum) + '</td><td>Summe</td><td class="n">' + de(sum) + '</td></tr></tbody></table></div>',
        fields: [{ l: 'Liquidität 1. Grades', a: lm / kfk * 100, t: 0.06, u: '%' }, { l: 'Liquidität 2. Grades', a: (lm + fo) / kfk * 100, t: 0.06, u: '%' }, { l: 'Liquidität 3. Grades', a: (lm + fo + vo) / kfk * 100, t: 0.06, u: '%' }, { l: 'Verschuldungsgrad (FK/EK)', a: (lfk + kfk) / ek, t: 0.006 }, { l: 'Anlagenintensität', a: av / sum * 100, t: 0.06, u: '%' }, { l: 'Deckungsgrad B', a: (ek + lfk) / av * 100, t: 0.06, u: '%' }],
        sol: '<div class="formel">Liquidität 1. Grades = ' + de(lm) + ' / ' + de(kfk) + ' = ' + de(lm / kfk * 100, 2) + ' %<br>Liquidität 2. Grades = (' + de(lm) + ' + ' + de(fo) + ') / ' + de(kfk) + ' = ' + de((lm + fo) / kfk * 100, 2) + ' %<br>Liquidität 3. Grades = (' + de(lm) + ' + ' + de(fo) + ' + ' + de(vo) + ') / ' + de(kfk) + ' = ' + de((lm + fo + vo) / kfk * 100, 2) + ' %<br>Verschuldungsgrad = ' + de(lfk + kfk) + ' / ' + de(ek) + ' = ' + de((lfk + kfk) / ek, 2) + '<br>Anlagenintensität = ' + de(av) + ' / ' + de(sum) + ' = ' + de(av / sum * 100, 2) + ' %<br>Deckungsgrad B = (' + de(ek) + ' + ' + de(lfk) + ') / ' + de(av) + ' = ' + de((ek + lfk) / av * 100, 2) + ' %</div><p class="note">Goldene Bilanzregel: Deckungsgrad B soll über 100 % liegen, langfristiges Vermögen soll langfristig finanziert sein.</p>'
      };
    }
  };
  function renderGen(el) {
    var key = el.dataset.gen, gen = GEN[key]; if (!gen) return;
    var body = $('.ex-body', el), task = $('.task', body), sol = $('.sol', body), form = null, solCtl = null, n = 0;
    var actions, res;
    function fresh() {
      var g = gen(); n++;
      task.innerHTML = g.task; sol.innerHTML = g.sol; sol.hidden = true;
      if (form) body.removeChild(form.node);
      form = buildForm({ fields: g.fields }, 'g-' + key + '-' + n, null);
      actions = h('div', 'ex-actions'); res = h('span', 'result'); res.setAttribute('aria-live', 'polite');
      var bc = h('button', '', 'Prüfen'); bc.type = 'button';
      var bn = h('button', 'ghost', 'Neue Zahlen'); bn.type = 'button';
      actions.appendChild(bc); form.node.appendChild(actions); body.insertBefore(form.node, sol);
      solCtl = wireSolution(body, actions); actions.appendChild(bn); actions.appendChild(res);
      bc.addEventListener('click', function () {
        var r = form.check();
        if (!r.filled) { res.className = 'result bad'; res.textContent = 'Trag zuerst deine Ergebnisse ein.'; return; }
        res.className = 'result ' + (r.right === r.total ? 'ok' : 'bad');
        res.textContent = r.right === r.total ? 'Alles richtig. Hol dir neue Zahlen.' : r.right + ' von ' + r.total + ' richtig.';
      });
      bn.addEventListener('click', fresh);
    }
    fresh();
  }

  /* ---------- Fortschritt ---------- */
  function progress() {
    var total = 0, done = 0;
    $$('.view').forEach(function (v) {
      var t = 0, d = 0;
      $$('.ex[data-ex]', v).forEach(function (e) { t++; if ((state.ex[e.dataset.ex] || {}).done) d++; });
      $$('.quiz', v).forEach(function (qz) { (QUIZ[qz.dataset.quiz] || []).forEach(function (q, i) { t++; if (state.quiz[qz.dataset.quiz + '-' + i]) d++; }); });
      total += t; done += d;
      var c = $('.nav a[href="#' + v.id + '"] .cnt'); if (c && t) { c.textContent = d + '/' + t; c.classList.toggle('full', d === t); }
    });
    var pct = total ? Math.round(done / total * 100) : 0;
    $$('[data-prog-bar]').forEach(function (b) { b.style.width = pct + '%'; });
    $$('[data-prog-txt]').forEach(function (b) { b.textContent = done + ' von ' + total; });
    $$('[data-prog-pct]').forEach(function (b) { b.textContent = pct + ' %'; });
  }

  /* ---------- Start: Countdown und Lernplan ---------- */
  function startView() {
    var exam = new Date(2026, 10, 30), now = new Date(), today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    var days = Math.round((exam - today) / 864e5), el = $('#days'), sub = $('#days-sub');
    if (el) { el.textContent = days > 0 ? days : (days === 0 ? 'Heute' : '–'); sub.textContent = days > 1 ? 'Tage bis zur Klausur am 30.11.2026' : (days === 1 ? 'Tag bis zur Klausur' : (days === 0 ? 'Viel Erfolg in der Klausur' : 'Die Klausur war am 30.11.2026')); }
    $$('.plan tbody tr').forEach(function (tr, i) {
      var d = new Date(2026, 10, 16 + i); if (+d === +today) tr.classList.add('today'); else if (d < today) tr.classList.add('past');
      var cb = $('input', tr); if (!cb) return; cb.checked = !!state.plan[i];
      cb.addEventListener('change', function () { state.plan[i] = cb.checked ? 1 : 0; save(); });
    });
  }

  /* ---------- Interaktiv: Break-even ---------- */
  function niceAxis(v) { var p = Math.pow(10, Math.floor(Math.log10(v))), m = v / p, st = [1, 1.2, 1.6, 2, 2.4, 3.2, 4, 4.8, 6, 8, 10], i; for (i = 0; i < st.length; i++) if (m <= st[i] + 1e-9) return st[i] * p; return 10 * p; }
  function niceMax(v) { var p = Math.pow(10, Math.floor(Math.log10(v))), m = v / p; return (m <= 1 ? 1 : m <= 2 ? 2 : m <= 2.5 ? 2.5 : m <= 5 ? 5 : 10) * p; }
  function drawBE() {
    var svg = $('#be-svg'); if (!svg) return;
    var p = +$('#be-p').value, kv = +$('#be-kv').value, kf = +$('#be-kf').value * 1000, ds = p - kv;
    $('#be-p-o').textContent = de(p, 2) + ' €'; $('#be-kv-o').textContent = de(kv, 2) + ' €'; $('#be-kf-o').textContent = de(kf) + ' €';
    var W = 640, H = 330, L = 70, R = 96, T = 14, B = 42, bep = ds > 0 ? kf / ds : null;
    var xmax = niceMax(bep ? bep * 2 : kf / p * 2), ymax = niceMax(Math.max(p * xmax, kf + kv * xmax));
    function X(x) { return L + x / xmax * (W - L - R); } function Y(y) { return H - B - y / ymax * (H - T - B); }
    var s = '', i;
    for (i = 0; i <= 4; i++) { var yy = ymax * i / 4, xx = xmax * i / 4; s += '<line class="ln-g" x1="' + L + '" x2="' + (W - R) + '" y1="' + Y(yy) + '" y2="' + Y(yy) + '"/><text class="te tm" x="' + (L - 8) + '" y="' + (Y(yy) + 4) + '">' + de(yy / 1000) + '</text><text class="tc tm" x="' + X(xx) + '" y="' + (H - B + 17) + '">' + de(xx) + '</text>'; }
    if (bep && bep < xmax) {
      s += '<polygon class="z-bad" points="' + X(0) + ',' + Y(0) + ' ' + X(0) + ',' + Y(kf) + ' ' + X(bep) + ',' + Y(p * bep) + '"/>';
      s += '<polygon class="z-ok" points="' + X(bep) + ',' + Y(p * bep) + ' ' + X(xmax) + ',' + Y(p * xmax) + ' ' + X(xmax) + ',' + Y(kf + kv * xmax) + '"/>';
    }
    s += '<line class="ln" x1="' + L + '" y1="' + T + '" x2="' + L + '" y2="' + (H - B) + '"/><line class="ln" x1="' + L + '" y1="' + (H - B) + '" x2="' + (W - R) + '" y2="' + (H - B) + '"/>';
    s += '<line class="ln ln-d" x1="' + X(0) + '" y1="' + Y(kf) + '" x2="' + X(xmax) + '" y2="' + Y(kf) + '"/>';
    s += '<line class="ln-m" x1="' + X(0) + '" y1="' + Y(kf) + '" x2="' + X(xmax) + '" y2="' + Y(kf + kv * xmax) + '"/>';
    s += '<line class="ln-a" x1="' + X(0) + '" y1="' + Y(0) + '" x2="' + X(xmax) + '" y2="' + Y(p * xmax) + '"/>';
    var ye = Y(p * xmax), yk = Y(kf + kv * xmax), yf = Y(kf); if (Math.abs(ye - yk) < 15) { if (ye < yk) yk = ye + 15; else ye = yk + 15; } if (Math.abs(yf - yk) < 15) yf = yk + 15; if (Math.abs(yf - ye) < 15) yf = Math.max(ye, yk) + 15;
    s += '<text class="ta tb" x="' + (W - R + 6) + '" y="' + (ye + 4) + '">Erlöse</text><text class="tk tb" x="' + (W - R + 6) + '" y="' + (yk + 4) + '">Gesamtkosten</text><text class="tm" x="' + (W - R + 6) + '" y="' + (yf + 4) + '">Fixkosten</text>';
    if (bep && bep < xmax) { s += '<line class="ln ln-d" x1="' + X(bep) + '" y1="' + Y(p * bep) + '" x2="' + X(bep) + '" y2="' + (H - B) + '"/><circle class="fi" cx="' + X(bep) + '" cy="' + Y(p * bep) + '" r="4.5"/><text class="tc tb" x="' + X(bep) + '" y="' + (Y(p * bep) - 10) + '">Break-even</text>'; }
    s += '<text class="tm" x="' + L + '" y="' + (H - 6) + '">Menge in Stück</text><text class="tm" x="6" y="' + (T + 2) + '">T€</text>';
    svg.innerHTML = s;
    $('#be-out').innerHTML = ds > 0 ? '<span>Deckungsspanne <b>' + de(ds, 2) + ' €</b></span><span>Break-even-Menge <b>' + de(Math.ceil(bep - 1e-9)) + ' Stück</b></span><span>Break-even-Umsatz <b>' + de(bep * p) + ' €</b></span>' : '<span>Die variablen Stückkosten liegen nicht unter dem Preis. Jede verkaufte Einheit vergrößert den Verlust, einen Break-even gibt es nicht.</span>';
  }

  /* ---------- Interaktiv: Plankostenrechnung ---------- */
  function drawPK() {
    var svg = $('#pk-svg'); if (!svg) return;
    var kf = Math.max(0, +$('#pk-kf').value || 0), kv = Math.max(0, +$('#pk-kv').value || 0), xp = Math.max(1, +$('#pk-xp').value || 1), xi = Math.max(0, +$('#pk-xi').value || 0), ist = Math.max(0, +$('#pk-ist').value || 0);
    var plan = kf + kv, pvs = plan / xp, verr = pvs * xi, soll = kf + kv * xi / xp, va = ist - soll, ba = soll - verr;
    var W = 640, H = 340, L = 70, R = 130, T = 16, B = 42, xmax = niceAxis(Math.max(xp, xi) * 1.1), ymax = niceAxis(Math.max(pvs * xmax, kf + kv * xmax / xp, ist, 1) * 1.02);
    function X(x) { return L + x / xmax * (W - L - R); } function Y(y) { return H - B - y / ymax * (H - T - B); }
    var s = '', i;
    for (i = 0; i <= 4; i++) { var yy = ymax * i / 4, xx = xmax * i / 4; s += '<line class="ln-g" x1="' + L + '" x2="' + (W - R) + '" y1="' + Y(yy) + '" y2="' + Y(yy) + '"/><text class="te tm" x="' + (L - 8) + '" y="' + (Y(yy) + 4) + '">' + de(yy) + '</text><text class="tc tm" x="' + X(xx) + '" y="' + (H - B + 17) + '">' + de(xx) + '</text>'; }
    s += '<line class="ln" x1="' + L + '" y1="' + T + '" x2="' + L + '" y2="' + (H - B) + '"/><line class="ln" x1="' + L + '" y1="' + (H - B) + '" x2="' + (W - R) + '" y2="' + (H - B) + '"/>';
    s += '<line class="ln ln-d" x1="' + X(0) + '" y1="' + Y(kf) + '" x2="' + X(xmax) + '" y2="' + Y(kf) + '"/>';
    s += '<line class="ln-m" x1="' + X(0) + '" y1="' + Y(kf) + '" x2="' + X(xmax) + '" y2="' + Y(kf + kv * xmax / xp) + '"/>';
    s += '<line class="ln-a" x1="' + X(0) + '" y1="' + Y(0) + '" x2="' + X(xmax) + '" y2="' + Y(pvs * xmax) + '"/>';
    s += '<line class="ln ln-d" x1="' + X(xp) + '" y1="' + Y(plan) + '" x2="' + X(xp) + '" y2="' + (H - B) + '"/><text class="tc tm" x="' + X(xp) + '" y="' + (H - 6) + '">Plan</text>';
    s += '<line class="ln ln-d" x1="' + X(xi) + '" y1="' + Y(Math.max(ist, soll, verr)) + '" x2="' + X(xi) + '" y2="' + (H - B) + '"/><text class="tc tm" x="' + X(xi) + '" y="' + (H - 6) + '">Ist</text>';
    var ys = Y(kf + kv * xmax / xp), yv = Y(pvs * xmax); if (Math.abs(ys - yv) < 28) { if (ys < yv) yv = ys + 28; else ys = yv + 28; }
    s += '<text class="tk tb" x="' + (W - R + 6) + '" y="' + (ys + 4) + '">Sollkosten</text><text class="ta tb" x="' + (W - R + 6) + '" y="' + (yv - 2) + '">verrechnete</text><text class="ta tb" x="' + (W - R + 6) + '" y="' + (yv + 12) + '">Plankosten</text><text class="tm" x="' + (W - R + 6) + '" y="' + (Y(kf) + 4) + '">Fixkosten</text>';
    var bx = X(xi) + 9;
    s += '<line stroke-width="5" class="ln-a" x1="' + bx + '" y1="' + Y(verr) + '" x2="' + bx + '" y2="' + Y(soll) + '"/><line stroke-width="5" class="ln-m" x1="' + (bx + 8) + '" y1="' + Y(soll) + '" x2="' + (bx + 8) + '" y2="' + Y(ist) + '"/>';
    s += '<circle class="fa" cx="' + X(xi) + '" cy="' + Y(verr) + '" r="4"/><circle class="fm" cx="' + X(xi) + '" cy="' + Y(soll) + '" r="4"/><circle class="fi" cx="' + X(xi) + '" cy="' + Y(ist) + '" r="5"/><text class="te tb" x="' + (X(xi) - 9) + '" y="' + (Y(ist) + 4) + '">Istkosten</text>';
    s += '<text class="tm" x="6" y="' + (T + 2) + '">€</text>';
    svg.innerHTML = s;
    $('#pk-out').innerHTML = '<span>Planverrechnungssatz <b>' + de(pvs, 2) + ' €</b></span><span>verrechnete Plankosten <b>' + de(verr) + ' €</b></span><span>Sollkosten <b>' + de(soll) + ' €</b></span><span style="color:var(--mark)">Verbrauchsabweichung <b>' + de(va) + ' €</b></span><span style="color:var(--accent)">Beschäftigungsabweichung <b>' + de(ba) + ' €</b></span><span>Gesamtabweichung <b>' + de(va + ba) + ' €</b></span>';
  }

  /* ---------- Navigation über #name ---------- */
  var views = $$('.view');
  function route() {
    var name = (location.hash || '').replace('#', '') || 'start', target = document.getElementById(name);
    var view = target ? (target.classList.contains('view') ? target : target.closest('.view')) : null;
    if (!view) { view = $('#start'); target = view; }
    views.forEach(function (v) { v.classList.toggle('active', v === view); });
    $$('.nav a').forEach(function (a) { if (a.getAttribute('href') === '#' + view.id) a.setAttribute('aria-current', 'page'); else a.removeAttribute('aria-current'); });
    if (target !== view) target.scrollIntoView(); else window.scrollTo(0, 0);
    var cur = $('.nav a[aria-current="page"]'); if (cur && cur.scrollIntoView && window.matchMedia('(max-width:900px)').matches) cur.scrollIntoView({ block: 'nearest', inline: 'center' });
  }

  $$('.ex[data-ex]').forEach(renderEx);
  $$('.ex[data-gen]').forEach(renderGen);
  $$('.quiz').forEach(renderQuiz);
  ['be-p', 'be-kv', 'be-kf'].forEach(function (id) { var e = document.getElementById(id); if (e) e.addEventListener('input', drawBE); });
  ['pk-kf', 'pk-kv', 'pk-xp', 'pk-xi', 'pk-ist'].forEach(function (id) { var e = document.getElementById(id); if (e) e.addEventListener('input', drawPK); });
  drawBE(); drawPK(); startView(); progress();
  var rs = document.getElementById('reset-all');
  if (rs) rs.addEventListener('click', function () { if (rs.dataset.armed) { state = { ex: {}, quiz: {}, plan: {} }; save(); location.reload(); } else { rs.dataset.armed = '1'; rs.textContent = 'Wirklich alles löschen? Noch einmal klicken.'; } });
  /* ---------- Formelkarten: Symbol und Legende gemeinsam hervorheben ---------- */
  var fxPinned = null;
  function fxMark(card, key) {
    $$('.hl', card).forEach(function (e) { e.classList.remove('hl'); });
    if (key) $$('[data-s="' + key + '"]', card).forEach(function (e) { e.classList.add('hl'); });
  }
  function fxTarget(e) { var t = e.target.closest && e.target.closest('.fx [data-s]'); return t ? { card: t.closest('.fx'), key: t.getAttribute('data-s') } : null; }
  document.addEventListener('mouseover', function (e) { var t = fxTarget(e); if (t && !fxPinned) fxMark(t.card, t.key); });
  document.addEventListener('mouseout', function (e) { var t = fxTarget(e); if (t && !fxPinned) fxMark(t.card, null); });
  document.addEventListener('focusin', function (e) { var t = fxTarget(e); if (t) fxMark(t.card, t.key); });
  document.addEventListener('focusout', function (e) { var t = fxTarget(e); if (t && !fxPinned) fxMark(t.card, null); });
  document.addEventListener('click', function (e) {
    var t = fxTarget(e);
    if (fxPinned) { fxMark(fxPinned.card, null); var same = t && fxPinned.card === t.card && fxPinned.key === t.key; fxPinned = null; if (same) return; }
    if (t) { fxPinned = t; fxMark(t.card, t.key); }
  });

  /* ---------- Schlagwortsuche über die Kapitel 1 bis 9 ---------- */
  var SR_VIEWS = ['controlling', 'rechnungswesen', 'kosten', 'kapitalfluss', 'kennzahlen', 'bewertung', 'planung', 'risiko', 'esg'];
  var SR_SEL = 'h1,h2,h3,h4,p,li,tr,figcaption,summary,.fx,.ex-head h3,.card h4';
  var SR_SKIP = '.sol,.quiz,.ex-form,.ex-actions,.next,.eyebrow,svg,.ctrl,.readout';
  var srIndex = null, srQ = $('#sr-q'), srPanel = $('#sr-panel'), srItems = [], srSel = -1, srTerms = [];

  function norm(str) {
    var s = '', map = [];
    for (var i = 0; i < str.length; i++) {
      var c = str[i], n = c === 'ß' ? 'ss' : c.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
      for (var j = 0; j < n.length; j++) { s += n[j]; map.push(i); }
    }
    map.push(str.length);
    var s2 = '', m2 = [];
    for (var k = 0; k < s.length; k++) {
      if (s[k] === 'e' && k > 0 && /[aou]/.test(s[k - 1]) && m2.length && m2[m2.length - 1] !== map[k]) continue;
      s2 += s[k]; m2.push(map[k]);
    }
    m2.push(str.length);
    return { s: s2, map: m2 };
  }
  function esc(t) { return t.replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }
  function kindOf(el) {
    if (el.classList.contains('fx')) return 'Formel';
    if (/^H[1-4]$/.test(el.tagName) && !el.closest('.ex-head,.card')) return 'Abschnitt';
    if (el.closest('.ex')) return 'Aufgabe';
    if (el.tagName === 'TR') return 'Tabelle';
    if (el.tagName === 'FIGCAPTION') return 'Schaubild';
    if (el.tagName === 'SUMMARY' || el.closest('details')) return 'Vertiefung';
    if (el.closest('.box')) return 'Merkkasten';
    return 'Text';
  }
  function buildIndex() {
    srIndex = [];
    SR_VIEWS.forEach(function (vid, vi) {
      var view = document.getElementById(vid); if (!view) return;
      var chap = view.querySelector('h1').textContent, sect = chap;
      $$(SR_SEL, view).forEach(function (el) {
        if (el.closest(SR_SKIP)) return;
        var parent = el.parentElement && el.parentElement.closest(SR_SEL);
        if (parent && view.contains(parent)) return;
        var text, snip = null;
        if (el.classList.contains('fx')) {
          snip = $$('.fx-i', el).map(function (i) { return $('dt', i).textContent + ': ' + $('dd', i).textContent; }).join(' · ').replace(/\s+/g, ' ').trim();
          text = $('.fx-t', el).textContent.replace('im Kapitel', '') + ' · ' + snip;
        } else if (el.tagName === 'TR') {
          text = $$('th,td', el).map(function (c) { return c.textContent.trim(); }).filter(Boolean).join(' · ');
        } else text = el.textContent;
        text = text.replace(/\s+/g, ' ').trim();
        if (/^H[23]$/.test(el.tagName) && !el.closest('.ex-head,.card')) sect = text;
        if (text.length < 2) return;
        srIndex.push({ el: el, view: view, vi: vi, chap: chap, sect: sect, kind: kindOf(el), text: text, n: norm(text), st: snip, sn: snip ? norm(snip) : null, title: el.classList.contains('fx') ? $('.fx-t', el).textContent.replace('im Kapitel', '').trim() : '' });
      });
    });
  }
  function terms(q) { return norm(q).s.split(/\s+/).filter(function (t) { return t.length > 0; }); }
  var KW = { Abschnitt: 6, Formel: 5, Merkkasten: 2, Schaubild: 2, Tabelle: 1.5, Vertiefung: 1.2, Aufgabe: 1, Text: 1.2 };
  function search(q) {
    if (!srIndex) buildIndex();
    srTerms = terms(q);
    if (!srTerms.length) return [];
    var res = [];
    srIndex.forEach(function (it, idx) {
      var sc = 0;
      for (var i = 0; i < srTerms.length; i++) {
        var t = srTerms[i], pos = it.n.s.indexOf(t);
        if (pos < 0) return;
        var wb = (pos === 0 || /[^a-z0-9]/.test(it.n.s[pos - 1])) ? 1.5 : 1;
        var cnt = it.n.s.split(t).length - 1;
        sc += KW[it.kind] * wb * (1 + Math.min(cnt, 4) * 0.15);
        if (it.title && norm(it.title).s.indexOf(t) >= 0) sc += 4;
      }
      sc += Math.max(0, 1.5 - it.text.length / 400);
      res.push({ it: it, sc: sc, idx: idx });
    });
    return res;
  }
  function snippet(it0) {
    var it = it0.sn ? { n: it0.sn, text: it0.st } : it0;
    var s = it.n.s, first = Infinity;
    srTerms.forEach(function (t) { var p = s.indexOf(t); if (p >= 0 && p < first) first = p; });
    if (first === Infinity) first = 0;
    var o0 = it.n.map[first], start = Math.max(0, o0 - 70), end = Math.min(it.text.length, o0 + 150);
    if (start > 0) { var sp = it.text.indexOf(' ', start); if (sp > 0 && sp < o0) start = sp + 1; }
    var ranges = [];
    srTerms.forEach(function (t) { var p = -1; while ((p = s.indexOf(t, p + 1)) >= 0) { var a = it.n.map[p], b = it.n.map[p + t.length - 1] + 1; if (a >= start && b <= end) ranges.push([a, b]); } });
    ranges.sort(function (x, y) { return x[0] - y[0]; });
    var out = '', cur = start;
    ranges.forEach(function (r) { if (r[0] < cur) return; out += esc(it.text.slice(cur, r[0])) + '<mark>' + esc(it.text.slice(r[0], r[1])) + '</mark>'; cur = r[1]; });
    out += esc(it.text.slice(cur, end));
    return (start > 0 ? '… ' : '') + out + (end < it.text.length ? ' …' : '');
  }
  var srOpenGroups = {};
  function renderResults() {
    var q = srQ.value.trim();
    if (!q) { closePanel(); applyHighlight(); return; }
    var res = search(q);
    srItems = []; srSel = -1;
    var html = '';
    if (!res.length) {
      html = '<div class="sr-empty">Keine Treffer für „' + esc(q) + '“ in den Kapiteln 1 bis 9. Probier ein kürzeres Wort oder einen Wortanfang, z. B. „Abschreib“.</div>';
    } else {
      var groups = {};
      res.forEach(function (r) { (groups[r.it.vi] = groups[r.it.vi] || []).push(r); });
      var order = Object.keys(groups).map(Number).sort(function (a, b) { return a - b; });
      html = '<div class="sr-meta">' + res.length + (res.length === 1 ? ' Treffer' : ' Treffer') + ' in ' + order.length + (order.length === 1 ? ' Kapitel' : ' Kapiteln') + '. Probeklausur, Trainer und Formelsammlung werden nicht durchsucht.</div>';
      order.forEach(function (vi) {
        var g = groups[vi].sort(function (a, b) { return b.sc - a.sc || a.idx - b.idx; });
        var lim = srOpenGroups[vi] ? g.length : 6;
        html += '<div class="sr-g">' + (vi + 1) + ' ' + esc(g[0].it.chap) + ' · ' + g.length + '</div>';
        g.slice(0, lim).forEach(function (r) {
          var it = r.it, n = srItems.length; srItems.push(it);
          var head = it.kind === 'Abschnitt' ? it.text : it.title || it.sect;
          html += '<button type="button" class="sr-item" role="option" id="sr-o' + n + '" data-n="' + n + '"><span class="sr-top"><span class="sr-kind">' + it.kind + '</span><span>' + esc(head) + '</span></span>' + (it.kind === 'Abschnitt' ? '' : '<span class="sr-snip">' + snippet(it) + '</span>') + '</button>';
        });
        if (g.length > lim) html += '<button type="button" class="sr-item sr-more" data-more="' + vi + '"><span class="sr-snip">Alle ' + g.length + ' Treffer in diesem Kapitel anzeigen</span></button>';
      });
    }
    srPanel.innerHTML = html;
    openPanel();
    applyHighlight();
  }
  function placePanel() {
    var r = srQ.getBoundingClientRect(), w = Math.min(520, window.innerWidth - 24), left = Math.min(r.left, window.innerWidth - w - 12);
    srPanel.style.left = Math.max(12, left) + 'px'; srPanel.style.top = (r.bottom + 6) + 'px';
    srPanel.style.maxHeight = Math.max(200, Math.min(620, window.innerHeight - r.bottom - 18)) + 'px';
  }
  function openPanel() { srPanel.hidden = false; srQ.setAttribute('aria-expanded', 'true'); placePanel(); }
  function closePanel() { srPanel.hidden = true; srQ.setAttribute('aria-expanded', 'false'); srQ.removeAttribute('aria-activedescendant'); }
  function select(n) {
    var opts = $$('.sr-item[data-n]', srPanel); if (!opts.length) return;
    srSel = (n + opts.length) % opts.length;
    opts.forEach(function (o, i) { o.setAttribute('aria-selected', i === srSel ? 'true' : 'false'); });
    opts[srSel].scrollIntoView({ block: 'nearest' }); srQ.setAttribute('aria-activedescendant', opts[srSel].id);
  }
  function goTo(it) {
    closePanel();
    try { history.pushState(null, '', '#' + it.view.id); } catch (e) { location.hash = it.view.id; }
    route();
    var d = it.el.closest('details'); while (d) { d.open = true; d = d.parentElement.closest('details'); }
    setTimeout(function () {
      it.el.scrollIntoView({ block: 'center', behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth' });
      it.el.classList.remove('sr-flash'); void it.el.offsetWidth; it.el.classList.add('sr-flash');
      applyHighlight();
    }, 30);
  }
  function applyHighlight() {
    if (!window.CSS || !CSS.highlights || typeof Highlight === 'undefined') return;
    CSS.highlights.delete('sr');
    var q = srQ.value.trim(); if (!q) return;
    var view = $('.view.active'); if (!view || SR_VIEWS.indexOf(view.id) < 0) return;
    var ts = terms(q), ranges = [], w = document.createTreeWalker(view, NodeFilter.SHOW_TEXT), node;
    while ((node = w.nextNode())) {
      var pe = node.parentElement; if (!pe || pe.closest('svg,.sol,script')) continue;
      var nn = norm(node.nodeValue);
      ts.forEach(function (t) { var p = -1; while ((p = nn.s.indexOf(t, p + 1)) >= 0) { var r = document.createRange(); r.setStart(node, nn.map[p]); r.setEnd(node, nn.map[p + t.length - 1] + 1); ranges.push(r); } });
    }
    if (ranges.length) { var hl = new Highlight(); ranges.forEach(function (x) { hl.add(x); }); CSS.highlights.set('sr', hl); }
  }
  if (srQ) {
    srQ.addEventListener('input', function () { srOpenGroups = {}; renderResults(); });
    srQ.addEventListener('focus', function () { if (srQ.value.trim()) renderResults(); });
    srQ.addEventListener('keydown', function (e) {
      if (e.key === 'ArrowDown') { e.preventDefault(); if (srPanel.hidden) renderResults(); select(srSel + 1); }
      else if (e.key === 'ArrowUp') { e.preventDefault(); select(srSel - 1); }
      else if (e.key === 'Enter') { e.preventDefault(); var n = srSel >= 0 ? srSel : 0; if (srItems[n]) goTo(srItems[n]); }
      else if (e.key === 'Escape') { if (!srPanel.hidden) closePanel(); else { srQ.value = ''; applyHighlight(); } }
    });
    srPanel.addEventListener('mousedown', function (e) { e.preventDefault(); });
    srPanel.addEventListener('click', function (e) {
      var more = e.target.closest('[data-more]'); if (more) { srOpenGroups[more.getAttribute('data-more')] = 1; renderResults(); return; }
      var b = e.target.closest('.sr-item[data-n]'); if (b) goTo(srItems[+b.getAttribute('data-n')]);
    });
    document.addEventListener('mousedown', function (e) { if (!srPanel.hidden && !srPanel.contains(e.target) && e.target !== srQ) closePanel(); });
    document.addEventListener('keydown', function (e) {
      var tag = (document.activeElement && document.activeElement.tagName) || '';
      if ((e.key === '/' && !/INPUT|TEXTAREA|SELECT/.test(tag)) || ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k')) { e.preventDefault(); srQ.focus(); srQ.select(); }
    });
    window.addEventListener('resize', function () { if (!srPanel.hidden) placePanel(); });
    window.addEventListener('scroll', function () { if (!srPanel.hidden) placePanel(); }, true);
    window.addEventListener('hashchange', function () { setTimeout(applyHighlight, 20); });
  }

  window.addEventListener('hashchange', route);
  route();
  window.__lern = { parseNum: parseNum, judge: judge, EX: EX, GEN: GEN };
})();
