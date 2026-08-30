/* N03A tyrimas — bendras puslapių variklis. Duomenys: assets/data.json */
(function () {
  "use strict";

  var NS = "http://www.w3.org/2000/svg";
  var nf = new Intl.NumberFormat("lt-LT", { maximumFractionDigits: 0 });
  var MN = ["sausis","vasaris","kovas","balandis","gegužė","birželis",
            "liepa","rugpjūtis","rugsėjis","spalis","lapkritis","gruodis"];

  function num(v) { return nf.format(Math.round(v)); }
  function eur(v) { return num(v) + " €"; }
  function pct(v, d) { return (v * 100).toFixed(d === undefined ? 1 : d).replace(".", ",") + " %"; }
  function el(n, a) { var e = document.createElementNS(NS, n); for (var k in a) e.setAttribute(k, a[k]); return e; }
  function cv(v) { return getComputedStyle(document.documentElement).getPropertyValue(v).trim(); }
  function esc(s) { return String(s).replace(/[&<>"]/g, function (c) { return {"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;"}[c]; }); }
  function monthLabel(m) { return MN[parseInt(m.slice(5), 10) - 1] + " " + m.slice(0, 4); }
  function niceMax(v) {
    if (v <= 0) return 10;
    var p = Math.pow(10, Math.floor(Math.log10(v))), st = [1,1.25,1.5,2,2.5,3,4,5,6,7,8,10];
    for (var i = 0; i < st.length; i++) if (st[i] * p >= v) return st[i] * p;
    return 10 * p;
  }
  function expand(series, n) {         // [start,[...]] -> pilnas 114 masyvas
    var a = new Array(n).fill(0), s = series[0], v = series[1];
    for (var i = 0; i < v.length; i++) a[s + i] = v[i];
    return a;
  }

  /* ---------- kaminėlių grafikas ---------- */
  function StackChart(root, opts) {
    var svg = root.querySelector("svg"), tip = root.querySelector(".tip");

    function draw() {
      var W = root.clientWidth || 720, narrow = W < 560;
      var H = opts.height || (narrow ? 280 : 340);
      var m = { t: 16, r: 6, b: narrow ? 26 : 30, l: narrow ? 44 : 58 };
      var pw = W - m.l - m.r, ph = H - m.t - m.b;
      var rows = opts.rows(), series = opts.series(), n = rows.length;
      while (svg.firstChild) svg.removeChild(svg.firstChild);
      if (!n) return;
      svg.setAttribute("viewBox", "0 0 " + W + " " + H);
      svg.setAttribute("height", H);
      svg.setAttribute("role", "img");
      svg.setAttribute("aria-label", opts.aria || "");

      var totals = rows.map(function (r) {
        return series.reduce(function (a, s) { return a + (r.vals[s.key] || 0); }, 0);
      });
      var max = niceMax(Math.max.apply(null, totals.concat([1])) * 1.02);
      var yS = function (v) { return m.t + ph - (v / max) * ph; };

      for (var i = 0; i <= 4; i++) {
        var v = max * i / 4, y = yS(v);
        svg.appendChild(el("line", { x1: m.l, x2: m.l + pw, y1: y, y2: y,
          stroke: i === 0 ? cv("--axis") : cv("--grid"), "stroke-width": 1 }));
        var t = el("text", { x: m.l - 8, y: y + 4, "text-anchor": "end", fill: cv("--muted"),
          style: 'font:500 10.5px "IBM Plex Mono",monospace' });
        t.textContent = opts.yTick(v);
        svg.appendChild(t);
      }

      var step = pw / n, bw = Math.max(2, Math.min(opts.maxBar || 46, step * 0.74));
      var band = el("rect", { x: 0, y: m.t, width: step, height: ph, fill: cv("--chip"), opacity: 0 });
      svg.appendChild(band);

      rows.forEach(function (r, i) {
        var cx = m.l + step * i + step / 2, cum = 0;
        var stack = series.filter(function (s) { return (r.vals[s.key] || 0) > 0; });
        stack.forEach(function (s, k) {
          var v = r.vals[s.key], y0 = yS(cum), y1 = yS(cum + v), top = k === stack.length - 1;
          var h = y0 - y1 - (top ? 0 : 2); if (h < 0.6) h = 0.6;
          var col = cv(s.css);
          if (top) {
            var rad = Math.min(4, bw / 2, h), x = cx - bw / 2;
            svg.appendChild(el("path", { d:
              "M" + x + " " + (y1 + h) + " L" + x + " " + (y1 + rad) + " Q" + x + " " + y1 + " " + (x + rad) + " " + y1 +
              " L" + (x + bw - rad) + " " + y1 + " Q" + (x + bw) + " " + y1 + " " + (x + bw) + " " + (y1 + rad) +
              " L" + (x + bw) + " " + (y1 + h) + " Z", fill: col }));
          } else {
            svg.appendChild(el("rect", { x: cx - bw / 2, y: y1, width: bw, height: h, fill: col }));
          }
          cum += v;
        });
        if (opts.topLabel && step > 40) {
          var lab = opts.topLabel(r, totals[i]);
          if (lab) {
            var t2 = el("text", { x: cx, y: yS(totals[i]) - 7, "text-anchor": "middle", fill: cv("--ink2"),
              style: 'font:500 10.5px "IBM Plex Mono",monospace' });
            t2.textContent = lab; svg.appendChild(t2);
          }
        }
        var xl = opts.xLabel(r, i, n, narrow);
        if (xl != null) {
          var t3 = el("text", { x: cx, y: H - m.b + 16, "text-anchor": "middle", fill: cv("--muted"),
            style: 'font:500 10.5px "IBM Plex Mono",monospace' });
          t3.textContent = xl; svg.appendChild(t3);
        }
      });

      var hit = el("rect", { x: m.l, y: m.t, width: pw, height: ph, fill: "transparent" });
      svg.appendChild(hit);
      function show(evt) {
        var bx = svg.getBoundingClientRect(), px = (evt.clientX - bx.left) * (W / bx.width);
        var i = Math.floor((px - m.l) / step); if (i < 0) i = 0; if (i > n - 1) i = n - 1;
        band.setAttribute("x", m.l + step * i); band.setAttribute("opacity", .55);
        tip.innerHTML = opts.tipHtml(rows[i], series, totals[i]);
        tip.style.opacity = 1;
        var tw = tip.offsetWidth, rw = root.clientWidth;
        var left = (m.l + step * i + step / 2) * (bx.width / W) + 12;
        if (left + tw > rw) left = left - tw - 24; if (left < 0) left = 0;
        tip.style.left = left + "px";
        tip.style.top = Math.max(0, (evt.clientY - bx.top) - 30) + "px";
      }
      function hide() { band.setAttribute("opacity", 0); tip.style.opacity = 0; }
      hit.addEventListener("mousemove", show);
      hit.addEventListener("mouseleave", hide);
      hit.addEventListener("touchstart", function (e) { show(e.touches[0]); }, { passive: true });
      hit.addEventListener("touchmove", function (e) { show(e.touches[0]); }, { passive: true });
    }
    this.draw = draw;
    new ResizeObserver(draw).observe(root);
  }

  var PALETTE = ["--s1", "--s2", "--s3", "--s4", "--s5", "--s6"];

  function legendInto(box, series, off, redraw) {
    box.innerHTML = "";
    series.forEach(function (s) {
      var b = document.createElement("button");
      b.type = "button"; b.setAttribute("aria-pressed", "true");
      b.innerHTML = '<span class="swatch" style="background:var(' + s.css + ')"></span>' + esc(s.name);
      b.addEventListener("click", function () {
        var on = b.getAttribute("aria-pressed") === "true";
        var live = series.filter(function (x) { return !off[x.key]; }).length;
        if (on && live === 1) return;
        off[s.key] = on;
        b.setAttribute("aria-pressed", on ? "false" : "true");
        redraw();
      });
      box.appendChild(b);
    });
  }

  /* ---------- vaisto puslapis ---------- */
  function renderBrand(D, brand) {
    var months = D.months;
    var regs = brand.regs.slice().sort(function (a, b) {
      return b.series[1].reduce(function (x, y) { return x + y; }, 0) -
             a.series[1].reduce(function (x, y) { return x + y; }, 0);
    });
    var series = regs.slice(0, 6).map(function (r, i) {
      return { key: "v" + r.vid, name: r.strength + (regs.filter(function(q){return q.strength===r.strength;}).length>1 ? " · " + r.pack : ""),
               css: PALETTE[i % PALETTE.length], reg: r };
    });
    var restKeys = regs.slice(6);
    if (restKeys.length) series.push({ key: "kita", name: "kitos pakuotės", css: PALETTE[5], rest: restKeys });

    var full = {};
    regs.forEach(function (r) { full["v" + r.vid] = expand(r.series, months.length); });
    if (restKeys.length) {
      var rest = new Array(months.length).fill(0);
      restKeys.forEach(function (r) { var a = full["v" + r.vid]; for (var i = 0; i < a.length; i++) rest[i] += a[i]; });
      full["kita"] = rest;
    }

    var view = "year", off = {};
    function activeSeries() { return series.filter(function (s) { return !off[s.key]; }); }
    function rows() {
      if (view === "month") {
        return months.map(function (m, i) {
          var vals = {}; series.forEach(function (s) { vals[s.key] = full[s.key][i]; });
          return { label: m, month: m, vals: vals };
        });
      }
      return D.years.map(function (y) {
        var vals = {};
        series.forEach(function (s) {
          var t = 0; months.forEach(function (m, i) { if (m.slice(0, 4) === y) t += full[s.key][i]; });
          vals[s.key] = t;
        });
        return { label: y, year: y, vals: vals };
      }).filter(function (r) {
        return Object.keys(r.vals).some(function (k) { return r.vals[k] > 0; }) || r.year <= "2026";
      });
    }

    var chart = new StackChart(document.getElementById("ch-units"), {
      aria: brand.name + " parduotų pakuočių grafikas",
      rows: rows, series: activeSeries,
      yTick: function (v) { return v >= 1000 ? num(v / 1000) + "k" : num(v); },
      xLabel: function (r, i, n, narrow) {
        if (view === "year") return (narrow && i % 2 === 1) ? null : r.label + (r.year === "2026" ? "*" : "");
        return r.month.slice(5) === "01" ? r.month.slice(0, 4) : null;
      },
      topLabel: function (r, t) { return view === "year" ? num(t) : null; },
      tipHtml: function (r, ser, total) {
        var h = '<div class="t-head">' + (view === "year" ? r.label + (r.year === "2026" ? " m. (I–VI)" : " m.") : monthLabel(r.month)) + "</div><table>";
        ser.forEach(function (s) {
          h += '<tr><td class="n"><span class="dot" style="background:' + cv(s.css) + '"></span>' + esc(s.name) +
               '</td><td class="v">' + num(r.vals[s.key]) + "</td></tr>";
        });
        h += '<tr class="tot"><td>Iš viso</td><td class="v">' + num(total) + "</td></tr></table>";
        return h;
      }
    });
    legendInto(document.getElementById("leg-u"), series, off, function () { chart.draw(); });
    var by = document.getElementById("v-year"), bm = document.getElementById("v-month");
    function setView(v) {
      view = v;
      by.setAttribute("aria-pressed", v === "year" ? "true" : "false");
      bm.setAttribute("aria-pressed", v === "month" ? "true" : "false");
      chart.draw();
    }
    by.addEventListener("click", function () { setView("year"); });
    bm.addEventListener("click", function () { setView("month"); });
    chart.draw();

    /* pinigai */
    var moneySec = document.getElementById("sec-money");
    if (brand.money) {
      var myears = Object.keys(brand.money).sort();
      var mser = [{ key: "psdf", name: "PSDF biudžetas", css: "--m1" },
                  { key: "prie", name: "Pacientų priemokos", css: "--m2" }];
      var mchart = new StackChart(document.getElementById("ch-money"), {
        aria: brand.name + " kompensuota apyvarta",
        rows: function () {
          return myears.map(function (y) {
            var v = brand.money[y];
            return { label: y === "2026" ? "2026 I k." : y, vals: { psdf: v[0], prie: v[1] }, raw: v, y: y };
          });
        },
        series: function () { return mser; }, maxBar: 64,
        yTick: function (v) { return v >= 1000 ? num(v / 1000) + "k €" : num(v) + " €"; },
        xLabel: function (r) { return r.label; },
        topLabel: function (r) { var t = r.raw[0] + r.raw[1]; return t ? pct(r.raw[1] / t) : null; },
        tipHtml: function (r, s, total) {
          return '<div class="t-head">' + r.label + "</div><table>" +
            '<tr><td class="n"><span class="dot" style="background:' + cv("--m1") + '"></span>PSDF biudžetas</td><td class="v">' + eur(r.raw[0]) + "</td></tr>" +
            '<tr><td class="n"><span class="dot" style="background:' + cv("--m2") + '"></span>Pacientų priemokos</td><td class="v">' + eur(r.raw[1]) + "</td></tr>" +
            '<tr class="tot"><td>Iš viso</td><td class="v">' + eur(total) + "</td></tr>" +
            '<tr><td class="n">Receptų</td><td class="v">' + num(r.raw[2]) + "</td></tr>" +
            '<tr><td class="n">Pacientų (≥)</td><td class="v">' + num(r.raw[3]) + "</td></tr></table>";
        }
      });
      legendInto(document.getElementById("leg-m"), mser, {}, function () { mchart.draw(); });
      mchart.draw();
    } else {
      moneySec.innerHTML = '<h2>Kompensavimas</h2><p class="sub">Šio preparato VLK kompensuojamųjų vaistų ataskaitose (2022–2026 m.) nėra — jis Lietuvoje neparduodamas kompensuojamuoju receptu arba apmokamas kitu būdu.</p>';
    }

    /* KPI */
    var yrs = Object.keys(brand.byYear).sort();
    var last = yrs.filter(function (y) { return y <= "2025"; }).pop();
    var prev = yrs.filter(function (y) { return y < last; }).pop();
    var m25 = brand.money && brand.money["2025"];
    var k = [];
    k.push({ l: "Parduota pakuočių, " + last + " m.", v: num(brand.byYear[last]),
      n: prev ? (brand.byYear[last] >= brand.byYear[prev] ? "+" : "") +
        ((brand.byYear[last] / brand.byYear[prev] - 1) * 100).toFixed(1).replace(".", ",") + " % nei " + prev + " m." : "—" });
    k.push({ l: "Iš viso 2017–2026 m.", v: num(brand.total), n: brand.regs.length + " registracijos VVKT registre" });
    if (m25) {
      k.push({ l: "Kompensuota apyvarta, 2025 m.", v: num((m25[0] + m25[1]) / 1000) + " tūkst. €",
        n: "PSDF " + eur(m25[0]) + " + priemokos " + eur(m25[1]) });
      k.push({ l: "Receptų, 2025 m.", v: num(m25[2]),
        n: "pacientų — ne mažiau kaip " + num(m25[3]) + " (nesumuojami per pakuotes)" });
    } else if (brand.ddd && brand.ddd["2025"]) {
      k.push({ l: "DDD, 2025 m.", v: num(brand.ddd["2025"]),
        n: "nustatytosios paros dozės pagal PSO metodiką" });
    }
    document.getElementById("kpis").innerHTML = k.map(function (x) {
      return '<div class="kpi"><div class="k-label">' + esc(x.l) + '</div><div class="k-val">' + x.v +
             '</div><div class="k-note">' + esc(x.n) + "</div></div>";
    }).join("");

    /* lentelė */
    var t = '<thead><tr><th class="l">Metai</th>';
    series.forEach(function (s) { t += "<th>" + esc(s.name) + "</th>"; });
    t += "<th>Iš viso</th><th>PSDF, €</th><th>Priemokos, €</th><th>Receptų</th></tr></thead><tbody>";
    D.years.forEach(function (y) {
      var tot = 0, cells = "";
      series.forEach(function (s) {
        var v = 0; months.forEach(function (m, i) { if (m.slice(0, 4) === y) v += full[s.key][i]; });
        tot += v; cells += v ? "<td>" + num(v) + "</td>" : '<td class="dim">—</td>';
      });
      var mo = brand.money && brand.money[y];
      if (!tot && !mo) return;
      t += '<tr><td class="l">' + y + (y === "2026" ? ' <span class="dim">I–VI</span>' : "") + "</td>" + cells +
        "<td><b>" + num(tot) + "</b></td>" +
        (mo ? "<td>" + num(mo[0]) + "</td><td>" + num(mo[1]) + "</td><td>" + num(mo[2]) + "</td>"
            : '<td class="dim">—</td><td class="dim">—</td><td class="dim">—</td>') + "</tr>";
    });
    document.getElementById("tbl").innerHTML = t + "</tbody>";

    /* registracijos */
    var rt = '<thead><tr><th class="l">Registracijos ID</th><th class="l">Stiprumas</th><th class="l">Forma</th><th class="l">Pakuotė</th><th class="l">Tiekimas</th><th>Parduota iš viso</th></tr></thead><tbody>';
    regs.forEach(function (r) {
      var tot = r.series[1].reduce(function (a, b) { return a + b; }, 0);
      rt += '<tr><td class="l"><a href="https://vapris.vvkt.lt/vvkt-web/public/medications/view/' + r.vid +
        '" target="_blank" rel="noopener">' + r.vid + "</a></td>" +
        '<td class="l">' + esc(r.strength) + '</td><td class="l">' + esc(r.form) + '</td><td class="l">' + esc(r.pack) + "</td>" +
        '<td class="l"><span class="pill ' + (r.supplied ? "ok" : "no") + '">' + (r.supplied ? "tiekiama" : "netiekiama") + "</span>" +
        (r.registered ? "" : ' <span class="pill no">išregistruota</span>') + "</td>" +
        "<td>" + num(tot) + "</td></tr>";
    });
    document.getElementById("tbl-regs").innerHTML = rt + "</tbody>";
  }

  /* ---------- pradinis puslapis ---------- */
  function renderIndex(D) {
    var subs = Object.keys(D.substanceDdd).filter(function (s) {
      return D.substanceDdd[s]["2025"];
    }).sort(function (a, b) { return (D.substanceDdd[b]["2025"] || 0) - (D.substanceDdd[a]["2025"] || 0); });
    var top = subs.slice(0, 5);
    var series = top.map(function (s, i) { return { key: s, name: s, css: PALETTE[i] }; });
    series.push({ key: "__kita", name: "kitos medžiagos", css: PALETTE[5] });
    var off = {};

    function yearRows() {
      return D.years.filter(function (y) { return y >= "2017"; }).map(function (y) {
        var vals = {}, other = 0;
        subs.forEach(function (s) {
          var v = (D.substanceDdd[s][y] || 0) / 365 / (D.population[y] / 1000);
          if (top.indexOf(s) >= 0) vals[s] = v; else other += v;
        });
        vals.__kita = other;
        return { label: y, year: y, vals: vals };
      });
    }
    var sChart = new StackChart(document.getElementById("ch-subs"), {
      aria: "Antiepilepsinių vaistų suvartojimas pagal veikliąją medžiagą",
      rows: yearRows, series: function () { return series.filter(function (s) { return !off[s.key]; }); },
      maxBar: 56,
      yTick: function (v) { return v.toFixed(1).replace(".", ","); },
      xLabel: function (r, i, n, narrow) { return (narrow && i % 2 === 1) ? null : r.label + (r.year === "2026" ? "*" : ""); },
      topLabel: function (r, t) { return t.toFixed(2).replace(".", ","); },
      tipHtml: function (r, ser, total) {
        var h = '<div class="t-head">' + r.label + " m." + (r.year === "2026" ? " (I–VI)" : "") + "</div><table>";
        ser.forEach(function (s) {
          h += '<tr><td class="n"><span class="dot" style="background:' + cv(s.css) + '"></span>' + esc(s.name) +
            '</td><td class="v">' + r.vals[s.key].toFixed(2).replace(".", ",") + "</td></tr>";
        });
        h += '<tr class="tot"><td>Iš viso DDD/1000/d</td><td class="v">' + total.toFixed(2).replace(".", ",") + "</td></tr></table>";
        return h;
      }
    });
    legendInto(document.getElementById("leg-s"), series, off, function () { sChart.draw(); });
    sChart.draw();

    /* KPI */
    var pk = 0, ps = 0, pp = 0, rc = 0;
    D.brands.forEach(function (b) {
      pk += b.byYear["2025"] || 0;
      var m = b.money && b.money["2025"];
      if (m) { ps += m[0]; pp += m[1]; rc += m[2]; }
    });
    var ddd25 = 0; subs.forEach(function (s) { ddd25 += D.substanceDdd[s]["2025"] || 0; });
    ddd25 = ddd25 / 365 / (D.population["2025"] / 1000);
    var E0 = D.epi, DK0 = D.dk;
    document.getElementById("kpis").innerHTML = [
      { l: "Serga epilepsija, 2025 m.", v: num(E0.years["2025"][0]),
        n: String(E0.years["2025"][1]).replace(".", ",") + " iš 1000 gyventojų" },
      { l: "Epilepsijos receptų, 2025 m.", v: num(E0.rx2025.n03aSuG40),
        n: "iš " + num(E0.rx2025.n03aVisi) + " visų N03A receptų" },
      { l: "Naujos kartos vaistų dalis", v: String(DK0.ltNaujaDalis).replace(".", ",") + " %",
        n: "Danijoje — apie " + String(DK0.dkNaujaDalis).replace(".", ",") + " % viso suvartojimo" },
      { l: "PSDF išlaidos, 2025 m.", v: num(ps / 1000) + " tūkst. €",
        n: "pacientų priemokos — dar " + num(pp / 1000) + " tūkst. €" }
    ].map(function (x) {
      return '<div class="kpi"><div class="k-label">' + esc(x.l) + '</div><div class="k-val">' + x.v +
        '</div><div class="k-note">' + esc(x.n) + "</div></div>";
    }).join("");

    /* lentelė */
    var rows = D.brands.map(function (b) {
      var m25 = b.money && b.money["2025"];
      return {
        name: b.name, slug: b.slug, sub: b.subs.join(", "), atc: b.atc.join(", "),
        y25: b.byYear["2025"] || 0, tot: b.total,
        psdf: m25 ? m25[0] : null, prie: m25 ? m25[1] : null, rec: m25 ? m25[2] : null,
        supplied: b.regs.some(function (r) { return r.supplied; })
      };
    });
    var sortKey = "y25", sortDir = -1, q = "", subFilter = "";
    function render() {
      var f = rows.filter(function (r) {
        if (subFilter && r.sub.indexOf(subFilter) < 0) return false;
        if (!q) return true;
        var s = (r.name + " " + r.sub + " " + r.atc).toLowerCase();
        return s.indexOf(q) >= 0;
      });
      f.sort(function (a, b) {
        var x = a[sortKey], y = b[sortKey];
        if (typeof x === "string") return sortDir * x.localeCompare(y, "lt");
        return sortDir * ((x || 0) - (y || 0));
      });
      var h = "";
      f.forEach(function (r) {
        h += '<tr><td class="l"><a href="vaistai/' + r.slug + '.html">' + esc(r.name) + "</a></td>" +
          '<td class="l">' + esc(r.sub) + '</td><td class="l"><span class="pill">' + esc(r.atc) + "</span></td>" +
          "<td>" + (r.y25 ? num(r.y25) : '<span class="dim">0</span>') + "</td>" +
          "<td>" + num(r.tot) + "</td>" +
          (r.psdf != null ? "<td>" + num(r.psdf) + "</td><td>" + num(r.prie) + "</td><td>" + num(r.rec) + "</td>"
                          : '<td class="dim">—</td><td class="dim">—</td><td class="dim">—</td>') +
          '<td class="l"><span class="pill ' + (r.supplied ? "ok" : "no") + '">' + (r.supplied ? "tiekiama" : "netiekiama") + "</span></td></tr>";
      });
      document.querySelector("#tbl-brands tbody").innerHTML = h;
      document.getElementById("count").textContent = f.length + " iš " + rows.length;
      document.querySelectorAll("#tbl-brands thead th").forEach(function (th) {
        if (th.dataset.k === sortKey) th.setAttribute("aria-sort", sortDir < 0 ? "descending" : "ascending");
        else th.removeAttribute("aria-sort");
      });
    }
    document.querySelectorAll("#tbl-brands thead th.sortable").forEach(function (th) {
      th.addEventListener("click", function () {
        var k = th.dataset.k;
        if (k === sortKey) sortDir = -sortDir; else { sortKey = k; sortDir = (k === "name" || k === "sub") ? 1 : -1; }
        render();
      });
    });
    document.getElementById("q").addEventListener("input", function (e) { q = e.target.value.trim().toLowerCase(); render(); });
    var sel = document.getElementById("subsel");
    Object.keys(D.substanceYear).sort().forEach(function (s) {
      var o = document.createElement("option"); o.value = s; o.textContent = s; sel.appendChild(o);
    });
    sel.addEventListener("change", function (e) { subFilter = e.target.value; render(); });
    render();

    /* neparduodami */
    document.getElementById("unsold").innerHTML = D.unsold.map(function (u) {
      return '<div class="card"><b>' + esc(u.name) + "</b><span>" + esc(u.subs.join(", ")) +
        " · " + u.regs + (u.regs === 1 ? " registracija" : " registracijos") + "</span></div>";
    }).join("");
  }


  /* ---------- epidemiologija + receptai ---------- */
  function renderEpi(D) {
    var E = D.epi; if (!E) return;

    /* sergamumo grafikas */
    var eyears = Object.keys(E.years).sort();
    var ch = new StackChart(document.getElementById("ch-epi"), {
      aria: "Epilepsija (G40–G41) sergančių asmenų skaičius 2017–2025 m.",
      rows: function () {
        return eyears.map(function (y) { return { label: y, vals: { n: E.years[y][0] }, rate: E.years[y][1] }; });
      },
      series: function () { return [{ key: "n", name: "Sergančių asmenų", css: "--s4" }]; },
      maxBar: 56,
      yTick: function (v) { return v >= 1000 ? num(v / 1000) + "k" : num(v); },
      xLabel: function (r, i, n, narrow) { return (narrow && i % 2 === 1) ? null : r.label; },
      topLabel: function (r) { return num(r.vals.n); },
      tipHtml: function (r) {
        return '<div class="t-head">' + r.label + " m.</div><table>" +
          '<tr><td class="n">Sergančių asmenų</td><td class="v">' + num(r.vals.n) + "</td></tr>" +
          '<tr><td class="n">1000 gyventojų</td><td class="v">' + String(r.rate).replace(".", ",") + "</td></tr></table>";
      }
    });
    ch.draw();

    function miniTable(id, rows, h1) {
      var h = '<thead><tr><th class="l">' + h1 + "</th><th>Asmenų</th><th>1000 gyv.</th></tr></thead><tbody>";
      rows.forEach(function (r) {
        h += '<tr><td class="l">' + esc(r[0]) + "</td><td>" + num(r[1]) + "</td><td>" +
             String(r[2]).replace(".", ",") + "</td></tr>";
      });
      document.getElementById(id).innerHTML = h + "</tbody>";
    }
    miniTable("tbl-sex", E.sex2025, "Lytis");
    miniTable("tbl-age", E.age2025, "Amžiaus grupė");

    /* savivaldybės */
    var srows = E.sav2025.filter(function (r) { return r[0] !== "Nenurodyta"; })
      .map(function (r) { return { name: r[0], n: r[1], r: r[2] }; });
    var sk = "r", sd = -1;
    function srender() {
      srows.sort(function (a, b) {
        var x = a[sk], y = b[sk];
        return typeof x === "string" ? sd * x.localeCompare(y, "lt") : sd * (x - y);
      });
      document.querySelector("#tbl-sav tbody").innerHTML = srows.map(function (r) {
        return '<tr><td class="l">' + esc(r.name) + "</td><td>" + num(r.n) + "</td><td>" +
               r.r.toFixed(2).replace(".", ",") + "</td></tr>";
      }).join("");
      document.querySelectorAll("#tbl-sav thead th").forEach(function (th) {
        if (th.dataset.k === sk) th.setAttribute("aria-sort", sd < 0 ? "descending" : "ascending");
        else th.removeAttribute("aria-sort");
      });
    }
    document.querySelectorAll("#tbl-sav thead th.sortable").forEach(function (th) {
      th.addEventListener("click", function () {
        var k = th.dataset.k;
        if (k === sk) sd = -sd; else { sk = k; sd = k === "name" ? 1 : -1; }
        srender();
      });
    });
    srender();

    /* receptai */
    var R = E.rx2025, share = R.n03aSuG40 / R.n03aVisi;
    var rxBox = document.getElementById("kpis-rx");
    if (rxBox) rxBox.innerHTML = [
      { l: "Antiepilepsinių receptų, 2025 m.", v: num(R.n03aVisi), n: "iš " + num(R.visiReceptai) + " visų šalies receptų" },
      { l: "Iš jų su epilepsijos diagnoze", v: num(R.n03aSuG40), n: pct(share) + " visų N03A receptų" },
      { l: "Epilepsijos receptų iš viso", v: num(R.g40Visi), n: pct(R.n03aSuG40 / R.g40Visi) + " jų — antiepilepsiniai vaistai" },
      { l: "Vyrai / moterys", v: num(R.sex[0][1]) + " / " + num(R.sex[1][1]), n: "epilepsijos receptai pagal paciento lytį" }
    ].map(function (x) {
      return '<div class="kpi"><div class="k-label">' + esc(x.l) + '</div><div class="k-val">' + x.v +
        '</div><div class="k-note">' + esc(x.n) + "</div></div>";
    }).join("");

    var h = '<thead><tr><th class="l">Veiklioji medžiaga</th><th>Receptų iš viso</th><th>Iš jų epilepsijai</th>' +
      '<th>Dalis</th><th class="l">Kam dar skiriama</th></tr></thead><tbody>';
    R.byAtc.forEach(function (r) {
      var kitos = r.kitos.map(function (k) {
        return esc(k[1]) + ' <span class="dim">' + num(k[2]) + "</span>";
      }).join("<br>");
      h += '<tr><td class="l"><b>' + esc(r.sub) + '</b> <span class="pill">' + esc(r.atc) + "</span></td>" +
        "<td>" + num(r.visi) + "</td><td>" + num(r.g40) + "</td>" +
        '<td><span class="share"><i style="width:' + Math.max(2, r.dalis) + '%"></i></span> ' +
        String(r.dalis).replace(".", ",") + " %</td>" +
        '<td class="l small">' + (kitos || '<span class="dim">—</span>') + "</td></tr>";
    });
    document.getElementById("tbl-rxatc").innerHTML = h + "</tbody>";

    h = '<thead><tr><th class="l">Kodas</th><th class="l">Diagnozė</th><th>Receptų</th></tr></thead><tbody>';
    R.byDiag.forEach(function (r) {
      h += '<tr><td class="l"><span class="pill">' + esc(r[0]) + '</span></td><td class="l">' + esc(r[1]) +
        "</td><td>" + num(r[2]) + "</td></tr>";
    });
    document.getElementById("tbl-rxdiag").innerHTML = h + "</tbody>";
  }


  /* ---------- Danijos palyginimas ---------- */
  function renderDk(D) {
    var K = D.dk; if (!K) return;
    document.getElementById("kpis-dk").innerHTML = [
      { l: "Naujos kartos vaistų dalis, Lietuva", v: String(K.ltNaujaDalis).replace(".", ",") + " %",
        n: "nuo viso antiepilepsinių vaistų suvartojimo (DDD)" },
      { l: "Naujos kartos vaistų dalis, Danija", v: "~" + String(K.dkNaujaDalis).replace(".", ",") + " %",
        n: "apie " + num(K.dkNaujaAsm) + " žmonių gauna bent vieną tokį vaistą" },
      { l: "Antiepilepsinius vartoja, Danija", v: num(K.n03aAsmenys),
        n: String(K.n03aAsm1000).replace(".", ",") + " iš 1000 gyventojų · " + String(K.n03aDdd).replace(".", ",") + " DDD/1000/d" },
      { l: "Suvartojimas, Lietuva", v: String(K.ltN03aDdd).replace(".", ",") + " DDD/1000/d",
        n: "Danijoje " + String(K.n03aDdd).replace(".", ",") + " — beveik dvigubai daugiau" }
    ].map(function (x) {
      return '<div class="kpi"><div class="k-label">' + esc(x.l) + '</div><div class="k-val">' + x.v +
        '</div><div class="k-note">' + esc(x.n) + "</div></div>";
    }).join("");

    var h = '<thead><tr><th class="l">Veiklioji medžiaga</th>' +
      '<th>DK asmenų</th><th>DK 1000 gyv.</th><th>DK DDD/1000/d</th>' +
      '<th>LT DDD/1000/d</th><th>LT epilepsijos receptų</th></tr></thead><tbody>';
    K.rows.forEach(function (r) {
      var lt = r.ltDdd, dk = r.dkDdd;
      var santykis = (lt > 0 && dk > 0) ? (dk / lt) : null;
      h += "<tr" + (r.nauja ? ' class="hl"' : "") + '><td class="l"><b>' + esc(r.sub) + "</b>" +
        (r.nauja ? ' <span class="pill new">naujos kartos</span>' : "") + "</td>" +
        (r.dkAsm == null ? '<td class="dim">neregistr.</td><td class="dim">—</td><td class="dim">—</td>'
          : "<td>" + num(r.dkAsm) + "</td><td>" + String(r.dkAsm1000).replace(".", ",") + "</td><td>" +
            String(r.dkDdd).replace(".", ",") + "</td>") +
        "<td>" + (lt ? lt.toFixed(4).replace(".", ",").replace(/,?0+$/, function (m) { return m.length > 3 ? "" : m; }) : '<span class="dim">0</span>') + "</td>" +
        "<td>" + (r.ltRx != null ? num(r.ltRx) : '<span class="dim">—</span>') + "</td></tr>";
    });
    document.getElementById("tbl-dk").innerHTML = h + "</tbody>";
  }


  /* ---------- TOP 10 lentelės ---------- */
  function bar(v, max, cls) {
    return '<span class="share wide"><i class="' + (cls || "") + '" style="width:' +
      Math.max(1.5, v / max * 100) + '%"></i></span>';
  }
  function renderTop10(D) {
    var E = D.epi, K = D.dk;

    var lt = E.rx2025.byAtc.slice().sort(function (a, b) { return b.g40 - a.g40; }).slice(0, 10);
    var ltMax = lt[0].g40, ltSum = E.rx2025.n03aSuG40;
    var h = '<thead><tr><th class="l">#</th><th class="l">Veiklioji medžiaga</th><th>Epilepsijos receptų</th>' +
      '<th class="l">Dalis visų epilepsijos receptų</th><th>Iš viso receptų</th><th>Epilepsijai</th></tr></thead><tbody>';
    lt.forEach(function (r, i) {
      h += "<tr" + (r.nauja ? ' class="hl"' : "") + '><td class="l dim">' + (i + 1) + "</td>" +
        '<td class="l"><b>' + esc(r.sub) + '</b> <span class="pill">' + esc(r.atc) + "</span></td>" +
        "<td>" + num(r.g40) + "</td>" +
        '<td class="l nowrap">' + bar(r.g40, ltMax) + " " + pct(r.g40 / ltSum) + "</td>" +
        "<td>" + num(r.visi) + "</td><td>" + String(r.dalis).replace(".", ",") + " %</td></tr>";
    });
    document.getElementById("tbl-lt10").innerHTML = h + "</tbody>";

    var dk = K.rows.filter(function (r) { return r.dkAsm; })
      .sort(function (a, b) { return b.dkAsm - a.dkAsm; }).slice(0, 10);
    var dkMax = dk[0].dkAsm;
    h = '<thead><tr><th class="l">#</th><th class="l">Veiklioji medžiaga</th><th>Asmenų</th>' +
      '<th class="l">Palyginti su pirmaujančiu</th><th>1000 gyv.</th><th>Lietuvoje 2025 m.</th></tr></thead><tbody>';
    dk.forEach(function (r, i) {
      var ltRx = r.ltRx;
      h += "<tr" + (r.nauja ? ' class="hl"' : "") + '><td class="l dim">' + (i + 1) + "</td>" +
        '<td class="l"><b>' + esc(r.sub) + "</b>" + (r.nauja ? ' <span class="pill new">naujos kartos</span>' : "") + "</td>" +
        "<td>" + num(r.dkAsm) + "</td>" +
        '<td class="l">' + bar(r.dkAsm, dkMax, "dk") + "</td>" +
        "<td>" + String(r.dkAsm1000).replace(".", ",") + "</td>" +
        '<td class="' + (ltRx != null && ltRx < 200 ? "warn" : "") + '">' +
        (ltRx != null ? num(ltRx) + " recept." : '<span class="dim">neparduodamas</span>') + "</td></tr>";
    });
    document.getElementById("tbl-dk10").innerHTML = h + "</tbody>";

    /* paplitimo palyginimas */
    var P = K.epi;
    h = '<thead><tr><th class="l">Rodiklis</th><th>Asmenų</th><th>1000 gyv.</th><th class="l">Ką apima</th></tr></thead><tbody>';
    h += '<tr><td class="l"><b>Lietuva 2025</b></td><td>' + num(E.years["2025"][0]) + "</td><td>" +
      String(E.years["2025"][1]).replace(".", ",") + '</td><td class="l small">Bet kuris per metus užregistruotas G40/G41 atvejis, įskaitant šeimos gydytoją</td></tr>';
    h += '<tr><td class="l"><b>Danija 2025</b></td><td>' + num(P.ligonines) + "</td><td>" +
      String(P.ligonines1000).replace(".", ",") + '</td><td class="l small">Tik ligoninių kontaktai, kuriuose epilepsija — pagrindinė diagnozė</td></tr>';
    h += '<tr><td class="l">Danija, 2021–2025 kaupiamai</td><td>' + num(P.penkmetis) + "</td><td>" +
      String(P.penkmetis1000).replace(".", ",") + '</td><td class="l small">Unikalūs asmenys per penkerius metus — artimiausias palyginamas dydis</td></tr>';
    h += '<tr><td class="l dim">Danija, publikuotas vertinimas</td><td class="dim">~36 000</td><td class="dim">~6</td>' +
      '<td class="l small dim">Registrų tyrimas: 5 metų paplitimas 0,6 % — ne einamųjų metų statistika</td></tr>';
    document.getElementById("tbl-prev").innerHTML = h + "</tbody>";
  }

  /* ---------- paleidimas ---------- */
  var base = (window.PAGE && window.PAGE.base) || "";
  fetch(base + "assets/data.json?v=" + (window.PAGE.v || "")).then(function (r) { return r.json(); }).then(function (D) {
    if (window.PAGE.type === "brand") {
      var b = D.brands.filter(function (x) { return x.slug === window.PAGE.slug; })[0];
      if (b) renderBrand(D, b);
    } else {
      renderIndex(D);
      renderEpi(D);
      renderDk(D);
      renderTop10(D);
    }
    var redraw = function () { window.dispatchEvent(new Event("resize")); };
    if (window.matchMedia) {
      var mq = window.matchMedia("(prefers-color-scheme: dark)");
      if (mq.addEventListener) mq.addEventListener("change", redraw);
    }
    new MutationObserver(redraw).observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme"] });
  }).catch(function (e) {
    document.body.insertAdjacentHTML("afterbegin",
      '<p style="padding:20px;color:#c33">Nepavyko įkelti duomenų: ' + esc(e.message) + "</p>");
  });
})();
