// ===================================================================
//  ✨ 재미 효과 도구 (fxkit.js) — 가까이 가면 반응하는 물건을 쉽게 만드는 도구
//
//  게임 본체가 window.GAME_FX (화면 좌표 계산 · 지금 방 · 주인공 위치) 를 주면,
//  이 도구가 그 위에 말풍선 · 그림 글자 · 짧은 효과음을 그립니다. (CSS 도 이 파일이 직접 넣습니다)
//
//  반응 목록은 이렇게 적습니다 (react.js) :
//    FXKIT.define({
//      물건이름: { r: 1.3,            // 이 거리(칸) 안에 들어오면
//                  cool: 20,          // 같은 자리는 20초 뒤에 다시
//                  p: 0.6,            // 60% 확률로만 (없으면 늘)
//                  s: "coin",         // 효과음 (아래 SND 이름, 여러 개면 ["a","b"])
//                  e: "🪙:bounce:4",  // 그림 효과 "그림:움직임:개수:크기:높이"  (여러 개면 배열)
//                  t: ["말 1", "말 2"] // 말풍선 (하나를 무작위로)
//                  f: function (K, o) {…} } // 직접 만드는 반응 (선택)
//    })
//  움직임 : pop 튀어나옴 · rise 떠오름 · fly 날아감 · drop 내려옴 · spin 빙글 · run 굴러감
//           bounce 통통 · sway 흔들 · jump 펄쩍 · fall 떨어짐 · blink 깜빡
//  구글 시트 '설정' 탭 :  재미 효과 | N  → 반응을 모두 끔   /   효과음 | N  → 소리만 끔
// ===================================================================
(function () {
  "use strict";
  if (window.FXKIT) return;
  var R = function () { return Math.random() };
  function pick(a) { return Array.isArray(a) ? a[Math.floor(R() * a.length)] : a }
  function S() { return window.SETTINGS || {} }
  function api() { return window.GAME_FX }

  // ---------- 화면 꾸미기 (한 번만 넣음) ----------
  var CSS = [
    "#fxk{position:absolute;inset:0;pointer-events:none;overflow:hidden;z-index:6}",
    ".fxk-s,.fxk-b{position:absolute;left:0;top:0;will-change:transform}",
    ".fxk-s span{position:absolute;left:0;top:0;transform:translate(-50%,-100%);line-height:1;white-space:nowrap;filter:drop-shadow(0 3px 5px #0006);animation-fill-mode:both;animation-timing-function:ease-out}",
    ".fxk-s.dark span{filter:grayscale(1) brightness(.4) drop-shadow(0 2px 4px #0006)}",
    ".fxk-s.soft span{opacity:.75}",
    ".fxk-s .tag{font-family:var(--fh,inherit);color:#fff;background:var(--fxk-tag,#3f6fd6);border:3px solid #fff;border-radius:14px;padding:3px 12px;box-shadow:0 4px 0 #0003}",
    ".fxk-s.pop span{animation-name:fxkPop}.fxk-s.rise span{animation-name:fxkRise}.fxk-s.fly span{animation-name:fxkFly;animation-timing-function:ease-in}",
    ".fxk-s.drop span{animation-name:fxkDrop;animation-timing-function:cubic-bezier(.3,1.4,.5,1)}.fxk-s.spin span{animation-name:fxkSpin}",
    ".fxk-s.run span{animation-name:fxkRun;animation-timing-function:linear}.fxk-s.bounce span{animation-name:fxkBounce}",
    ".fxk-s.sway span{animation-name:fxkSway;animation-timing-function:ease-in-out}.fxk-s.jump span{animation-name:fxkJump}",
    ".fxk-s.fall span{animation-name:fxkFall;animation-timing-function:linear}.fxk-s.blink span{animation-name:fxkBlink}",
    "@keyframes fxkPop{0%{transform:translate(-50%,-100%) scale(0);opacity:0}25%{transform:translate(-50%,-100%) scale(1.3);opacity:1}45%{transform:translate(-50%,-100%) scale(1)}80%{opacity:1}100%{transform:translate(-50%,-130%);opacity:0}}",
    "@keyframes fxkRise{0%{transform:translate(-50%,-60%) scale(.5);opacity:0}18%{opacity:1}100%{transform:translate(-50%,calc(-100% - 100px)) scale(1.1);opacity:0}}",
    "@keyframes fxkFly{0%{transform:translate(-50%,-100%) scale(.7);opacity:0}12%{opacity:1}100%{transform:translate(calc(-50% + var(--dx)),calc(-100% + var(--dy))) scale(1.1);opacity:0}}",
    "@keyframes fxkDrop{0%{transform:translate(-50%,-240%);opacity:0}25%{transform:translate(-50%,-100%);opacity:1}75%{transform:translate(-50%,-110%);opacity:1}100%{transform:translate(-50%,-240%);opacity:0}}",
    "@keyframes fxkSpin{0%{transform:translate(-50%,-100%) rotate(0) scale(.6);opacity:0}15%{opacity:1}100%{transform:translate(-50%,calc(-100% - 40px)) rotate(360deg);opacity:0}}",
    "@keyframes fxkRun{0%{transform:translate(-50%,-100%);opacity:0}10%{opacity:1}25%{transform:translate(calc(-50% + var(--dx) * .25),-120%)}50%{transform:translate(calc(-50% + var(--dx) * .5),-100%)}75%{transform:translate(calc(-50% + var(--dx) * .75),-120%)}100%{transform:translate(calc(-50% + var(--dx)),-100%);opacity:0}}",
    "@keyframes fxkBounce{0%{transform:translate(-50%,-100%) scale(.4);opacity:0}15%{opacity:1}35%{transform:translate(calc(-50% + var(--dx) * .5),calc(-100% - 70px)) scale(1)}60%{transform:translate(calc(-50% + var(--dx)),-100%)}75%{transform:translate(calc(-50% + var(--dx)),calc(-100% - 20px))}90%{transform:translate(calc(-50% + var(--dx)),-100%);opacity:1}100%{opacity:0}}",
    "@keyframes fxkSway{0%{transform:translate(-50%,-100%) rotate(0) scale(.5);opacity:0}15%{transform:translate(-50%,-100%) rotate(-12deg) scale(1);opacity:1}35%{transform:translate(-50%,-100%) rotate(12deg)}55%{transform:translate(-50%,-100%) rotate(-10deg)}75%{transform:translate(-50%,-100%) rotate(8deg);opacity:1}100%{transform:translate(-50%,-110%);opacity:0}}",
    "@keyframes fxkJump{0%{transform:translate(-50%,-100%) rotate(30deg);opacity:0}10%{opacity:1}50%{transform:translate(calc(-50% + 30px),calc(-100% - 90px)) rotate(-20deg)}90%{opacity:1}100%{transform:translate(calc(-50% + 60px),-100%) rotate(-60deg);opacity:0}}",
    "@keyframes fxkFall{0%{transform:translate(-50%,-100%) rotate(0);opacity:0}10%{opacity:1}100%{transform:translate(calc(-50% + 80px),calc(-100% + 260px)) rotate(240deg);opacity:0}}",
    "@keyframes fxkBlink{0%,100%{opacity:0;transform:translate(-50%,-100%) scaleY(.1)}15%,45%,60%,85%{opacity:1;transform:translate(-50%,-100%) scaleY(1)}52%{transform:translate(-50%,-100%) scaleY(.1)}}",
    ".fxk-b div{position:absolute;left:0;top:0;transform:translate(-50%,-100%);max-width:250px;width:max-content;background:var(--fxk-bg,#fffdf7);color:var(--fxk-ink,#2f2a3a);border:2px solid var(--fxk-line,#6a7a9a);border-radius:14px;padding:7px 12px;font-family:var(--fh,inherit);font-size:15px;line-height:1.35;text-align:center;white-space:normal;word-break:keep-all;box-shadow:0 4px 0 #0002,0 6px 16px #0003;animation:fxkBubble 2.8s ease both}",
    ".fxk-b div::after{content:'';position:absolute;left:50%;bottom:-9px;margin-left:-8px;border:8px solid transparent;border-top-color:var(--fxk-line,#6a7a9a);border-bottom:0}",
    ".fxk-b.top div::after{display:none}.fxk-b div b{color:var(--fxk-em,#d8423a)}",
    "@keyframes fxkBubble{0%{opacity:0;transform:translate(-50%,-80%) scale(.8)}8%{opacity:1;transform:translate(-50%,-100%) scale(1)}88%{opacity:1}100%{opacity:0;transform:translate(-50%,-110%)}}",
    ".fxk-o{position:absolute;inset:0;animation:fxkFlash .6s ease both}",
    "@keyframes fxkFlash{0%{opacity:0}20%{opacity:.25}100%{opacity:0}}"
  ].join("\n");
  var st = document.createElement("style"); st.textContent = CSS; document.head.appendChild(st);

  // ---------- 효과 막 · 그리기 ----------
  var layer = null, items = [], lastBubble = null;
  function getLayer() {
    if (layer && layer.parentNode) return layer;
    var f = document.getElementById("frame"); if (!f) return null;
    layer = document.createElement("div"); layer.id = "fxk"; f.appendChild(layer);
    return layer;
  }
  function add(e, x, h, y, life, sticky) {
    var L = getLayer(); if (!L || !api()) return null;
    L.appendChild(e);
    var it = { e: e, x: x, h: h, y: y, until: performance.now() + life, sticky: sticky };
    items.push(it); place(it); loop();
    return it;
  }
  function place(it) {
    var pt = api().project(it.x, it.h, it.y) || {};
    if (!pt.vis && it.sticky) {                               // 화면 밖이면 말풍선은 위쪽 가운데에
      var L = getLayer(); pt = { x: L.clientWidth / 2, y: 70, vis: true };
      it.e.classList.add("top");
    } else if (it.sticky) it.e.classList.remove("top");
    it.e.style.transform = "translate(" + (pt.x || 0).toFixed(1) + "px," + (pt.y || 0).toFixed(1) + "px)";
    it.e.style.display = pt.vis ? "" : "none";
  }
  var looping = false;
  function loop() {
    if (looping) return; looping = true;
    (function step() {
      var now = performance.now();
      items = items.filter(function (it) {
        if (now > it.until) { if (it.e.parentNode) it.e.parentNode.removeChild(it.e); return false }
        place(it); return true;
      });
      if (items.length) requestAnimationFrame(step); else looping = false;
    })();
  }
  function sprite(ch, x, h, y, anim, ms, opt) {
    opt = opt || {}; anim = anim || "pop"; ms = ms || 1400;
    var dx = opt.dx, dy = opt.dy;
    if (dx === undefined) dx = anim === "fly" ? (R() < 0.5 ? -1 : 1) * (160 + R() * 160) : anim === "run" ? (R() < 0.5 ? -1 : 1) * 160 : anim === "bounce" ? (R() - 0.5) * 120 : 0;
    if (dy === undefined) dy = anim === "fly" ? -120 - R() * 120 : 0;
    var e = document.createElement("div");
    e.className = "fxk-s " + anim + (opt.cls ? " " + opt.cls : "");
    e.innerHTML = '<span style="font-size:' + (opt.size || 34) + 'px;--dx:' + dx + 'px;--dy:' + dy + 'px;animation-duration:' + ms + 'ms;animation-delay:' + (opt.delay || 0) + 'ms">' + ch + '</span>';
    add(e, x, h, y, ms + (opt.delay || 0));
  }
  function bubble(text, x, y, h, ms) {
    if (lastBubble) { lastBubble.until = 0; if (lastBubble.e.parentNode) lastBubble.e.parentNode.removeChild(lastBubble.e) }
    var e = document.createElement("div");
    e.className = "fxk-b";
    e.innerHTML = '<div style="animation-duration:' + (ms || 2800) + 'ms">' + text + '</div>';
    lastBubble = add(e, x, h || 1.7, y, ms || 2800, true);
  }
  function flash(color) {
    var L = getLayer(); if (!L) return;
    var e = document.createElement("div"); e.className = "fxk-o"; e.style.background = color || "#fff";
    L.appendChild(e); setTimeout(function () { if (e.parentNode) e.parentNode.removeChild(e) }, 650);
  }
  // "그림:움직임:개수:크기:높이" → 그리기
  function effect(spec, o) {
    if (!spec) return;
    if (Array.isArray(spec)) { spec.forEach(function (s) { effect(s, o) }); return }
    if (typeof spec === "string") {
      var a = spec.split(":");
      spec = { e: a[0], a: a[1] || "pop", n: +a[2] || 1, size: +a[3] || 0, h: a[4] !== undefined && a[4] !== "" ? +a[4] : undefined };
    }
    var n = spec.n || 1;
    for (var k = 0; k < n; k++)
      sprite(pick(spec.e), o.x + (n > 1 ? (R() - 0.5) * 0.5 : 0), spec.h !== undefined ? spec.h : 0.9, o.y, spec.a || "pop", spec.ms || 1400,
             { size: spec.size || (n > 1 ? 24 : 34), dx: spec.dx, dy: spec.dy, cls: spec.cls, delay: (spec.delay || 0) + k * 110 });
  }

  // ---------- 효과음 (브라우저가 만드는 짧은 소리 · 작게) ----------
  var AC = null;
  function muted() { var A = api(); return S().fxSound === false || !!(A && A.muted && A.muted()) }
  function ac() {
    if (muted()) return null;
    try { AC = AC || new (window.AudioContext || window.webkitAudioContext)(); if (AC.state === "suspended") AC.resume() } catch (e) { AC = null }
    return AC;
  }
  function tone(f1, f2, dur, type, vol, delay) {
    var a = ac(); if (!a) return;
    var t = a.currentTime + (delay || 0), o = a.createOscillator(), g = a.createGain();
    o.type = type || "sine";
    o.frequency.setValueAtTime(f1, t); o.frequency.exponentialRampToValueAtTime(Math.max(30, f2), t + dur);
    g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(vol || 0.05, t + 0.01); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g); g.connect(a.destination); o.start(t); o.stop(t + dur + 0.05);
  }
  function noise(dur, vol, freq, delay, high) {
    var a = ac(); if (!a) return;
    var n = Math.floor(a.sampleRate * dur), buf = a.createBuffer(1, n, a.sampleRate), d = buf.getChannelData(0);
    for (var i = 0; i < n; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / n, 2);
    var s = a.createBufferSource(), g = a.createGain(), f = a.createBiquadFilter();
    f.type = high ? "highpass" : "lowpass"; f.frequency.value = freq || 900;
    s.buffer = buf; g.gain.value = vol || 0.05; s.connect(f); f.connect(g); g.connect(a.destination);
    s.start(a.currentTime + (delay || 0));
  }
  function notes(list, type, vol, gap, len) { list.forEach(function (f, k) { tone(f, f, len || 0.25, type || "triangle", vol || 0.035, k * (gap || 0.13)) }) }
  var SND = {
    pop:      function () { tone(500, 1200, 0.1, "sine", 0.045) },
    boing:    function () { tone(180, 520, 0.25, "sine", 0.05) },
    chime:    function () { tone(1046, 1046, 0.5, "sine", 0.03); tone(1568, 1568, 0.5, "sine", 0.02, 0.1) },
    ding:     function () { tone(1320, 1320, 1.1, "sine", 0.04); tone(1980, 1980, 0.8, "sine", 0.015) },
    coin:     function () { tone(2200, 2300, 0.12, "sine", 0.035); tone(2900, 3000, 0.15, "sine", 0.03, 0.08) },
    fanfare:  function () { notes([523, 659, 784, 1046], "square", 0.022, 0.12, 0.2) },
    tada:     function () { notes([784, 1046], "triangle", 0.04, 0.15, 0.4) },
    laugh:    function () { for (var k = 0; k < 4; k++) tone(420 - k * 25, 360 - k * 25, 0.1, "triangle", 0.04, k * 0.13) },
    knock:    function () { tone(180, 120, 0.07, "square", 0.04); tone(180, 120, 0.07, "square", 0.04, 0.18) },
    clang:    function () { tone(1900, 1500, 0.25, "square", 0.025); tone(2600, 2400, 0.2, "sine", 0.02) },
    hammer:   function () { for (var k = 0; k < 3; k++) { tone(1900, 1500, 0.2, "square", 0.022, k * 0.3); tone(2600, 2400, 0.15, "sine", 0.018, k * 0.3) } },
    creak:    function () { tone(160, 110, 0.5, "sawtooth", 0.02) },
    whoosh:   function () { noise(0.5, 0.05, 700) },
    splash:   function () { noise(0.45, 0.06, 2200) },
    plop:     function () { tone(700, 220, 0.12, "sine", 0.06) },
    bubble:   function () { for (var k = 0; k < 4; k++) tone(300 + R() * 300, 700 + R() * 400, 0.08, "sine", 0.035, k * 0.13) },
    drip:     function () { tone(1200, 400, 0.12, "sine", 0.04); tone(1100, 380, 0.12, "sine", 0.03, 0.6) },
    hiss:     function () { noise(0.7, 0.04, 5000, 0, 1) },
    page:     function () { noise(0.15, 0.03, 2500, 0, 1); noise(0.12, 0.025, 2500, 0.18, 1) },
    click:    function () { tone(1800, 1200, 0.03, "square", 0.03) },
    tick:     function () { for (var k = 0; k < 4; k++) tone(1600, 1500, 0.02, "square", 0.025, k * 0.5) },
    bell:     function () { notes([659, 523, 587, 392], "sine", 0.04, 0.42, 0.5); notes([392, 587, 659, 523], "sine", 0.04, 0.42, 0.5) },
    piano:    function () { notes([523, 587, 659, 698, 784], "triangle", 0.035, 0.14, 0.3) },
    whistle:  function () { tone(1400, 2400, 0.35, "sine", 0.035) },
    sparrow:  function () { for (var k = 0; k < 4; k++) tone(3200, 4200, 0.04, "sine", 0.025, k * 0.08) },
    bird:     function () { tone(2400, 3200, 0.1, "sine", 0.03); tone(2600, 3600, 0.12, "sine", 0.03, 0.15) },
    hoot:     function () { tone(380, 360, 0.35, "sine", 0.05); tone(380, 340, 0.5, "sine", 0.05, 0.45) },
    meow:     function () { tone(500, 900, 0.18, "triangle", 0.04); tone(900, 420, 0.35, "triangle", 0.04, 0.17) },
    moo:      function () { tone(140, 110, 0.9, "sawtooth", 0.025) },
    neigh:    function () { for (var k = 0; k < 5; k++) tone(700 - k * 60, 600 - k * 60, 0.09, "sawtooth", 0.02, k * 0.08) },
    frog:     function () { tone(220, 160, 0.12, "square", 0.03); tone(240, 170, 0.12, "square", 0.03, 0.2) },
    beep:     function () { tone(1200, 1200, 0.08, "square", 0.025); tone(1600, 1600, 0.08, "square", 0.025, 0.12) },
    boop:     function () { notes([880, 660, 990], "square", 0.022, 0.1, 0.08) },
    whir:     function () { tone(200, 600, 0.6, "sawtooth", 0.018); tone(600, 300, 0.4, "sawtooth", 0.015, 0.6) },
    zap:      function () { tone(2400, 300, 0.25, "sawtooth", 0.03); noise(0.2, 0.03, 4000, 0, 1) },
    hum:      function () { tone(110, 112, 1.0, "sawtooth", 0.02) },
    ping:     function () { tone(1500, 1480, 0.9, "sine", 0.04) },
    sonar:    function () { tone(1500, 1480, 0.9, "sine", 0.04); tone(1500, 1480, 0.7, "sine", 0.015, 0.9) },
    launch:   function () { noise(1.2, 0.06, 500); tone(80, 300, 1.2, "sawtooth", 0.02) },
    heart:    function () { tone(70, 50, 0.12, "sine", 0.12); tone(70, 50, 0.12, "sine", 0.1, 0.22) },
    gurgle:   function () { for (var k = 0; k < 5; k++) tone(120 + R() * 140, 60 + R() * 80, 0.12, "sine", 0.05, k * 0.1) },
    sneeze:   function () { tone(600, 900, 0.25, "triangle", 0.03); noise(0.35, 0.07, 3000, 0.3) },
    wave:     function () { noise(1.4, 0.04, 600) },
    cheer:    function () { noise(0.9, 0.03, 1800); notes([784, 988], "triangle", 0.02, 0.2, 0.3) },
    drum:     function () { tone(110, 55, 0.5, "sine", 0.12); noise(0.08, 0.04, 300) },
    lyre:     function () { notes([392, 494, 587, 784], "triangle", 0.035, 0.11, 0.6) },
    horn:     function () { tone(220, 222, 0.8, "sawtooth", 0.025); tone(330, 332, 0.8, "sawtooth", 0.015) },
    magic:    function () { notes([1046, 1318, 1568, 2093], "sine", 0.025, 0.07, 0.4) },
    sad:      function () { notes([392, 370, 349, 330], "triangle", 0.03, 0.22, 0.3) },
    squeak:   function () { for (var k = 0; k < 3; k++) tone(2400, 3000, 0.05, "sine", 0.02, k * 0.09) },
    caw:      function () { tone(900, 500, 0.18, "sawtooth", 0.03); tone(880, 480, 0.2, "sawtooth", 0.03, 0.28) }
  };
  function play(names) { if (!names) return; (Array.isArray(names) ? names : [names]).forEach(function (n) { if (SND[n]) SND[n]() }) }

  // ---------- 반응 목록 만들기 ----------
  var K = { sprite: sprite, bubble: bubble, effect: effect, flash: flash, play: play, snd: SND, pick: pick, R: R, tone: tone, noise: noise };
  K.say = function (o, text, h) { bubble(pick(text), o.x, o.y, h || o.bh || 1.7) };
  function define(table) {
    var out = {};
    Object.keys(table).forEach(function (name) {
      var d = table[name];
      out[name] = { r: d.r || 1.3, cool: d.cool || 20, p: d.p, typeCool: d.typeCool,
        fn: function (a, o) {
          o.bh = d.h;
          if (d.f) { d.f(K, o); return }
          play(d.s); effect(d.e, o);
          if (d.t) K.say(o, d.t, d.h);
        } };
    });
    return out;
  }
  // 가끔 저절로 일어나는 일 : FXKIT.ambient({ 방이름: function (K, 주인공) {…} }, 최소초, 최대초)
  function ambient(map, minS, maxS) {
    var next = performance.now() + (minS || 30) * 1000;
    setInterval(function () {
      var A = api(); if (!A || A.busy() || S().fun === false) return;
      var now = performance.now(); if (now < next) return;
      next = now + ((minS || 30) + R() * ((maxS || 60) - (minS || 30))) * 1000;
      var fn = map[A.room()] || map["*"]; if (fn) fn(K, A.player());
    }, 1000);
  }
  K.define = define; K.ambient = ambient;
  window.FXKIT = K;
})();
