/* player.js — общий плеер сайта.
 *
 * Подключается на каждой странице одной строкой (после aurora-скрипта):
 *   <script src="player.js"></script>
 *
 * Что делает:
 *  1. Один <audio> на весь сайт, список песен берёт из songs/songs.json.
 *  2. Рисует мини-плеер в одну строку в самом верху страницы.
 *  3. Переходы по внутренним ссылкам идут без перезагрузки (подменяется только
 *     содержимое страницы), поэтому музыка не прерывается.
 *  4. Для главной: MuckPlayer.mountCarousel(контейнер) рисует карусель с обложками.
 *
 * Если songs.json нет или он пустой — плеер не появляется, сайт работает как раньше.
 */
(function () {
  if (window.MuckPlayer) return;

  var SCRIPT_SRC = (document.currentScript && document.currentScript.src) || location.href;
  var BASE = new URL("songs/", SCRIPT_SRC);
  function noop() {}

  function el(tag, cls, text) {
    var e = document.createElement(tag);
    if (cls) e.className = cls;
    if (text !== undefined) e.textContent = text;
    return e;
  }
  function fmt(t) {
    if (!isFinite(t)) return "0:00";
    var m = Math.floor(t / 60), s = Math.floor(t % 60);
    return m + ":" + (s < 10 ? "0" : "") + s;
  }
  function songUrl(f) {
    return new URL(f.split("/").map(encodeURIComponent).join("/"), BASE).href;
  }

  /* ---------- Стили (живут постоянно, не пропадают при смене страницы) ---------- */
  var css = [
    ":root { --mp-accent: #2a8a4a; --mp-h: 2.75rem; }",
    "@media (prefers-color-scheme: dark) { :root { --mp-accent: #6fd08c; } }",

    /* мини-плеер */
    "html.mp-on body { padding-top: var(--mp-h); }",
    ".mp-bar { position: fixed; top: 0; left: 0; right: 0; z-index: 50; padding-top: env(safe-area-inset-top, 0px);",
    "  background: color-mix(in srgb, var(--card, #fff) 82%, transparent); color: var(--ink, #14181f);",
    "  -webkit-backdrop-filter: blur(14px) saturate(1.2); backdrop-filter: blur(14px) saturate(1.2);",
    "  border-bottom: 1px solid var(--line, #d5dae1); font: 400 .85rem/1 var(--sans, system-ui, sans-serif); }",
    ".mp-in { max-width: 44rem; margin: 0 auto; height: var(--mp-h); padding: 0 .75rem; display: flex; align-items: center; gap: .35rem; }",
    ".mp-btn { flex: none; width: 2rem; height: 2rem; padding: 0; border: 0; border-radius: 50%; cursor: pointer; background: transparent; color: inherit; font-size: .8rem; display: grid; place-items: center; }",
    ".mp-btn:hover { background: color-mix(in srgb, var(--line, #d5dae1) 55%, transparent); }",
    ".mp-btn.mp-play { font-size: .95rem; }",
    ".mp-label { flex: 1; min-width: 0; margin: 0 .35rem; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; font-weight: 600; }",
    ".mp-label span { font-weight: 400; color: var(--muted, #596273); }",
    ".mp-seek { flex: 0 0 min(30%, 12rem); min-width: 3.5rem; accent-color: var(--mp-accent); cursor: pointer; }",
    ".mp-time { flex: none; min-width: 6.2ch; margin-left: .35rem; color: var(--muted, #596273); font-variant-numeric: tabular-nums; text-align: right; }",
    "@media (max-width: 34rem) { .mp-time { display: none; } .mp-in { padding: 0 .4rem; } .mp-seek { flex-basis: 22%; min-width: 3rem; } }",
    ".mp-btn:focus-visible, .mp-seek:focus-visible { outline: 3px solid #2f6fd0; outline-offset: 2px; }",

    /* карусель на главной */
    ".player { padding: 1rem 1rem .9rem; }",
    ".carousel { display: flex; overflow-x: auto; scroll-snap-type: x mandatory; scrollbar-width: none; -webkit-overflow-scrolling: touch; overscroll-behavior-x: contain; }",
    ".carousel::-webkit-scrollbar { display: none; }",
    "@media (prefers-reduced-motion: no-preference) { .carousel { scroll-behavior: smooth; } }",
    ".slide { flex: 0 0 100%; scroll-snap-align: center; scroll-snap-stop: always; min-width: 0; display: flex; align-items: center; gap: 1rem; }",
    ".cover { flex: none; width: clamp(5.5rem, 28vw, 8rem); aspect-ratio: 1; border-radius: 14px; overflow: hidden; box-shadow: var(--shadow);",
    "  background: linear-gradient(135deg, #26ceaa, #5049cc); display: grid; place-items: center; color: #fff; font-size: 2.4rem; }",
    ".cover img { width: 100%; height: 100%; object-fit: cover; display: block; }",
    ".s-info { flex: 1; min-width: 0; }",
    ".s-title { font: 600 1.25rem/1.25 var(--serif); margin: 0 0 .2rem; overflow-wrap: anywhere; }",
    ".s-artist { font-size: .92rem; color: var(--muted); }",
    ".ctrl { display: flex; align-items: center; gap: .6rem; margin-top: 1rem; }",
    ".time { flex: none; font-size: .78rem; color: var(--muted); font-variant-numeric: tabular-nums; min-width: 2.2rem; }",
    ".time.end { text-align: right; }",
    ".seek { flex: 1; min-width: 0; accent-color: var(--mp-accent); cursor: pointer; }",
    ".nav { width: 2.2rem; height: 2.2rem; border: 0; border-radius: 50%; cursor: pointer; background: transparent; color: var(--ink); font-size: .95rem; display: grid; place-items: center; transition: background .15s; }",
    ".nav:hover { background: color-mix(in srgb, var(--line) 50%, transparent); }",
    ".play { flex: none; width: 2.8rem; height: 2.8rem; border: 0; border-radius: 50%; cursor: pointer; background: var(--accent); color: var(--on-accent);",
    "  box-shadow: var(--shadow-btn); font-size: 1rem; display: grid; place-items: center; }",
    ".pager { display: flex; align-items: center; justify-content: center; gap: .8rem; margin-top: .4rem; }",
    ".dots { display: flex; gap: .45rem; }",
    ".dots button { width: .5rem; height: .5rem; padding: 0; border: 0; border-radius: 50%; cursor: pointer; background: var(--line); }",
    ".dots button.on { background: var(--mp-accent); }",
    ".nav:focus-visible, .play:focus-visible, .dots button:focus-visible, .seek:focus-visible { outline: 3px solid #2f6fd0; outline-offset: 2px; }"
  ].join("\n");
  var styleEl = el("style");
  styleEl.setAttribute("data-mp", "");
  styleEl.textContent = css;
  document.head.appendChild(styleEl);

  /* ---------- Ядро: один audio на весь сайт ---------- */
  var audio = new Audio();
  audio.preload = "metadata";
  var songs = [], cur = 0, subs = [], cleanups = [];

  function emit(kind) { subs.slice().forEach(function (fn) { fn(kind); }); }
  function on(fn) {
    subs.push(fn);
    return function () { subs = subs.filter(function (x) { return x !== fn; }); };
  }

  function setTrack(i, autoplay) {
    if (!songs.length) return;
    cur = (i + songs.length) % songs.length;
    audio.src = songUrl(songs[cur].file);
    if (autoplay) audio.play().catch(noop);
    if ("mediaSession" in navigator && window.MediaMetadata) {
      var s = songs[cur];
      navigator.mediaSession.metadata = new MediaMetadata({
        title: s.title || s.file, artist: s.artist || "MuckMson",
        artwork: s.cover ? [{ src: songUrl(s.cover) }] : []
      });
    }
    emit("track");
  }
  function toggle() { audio.paused ? audio.play().catch(noop) : audio.pause(); }
  function step(d, autoplay) { setTrack(cur + d, autoplay === undefined ? !audio.paused : autoplay); }
  function seekTo(f) { if (audio.duration) audio.currentTime = f * audio.duration; }

  ["play", "pause", "loadedmetadata", "durationchange", "timeupdate"].forEach(function (ev) {
    audio.addEventListener(ev, function () { emit(ev); });
  });
  audio.addEventListener("ended", function () {
    if (songs.length > 1) step(1, true);
  });

  if ("mediaSession" in navigator) {
    var ms = navigator.mediaSession;
    try {
      ms.setActionHandler("play", function () { audio.play().catch(noop); });
      ms.setActionHandler("pause", function () { audio.pause(); });
      ms.setActionHandler("previoustrack", function () { step(-1, true); });
      ms.setActionHandler("nexttrack", function () { step(1, true); });
    } catch (e) {}
  }

  // Ползунок перемотки: пока тянем — не перебиваем его обновлением от audio
  function bindSeek(input, setNow) {
    var dragging = false;
    input.type = "range"; input.min = 0; input.max = 1000; input.value = 0;
    input.setAttribute("aria-label", "Перемотка");
    input.addEventListener("input", function () { dragging = true; setNow(input.value / 1000 * (audio.duration || 0)); });
    input.addEventListener("change", function () { seekTo(input.value / 1000); dragging = false; });
    return function sync() {
      if (dragging) return;
      input.value = audio.duration ? audio.currentTime / audio.duration * 1000 : 0;
    };
  }

  /* ---------- Мини-плеер сверху ---------- */
  function buildBar() {
    var bar = el("div", "mp-bar");
    bar.setAttribute("data-mp", "");
    var row = el("div", "mp-in");

    var prev = el("button", "mp-btn", "⏮"), play = el("button", "mp-btn mp-play", "▶"), next = el("button", "mp-btn", "⏭");
    [prev, play, next].forEach(function (b) { b.type = "button"; });
    prev.setAttribute("aria-label", "Предыдущая"); next.setAttribute("aria-label", "Следующая");
    prev.onclick = function () { step(-1); };
    next.onclick = function () { step(1); };
    play.onclick = toggle;

    var label = el("div", "mp-label");
    var seek = el("input", "mp-seek");
    var time = el("span", "mp-time", "0:00 / 0:00");
    var syncSeek = bindSeek(seek, function (t) { time.textContent = fmt(t) + " / " + fmt(audio.duration); });

    if (songs.length > 1) row.appendChild(prev);
    row.appendChild(play);
    if (songs.length > 1) row.appendChild(next);
    row.appendChild(label); row.appendChild(seek); row.appendChild(time);
    bar.appendChild(row);
    document.body.insertBefore(bar, document.body.firstChild);
    document.documentElement.classList.add("mp-on");

    function update() {
      var s = songs[cur];
      play.textContent = audio.paused ? "▶" : "❚❚";
      play.setAttribute("aria-label", audio.paused ? "Играть" : "Пауза");
      label.textContent = s.title || s.file;
      if (s.artist) { var a = el("span", "", " — " + s.artist); label.appendChild(a); }
      time.textContent = fmt(audio.currentTime) + " / " + fmt(audio.duration);
      syncSeek();
    }
    on(update);
    update();
  }

  /* ---------- Карусель на главной ---------- */
  function mountCarousel(box) {
    if (!songs.length) return;
    box.appendChild(el("h2", "group", "Музыка"));
    var card = el("div", "card player");
    var car = el("div", "carousel");
    var dots = el("div", "dots");

    songs.forEach(function (sg, i) {
      var slide = el("div", "slide");
      var cv = el("div", "cover");
      if (sg.cover) {
        var img = el("img");
        img.src = songUrl(sg.cover); img.alt = ""; img.loading = "lazy";
        img.onerror = function () { img.remove(); cv.textContent = "♪"; };
        cv.appendChild(img);
      } else cv.textContent = "♪";
      slide.appendChild(cv);
      var info = el("div", "s-info");
      info.appendChild(el("div", "s-title", sg.title || sg.file));
      info.appendChild(el("div", "s-artist", sg.artist || ""));
      slide.appendChild(info);
      car.appendChild(slide);
      var dot = el("button");
      dot.type = "button"; dot.setAttribute("aria-label", "Песня " + (i + 1));
      dot.onclick = function () { step(i - cur); };
      dots.appendChild(dot);
    });
    card.appendChild(car);

    var play = el("button", "play", "▶");
    play.type = "button";
    play.onclick = toggle;
    var tNow = el("span", "time", "0:00"), tAll = el("span", "time end", "0:00");
    var seek = el("input", "seek");
    var syncSeek = bindSeek(seek, function (t) { tNow.textContent = fmt(t); });
    var ctrl = el("div", "ctrl");
    ctrl.appendChild(play); ctrl.appendChild(tNow); ctrl.appendChild(seek); ctrl.appendChild(tAll);
    card.appendChild(ctrl);

    if (songs.length > 1) {
      var prev = el("button", "nav", "⏮"), next = el("button", "nav", "⏭");
      prev.type = next.type = "button";
      prev.setAttribute("aria-label", "Предыдущая"); next.setAttribute("aria-label", "Следующая");
      prev.onclick = function () { step(-1); };
      next.onclick = function () { step(1); };
      var pager = el("div", "pager");
      pager.appendChild(prev); pager.appendChild(dots); pager.appendChild(next);
      card.appendChild(pager);
    }
    box.appendChild(card);

    var lock = false, lockT, scrollT;
    function alignScroll(instant) {
      var want = cur * car.clientWidth;
      if (Math.abs(car.scrollLeft - want) < 4) return;
      lock = true; clearTimeout(lockT); lockT = setTimeout(function () { lock = false; }, 800);
      car.scrollTo({ left: want, behavior: instant ? "instant" : "auto" });
    }
    car.addEventListener("scroll", function () {
      if (lock) return;
      clearTimeout(scrollT);
      scrollT = setTimeout(function () {
        var i = Math.round(car.scrollLeft / car.clientWidth);
        if (i !== cur && i >= 0 && i < songs.length) setTrack(i, !audio.paused);
      }, 90);
    }, { passive: true });
    function onResize() { alignScroll(true); }
    window.addEventListener("resize", onResize);

    function update(kind) {
      Array.prototype.forEach.call(dots.children, function (d, i) { d.className = i === cur ? "on" : ""; });
      play.textContent = audio.paused ? "▶" : "❚❚";
      play.setAttribute("aria-label", audio.paused ? "Играть" : "Пауза");
      tNow.textContent = fmt(audio.currentTime);
      tAll.textContent = fmt(audio.duration);
      syncSeek();
      if (kind === "track") alignScroll(false);
    }
    var off = on(update);
    update();
    alignScroll(true);

    cleanups.push(function () {
      off();
      clearTimeout(lockT); clearTimeout(scrollT);
      window.removeEventListener("resize", onResize);
    });
  }

  /* ---------- Переходы без перезагрузки: музыка не прерывается ---------- */
  var navId = 0;

  function isKept(n) {
    if (n.nodeType !== 1) return false;
    if (n.hasAttribute("data-mp") || n.classList.contains("aurora")) return true;
    if (n.tagName === "SCRIPT") {
      if (n.getAttribute("src") && /player\.js/.test(n.getAttribute("src"))) return true;
      if (/sizeAurora/.test(n.textContent)) return true;
    }
    return false;
  }

  function swapPage(doc, url, push) {
    cleanups.splice(0).forEach(function (fn) { try { fn(); } catch (e) {} });

    // стили страницы (свои у каждой страницы), кроме стилей плеера
    Array.prototype.slice.call(document.head.querySelectorAll("style:not([data-mp])")).forEach(function (s) { s.remove(); });
    Array.prototype.forEach.call(doc.head.querySelectorAll("style"), function (s) {
      document.head.appendChild(document.importNode(s, true));
    });
    document.title = doc.title;
    var d1 = document.head.querySelector('meta[name="description"]'), d2 = doc.head.querySelector('meta[name="description"]');
    if (d1 && d2) d1.setAttribute("content", d2.getAttribute("content") || "");

    Array.prototype.slice.call(document.body.childNodes).forEach(function (n) { if (!isKept(n)) n.remove(); });

    if (push) history.pushState({}, "", url);
    window.scrollTo(0, 0);

    Array.prototype.slice.call(doc.body.childNodes).forEach(function (n) {
      if (isKept(n)) return;
      if (n.nodeType === 1 && n.tagName === "SCRIPT") {
        var s = document.createElement("script");
        Array.prototype.forEach.call(n.attributes, function (a) { s.setAttribute(a.name, a.value); });
        s.textContent = n.textContent;
        document.body.appendChild(s);       // inline-скрипт выполняется сразу
      } else {
        document.body.appendChild(document.importNode(n, true));
      }
    });
  }

  function go(url, push) {
    var id = ++navId;
    fetch(url, { credentials: "same-origin" })
      .then(function (r) {
        var type = r.headers.get("content-type") || "";
        if (!r.ok || type.indexOf("text/html") < 0) throw new Error("not html");
        return r.text();
      })
      .then(function (html) {
        if (id !== navId) return;
        var doc = new DOMParser().parseFromString(html, "text/html");
        if (!doc.querySelector(".wrap")) throw new Error("no .wrap");
        swapPage(doc, url, push);
      })
      .catch(function () { if (id === navId) location.href = url; });  // запасной вариант — обычный переход
  }

  function installNav() {
    if ("scrollRestoration" in history) history.scrollRestoration = "manual";
    document.addEventListener("click", function (e) {
      if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
      var a = e.target.closest && e.target.closest("a[href]");
      if (!a || (a.target && a.target !== "_self") || a.hasAttribute("download")) return;
      var raw = a.getAttribute("href");
      if (!raw || raw === "#") return;
      var u = new URL(a.href, location.href);
      if (u.origin !== location.origin) return;
      if (!/(\.html?|\/)$/.test(u.pathname)) return;
      if (u.hash && u.pathname === location.pathname && u.search === location.search) return;  // якорь на этой же странице
      e.preventDefault();
      go(u.href, true);
    });
    window.addEventListener("popstate", function () { go(location.href, false); });
  }

  /* ---------- Запуск ---------- */
  var ready = fetch(new URL("songs.json", BASE), { cache: "no-cache" })
    .then(function (r) { return r.ok ? r.json() : []; })
    .catch(function () { return []; })
    .then(function (list) {
      if (!Array.isArray(list) || !list.length) return;
      songs = list;
      setTrack(0, false);
      buildBar();
      installNav();
    });

  window.MuckPlayer = {
    ready: ready,
    mountCarousel: mountCarousel,
    audio: audio,
    toggle: toggle,
    next: function () { step(1); },
    prev: function () { step(-1); }
  };
})();
