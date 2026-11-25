(function () {
  'use strict';
  document.documentElement.classList.add('js');
  var $ = function (s, r) { return (r || document).querySelector(s); };
  var $$ = function (s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)); };
  function h(tag, cls, html) { var e = document.createElement(tag); if (cls) e.className = cls; if (html != null) e.innerHTML = html; return e; }
  function de(n, d) { d = d || 0; return Number(n).toLocaleString('de-DE', { minimumFractionDigits: d, maximumFractionDigits: d }); }

  /* ---------- Speicher (nur dieser Browser) ---------- */
  var KEY = 'controlling-lernseite-v1';
  var state = { ex: {}, quiz: {}, plan: {}, mcw: {} };
  try { var raw = JSON.parse(localStorage.getItem(KEY)); if (raw && typeof raw === 'object') { state.ex = raw.ex || {}; state.quiz = raw.quiz || {}; state.plan = raw.plan || {}; state.mcw = raw.mcw || {}; } } catch (e) {}
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
  /* Zusätzliche Multiple-Choice-Fragen, nur auf der Seite „Multiple Choice“ */
  var QUIZ_MC = {
    controlling: [
      { q: 'Was bedeutet das englische „to control“ laut Skript?', o: ['prüfen und revidieren wie ein Kontrolleur', 'lenken, steuern, im Griff haben, Prozesse regeln', 'Kosten in allen Bereichen senken', 'Bücher führen und abschließen'], a: 1, w: '„Kontrolleur“ ist laut Skript eine falsche Übersetzung. Gemeint ist Steuerung.' },
      { q: 'Wie lässt sich Controlling als Führungskonzeption kurz umschreiben?', o: ['Revision der Buchhaltung', 'Unternehmenssteuerung durch Zahlen', 'Kostensenkung um jeden Preis', 'Rechtliche Überwachung des Vorstands'], a: 1, w: 'Über Abweichungsanalysen unterstützt es Zielbildungs-, Kontroll- und Informationsprozesse.' },
      { q: 'Welche Aufgabe liegt laut Skript beim Management und nicht beim Controlling?', o: ['Betriebswirtschaftliche Konzepte erarbeiten', 'Methoden-Know-how liefern', 'Unternehmensziele entwickeln und Wettbewerbsstrategien formulieren', 'DV-Lösungen bereitstellen'], a: 2, w: 'Das Management setzt Ziele und Strategien. Das Controlling liefert Konzepte, Methoden, Auswertungen und Systeme.' },
      { q: 'Was gehört zum Aufgabenschwerpunkt „Gestaltung des Internen Kontrollsystems“?', o: ['Kapitalbeschaffung', 'Sicherung des Vermögens vor Verlusten', 'Managementinformationssysteme', 'Investitionsplanung'], a: 1, w: 'Zum IKS gehören auch die Ordnungsmäßigkeit der Rechnungslegung und die Einhaltung der Geschäftspolitik.' },
      { q: 'Welche Tätigkeit nannten Controller in der Umfrage aus dem Skript am häufigsten?', o: ['Reporting', 'Kennzahlenanalyse', 'Kostenrechnung', 'Budgeterstellung und -kontrolle'], a: 1, w: 'Kennzahlenanalyse lag mit 2.116 Nennungen deutlich vorn.' },
      { q: 'Welche Methode gehört zum strategischen Controlling?', o: ['Budgetierung und Budgetkontrolle', 'Kostenrechnung', 'Portfolio-Analyse', 'Berichtswesen'], a: 2, w: 'Strategisch: Szenario-, Markt-, Wettbewerbs-, Gap- und Portfolio-Analyse, Produktlebenszyklus, Erfahrungskurve.' },
      { q: 'Welche Aussage trifft auf das operative Controlling zu?', o: ['Es ist primär nach außen auf die Umwelt gerichtet', 'Es verhält sich eher proaktiv', 'Seine Probleme sind strukturiert, konkret und repetitiv', 'Sein Detaillierungsgrad ist grob'], a: 2, w: 'Die anderen drei Merkmale beschreiben das strategische Controlling.' },
      { q: 'In welchem Controllingprozess liegen Soll-Ist-Vergleich, Abweichungsanalyse und Forecasting?', o: ['Strategische Planung', 'Operative Planung', 'Operative Kontrolle', 'Strategische Kontrolle'], a: 2, w: 'Strategische Kontrolle bedeutet dagegen Strategiereviews, zum Beispiel vierteljährlich.' },
      { q: 'Was besagt das Minimumprinzip?', o: ['Mit gegebenem Input den größten Output erzielen', 'Einen bestimmten Output mit geringstmöglichem Input erreichen', 'Mit nichts alles erreichen', 'Die Kosten auf null senken'], a: 1, w: 'Das Maximumprinzip ist die Umkehrung. Beides gleichzeitig zu verlangen, ist unmöglich.' },
      { q: 'Warum widerspricht es dem Gewinnziel, die Liquidität zu maximieren?', o: ['Liquidität erhöht die Steuerlast', 'Liquidität verursacht Opportunitätskosten durch entgangene Zinsen', 'Liquidität ist gesetzlich begrenzt', 'Liquidität senkt die Eigenkapitalquote'], a: 1, w: 'Gehaltene liquide Mittel bringen kaum Ertrag. Nötig ist nur das finanzielle Gleichgewicht.' },
      { q: 'Was kennzeichnet ein Unternehmen im Unterschied zum öffentlichen Betrieb?', o: ['Organprinzip und Gemeineigentum', 'Autonomieprinzip, erwerbswirtschaftliches Prinzip und Privateigentum', 'Kostendeckungsprinzip', 'Zuschussprinzip und politischer Wirtschaftsplan'], a: 1, w: 'Öffentliche Betriebe folgen dem Organprinzip, dem Kostendeckungs- oder Zuschussprinzip und stehen in Gemeineigentum.' },
      { q: 'Was ist laut Skript kein Standortfaktor?', o: ['Transportkosten', 'Steuern und Subventionen', 'Staatsleistungen', 'Die Rechtsform'], a: 3, w: 'Die Rechtsformwahl ist eine eigene konstitutive Entscheidung neben der Standortwahl.' },
      { q: 'Die Wirtschaftlichkeit eines Betriebs beträgt 1,2. Was heißt das?', o: ['Der Output ist 20 % größer als der Input', 'Die Erträge übersteigen die Aufwendungen um 20 %', 'Die Rendite beträgt 20 %', 'Die Kosten sind um 20 % gestiegen'], a: 1, w: 'Wirtschaftlichkeit = Ertrag / Aufwand. Mengen vergleicht dagegen die Produktivität.' },
      { q: 'Wie beschreibt das Leitbild des ICV die Rolle der Controller gegenüber der Organisation?', o: ['als Kapitän', 'als betriebswirtschaftliches Gewissen', 'als externe Prüfer', 'als Vertreter der Gläubiger'], a: 1, w: 'Sie sind dem Wohl der Organisation als Ganzes verpflichtet.' }
    ],
    rechnungswesen: [
      { q: 'Zuschreibung auf Wertpapiere des Anlagevermögens über 4.000 €. Was liegt vor?', o: ['Einnahme und Ertrag', 'Ertrag, keine Einnahme', 'Einzahlung, kein Ertrag', 'weder Einnahme noch Ertrag'], a: 1, w: 'Nur der Wert des Sachvermögens steigt, das Geldvermögen bleibt gleich.' },
      { q: 'Verkauf einer Maschine genau zum Buchwert von 2.000 €. Was liegt vor?', o: ['Einnahme, kein Ertrag', 'Ertrag, keine Einnahme', 'Einnahme und Ertrag', 'Aufwand'], a: 0, w: 'Sachvermögen wird zu Geldvermögen. Das Reinvermögen bleibt unverändert.' },
      { q: 'Abschreibung auf Maschinen über 5.000 €. Was liegt vor?', o: ['Ausgabe und Aufwand', 'Auszahlung, kein Aufwand', 'Aufwand, keine Ausgabe', 'Ausgabe, kein Aufwand'], a: 2, w: 'Werteverzehr ohne Zahlungs- oder Kreditvorgang.' },
      { q: 'Kauf von Sachvermögen auf Kredit über 10.000 €. Was liegt vor?', o: ['Ausgabe, kein Aufwand', 'Aufwand, keine Ausgabe', 'Auszahlung und Aufwand', 'weder Ausgabe noch Aufwand'], a: 0, w: 'Das Geldvermögen sinkt durch die Verbindlichkeit, das Sachvermögen steigt gleich stark.' },
      { q: 'Bartilgung eines Kredits über 20.000 €. Was liegt vor?', o: ['Auszahlung und Ausgabe', 'Auszahlung, keine Ausgabe', 'Ausgabe, keine Auszahlung', 'Aufwand'], a: 1, w: 'Die Kasse sinkt, die Verbindlichkeit sinkt genauso. Das Geldvermögen bleibt.' },
      { q: 'Eine kalkulatorische Abschreibung, die von der bilanziellen abweicht, ist …', o: ['neutraler Aufwand', 'Grundkosten', 'Anderskosten', 'Zusatzerlös'], a: 2, w: 'Anderskosten: Kosten, die in der Finanzbuchhaltung in anderer Höhe erfasst werden.' },
      { q: 'Zu welcher Bestandsgröße gehören Kosten und Erlöse?', o: ['Zahlungsmittelbestand', 'Geldvermögen', 'Reinvermögen', 'Betriebsnotwendiges Vermögen'], a: 3, w: 'Kosten und Erlöse betreffen nur die eigentliche betriebliche Tätigkeit.' },
      { q: 'Wer ist der Hauptadressat des internen Rechnungswesens?', o: ['Finanzbehörden', 'Gläubiger', 'Das Management', 'Die Öffentlichkeit'], a: 2, w: 'Das externe Rechnungswesen richtet sich an alle Stakeholder.' },
      { q: 'Welche Funktion hat der Konzernabschluss?', o: ['Zahlungsbemessung', 'ausschließlich Information', 'Steuerbemessung', 'Ausschüttungsbemessung'], a: 1, w: 'Der Einzelabschluss dient Zahlungsbemessung, Information und Dokumentation.' },
      { q: 'Wo ist die Maßgeblichkeit der Handelsbilanz für die Steuerbilanz geregelt?', o: ['§ 242 HGB', '§ 275 HGB', '§ 5 Abs. 1 EStG', '§ 161 AktG'], a: 2, w: 'Die Handelsbilanz ist maßgeblich für die Steuerbilanz.' },
      { q: 'Wo stehen auf einem Aktivkonto die Zugänge?', o: ['im Haben', 'im Soll', 'im Saldo', 'gar nicht, nur in der Bilanz'], a: 1, w: 'Mehrungen stehen auf der Seite des Anfangsbestands. Beim Aktivkonto ist das das Soll.' },
      { q: 'Welches Konto nennt ein Buchungssatz zuerst?', o: ['Das Haben-Konto', 'Das Soll-Konto', 'Das Konto mit dem höheren Betrag', 'Das Erfolgskonto'], a: 1, w: 'Soll an Haben, dann der Betrag.' },
      { q: 'Auf welcher Seite des GuV-Kontos steht ein Gewinn als Saldo?', o: ['im Soll', 'im Haben', 'je nach Rechtsform', 'auf beiden Seiten'], a: 0, w: 'Gegengebucht wird er im Haben des Eigenkapitalkontos.' },
      { q: 'Was setzt das Umsatzkostenverfahren voraus?', o: ['Eine Kapitalflussrechnung', 'Eine Kostenstellen- und Kostenträgerrechnung', 'Eine Plankostenrechnung', 'IFRS-Bilanzierung'], a: 1, w: 'Das UKV gliedert nach Funktionsbereichen. Das GKV kommt ohne diese Rechnungen aus.' },
      { q: 'Eine Beteiligung mit Buchwert 50.000 € wird für 120.000 € verkauft. Welcher Buchungstyp liegt vor?', o: ['Aktivtausch', 'Ertragsbuchung', 'Gemischte Buchung', 'Bilanzverlängerung'], a: 2, w: '50.000 € Aktivtausch und 70.000 € Ertrag (Fall Edmund AG).' },
      { q: 'Der Bilanzgewinn wird vollständig in die Gewinnrücklagen eingestellt. Welcher Buchungstyp?', o: ['Aktivtausch', 'Passivtausch', 'Bilanzverkürzung', 'Aufwandsbuchung'], a: 1, w: 'Bilanzgewinn an Gewinnrücklagen: Nur die Passivseite ändert sich.' },
      { q: 'Welche Aussage trifft auf Fremdkapital zu?', o: ['Der Geber haftet mindestens in Höhe der Einlage', 'Es ist in der Regel zeitlich unbegrenzt verfügbar', 'Die Zinsen sind als Aufwand steuerlich absetzbar', 'Der Geber ist zur Unternehmensleitung berechtigt'], a: 2, w: 'Die übrigen Merkmale beschreiben Eigenkapital.' },
      { q: 'Wonach sind die Passiva geordnet?', o: ['nach Liquidierbarkeit', 'nach Fristigkeit', 'nach Höhe', 'alphabetisch'], a: 1, w: 'Die Aktiva sind nach Liquidierbarkeit geordnet.' },
      { q: 'Was hat das BilRUG für die GuV geändert?', o: ['Das GKV ist nicht mehr zulässig', 'Außerordentliche Posten werden nicht mehr gesondert ausgewiesen', 'Steuern gehören ins Finanzergebnis', 'Die GuV ist freiwillig'], a: 1, w: 'Ein separater Ausweis außerordentlicher Positionen ist nicht mehr erlaubt.' }
    ],
    kosten: [
      { q: 'Was passiert mit den fixen Stückkosten, wenn die Menge steigt?', o: ['Sie steigen', 'Sie bleiben gleich', 'Sie sinken', 'Sie werden variabel'], a: 2, w: 'Derselbe Fixkostenblock verteilt sich auf mehr Stück.' },
      { q: 'Was sind sprungfixe Kosten?', o: ['Kosten, die linear mit der Menge steigen', 'Kosten, die innerhalb bestimmter Intervalle konstant sind und dazwischen springen', 'Kosten, die nur einmal anfallen', 'Kalkulatorische Kosten'], a: 1, w: 'Zum Beispiel eine zusätzliche Maschine ab einer bestimmten Menge.' },
      { q: 'Womit werden Plankosten bewertet?', o: ['mit historischen Anschaffungspreisen', 'mit erwarteten Wiederbeschaffungspreisen', 'mit Durchschnittswerten der Vergangenheit', 'mit Marktpreisen der Konkurrenz'], a: 1, w: 'Durchschnittsgrößen der Vergangenheit sind Normalkosten.' },
      { q: 'Wie ermittelt die Inventurmethode den Materialverbrauch?', o: ['Zugang laut Lieferschein', 'Anfangsbestand + Zugang − Endbestand', 'Summe der Entnahmescheine', 'Stückverbrauch laut Stückliste × Menge'], a: 1, w: 'Entnahmescheine: Skontrationsmethode. Stückliste: Rückrechnung.' },
      { q: 'Welche Methode nutzt die Summe der Materialentnahmescheine?', o: ['Zugangsmethode', 'Inventurmethode', 'Skontrationsmethode', 'Rückrechnung'], a: 2, w: 'Jede Entnahme wird belegt und aufsummiert.' },
      { q: 'Was leisten Hilfskostenstellen?', o: ['Sie bearbeiten die Hauptprodukte', 'Sie erbringen Leistungen für andere Kostenstellen, zum Beispiel die Kantine', 'Sie verkaufen Nebenprodukte', 'Sie erfassen Einzelkosten'], a: 1, w: 'Ihre Kosten werden als sekundäre Gemeinkosten auf die Hauptkostenstellen umgelegt.' },
      { q: 'Welches Verfahren der innerbetrieblichen Leistungsverrechnung passt bei gegenseitigem Leistungsaustausch?', o: ['Anbauverfahren', 'Stufenleiterverfahren', 'Simultanes Gleichungsverfahren', 'Divisionskalkulation'], a: 2, w: 'Anbau- und Stufenleiterverfahren unterstellen einen einseitigen Austausch.' },
      { q: 'Was sind primäre Gemeinkosten?', o: ['Kosten der von außen beschafften Güter', 'Kosten der Hilfskostenstellen', 'Einzelkosten der Fertigung', 'Kalkulatorische Zinsen'], a: 0, w: 'Sie werden im ersten Schritt des BAB auf die Kostenstellen verteilt.' },
      { q: 'Für welche Produkte passt die Äquivalenzziffernkalkulation?', o: ['Einzelanfertigung im Anlagenbau', 'Verschiedene Biersorten', 'Strom aus einem Kraftwerk', 'Produkte einer Raffinerie'], a: 1, w: 'Sortenfertigung verwandter Produkte. Strom: Division. Raffinerie: Kuppelproduktion.' },
      { q: 'Wann wird die Restwertmethode angewendet?', o: ['Bei Kuppelproduktion mit einem Hauptprodukt', 'Bei Einzelfertigung', 'Bei Massenproduktion eines Produkts', 'Bei der Bilanzierung von Anlagen'], a: 0, w: 'Die Nettoerlöse der Nebenprodukte werden von den Prozesskosten abgezogen.' },
      { q: 'Ist die Kostenrechnung gesetzlich vorgeschrieben?', o: ['Ja, nach HGB', 'Ja, nach EStG', 'Nein, sie ist freiwillig', 'Nur für Kapitalgesellschaften'], a: 2, w: 'Sie ist Teil des internen Rechnungswesens.' },
      { q: 'Ein Produkt hat einen positiven Deckungsbeitrag, aber nach Vollkosten einen Verlust. Was gilt kurzfristig?', o: ['Sofort einstellen', 'Im Programm behalten, weil es zur Deckung der Fixkosten beiträgt', 'Preis auf die Selbstkosten anheben', 'Nur noch auf Lager produzieren'], a: 1, w: 'Die Fixkosten fallen ohnehin an. Langfristig muss der Preis alle Kosten decken.' },
      { q: 'Wann lohnt ein Zusatzauftrag nach der Deckungsbeitragsrechnung?', o: ['Wenn der Preis über den Selbstkosten liegt', 'Wenn freie Kapazität besteht und der Preis über den variablen Stückkosten liegt', 'Nie unter Listenpreis', 'Wenn die Fixkosten sinken'], a: 1, w: 'Glanz AG: Der Vollkostenrechner lehnt ab, obwohl der Auftrag 10.000 € Deckungsbeitrag bringt.' },
      { q: 'Warum führen Voll- und Teilkostenrechnung beim Bonbonproduzenten zum gleichen Betriebsergebnis?', o: ['Weil es keine Fixkosten gibt', 'Weil produzierte und abgesetzte Menge gleich sind', 'Weil die Zuschlagssätze gleich sind', 'Weil alle Sorten den gleichen Preis haben'], a: 1, w: 'Ohne Bestandsveränderungen werden in beiden Rechnungen alle Fixkosten der Periode verrechnet.' },
      { q: 'Welche Grenze hat die Deckungsbeitragsrechnung laut Skript?', o: ['Sie schlüsselt alle Fixkosten', 'Die Beschäftigung ist die einzige Kosteneinflussgröße', 'Sie kennt keine variablen Kosten', 'Sie ist nur für Banken geeignet'], a: 1, w: 'Dazu: statische Betrachtung, undifferenzierter Fixkostenblock, Kostensprünge fehlen.' },
      { q: 'Der Verkaufspreis steigt, alles andere bleibt gleich. Was passiert mit der Break-even-Menge?', o: ['Sie steigt', 'Sie sinkt', 'Sie bleibt gleich', 'Sie wird negativ'], a: 1, w: 'Die Deckungsspanne wächst, die Fixkosten sind schneller gedeckt.' },
      { q: 'Welche Frage beantwortet die Kostenstellenrechnung?', o: ['Welche Kosten fallen an?', 'Wo fallen die Kosten an?', 'Wofür fallen die Kosten an?', 'Wann fallen die Kosten an?'], a: 1, w: 'Kostenarten: welche. Kostenträger: wofür.' },
      { q: 'Wie heißt die Kostenträgerzeitrechnung auch?', o: ['Kalkulation', 'Betriebsergebnisrechnung', 'Betriebsabrechnungsbogen', 'Investitionsrechnung'], a: 1, w: 'Die Kostenträgerstückrechnung ist die Kalkulation.' }
    ],
    kapitalfluss: [
      { q: 'Was zählt zu den Zahlungsmitteläquivalenten?', o: ['Forderungen aus LuL', 'Festgelder und Geldmarktpapiere mit Restlaufzeit unter drei Monaten', 'Aktien im Anlagevermögen', 'Vorräte'], a: 1, w: 'Kurzfristig, äußerst liquide und risikoarm.' },
      { q: 'Welches Vorzeichen erwartet das Skript beim Cashflow aus Investitionstätigkeit?', o: ['immer positiv', 'negativ oder null', 'genau null', 'gleich dem operativen Cashflow'], a: 1, w: 'Ein wachsendes Unternehmen investiert mehr, als es aus Abgängen einnimmt.' },
      { q: 'Eine Pensionsrückstellung wird gebildet. Was passiert im indirekten Schema?', o: ['Betrag wird abgezogen', 'Betrag wird addiert', 'Kein Einfluss', 'Betrag geht in die Finanzierung'], a: 1, w: 'Aufwand ohne Auszahlung. Bezahlt wird erst später.' },
      { q: 'Die Verbindlichkeiten aus LuL sinken. Was passiert im indirekten Schema?', o: ['Betrag wird addiert', 'Betrag wird abgezogen', 'Kein Einfluss', 'Betrag geht in die Investition'], a: 1, w: 'Alte Rechnungen wurden bezahlt: Passiva runter heißt Cash runter.' },
      { q: 'Die Vorräte sinken. Was passiert im indirekten Schema?', o: ['Betrag wird addiert', 'Betrag wird abgezogen', 'Kein Einfluss', 'Betrag wird halbiert'], a: 0, w: 'Lager wurde abgebaut, gebundenes Geld wird frei: Aktiva runter heißt Cash rauf.' },
      { q: 'Wohin gehört die Zahlung der Ertragsteuer?', o: ['Laufende Geschäftstätigkeit', 'Investitionstätigkeit', 'Finanzierungstätigkeit', 'Finanzmittelfonds'], a: 0, w: 'So in der Lösung zur Mania AG: −1.000 im operativen Cashflow.' },
      { q: 'Grundstückskauf über 50.000, 20 % gewährt der Verkäufer als Kredit. Wie hoch ist der Investitions-Cashflow?', o: ['−50.000', '−40.000', '−10.000', '0'], a: 1, w: 'Nur die tatsächlich gezahlten 80 % fließen ab. Der Verkäuferkredit ist kein Zahlungsvorgang.' },
      { q: 'Kredit über 10.000 mit Ausgabekurs 98 %. Wie hoch ist der Finanzierungs-Cashflow?', o: ['+10.000', '+9.800', '−200', '+200'], a: 1, w: 'Ausgezahlt werden 98 %. Das Disagio ist Aufwand, aber kein Zahlungsvorgang.' },
      { q: 'Wie werden Investitions- und Finanzierungs-Cashflow ermittelt?', o: ['immer indirekt', 'immer direkt', 'nach Wahl über die GuV', 'gar nicht'], a: 1, w: 'Nur der operative Cashflow wird üblicherweise indirekt aus dem Ergebnis abgeleitet.' },
      { q: 'Sachanlagen steigen von 900 auf 1.600, Abschreibungen 85. Wie hoch war die Auszahlung für Investitionen?', o: ['700', '615', '785', '1.600'], a: 2, w: 'Zunahme des Buchwerts plus Abschreibungen (Borussen AG).' },
      { q: 'Wohin gehört eine Kapitalerhöhung gegen Einlage?', o: ['Laufende Geschäftstätigkeit', 'Investitionstätigkeit', 'Finanzierungstätigkeit', 'Sie ist zahlungsunwirksam'], a: 2, w: 'Flash-Cow AG: gezeichnetes Kapital und Kapitalrücklage erhöhen den Finanzierungs-Cashflow.' },
      { q: 'Jahresüberschuss Vorjahr 700, Zuführung zu den Gewinnrücklagen 590. Wie hoch war die Ausschüttung?', o: ['700', '590', '110', '1.290'], a: 2, w: 'Der Vorjahresgewinn wird entweder einbehalten oder ausgeschüttet.' },
      { q: 'Was ist keine Aufgabe der Kapitalflussrechnung?', o: ['Fähigkeit zeigen, Zahlungsüberschüsse zu erwirtschaften', 'Divergenzen zwischen Ergebnis und Zahlungen aufdecken', 'Selbstkosten je Stück ermitteln', 'Fähigkeit zeigen, Verbindlichkeiten zu bedienen'], a: 2, w: 'Selbstkosten ermittelt die Kostenträgerrechnung.' },
      { q: 'Was ist der Ausgangspunkt der indirekten Methode?', o: ['Die Summe der Einzahlungen', 'Das Ergebnis der GuV', 'Der Finanzmittelfonds am Jahresende', 'Der Umsatz'], a: 1, w: 'Vom Ergebnis aus werden alle zahlungsunwirksamen Posten korrigiert.' },
      { q: 'Wozu dient die Probe am Ende jeder Kapitalflussrechnung?', o: ['Summe der drei Cashflows = Veränderung des Finanzmittelfonds', 'Operativer Cashflow = Jahresüberschuss', 'Investitions-Cashflow = Abschreibungen', 'Finanzierungs-Cashflow = 0'], a: 0, w: 'Flash-Cow AG: 21.450 − 63.350 + 30.150 = −11.750 = Veränderung der liquiden Mittel.' }
    ],
    kennzahlen: [
      { q: 'Warum steht bei der Eigenkapitalrendite das EBT im Zähler?', o: ['Weil Steuern nicht zum Ergebnis gehören', 'Weil die Zinsen den Fremdkapitalgebern zustehen', 'Weil das EBIT nicht berechenbar ist', 'Weil das HGB es vorschreibt'], a: 1, w: 'Den Eigentümern gehört nur, was nach den Zinsen übrig bleibt.' },
      { q: 'Was steht bei der Gesamtkapitalrendite im Zähler?', o: ['Jahresüberschuss', 'EBT', 'EBIT', 'EBITDA'], a: 2, w: 'Sie misst die Verzinsung für alle Kapitalgeber, also vor Zinsen.' },
      { q: 'Was verlangt die Goldene Bilanzregel?', o: ['Deckungsgrad B größer 1', 'Eigenkapitalquote größer 50 %', 'Liquidität 1. Grades größer 1', 'Verschuldungsgrad kleiner 1'], a: 0, w: '(EK + langfristiges FK) / AV > 1: Langfristiges Vermögen ist langfristig finanziert.' },
      { q: 'Wie ist der Verschuldungsgrad definiert?', o: ['EK / FK', 'FK / EK', 'FK / Bilanzsumme', 'AV / EK'], a: 1, w: 'FK / Bilanzsumme ist die Fremdkapitalquote.' },
      { q: 'Wie berechnet man das Capital Employed passivisch?', o: ['EK + alle Rückstellungen + alle Verbindlichkeiten', 'EK + Pensionsrückstellungen + Finanzschulden', 'Bilanzsumme − EK', 'AV + Vorräte'], a: 1, w: 'Nur das verzinsliche Kapital zählt.' },
      { q: 'Welche Position gehört nicht zum Capital Employed?', o: ['Eigenkapital', 'Pensionsrückstellungen', 'Finanzschulden', 'Verbindlichkeiten aus LuL'], a: 3, w: 'Lieferantenverbindlichkeiten und sonstige Rückstellungen kosten keine Zinsen.' },
      { q: 'Wie berechnet man den NOPAT praktisch?', o: ['EBT × (1 − s)', 'EBIT × (1 − s)', 'Jahresüberschuss + Zinsen', 'EBITDA − Steuern'], a: 1, w: 'Gewinn vor Zinsen, nach Steuern ohne Tax Shield.' },
      { q: 'Was ist das Tax Shield?', o: ['Ein Steuerfreibetrag für Gründer', 'Fremdkapitalzinsen mindern die Steuerlast', 'Eine Rücklage für Steuerschulden', 'Ein Verlustvortrag'], a: 1, w: 'Darum wird r_FK im WACC mit (1 − s) multipliziert.' },
      { q: 'Was ist im CAPM der risikolose Basiszins?', o: ['Der Leitzins der EZB', 'Die Rendite langfristiger Staatsanleihen höchster Bonität', 'Die Rendite des DAX', 'Der Fremdkapitalzins des Unternehmens'], a: 1, w: 'Zum Beispiel die Rendite langfristiger Bundesanleihen.' },
      { q: 'r_f = 6 %, erwartete Marktrendite 11 %, Beta 1,8. Wie hoch sind die Eigenkapitalkosten?', o: ['11 %', '15 %', '19,8 %', '9 %'], a: 1, w: '6 % + (11 % − 6 %) × 1,8 = 15 % (ProValue AG).' },
      { q: 'Was kritisiert das Skript am EVA?', o: ['Er ignoriert den WACC', 'Er hängt an buchhalterischen Zahlen, und die Anpassungen sind nicht normiert', 'Er ist eine relative Kennzahl', 'Er ist nur für Banken geeignet'], a: 1, w: 'Über 200 Conversions, selektiv angewendet („cherry picking“).' },
      { q: 'Was ist der CFROI?', o: ['eine absolute, gewinnorientierte Kennzahl', 'eine relative, cashflow-basierte Kennzahl', 'ein Liquiditätsgrad', 'ein Multiplikator'], a: 1, w: 'Sein absolutes Gegenstück ist der CVA.' },
      { q: 'Wie wird die Bruttoinvestitionsbasis praktisch ermittelt?', o: ['Capital Employed + kumulierte Abschreibungen', 'Bilanzsumme − Eigenkapital', 'Anlagevermögen zu Restbuchwerten', 'NOPAT + Abschreibungen'], a: 0, w: 'Das Anlagevermögen zählt zu vollen Anschaffungskosten. NOPAT + Abschreibungen ist der Brutto-Cashflow.' },
      { q: 'Was ist die ökonomische Abschreibung beim CFROI?', o: ['Die steuerliche AfA', 'Ein konstanter Betrag, der mit Zinseszins die Anschaffungskosten wieder ansammelt', 'Die Summe aller bisherigen Abschreibungen', 'Die Abschreibung auf den Goodwill'], a: 1, w: 'Ansparbetrag über die Nutzungsdauer, verzinst mit dem WACC.' },
      { q: 'Kurs 100 € zu Jahresbeginn, 120 € am Jahresende, Dividende 5 €. Wie hoch ist der TRS?', o: ['20 %', '25 %', '5 %', '24 %'], a: 1, w: '(120 − 100 + 5) / 100 = 25 %.' },
      { q: 'Wobei setzt die Balanced Scorecard an?', o: ['Bei der Formulierung der Strategie', 'Bei der Umsetzung der Strategie', 'Bei der Kapitalbeschaffung', 'Beim Jahresabschluss'], a: 1, w: 'Strategien scheitern oft an der Umsetzung, nicht nur am Markt oder am Kapital.' },
      { q: 'Welcher Nachteil der Balanced Scorecard steht im Skript?', o: ['Sie berücksichtigt nur Finanzkennzahlen', 'Gefahr der „BSC als Sammlung von Kennzahlen“', 'Sie ist gesetzlich vorgeschrieben', 'Sie hat keine Kundenperspektive'], a: 1, w: 'Quantität wird mit Qualität verwechselt.' },
      { q: 'Womit endet die Ursache-Wirkungs-Kette der Balanced Scorecard?', o: ['Mit befugten Mitarbeitern', 'Mit rechtzeitiger Lieferung', 'Mit Kundenzufriedenheit', 'Mit den Erlösen (Finanzperspektive)'], a: 3, w: 'Potenziale → Prozesse → Kunden → Finanzen.' },
      { q: 'Die Eigenkapitalquote (EK / GK) ist welche Kennzahlenart?', o: ['Gliederungszahl', 'Beziehungszahl', 'Indexzahl', 'absolute Kennzahl'], a: 0, w: 'Ein Teil wird ins Verhältnis zum Ganzen gesetzt. Der Return on Investment ist eine Beziehungszahl.' },
      { q: 'Welches Problem hat laut Skript der Unternehmensvergleich?', o: ['Er ist gesetzlich verboten', 'Vergleich von „Schlendrian mit Schlendrian“', 'Er kennt keine Sollwerte', 'Er funktioniert nur mit Planzahlen'], a: 1, w: 'Dazu eingeschränkte Vergleichbarkeit und Probleme bei der Datenbeschaffung.' },
      { q: 'Wie wirkt die Aktivierung von Entwicklungskosten (§ 248 Abs. 2 HGB) auf den Jahresüberschuss?', o: ['Er sinkt', 'Er steigt', 'Keine Wirkung', 'Nur die Kapitalflussrechnung ändert sich'], a: 1, w: 'Der Aufwand wird zu Vermögen. Euro-Pol GmbH: +4.457 T€.' },
      { q: 'Wie spotten Börsenaufsichten und Standardsetzer über die vielen EBIT-Varianten?', o: ['„Earnings Before Bad Stuff“', '„Cash is King“', '„Window Dressing“', '„Big Bath“'], a: 0, w: 'Auch „Earnings Before All“.' },
      { q: 'Warum kann eine klassische Kapitalrendite trotz Verlust positiv sein?', o: ['Weil Steuern erstattet werden', 'Weil Zähler und Nenner beide negativ sein können', 'Weil Abschreibungen addiert werden', 'Das ist unmöglich'], a: 1, w: 'Verlust geteilt durch negatives Eigenkapital ergibt einen positiven Wert.' }
    ],
    bewertung: [
      { q: 'Was ist der Shareholder Value als Finanzgröße?', o: ['Buchwert des Eigenkapitals', 'Marktwert des Eigenkapitals', 'Marktwert des Gesamtkapitals', 'Jahresüberschuss'], a: 1, w: 'Bei börsennotierten Unternehmen die Marktkapitalisierung.' },
      { q: 'Warum ist das Marktwert-Buchwert-Verhältnis meist größer als eins?', o: ['Weil Schulden zu hoch bilanziert sind', 'Weil materielle und immaterielle Wertzuwächse nicht in der Bilanz stehen', 'Weil der Buchwert Steuern enthält', 'Weil Aktienkurse immer steigen'], a: 1, w: 'Der Buchwert blickt zurück, der Marktwert nach vorn.' },
      { q: 'Marktwert des Eigenkapitals 200, Kaufpreis 500. Wie hoch ist der Goodwill?', o: ['200', '300', '500', '700'], a: 1, w: 'Kaufpreis minus Marktwert des Eigenkapitals nach Aufdeckung der stillen Reserven (X-AG).' },
      { q: 'Welche Werte setzt der Substanzwert zu Reproduktionswerten an?', o: ['Liquidationserlöse', 'Wiederbeschaffungswerte', 'Buchwerte', 'Börsenwerte'], a: 1, w: 'Annahme: Das Unternehmen wird nachgebaut.' },
      { q: 'Wie wird der Liquidationswert ermittelt?', o: ['Barwert der künftigen Cashflows', 'Einzelveräußerungserlöse minus Schulden minus Liquidationskosten', 'Jahresüberschuss × KGV', 'Eigenkapital laut Bilanz'], a: 1, w: 'Annahme: Das Unternehmen wird zerschlagen.' },
      { q: 'Sicheres Ergebnis 500 pro Jahr, Kalkulationszins 8 %. Wie hoch ist der Ertragswert als ewige Rente?', o: ['4.000', '5.400', '6.250', '40.000'], a: 2, w: '500 / 0,08 = 6.250 (Käufersicht BITA GmbH).' },
      { q: 'Woraus leitet das Ertragswertverfahren den Kalkulationszins ab?', o: ['Aus dem CAPM', 'Aus der individuell besten alternativen Kapitalanlage', 'Aus dem Leitzins', 'Aus der Umsatzrendite'], a: 1, w: 'DCF-Verfahren nutzen dagegen kapitalmarkttheoretische Modelle.' },
      { q: 'Worin unterscheidet sich der Flow to Equity vom Free Cash Flow?', o: ['Zinsen, Tilgungen und andere Ansprüche sind schon abgezogen', 'Abschreibungen sind addiert', 'Steuern fehlen', 'Investitionen fehlen'], a: 0, w: 'Der FTE steht nur den Eigentümern zu und ist Basis des Nettoverfahrens.' },
      { q: 'Zu welcher Gruppe gehört der WACC-Ansatz?', o: ['Nettoverfahren (Equity Approach)', 'Bruttoverfahren (Entity Approach)', 'Einzelbewertungsverfahren', 'Mischverfahren'], a: 1, w: 'Erst wird das ganze Unternehmen bewertet, dann das Fremdkapital abgezogen.' },
      { q: 'Wie lautet der Terminal Value als wachsende ewige Rente?', o: ['FCF × WACC', 'FCF / (WACC − g)', 'FCF / (WACC + g)', 'FCF × (1 + g)'], a: 1, w: 'Danach noch mit (1 + WACC)^n auf heute abzinsen.' },
      { q: 'r_EK 8 %, r_FK 4 %, EK-Quote 40 %, Steuersatz 30 %. Wie hoch ist der WACC?', o: ['5,6 %', '4,88 %', '6,4 %', '3,2 %'], a: 1, w: '8 % × 0,4 + 4 % × 0,6 × 0,7 = 3,2 % + 1,68 % = 4,88 % (Aufgabe 10).' },
      { q: 'Wie lang ist die Detailplanungsphase im Zwei-Phasen-Modell meist?', o: ['1 Jahr', '3 bis 5 Jahre', '10 bis 15 Jahre', 'unbegrenzt'], a: 1, w: 'Danach folgt der Terminal Value.' },
      { q: 'Worum wird das Ergebnis vor dem Ertragswertverfahren bereinigt?', o: ['Um alle Abschreibungen', 'Um Erfolge des nicht betriebsnotwendigen Vermögens und nicht periodengerechte Erfolge', 'Um die Umsatzerlöse', 'Um die Personalkosten'], a: 1, w: 'Auch um Effekte aus Bilanzierungs- und Bewertungswahlrechten.' },
      { q: 'Welcher Bewertungsanlass ist unabhängig vom Willen der Eigentümer und ohne Eigentumswechsel?', o: ['Börseneinführung', 'Kauf eines Unternehmens', 'Kreditwürdigkeitsprüfung', 'Eintritt eines Gesellschafters'], a: 2, w: 'Ebenso Sanierung und Steuererklärung.' },
      { q: 'Wie heißt der Wert, mit dem Käufer und Verkäufer in die Verhandlung gehen?', o: ['Argumentationswert', 'Einigungswert', 'Substanzwert', 'Buchwert'], a: 0, w: 'Den Einigungswert ermittelt zum Beispiel eine Konsortialbank oder ein Berater.' },
      { q: 'Jahresüberschuss 420, Multiplikator (KGV) 12. Wie hoch ist der Marktwert des Eigenkapitals?', o: ['420', '5.040', '5.250', '35'], a: 1, w: '12 × 420 = 5.040 (BITA GmbH).' },
      { q: 'Welche Verfahren berücksichtigen Kombinationseffekte (Goodwill oder Badwill)?', o: ['Substanzwertverfahren', 'Liquidationswertverfahren', 'Gesamtbewertungsverfahren', 'Keines'], a: 2, w: 'Einzelbewertungsverfahren addieren nur die Teile.' },
      { q: 'Welcher Grund für einen Goodwill steht in deiner Mitschrift?', o: ['Synergie-Goodwill: Konzernunternehmen profitieren', 'Abschreibungs-Goodwill', 'Steuer-Goodwill', 'Bilanz-Goodwill'], a: 0, w: 'Außerdem Going-Concern-, Restrukturierungs- und Strategie-Goodwill sowie Überzahlung.' }
    ],
    planung: [
      { q: 'Was kennzeichnet die starre Plankostenrechnung?', o: ['Plankosten für jeden Beschäftigungsgrad', 'Plankosten nur für einen Beschäftigungsgrad, keine Trennung in fix und variabel', 'Nur variable Kosten werden verrechnet', 'Sie liefert Grenzkosten'], a: 1, w: 'Die Abweichung ist deshalb nicht interpretierbar.' },
      { q: 'Wie berechnet man die Sollkosten?', o: ['Planverrechnungssatz × Istbeschäftigung', 'Fixkosten + variable Plankosten × Ist- / Planbeschäftigung', 'Istkosten − Plankosten', 'Plankosten / Planbeschäftigung'], a: 1, w: 'Die erste Formel ergibt die verrechneten Plankosten.' },
      { q: 'Wie ist die Verbrauchsabweichung definiert?', o: ['Istkosten − Sollkosten', 'Sollkosten − verrechnete Plankosten', 'Plankosten − Istkosten', 'Sollkosten − Plankosten'], a: 0, w: 'Ursachen: Mehrverbrauch oder höhere Einsatzpreise.' },
      { q: 'Fixkosten 30.000, variable Plankosten 50.000 bei 1.000 h, Ist 800 h. Wie hoch sind die Sollkosten?', o: ['64.000', '70.000', '80.000', '40.000'], a: 1, w: '30.000 + 50.000 × 800 / 1.000 = 70.000.' },
      { q: 'Gleiche Zahlen, Plankosten gesamt 80.000. Wie hoch ist die Beschäftigungsabweichung?', o: ['6.000', '8.000', '14.000', '10.000'], a: 0, w: 'Sollkosten 70.000 − verrechnete Plankosten 64.000 = 30.000 × 20 % nicht verrechnete Fixkosten.' },
      { q: 'Wie ist die Mixabweichung definiert?', o: ['Istkosten − Sollkosten 1', 'Sollkosten 2 (Ist-Mischung) − Sollkosten 1 (Plan-Mischung)', 'Istkosten − Istkosten zu Planpreisen', 'Plankosten − Sollkosten'], a: 1, w: 'In jedem Schritt wird genau eine Größe von Plan auf Ist umgestellt.' },
      { q: 'Wie ist die Preisabweichung definiert?', o: ['Istkosten − Istkosten zu Planpreisen', 'Sollkosten 2 − Sollkosten 1', 'Istkosten − Sollkosten', 'Istmenge × Planpreis'], a: 0, w: 'Drink Til You Drop AG: 21.503 − 17.814 = 3.689 €.' },
      { q: 'Welche Rolle hat die Budgetierung laut Skript?', o: ['Teil der strategischen Planung', 'Kernstück der operativen Planung', 'Teil des Jahresabschlusses', 'Ersatz für die Kostenrechnung'], a: 1, w: 'Aufstellung, Abstimmung und Festlegung formalzielorientierter Pläne für eine Periode.' },
      { q: 'Welche Wirkung soll ein Budget nicht haben?', o: ['Orientierung', 'Anreize', 'Koordination', 'Rechenschaftslegung gegenüber den Aktionären'], a: 3, w: 'Die vierte Wirkung ist die Konzentration auf Schwerpunkte. Rechenschaft leistet der Jahresabschluss.' },
      { q: 'Welcher Vorteil gehört zum Top-down-Ansatz?', o: ['Kenntnisse vor Ort werden eingebunden', 'Schnelle Ableitung und widerspruchsfreie Ziele', 'Hohe Motivation der Mitarbeiter', 'Stärkere Marktorientierung'], a: 1, w: 'Die anderen drei sind Vorteile des Bottom-up-Ansatzes.' },
      { q: 'Welcher Nachteil gehört zum Gegenstromverfahren?', o: ['Mangelnde Realitätsnähe', 'Zeitaufwendige iterative Zyklen und Verteilungskämpfe', 'Vergangenheitsorientierung', 'Fehlende strategische Ausrichtung'], a: 1, w: 'Im Konflikt dominiert außerdem die Führungsspitze.' },
      { q: 'Was zeigt ein Forecast?', o: ['Den Ist-Ist-Vergleich mit dem Vorjahr', 'Den Soll-Wird-Vergleich: aktualisierte Erwartung bis Jahresende', 'Das neue Budget für fünf Jahre', 'Die Abweichung der Vorperiode'], a: 1, w: 'Das Budget bleibt, die Erwartung wird unterjährig fortgeschrieben.' },
      { q: 'Was kennzeichnet Beyond Budgeting?', o: ['Detailliertere Budgets', 'Relative Zielvorgaben und individuelle Leistungsanreize statt Budgets', 'Budgetierung alle drei bis vier Jahre bei null', 'Bisherige Strukturen bleiben erhalten'], a: 1, w: 'Better Budgeting behält die Strukturen bei. Zero Base Budgeting startet bei null.' },
      { q: 'Womit beginnt die Sachzielplanung?', o: ['Mit der Finanzplanung', 'Mit der Absatzplanung', 'Mit der Beschaffungsplanung', 'Mit der Personalplanung'], a: 1, w: 'Absatz → Fertigungsprogramm → Fertigungsablauf → Beschaffung.' },
      { q: 'Wie wird bei der Bicycle AG der Wertpapierkauf bestimmt?', o: ['Er ist vorgegeben', 'Als Restgröße: alles über dem optimalen Kassenbestand', 'Aus dem Jahresüberschuss', 'Aus den Abschreibungen'], a: 1, w: 'Liquide Mittel 208.000 − Zielbestand 100.000 = 108.000 € Wertpapiere.' },
      { q: 'Wie sollen Plankosten festgelegt werden?', o: ['idealistisch', 'realistisch', 'pauschal aus dem Vorjahr', 'möglichst niedrig'], a: 1, w: 'Kosten bei ordentlicher und wirtschaftlicher Leistungserstellung.' },
      { q: 'Was ist die Schwäche der flexiblen Plankostenrechnung auf Vollkostenbasis?', o: ['Keine Verbrauchsabweichung', 'Keine Entscheidungsinformationen, weil Fixkosten proportionalisiert werden', 'Keine Sollkosten', 'Keine Trennung in fix und variabel'], a: 1, w: 'Für dispositive Aufgaben ist sie ungeeignet.' },
      { q: 'Was beschreibt die rollierende Planung als Vorteil?', o: ['Weniger aktuelle Daten', 'Aktuellere Daten und Detaillierung passend zum Zeithorizont', 'Planung nur einmal im Jahr', 'Wegfall jeder Kontrolle'], a: 1, w: 'Nächstes Quartal genau, die folgenden überschlägig.' }
    ],
    risiko: [
      { q: 'Wie definiert das Skript Risiko?', o: ['Wahrscheinlichkeit eines Verlusts', 'Unsicherheit der Realisation einer Größe in Abhängigkeit künftiger Umweltzustände', 'Summe aller Schäden', 'Abweichung vom Budget'], a: 1, w: 'Risiko kann damit auch positiv ausfallen.' },
      { q: 'Wie verhält sich jemand, der Risiko negativ beurteilt?', o: ['risikofreudig', 'risikoneutral', 'risikoavers', 'risikoindifferent'], a: 2, w: 'Wer Risiko nicht berücksichtigt, ist risikoneutral.' },
      { q: 'Was gehört nicht zum Risikomanagement laut Definition?', o: ['Identifikation', 'Bewertung', 'Steuerung', 'Maximierung der Risiken'], a: 3, w: 'Identifikation, Analyse, Bewertung, Steuerung und Überwachung.' },
      { q: 'Fehlprognose der Marktentwicklung führt zu falschem Produktportfolio. Welche Kategorie?', o: ['Marktrisiko', 'Unternehmensstrategisches Risiko', 'Operatives Risiko', 'Rechtliches Risiko'], a: 1, w: 'Falsch abgeleitete Strategie- oder Portfolioentscheidungen.' },
      { q: 'Ein wichtiger Zulieferer fällt aus. Welche Kategorie?', o: ['Operatives Risiko', 'Finanzielles Risiko', 'Managementrisiko', 'Rechtliches Risiko'], a: 0, w: 'Dazu zählen auch technische Produktionsrisiken und Qualitätsrisiken.' },
      { q: 'Neue Anbieter drängen in den Markt. Welche Kategorie?', o: ['Marktrisiko', 'Operatives Risiko', 'Finanzielles Risiko', 'Unternehmensstrategisches Risiko'], a: 0, w: 'Konjunkturelle und branchentypische Risiken.' },
      { q: 'Managementsysteme oder einzelne Führungspersonen versagen. Welche Kategorie?', o: ['Marktrisiko', 'Managementrisiko', 'Rechtliches Risiko', 'Finanzielles Risiko'], a: 1, w: 'Versagen von Systemen, Personen oder Strukturen.' },
      { q: 'Ein Unternehmen legt Verlustobergrenzen fest. Welche Strategie?', o: ['Risikovermeidung', 'Risikobegrenzung', 'Risikoüberwälzung', 'Risikoakzeptanz'], a: 1, w: 'Risikolimitierung oder Diversifikation.' },
      { q: 'Ein Risiko wird bewusst getragen, weil Gegenmaßnahmen zu teuer wären. Welche Strategie?', o: ['Risikoakzeptanz', 'Risikoverminderung', 'Risikovermeidung', 'Risikoüberwälzung'], a: 0, w: 'Auch wenn die Auswirkung auf das Ergebnis geringfügig ist.' },
      { q: 'Was enthält ein Risk Tracking Sheet?', o: ['Nur die Bilanz', 'Chancen und Risiken mit Wahrscheinlichkeit, finanzieller Auswirkung und Verantwortlichkeit', 'Nur die Kursentwicklung', 'Die Personalplanung'], a: 1, w: 'Es setzt die C/R-Berichterstattung im Controlling um.' },
      { q: 'Was ist das Ergebnis der Risikoaggregation?', o: ['Liste der Einzelrisiken', 'Gesamtrisikoposition', 'Versicherungsvertrag', 'Risikostrategie'], a: 1, w: 'Einzelrisiken reichen nicht, sie müssen zusammengefasst werden.' },
      { q: 'Was ist die Intention der risikoorientierten Berichterstattung?', o: ['Steuern sparen', 'Verbesserung der Corporate Governance', 'Höhere Dividenden', 'Ersatz des Lageberichts'], a: 1, w: 'Zentraler Inhalt: ein Risikomanagementsystem als Frühwarnsystem.' },
      { q: 'Was ist das grundsätzliche unternehmerische Ziel beim Umgang mit Risiko?', o: ['Alle Risiken vermeiden', 'Risiken senken und erwartete Zahlungen erhöhen', 'Risiken maximieren', 'Nur Finanzrisiken betrachten'], a: 1, w: 'Risiko ist nur ein Teil der Abwägung.' },
      { q: 'Welche vier Gruppen bilden die Risk Map von Adidas?', o: ['Strategische, operative, rechtliche und Compliance- sowie Finanzrisiken', 'Markt-, Personal-, IT- und Umweltrisiken', 'Kurz-, mittel-, langfristige und Dauerrisiken', 'Interne und externe Risiken'], a: 0, w: 'Jedes Risiko wird nach Auswirkung und Wahrscheinlichkeit eingeordnet.' }
    ],
    esg: [
      { q: 'Was meint Inter-Generationengerechtigkeit im Brundtland-Report?', o: ['Gerechtigkeit innerhalb der heutigen Generation', 'Künftige Generationen sollen ihre Bedürfnisse ebenfalls befriedigen können', 'Gleiche Löhne für alle Altersgruppen', 'Rentengerechtigkeit'], a: 1, w: 'Die Bedürfnisse der heutigen Generation betreffen die Intra-Generationengerechtigkeit.' },
      { q: 'Wie viele Ziele umfassen die Sustainable Development Goals?', o: ['8', '17', '169', '6'], a: 1, w: '17 Ziele mit 169 Zielvorgaben, Fahrplan bis 2030.' },
      { q: 'Was markiert der Erdüberlastungstag?', o: ['Den heißesten Tag des Jahres', 'Den Tag, an dem die Menschheit die Ressourcen eines Jahres verbraucht hat', 'Den Tag der UN-Klimakonferenz', 'Den Stichtag für die CSRD'], a: 1, w: 'Earth Overshoot Day.' },
      { q: 'Was bedeutet „Netto-Null“ im Green Deal?', o: ['Ab 2050 gibt es keine Emissionen mehr', 'Verbleibende Emissionen werden durch Reduktionsmaßnahmen wieder aus der Atmosphäre entfernt', 'Emissionen werden halbiert', 'Nur die Industrie muss emissionsfrei sein'], a: 1, w: 'Ziel ist ein klimaneutraler Kontinent bis 2050.' },
      { q: 'Welche zwei Unterziele hat der European Green Deal?', o: ['Finanzierung der Transformation und „No one left behind“', 'Steuersenkung und Deregulierung', 'Atomausstieg und Kohleausstieg', 'Exportförderung und Zölle'], a: 0, w: 'Gerechte und integrative Transformation, finanziert über den Sustainable Finance Action Plan.' },
      { q: 'Wofür steht das G in ESG?', o: ['Growth', 'Green', 'Governance', 'Goodwill'], a: 2, w: 'Environment, Social, Governance.' },
      { q: 'Was ist kein Umweltziel der EU-Taxonomie?', o: ['Schutz des Klimas', 'Übergang zu einer Kreislaufwirtschaft', 'Schutz der Ökosysteme und der biologischen Vielfalt', 'Senkung der Lohnnebenkosten'], a: 3, w: 'Es gibt sechs Umweltziele, alle ökologisch.' },
      { q: 'Wie wird die CSDDD auch genannt?', o: ['EU-Lieferkettengesetz', 'EU-Taxonomie', 'Klimaschutzgesetz', 'Corporate Governance Kodex'], a: 0, w: 'Menschenrechte und Umweltstandards entlang der Wertschöpfungskette.' },
      { q: 'Wer überwacht die Nachhaltigkeitsberichterstattung kapitalmarktorientierter Unternehmen?', o: ['Das Umweltbundesamt', 'Die BaFin im Rahmen der Bilanzkontrolle', 'Die EZB', 'Der Aufsichtsrat allein'], a: 1, w: 'Soweit der Bericht Teil des Lageberichts ist.' },
      { q: 'Was ist Corporate Governance?', o: ['Ein Steuerverfahren', 'Der rechtliche und faktische Ordnungsrahmen für Leitung und Überwachung eines Unternehmens', 'Ein Bilanzierungsstandard', 'Eine Form der Budgetierung'], a: 1, w: 'Der Deutsche Corporate Governance Kodex konkretisiert ihn für Vorstand und Aufsichtsrat.' },
      { q: 'Was soll der Vorstand laut Kodex zu Nachhaltigkeit tun?', o: ['Nichts, das ist Aufgabe des Aufsichtsrats', 'Sozial- und Umweltrisiken und -auswirkungen systematisch identifizieren und bewerten', 'Nur die Gewinne maximieren', 'Die ESRS selbst schreiben'], a: 1, w: 'Die Unternehmensplanung soll finanzielle und nachhaltigkeitsbezogene Ziele enthalten.' },
      { q: 'Welches Ziel nennt das deutsche Klimaschutzgesetz für 2040?', o: ['−55 %', '−65 %', 'mindestens −88 %', 'Klimaneutralität'], a: 2, w: 'Jeweils gegenüber 1990. Neutralität ist für 2045 vorgesehen.' },
      { q: 'Ab wann sollen die vereinfachten ESRS grundsätzlich angewendet werden?', o: ['Geschäftsjahre ab 2025', 'Geschäftsjahre ab 2027', 'Geschäftsjahre ab 2030', 'Ab 2050'], a: 1, w: 'Die Kommission hat die überarbeiteten Standards im Sommer 2026 verabschiedet.' },
      { q: 'Was zeigt das 3-Kreise-Modell der Nachhaltigkeit?', o: ['Ökologie als Grundlage aller anderen Dimensionen', 'Drei gleichrangige Dimensionen: Ökologie, Soziales, Ökonomie', 'Nur die ökonomische Dimension', 'Die drei Berichtspflichten der CSRD'], a: 1, w: 'Triple Bottom Line, steht für schwache Nachhaltigkeit.' }
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
      if (v.id === 'mc') return;
      var t = 0, d = 0;
      $$('.ex[data-ex]', v).forEach(function (e) { t++; if ((state.ex[e.dataset.ex] || {}).done) d++; });
      $$('.quiz', v).forEach(function (qz) { (QUIZ[qz.dataset.quiz] || []).forEach(function (q, i) { t++; if (state.quiz[qz.dataset.quiz + '-' + i]) d++; }); });
      total += t; done += d;
      var c = $('.nav a[href="#' + v.id + '"] .cnt'); if (c && t) { c.textContent = d + '/' + t; c.classList.toggle('full', d === t); }
    });
    if (MC_POOL && MC_POOL.length) { var mcs = MC_POOL.filter(function (p) { return mcSure(p.id); }).length, mcc = $('.nav a[href="#mc"] .cnt'); if (mcc) { mcc.textContent = mcs + '/' + MC_POOL.length; mcc.classList.toggle('full', mcs === MC_POOL.length); } }
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
  if (rs) rs.addEventListener('click', function () { if (rs.dataset.armed) { state = { ex: {}, quiz: {}, plan: {}, mcw: {} }; save(); location.reload(); } else { rs.dataset.armed = '1'; rs.textContent = 'Wirklich alles löschen? Noch einmal klicken.'; } });
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

  /* ---------- Seite Multiple Choice ---------- */
  var MC_CH = [['controlling', 'Controlling'], ['rechnungswesen', 'Rechnungswesen'], ['kosten', 'Kostenrechnung'], ['kapitalfluss', 'Kapitalflussrechnung'], ['kennzahlen', 'Kennzahlen'], ['bewertung', 'Unternehmensbewertung'], ['planung', 'Planung und Budget'], ['risiko', 'Risikomanagement'], ['esg', 'ESG']];
  var MC_POOL = [];
  MC_CH.forEach(function (c, ci) {
    (QUIZ[c[0]] || []).forEach(function (q, i) { MC_POOL.push({ id: c[0] + '-' + i, ch: c[0], ci: ci, q: q, src: 'Kapitel' }); });
    (QUIZ_MC[c[0]] || []).forEach(function (q, i) { MC_POOL.push({ id: 'mc-' + c[0] + '-' + i, ch: c[0], ci: ci, q: q, src: 'neu' }); });
  });
  var mcSel = {}, mcRun = null;
  MC_CH.forEach(function (c) { mcSel[c[0]] = true; });
  function mcSure(id) { return !!state.quiz[id] && !state.mcw[id]; }
  function shuffle(a) { for (var i = a.length - 1; i > 0; i--) { var j = Math.floor(Math.random() * (i + 1)), t = a[i]; a[i] = a[j]; a[j] = t; } return a; }
  function mcChips() {
    var box = $('#mc-chips'); if (!box) return;
    var all = MC_CH.every(function (c) { return mcSel[c[0]]; });
    var html = '<button type="button" class="mc-chip" data-ch="*" aria-pressed="' + all + '">Alle Kapitel</button>';
    MC_CH.forEach(function (c, ci) {
      var n = MC_POOL.filter(function (p) { return p.ch === c[0]; }).length;
      html += '<button type="button" class="mc-chip" data-ch="' + c[0] + '" aria-pressed="' + (mcSel[c[0]] && !all) + '">' + (ci + 1) + ' ' + c[1] + ' <span>' + n + '</span></button>';
    });
    box.innerHTML = html;
  }
  function mcStart(only) {
    var filt = $('#mc-filter').value, order = $('#mc-order').value;
    var items = MC_POOL.filter(function (p) {
      if (only) return only.indexOf(p.id) >= 0;
      if (!mcSel[p.ch]) return false;
      if (filt === 'open') return !mcSure(p.id);
      if (filt === 'wrong') return !!state.mcw[p.id];
      return true;
    });
    if (order === 'mix') shuffle(items);
    mcRun = { items: items.map(function (p) { return { p: p, perm: shuffle(p.q.o.map(function (_, i) { return i; })), pick: null }; }), retry: !!only };
    mcRender();
  }
  function mcRender() {
    var list = $('#mc-list'); list.innerHTML = '';
    if (!mcRun.items.length) {
      var f = $('#mc-filter').value;
      list.innerHTML = '<li class="mc-empty">' + (f === 'wrong' ? 'Keine Frage ist zuletzt falsch beantwortet worden. Stell den Filter auf „alle“ oder „noch nicht sicher“.' : f === 'open' ? 'In den gewählten Kapiteln sitzt jede Frage. Stell den Filter auf „alle“, um trotzdem zu üben.' : 'Wähle mindestens ein Kapitel aus.') + '</li>';
    }
    mcRun.items.forEach(function (it, n) {
      var p = it.p, li = h('li', 'mc-q'); li.id = 'mcq-' + n;
      li.appendChild(h('div', 'mc-meta', '<span>' + (n + 1) + ' / ' + mcRun.items.length + '</span><span class="mc-tag">' + (p.ci + 1) + ' ' + MC_CH[p.ci][1] + '</span>'));
      li.appendChild(h('p', 'mc-text', p.q.q));
      var opts = h('div', 'mc-opts-list'), why = h('p', 'mc-why'); why.hidden = true; why.setAttribute('aria-live', 'polite');
      it.perm.forEach(function (oi, k) {
        var b = h('button', 'mc-o', '<b>' + 'ABCD'.charAt(k) + '</b><span>' + p.q.o[oi] + '</span>'); b.type = 'button'; b.dataset.oi = oi;
        b.addEventListener('click', function () { mcAnswer(it, oi, opts, why, li); });
        opts.appendChild(b);
      });
      li.appendChild(opts); li.appendChild(why); list.appendChild(li);
    });
    $('#mc-end').hidden = true;
    mcScore();
  }
  function mcAnswer(it, oi, opts, why, li) {
    if (it.pick !== null) return;
    it.pick = oi;
    var q = it.p.q, right = oi === q.a;
    $$('.mc-o', opts).forEach(function (b) {
      var o = +b.dataset.oi; b.disabled = true;
      if (o === q.a) b.classList.add('ok');
      else if (o === oi) b.classList.add('bad');
    });
    li.classList.add(right ? 'is-ok' : 'is-bad');
    why.hidden = false;
    why.innerHTML = right ? '<strong>Richtig.</strong> ' + q.w : '<strong>Falsch.</strong> Richtig ist: ' + q.o[q.a] + '. ' + q.w;
    if (right) { state.quiz[it.p.id] = 1; delete state.mcw[it.p.id]; } else state.mcw[it.p.id] = 1;
    save(); progress(); mcScore();
  }
  function mcScore() {
    var its = mcRun.items, done = its.filter(function (i) { return i.pick !== null; }), ok = done.filter(function (i) { return i.pick === i.p.q.a; });
    var sure = MC_POOL.filter(function (p) { return mcSure(p.id); }).length;
    var pct = done.length ? Math.round(ok.length / done.length * 100) : 0;
    $('#mc-score').innerHTML =
      '<div class="mc-s"><span class="k">' + (mcRun.retry ? 'Wiederholung' : 'Dieser Durchgang') + '</span><span class="v">' + done.length + ' / ' + its.length + '</span><span class="s">beantwortet</span></div>' +
      '<div class="mc-s"><span class="k">Richtig</span><span class="v">' + ok.length + '</span><span class="s">' + (done.length ? pct + ' % der beantworteten' : 'noch keine Antwort') + '</span></div>' +
      '<div class="mc-s"><span class="k">Sicher insgesamt</span><span class="v">' + sure + ' / ' + MC_POOL.length + '</span><span class="s">zuletzt richtig beantwortet</span></div>' +
      '<div class="mc-bar-line" aria-hidden="true"><i class="ok" style="width:' + (its.length ? ok.length / its.length * 100 : 0) + '%"></i><i class="bad" style="width:' + (its.length ? (done.length - ok.length) / its.length * 100 : 0) + '%"></i></div>';
    var end = $('#mc-end');
    if (its.length && done.length === its.length) {
      var wrong = done.filter(function (i) { return i.pick !== i.p.q.a; }).map(function (i) { return i.p.id; });
      end.hidden = false;
      end.innerHTML = '<p><strong>Durchgang beendet: ' + ok.length + ' von ' + its.length + ' richtig (' + pct + ' %).</strong> ' +
        (wrong.length ? 'Wiederhole jetzt die ' + wrong.length + ' falsch beantworteten Fragen, solange sie frisch sind.' : 'Alles richtig. Nimm dir als Nächstes andere Kapitel oder die gemischte Reihenfolge vor.') + '</p>' +
        '<div class="mc-end-b">' + (wrong.length ? '<button type="button" id="mc-retry">Nur die ' + wrong.length + ' falschen wiederholen</button>' : '') + '<button type="button" class="ghost" id="mc-again">Neuer Durchgang</button></div>';
      if (wrong.length) $('#mc-retry').addEventListener('click', function () { mcStart(wrong); $('#mc').scrollIntoView(); });
      $('#mc-again').addEventListener('click', function () { mcStart(); $('#mc').scrollIntoView(); });
    } else end.hidden = true;
    mcMastery();
  }
  function mcMastery() {
    var box = $('#mc-mastery'); if (!box) return;
    box.innerHTML = '<table class="tight mc-mt"><thead><tr><th>Kapitel</th><th class="n">sicher</th><th class="n">zuletzt falsch</th><th>Anteil sicher</th></tr></thead><tbody>' + MC_CH.map(function (c, ci) {
      var ps = MC_POOL.filter(function (p) { return p.ch === c[0]; }), s = ps.filter(function (p) { return mcSure(p.id); }).length, w = ps.filter(function (p) { return state.mcw[p.id]; }).length;
      return '<tr><td>' + (ci + 1) + ' ' + c[1] + '</td><td class="n">' + s + ' / ' + ps.length + '</td><td class="n">' + w + '</td><td><span class="mc-mbar"><i style="width:' + Math.round(s / ps.length * 100) + '%"></i></span></td></tr>';
    }).join('') + '</tbody></table>';
  }
  if ($('#mc')) {
    $$('[data-mc-total]').forEach(function (e) { e.textContent = MC_POOL.length; });
    mcChips();
    $('#mc-chips').addEventListener('click', function (e) {
      var b = e.target.closest('.mc-chip'); if (!b) return;
      var ch = b.dataset.ch, all = MC_CH.every(function (c) { return mcSel[c[0]]; });
      if (ch === '*') MC_CH.forEach(function (c) { mcSel[c[0]] = true; });
      else if (all) { MC_CH.forEach(function (c) { mcSel[c[0]] = c[0] === ch; }); }
      else { mcSel[ch] = !mcSel[ch]; if (!MC_CH.some(function (c) { return mcSel[c[0]]; })) MC_CH.forEach(function (c) { mcSel[c[0]] = true; }); }
      mcChips(); mcStart();
    });
    $('#mc-order').addEventListener('change', function () { mcStart(); });
    $('#mc-filter').addEventListener('change', function () { mcStart(); });
    $('#mc-new').addEventListener('click', function () { mcStart(); });
    mcStart();
    progress();
  }

  window.addEventListener('hashchange', route);
  route();
  window.__lern = { parseNum: parseNum, judge: judge, EX: EX, GEN: GEN };
})();
