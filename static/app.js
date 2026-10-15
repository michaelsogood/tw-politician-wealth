// Theme toggle, the people index (filter / sort), and chart hover. No dependencies.
(function () {
  "use strict";

  var root = document.documentElement;
  function storedTheme() {
    try { return localStorage.getItem("theme"); } catch (e) { return null; }
  }
  var saved = storedTheme();
  if (saved === "light" || saved === "dark") root.setAttribute("data-theme", saved);

  document.addEventListener("click", function (event) {
    var button = event.target.closest(".theme-toggle");
    if (!button) return;
    var dark = root.getAttribute("data-theme") === "dark" ||
      (!root.getAttribute("data-theme") && matchMedia("(prefers-color-scheme: dark)").matches);
    var next = dark ? "light" : "dark";
    root.setAttribute("data-theme", next);
    try { localStorage.setItem("theme", next); } catch (e) { /* private mode */ }
  });

  var wan = new Intl.NumberFormat("zh-TW", { maximumFractionDigits: 1 });
  var yi = new Intl.NumberFormat("zh-TW", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  function money(value) {
    if (value === null || value === undefined) return "—";
    if (Math.abs(value) < 10000) return wan.format(value) + " 元";
    if (Math.abs(value) >= 100000000) return yi.format(value / 100000000) + " 億";
    return wan.format(value / 10000) + " 萬";
  }
  function escapeHtml(text) {
    return String(text === null || text === undefined ? "" : text)
      .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
  }

  // ---- People index ----
  var dataNode = document.getElementById("people-data");
  if (dataNode) initIndex(JSON.parse(dataNode.textContent));

  function initIndex(people) {
    var body = document.getElementById("people-body");
    var countNode = document.getElementById("people-count");
    var search = document.getElementById("q");
    var city = document.getElementById("city");
    var party = document.getElementById("party");
    var former = document.getElementById("former");
    var moreButton = document.getElementById("more");
    var groupButtons = Array.prototype.slice.call(document.querySelectorAll("[data-group]"));
    var headers = Array.prototype.slice.call(document.querySelectorAll("th[data-sort]"));
    var state = { group: "", sort: "listed", dir: -1, limit: 100 };

    // Filters live in the address, so going back from a person page (or sharing the
    // link) shows the same list.
    var sortKeys = headers.map(function (h) { return h.getAttribute("data-sort"); });
    function choose(select, value) {
      if (value && Array.prototype.some.call(select.options, function (o) { return o.value === value; })) {
        select.value = value;
      }
    }
    var params = new URLSearchParams(location.search);
    if (groupButtons.some(function (b) { return b.getAttribute("data-group") === params.get("group"); })) {
      state.group = params.get("group");
    }
    if (sortKeys.indexOf(params.get("sort")) >= 0) {
      state.sort = params.get("sort");
      state.dir = params.get("dir") === "asc" ? 1 : -1;
    }
    if (params.get("q")) search.value = params.get("q");
    choose(city, params.get("city"));
    choose(party, params.get("party"));
    if (params.get("former") === "1") former.checked = true;

    function remember() {
      var next = new URLSearchParams();
      if (state.group) next.set("group", state.group);
      if (search.value.trim()) next.set("q", search.value.trim());
      if (city.value) next.set("city", city.value);
      if (party.value) next.set("party", party.value);
      if (former.checked) next.set("former", "1");
      if (state.sort !== "listed" || state.dir !== -1) {
        next.set("sort", state.sort);
        next.set("dir", state.dir > 0 ? "asc" : "desc");
      }
      var query = next.toString();
      try {
        history.replaceState(null, "", location.pathname + (query ? "?" + query : "") + location.hash);
      } catch (e) { /* file: pages in some browsers */ }
    }

    function matches(p) {
      var q = search.value.trim();
      if (state.group && p.group !== state.group) return false;
      if (city.value && p.city !== city.value) return false;
      if (party.value && (p.party || "（未登記）") !== party.value) return false;
      if (!former.checked && !p.on_roster) return false;
      if (q && (p.name + p.agency + (p.party || "") + (p.city || "")).indexOf(q) < 0) return false;
      return true;
    }
    function compare(a, b) {
      var x = a[state.sort], y = b[state.sort];
      var missingX = x === null || x === undefined, missingY = y === null || y === undefined;
      if (missingX || missingY) return missingX === missingY ? 0 : (missingX ? 1 : -1);
      if (typeof x === "string") return state.dir * x.localeCompare(y, "zh-Hant");
      return state.dir * (x - y);
    }
    function row(p) {
      var place = p.group === "legislators" ? "立法委員" :
        (p.city || "") + (p.group === "mayors" ? "長" : "議員");
      var extra = /^(議員|立法委員|市長|縣長)$/.test(p.title) ? "" : p.title;
      if (p.district) extra = p.district.replace("全國不分區及僑居國外國民", "不分區") + (extra ? "・" + extra : "");
      var tag = p.on_roster ? "" : ' <span class="badge warn">已非現任</span>';
      return "<tr>" +
        '<td><a href="people/' + encodeURIComponent(p.id) + '.html">' + escapeHtml(p.name) + "</a>" + tag + "</td>" +
        "<td>" + escapeHtml(place) + (extra ? '<span class="note">' + escapeHtml(extra) + "</span>" : "") + "</td>" +
        "<td>" + escapeHtml(p.party || "—") + "</td>" +
        '<td class="date">' + escapeHtml(p.latest || "—") + "</td>" +
        '<td class="num">' + money(p.cash) + "</td>" +
        '<td class="num">' + money(p.listed) + "</td>" +
        '<td class="num">' + money(p.securities) + "</td>" +
        '<td class="num">' + money(p.debts) + "</td>" +
        '<td class="num">' + (p.land === null ? "—" : p.land + " / " + p.buildings) + "</td>" +
        '<td class="num">' + (p.insurance === null ? "—" : p.insurance + " 份") + "</td>" +
        "</tr>";
    }
    function render() {
      remember();
      var list = people.filter(matches).sort(compare);
      countNode.textContent = "共 " + list.length + " 人";
      body.innerHTML = list.slice(0, state.limit).map(row).join("") ||
        '<tr><td colspan="10" class="empty">沒有符合條件的人</td></tr>';
      moreButton.hidden = list.length <= state.limit;
      groupButtons.forEach(function (b) {
        b.setAttribute("aria-pressed", String(b.getAttribute("data-group") === state.group));
      });
      headers.forEach(function (h) {
        var on = h.getAttribute("data-sort") === state.sort;
        if (on) h.setAttribute("aria-sort", state.dir > 0 ? "ascending" : "descending");
        else h.removeAttribute("aria-sort");
      });
    }
    groupButtons.forEach(function (b) {
      b.addEventListener("click", function () { state.group = b.getAttribute("data-group"); state.limit = 100; render(); });
    });
    headers.forEach(function (h) {
      h.addEventListener("click", function () {
        var key = h.getAttribute("data-sort");
        if (state.sort === key) state.dir = -state.dir;
        else { state.sort = key; state.dir = h.classList.contains("num") ? -1 : 1; }
        render();
      });
    });
    [search, city, party, former].forEach(function (node) {
      node.addEventListener(node === search ? "input" : "change", function () { state.limit = 100; render(); });
    });
    moreButton.addEventListener("click", function () { state.limit += 200; render(); });
    render();
  }

  // ---- Chart hover: crosshair + tooltip at the nearest declaration ----
  Array.prototype.forEach.call(document.querySelectorAll(".chart[data-chart]"), function (chart) {
    var spec = JSON.parse(chart.getAttribute("data-chart"));
    var svg = chart.querySelector("svg");
    var cross = chart.querySelector(".crosshair");
    var tip = chart.querySelector(".tooltip");
    function hide() { tip.style.display = "none"; cross.style.visibility = "hidden"; }
    svg.addEventListener("mouseleave", hide);
    svg.addEventListener("mousemove", function (event) {
      var box = svg.getBoundingClientRect();
      var x = (event.clientX - box.left) / box.width * spec.width;
      var best = 0;
      spec.xs.forEach(function (px, i) { if (Math.abs(px - x) < Math.abs(spec.xs[best] - x)) best = i; });
      cross.setAttribute("x1", spec.xs[best]);
      cross.setAttribute("x2", spec.xs[best]);
      cross.style.visibility = "visible";
      tip.innerHTML = "<strong>" + escapeHtml(spec.labels[best]) + "</strong>" + spec.series.map(function (s) {
        return '<div class="row"><span><span class="key ' + s.cls + '"></span>' + escapeHtml(s.name) +
          "</span><span>" + money(s.values[best]) + "</span></div>";
      }).join("");
      tip.style.display = "block";
      var left = spec.xs[best] / spec.width * box.width;
      var flip = left > box.width / 2;
      tip.style.left = flip ? "" : (left + 12) + "px";
      tip.style.right = flip ? (box.width - left + 12) + "px" : "";
      tip.style.top = "8px";
    });
  });
})();
