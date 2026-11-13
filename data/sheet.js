// ===================================================================
//  구글 스프레드시트에서 문제 가져오기  (기계 부분 — 고치지 않아도 됩니다)
//
//  * 시트 주소 · 시트 이름은 data/quiz.js 맨 위에서 고치세요.
//  * 이 파일은 시트를 읽어 window.QUIZ 를 만든 뒤 game.js 를 실행합니다.
//  * 시트를 못 읽으면 data/quiz.js 안의 예비 문제로 그냥 시작합니다.
// ===================================================================
(function () {
  "use strict";

  var VER      = "69";   // game.js 를 불러올 때 붙는 번호 (index.html 의 v=60 와 맞추세요 · 고칠 때마다 함께 올립니다)
  var C        = window.SHEET_CONFIG || {};
  var BACKUP   = (window.QUIZ || []).slice();      // quiz.js 에 적어 둔 예비 문제
  var MAX      = 20;                               // 게임이 놓을 수 있는 최대 문제 수
  var booted   = false;

  var DEBUG = C.debug === true;     // data/quiz.js 의 SHEET_CONFIG.debug
  function say(){ try { console.log.apply(console, ["[문제 불러오기]"].concat([].slice.call(arguments))) } catch (e) {} }
  // 시트 주소·문제·정답처럼 학생이 보면 안 되는 것은 debug 를 켰을 때만 찍습니다
  function dbg(){ if (DEBUG) say.apply(null, arguments) }

  // ---------- 불러오는 중 화면 ----------
  var veil = null;
  function showLoading(msg){
    if (!veil) {
      veil = document.createElement("div");
      veil.id = "loading";
      veil.innerHTML = '<div class="lbox"><div class="lspin"></div>' +
                       '<div class="ltx" id="loadMsg"></div>' +
                       '<div class="lsub">구글 스프레드시트에서 문제를 받아오고 있습니다</div></div>';
      document.body.appendChild(veil);
    }
    var t = document.getElementById("loadMsg");
    if (t) t.textContent = msg;
  }
  function hideLoading(){ if (veil && veil.parentNode) veil.parentNode.removeChild(veil); veil = null }

  // ---------- 게임 시작 ----------
  function boot(list, source, notice){
    if (booted) return;
    booted = true;
    if (list && list.length) window.QUIZ = list.slice(0, MAX);
    window.QUIZ_SOURCE = source;
    window.QUIZ_NOTICE = notice || "";
    hideLoading();
    // 한 파일짜리 미리보기처럼 game.js 가 이미 페이지 안에 들어 있으면 그것을 실행합니다
    if (typeof window.__runGame === "function") { window.__runGame(); return }
    var s = document.createElement("script");
    s.src = "game.js?v=" + VER;
    s.onerror = function(){ alert("game.js 를 불러오지 못했습니다. 파일이 같은 폴더에 있는지 확인하세요.") };
    document.body.appendChild(s);
  }
  function useBackup(why){
    setDone = true;                       // 실패한 상황이므로 설정 시트는 건너뜁니다
    say("시트를 쓰지 못했습니다:", why);
    boot(BACKUP, "예비 문제(quiz.js)",
         "⚠ 구글 시트를 불러오지 못해 예비 문제로 진행합니다. (" + why + ")");
  }

  // ---------- 시트 주소에서 문서 번호 뽑기 ----------
  function sheetId(u){
    var s = String(u || "").trim();
    if (!s) return "";
    if (/\/spreadsheets\/d\/e\//.test(s)) return "PUBLISHED";   // '웹에 게시' 주소는 못 씀
    var m = s.match(/\/spreadsheets\/d\/([A-Za-z0-9_\-]+)/);
    if (m) return m[1];
    m = s.match(/[?&]id=([A-Za-z0-9_\-]+)/);
    if (m) return m[1];
    if (/^[A-Za-z0-9_\-]{20,}$/.test(s)) return s;              // 문서 번호만 적은 경우
    return "";
  }

  // ---------- 글자 다듬기 ----------
  function key(s){ return String(s == null ? "" : s).replace(/[\s\u00a0]/g, "").toLowerCase() }
  function half(s){ return String(s).replace(/[０-９]/g, function(c){ return String.fromCharCode(c.charCodeAt(0) - 0xFEE0) }) }
  function cellText(c){
    if (!c) return "";
    if (typeof c.v === "boolean") return c.v ? "TRUE" : "FALSE";
    if (c.f !== undefined && c.f !== null && String(c.f) !== "") return String(c.f).trim();
    if (c.v === undefined || c.v === null) return "";
    return String(c.v).trim();
  }

  // ---------- 어느 칸이 무엇인지 찾기 ----------
  function findCols(labels){
    var col = { q: -1, a: -1, opt: [], hint: -1, exp: -1, img: -1, cat: -1, npc: [], type: -1 },
        tmp = [], ntmp = [];
    labels.forEach(function (L, i) {
      var k = key(L), m;
      if (!k) return;
      // NPC대화1 · NPC대화2 · 도우미대사3 … (문제마다 따라붙는 추가 대사)
      if (k.indexOf("npc") >= 0 || k.indexOf("대화") >= 0 || k.indexOf("대사") >= 0) {
        m = k.match(/([1-9])/);
        ntmp.push({ n: m ? +m[1] : 90 + ntmp.length, i: i });
        return;
      }
      if (col.type < 0 && (k.indexOf("유형") >= 0 || k.indexOf("종류") >= 0 || k.indexOf("타입") >= 0)) {
        col.type = i; return;                      // 일반 / 모둠
      }
      m = k.match(/^([1-9])번?보기$/) || k.match(/^보기([1-9])$/) || k.match(/^([1-9])번?선택지$/);
      if (m) { tmp.push({ n: +m[1], i: i }); return }
      if (k.indexOf("보기") >= 0 || k.indexOf("선택지") >= 0) { tmp.push({ n: 90 + tmp.length, i: i }); return }
      if (col.q < 0 && k.indexOf("번호") < 0 && (k.indexOf("문제") >= 0 || k.indexOf("질문") >= 0)) { col.q = i; return }
      if (col.a < 0 && (k.indexOf("정답") >= 0 || k === "답")) { col.a = i; return }
      if (col.hint < 0 && k.indexOf("힌트") >= 0) { col.hint = i; return }
      if (col.exp < 0 && (k.indexOf("해설") >= 0 || k.indexOf("설명") >= 0)) { col.exp = i; return }
      if (col.img < 0 && (k.indexOf("이미지") >= 0 || k.indexOf("그림") >= 0 || k.indexOf("사진") >= 0)) { col.img = i; return }
      if (col.cat < 0 && (k.indexOf("분류") >= 0 || k.indexOf("과목") >= 0 || k.indexOf("영역") >= 0)) { col.cat = i; return }
    });
    tmp.sort(function (a, b){ return a.n - b.n });
    col.opt = tmp.map(function (o){ return o.i });
    ntmp.sort(function (a, b){ return a.n - b.n });
    col.npc = ntmp.map(function (o){ return o.i });
    // 제목 줄을 못 알아보면 A·B·C… 순서대로 쓴 것으로 봅니다
    if (col.q < 0 || col.opt.length < 2) {
      col = { q: 1, a: 2, opt: [3, 4, 5, 6, 7], hint: 8, exp: -1, img: 9, cat: -1, npc: [10, 11, 12], type: 0 };
      say("제목 줄을 못 알아봐서 A=문제유형, B=문제, C=정답, D~H=보기, I=힌트, J=이미지, K~M=NPC대화 순서로 읽습니다.");
    }
    return col;
  }

  // ---------- 여러 개 고르는 문제 ( 정답에 "14" 처럼 숫자가 2개 이상 ) ----------
  //  · 보기 글자가 그 숫자와 똑같으면(보기에 "14" 가 있으면) 그건 그냥 한 개짜리 정답입니다.
  function multiAnswer(raw, opts){
    var s = half(String(raw == null ? "" : raw).trim()).replace(/[\s,·\-+/]/g, "");
    if (!/^[1-9]{2,}$/.test(s)) return null;
    for (var t = 0; t < opts.length; t++) if (key(opts[t]) === key(raw)) return null;  // 보기 글자와 같으면 제외
    var out = [];
    for (var i = 0; i < s.length; i++) {
      var n = +s.charAt(i);
      if (n < 1 || n > opts.length) return null;      // 보기 번호 밖이면 여러 개 고르기가 아닙니다
      if (out.indexOf(n - 1) < 0) out.push(n - 1);
    }
    return out.length >= 2 ? out.sort(function (a, b){ return a - b }) : null;
  }

  // ---------- 정답 칸 읽기 (1,2,3… / ①②③ / 보기 글자 / 가나다 / ABC) ----------
  var CIRCLE = "①②③④⑤⑥⑦⑧⑨";
  function answerIndex(raw, opts){
    var s = String(raw == null ? "" : raw).trim();
    if (!s) return -1;
    var ci = CIRCLE.indexOf(s.charAt(0));
    if (ci >= 0 && ci < opts.length) return ci;
    var m = half(s).match(/^\s*([0-9]+)/);
    if (m) {
      var n = parseInt(m[1], 10);
      if (n >= 1 && n <= opts.length) return n - 1;
    }
    var t = key(s);
    for (var i = 0; i < opts.length; i++) if (key(opts[i]) === t) return i;
    var idx = ["가","나","다","라","마"].indexOf(t);
    if (idx < 0) idx = ["a","b","c","d","e"].indexOf(t);
    if (idx >= 0 && idx < opts.length) return idx;
    return -1;
  }

  // ---------- 주관식 정답 칸 읽기 ( "백두산" 또는 "백두산/백두산봉" 처럼 여러 개 ) ----------
  function splitAnswers(raw){
    var s = String(raw == null ? "" : raw).trim();
    if (!s) return [];
    return s.split(/[\/|]|\s+또는\s+/)
            .map(function (v){ return v.trim() })
            .filter(function (v){ return v !== "" });
  }

  // ---------- 이미지 주소 다듬기 ----------
  function imageUrl(raw){
    var s = String(raw == null ? "" : raw).trim();
    if (!s) return "";
    var f = s.match(/^=?\s*IMAGE\s*\(\s*["']([^"']+)["']/i);          // =IMAGE("...") 함수
    if (f) s = f[1];
    if (s.indexOf("drive.google.com") >= 0) {                          // 구글 드라이브 공유 주소
      var d = s.match(/\/file\/d\/([A-Za-z0-9_\-]+)/) || s.match(/[?&]id=([A-Za-z0-9_\-]+)/);
      if (d) return "https://drive.google.com/thumbnail?id=" + d[1] + "&sz=w1000";
    }
    if (/^https?:\/\//i.test(s)) return s;
    if (/\.(png|jpe?g|gif|webp|svg)$/i.test(s)) return s;               // 폴더 안 파일 이름
    return "";
  }

  // ---------- CSV 읽기 (구글이 칸을 숫자로 바꿔 버리지 않는 방식) ----------
  function parseCsv(text){
    var s = String(text || ""), rows = [], row = [], cur = "", inQ = false, i = 0;
    if (s.charCodeAt(0) === 0xFEFF) s = s.slice(1);
    while (i < s.length) {
      var ch = s.charAt(i);
      if (inQ) {
        if (ch === '"') {
          if (s.charAt(i + 1) === '"') { cur += '"'; i += 2; continue }
          inQ = false; i++; continue;
        }
        cur += ch; i++; continue;
      }
      if (ch === '"') { inQ = true; i++; continue }
      if (ch === ",")  { row.push(cur); cur = ""; i++; continue }
      if (ch === "\r") { i++; continue }
      if (ch === "\n") { row.push(cur); rows.push(row); row = []; cur = ""; i++; continue }
      cur += ch; i++;
    }
    if (cur !== "" || row.length) { row.push(cur); rows.push(row) }
    return rows;
  }
  function fromCsv(text){
    var s = String(text || "");
    if (/^\s*<(!doctype|html)/i.test(s)) return null;      // 오류 안내 쪽이 온 경우
    var all = parseCsv(s).filter(function (r){ return r.some(function (v){ return String(v).trim() !== "" }) });
    if (all.length < 2) return null;
    return { labels: all[0].map(function (v){ return String(v).trim() }), rows: all.slice(1) };
  }
  function fromGviz(table){
    var labels = (table.cols || []).map(function (c){ return c.label || "" });
    var rows   = (table.rows || []).map(function (r){ return ((r && r.c) || []).map(cellText) });
    // 제목 줄이 데이터 첫 줄로 넘어온 경우
    if (!labels.some(function (L){ return key(L) !== "" }) && rows.length) {
      labels = rows[0]; rows = rows.slice(1);
    }
    return { labels: labels, rows: rows };
  }

  // ---------- 시트 한 장을 문제 목록으로 ----------
  function txt(v){ return String(v == null ? "" : v).trim() }
  function toQuiz(labels, rows){
    var col = findCols(labels), out = [], skipped = [], needText = 0;

    rows.forEach(function (c, ri) {
      var q = txt(c[col.q]);
      if (!q) return;                                        // 빈 줄은 건너뜀
      if (C.stripNumbers !== false) q = q.replace(/^\s*\d{1,2}\s*[.)．]\s+/, "");

      var opts = [];
      col.opt.forEach(function (i){ var v = txt(c[i]); if (v !== "") opts.push(v) });
      var line = "시트 " + (ri + 2) + "번째 줄";
      var raw = txt(c[col.a]);

      // H '힌트' 칸은 정답을 맞혔을 때 보여 줄 내용입니다 ('해설' 칸을 따로 두면 그쪽이 우선)
      var hint = col.hint >= 0 ? txt(c[col.hint]) : "";
      var exp  = col.exp  >= 0 ? txt(c[col.exp])  : "";
      var img  = col.img  >= 0 ? imageUrl(txt(c[col.img])) : "";
      if (!img && C.imageFolder) img = C.imageFolder + (out.length + 1) + ".png";

      // 이 문제를 못 푼 동안에만 같은 방 NPC 가 섞어서 말해 주는 대사
      var npc = [];
      col.npc.forEach(function (i){ var v = txt(c[i]); if (v !== "") npc.push(v) });

      // A열 문제유형 : '모둠' 이면 문제와 보기를 인원수만큼 나눠 보여 줍니다
      var kind = col.type >= 0 ? key(c[col.type]) : "";
      var team = /모둠|모듬|조별|협동|함께|팀/.test(kind);

      // ── 보기가 없으면 주관식(직접 입력) 문제로 만듭니다 ──
      if (opts.length < 2) {
        var answers = (opts.length === 1 && /^[1-9]$/.test(raw)) ? [opts[0]] : splitAnswers(raw);
        if (!answers.length) {
          skipped.push(line + ": 보기도 정답도 없음");
          if (q) needText++;          // 문제는 있는데 정답 칸이 비어 보이는 줄
          return;
        }
        out.push({
          id: out.length + 1,
          category: (col.cat >= 0 ? txt(c[col.cat]) : "") || "오늘 공부",
          question: q,
          type: "text",                 // 주관식
          options: [],
          answer: 0,
          answers: answers,             // 허용하는 정답들 ( / 로 여러 개 )
          answerText: answers[0],
          team: team,
          explanation: exp || hint || "",
          npc: npc,
          image: img
        });
        return;
      }

      var multi = multiAnswer(raw, opts);              // "14" → 1번과 4번을 모두 골라야 함
      var ai = multi ? multi[0] : answerIndex(raw, opts);
      if (ai < 0) { skipped.push(line + ": 정답 칸을 알아볼 수 없음"); return }

      out.push({
        id: out.length + 1,
        category: (col.cat >= 0 ? txt(c[col.cat]) : "") || "오늘 공부",
        question: q,
        options: opts,
        answer: ai,
        multi: multi,                                   // 여러 개 고르는 문제면 정답 번호들
        team: team,
        explanation: exp || hint || "",
        npc: npc,
        image: img
      });
    });

    if (skipped.length) say("건너뛴 줄:\n· " + skipped.join("\n· "));
    return { list: out, skipped: skipped.length, needText: needText };
  }

  // ---------- 주소창 ? 뒤에 적힌 시트 읽기 ----------
  //  index.html?<시트 주소>              ← 시트 주소를 통째로 붙여 넣기
  //  index.html?<문서 번호>              ← 주소 가운데 긴 번호만 붙여 넣기
  //  index.html?url=<시트 주소>&sheet=문제
  //  아무것도 없으면 아래 quiz.js 의 기본 시트를 씁니다.
  function fromAddress(){
    var out = { url: "", sheet: "", gid: "" }, m;
    var loc = (typeof location === "undefined") ? {} : location;
    var raw = String(loc.search || "").replace(/^\?/, "");
    if (raw) { try { raw = decodeURIComponent(raw) } catch (e) {} }
    var all = raw + "&" + String(loc.hash || "").replace(/^#/, "");
    var first = raw.split("&")[0].replace(/^(?:id|s)=/i, "");
    if ((m = raw.match(/(?:^|[?&=])((?:https?:\/\/)?docs\.google\.com\/spreadsheets\/[^\s&]+)/i))) out.url = m[1];
    else if ((m = raw.match(/(?:^|[?&])(?:url|link|sheeturl|문서)=([^&]+)/i)))                     out.url = m[1];
    else if (first.length >= 20 && first.indexOf("=") < 0)                                        out.url = first;
    if ((m = all.match(/(?:^|[?&])(?:sheet|tab|시트)=([^&#\s]+)/)))  out.sheet = m[1];
    if ((m = all.match(/(?:^|[?&#])gid=([0-9]+)/)))                  out.gid = m[1];
    return out;
  }

  // ---------- 주소 감추기 ----------
  //  규칙 : 시트 주소(문서 번호) 맨 뒤에 아무 글자 하나를 더 붙여서 보냅니다.
  //         게임은 맨 뒤 한 글자를 떼어내고 읽습니다.
  //  예)  ?11TG3zCMa1YdzLaIsujCA_kQ2_fWLFf3FNRDUI-y13Bw  + Q
  //   →   ?11TG3zCMa1YdzLaIsujCA_kQ2_fWLFf3FNRDUI-y13BwQ
  //  * 글자를 안 붙이고 그대로 보내도 됩니다. 둘 다 해 보고 되는 쪽을 씁니다.
  function cutLast(v){ return String(v || "").slice(0, -1) }

  // ---------- 구글에 문제 요청하기 (JSONP 방식이라 파일로 열어도 됩니다) ----------
  var ADDR      = fromAddress();
  var FROM_ADDR = !!ADDR.url;
  var NAME      = String(ADDR.sheet || C.sheet || "").trim();
  var DEF_ID    = sheetId(C.url);
  var asked = 0, step = 0;

  // 맨 뒤 글자를 뗀 것과 그대로인 것, 둘 다 후보로 두고 차례로 시도합니다
  var IDS = [];
  (function () {
    if (!FROM_ADDR) { IDS = [DEF_ID]; return }
    var raw = ADDR.url;
    var plain = sheetId(raw);
    var looksUrl = /docs\.google\.com|\//.test(raw);
    var cut = looksUrl ? sheetId(cutLast(plain)) : sheetId(cutLast(raw));
    var order = looksUrl ? [plain, cut]        // 주소를 통째로 붙였으면 그것부터
                         : [cut, plain];       // 문서 번호만 붙였으면 한 글자 뗀 쪽부터
    order.forEach(function (v){
      if (v && v !== "PUBLISHED" && IDS.indexOf(v) < 0) IDS.push(v);
    });
    if (!IDS.length && plain === "PUBLISHED") IDS.push("PUBLISHED");
    dbg("주소에서 찾은 문서 후보:", IDS.join(" → "));
  })();
  var ID = IDS[0] || sheetId(C.url);

  // 시도할 순서 : (주소의 gid 탭 → 시트 이름 → 첫 번째 탭) → 기본 시트도 같은 순서로
  function planFor(id, name, gid, strictGid){
    var a = [];
    if (!id || id === "PUBLISHED") return a;
    if (gid)  a.push({ id: id, gid: gid, strictOnly: !!strictGid });   // 설정의 gid 탭은 '문제 시트처럼 생겼을 때만' 씁니다
    if (name) a.push({ id: id, sheet: name });
    if (C.firstTabFallback !== false) a.push({ id: id });              // false 면 맨 앞 탭(다른 단원 문제일 수 있음)은 읽지 않습니다
    return a;
  }
  var PLAN = [];
  var CFG_GID = FROM_ADDR ? "" : String(C.sheetGid || "").trim();
  IDS.forEach(function (one){ PLAN = PLAN.concat(planFor(one, NAME, ADDR.gid || CFG_GID, !ADDR.gid && !!CFG_GID)) });
  if (FROM_ADDR && DEF_ID && IDS.indexOf(DEF_ID) < 0) {
    PLAN = PLAN.concat(planFor(DEF_ID, String(C.sheet || "").trim(), ""));
  }

  function nextWay(why){
    if (step + 1 >= PLAN.length) return false;
    step++;
    say(why + " → 다음 방법으로 다시 시도합니다.");
    ask();
    return true;
  }

  function base(way){
    return "https://docs.google.com/spreadsheets/d/" + way.id + "/gviz/tq?";
  }
  // 구글이 예전 결과를 잠시 기억해 두었다가 돌려주지 않도록, 요청마다 질의(tq)를 조금씩 다르게 보냅니다
  //  (select * limit 아주 큰 수 → 내용은 그대로, 새로고침하면 바로 바뀐 시트를 받아 옵니다)
  function fresh(){ return "&tq=" + encodeURIComponent("select * limit " + (100000000 + (Date.now() % 100000000))) }
  function tail(way){
    var u = fresh() + "&_=" + Date.now();
    if (way.gid)        u += "&gid=" + encodeURIComponent(way.gid);
    else if (way.sheet) u += "&sheet=" + encodeURIComponent(way.sheet);
    return u;
  }

  // 원본 내려받기 주소 : 구글이 칸 값을 손대지 않고 그대로 내보냅니다.
  //  (gviz 쪽은 숫자와 글자가 섞인 칸을 '숫자 칸' 으로 보고 글자를 빈칸으로 만들어 버립니다)
  //  탭은 gid 로만 고를 수 있어서, gid 를 모르면 맨 앞 탭을 가져옵니다.
  function exportUrl(way){
    var u = "https://docs.google.com/spreadsheets/d/" + way.id + "/export?format=csv&_=" + Date.now();
    var g = way.gid || String(C.sheetGid || "").trim();
    if (g) u += "&gid=" + encodeURIComponent(g);
    return u;
  }
  // 받아 온 것이 정말 '문제 시트' 인지 확인합니다 (엉뚱한 탭을 문제로 오해하지 않게)
  function looksLikeQuiz(labels){
    var q = false, a = false;
    (labels || []).forEach(function (L) {
      var k = key(L);
      if (!k) return;
      if (k.indexOf("번호") < 0 && (k.indexOf("문제") >= 0 || k.indexOf("질문") >= 0)) q = true;
      if (k.indexOf("정답") >= 0 || k === "답" || k.indexOf("보기") >= 0) a = true;
    });
    return q && a;
  }

  // CSV 한 번 받아 보기. strict 면 제목 줄이 문제 시트처럼 생겼을 때만 씁니다.
  function tryCsv(url, strict, label, ms, onDone, onFail){
    var done = false, httpFail = 0;
    var timer = setTimeout(function(){ if (!done) { done = true; say(label + " 응답이 늦습니다."); onFail(0) } }, ms);
    try {
      fetch(url, { credentials: "omit", cache: "no-store" })
        .then(function (res){
          if (!res.ok) { httpFail = res.status; return Promise.reject(new Error("HTTP " + res.status)) }
          return res.text();
        })
        .then(function (text){
          if (done) return; done = true; clearTimeout(timer);
          var t = fromCsv(text);
          if (t && (!strict || looksLikeQuiz(t.labels))) {
            var r = toQuiz(t.labels, t.rows);
            if (r && r.list.length) { say(label + " 로 읽었습니다."); onDone(r); return }
          }
          onFail(0);
        })
        .catch(function (e){
          if (done) return; done = true; clearTimeout(timer);
          say(label + " 로는 못 받았습니다(" + (e && e.message ? e.message : e) + ").");
          onFail(httpFail);
        });
    } catch (e) {
      if (!done) { done = true; clearTimeout(timer); onFail(0) }
    }
  }

  // ① 원본 CSV → ② gviz CSV → ③ JSONP 순서로 시도합니다
  function ask(){
    var way = PLAN[step] || {};
    if (!way.id) { useBackup("문제 탭을 찾지 못함"); return }
    if (typeof fetch !== "function") { if (way.strictOnly && nextWay("gid 탭 건너뜀")) return; askJson(way); return }
    // 이름으로 고른 탭은 '원본 내려받기'로 고를 수 없어서(맨 앞 탭이 옴) 건너뜁니다
    var first = (way.sheet && !way.gid)
      ? function (ok, fail){ fail() }
      : function (ok, fail){ tryCsv(exportUrl(way), true, "원본 CSV", 6000, ok, fail) };
    first(finishLoad, function () {
      tryCsv(base(way) + "tqx=out:csv" + tail(way), !!way.strictOnly, "CSV", 7000, finishLoad, function (httpFail) {
        if (way.strictOnly) { if (nextWay("gid 탭이 문제 시트가 아님")) return; useBackup("문제 탭을 찾지 못함"); return }
        if (httpFail) {                                  // 그런 문서·탭이 없음 → 다음 후보로
          say("시트를 찾지 못했습니다(" + httpFail + "). 다음 후보로 넘어갑니다.");
          if (nextWay("문서를 찾지 못함")) return;
        }
        askJson(way);
      });
    });
  }

  // ② CSV 가 막히면 JSONP 로 받습니다 (파일로 열어도 동작하는 방식)
  var best = null, retried = false;
  function askJson(way, noHeader){
    var cb = "__quizCB" + (++asked) + "_" + (Date.now() % 100000);
    var url = base(way) + "tqx=out:json;responseHandler:" + cb +
              (noHeader ? "&headers=0" : "&headers=1") + tail(way);

    var tag = document.createElement("script"), done = false;
    function cleanup(){
      try { delete window[cb] } catch (e) { window[cb] = undefined }
      if (tag.parentNode) tag.parentNode.removeChild(tag);
    }
    var timer = setTimeout(function () {
      if (done) return; done = true; cleanup();
      if (best) { finishLoad(best); return }
      useBackup("인터넷이 느리거나 연결되지 않음");
    }, 15000);

    window[cb] = function (res) {
      if (done) return; done = true;
      clearTimeout(timer); cleanup();
      handle(res, way, noHeader);
    };
    tag.onerror = function () {
      if (done) return; done = true;
      clearTimeout(timer); cleanup();
      if (best) { finishLoad(best); return }
      useBackup("시트에 연결하지 못함");
    };
    tag.src = url;
    document.head.appendChild(tag);
  }

  function handle(res, way, noHeader){
    if (!res || res.status === "error" || !res.table) {
      var why = "시트를 읽을 수 없음";
      try { why = res.errors[0].detailed_message || res.errors[0].message || why } catch (e) {}
      why = String(why).replace(/<[^>]*>/g, "").trim();
      if (best) { finishLoad(best); return }
      if (nextWay("시트를 못 찾음")) return;
      if (/access|permission|권한|비공개/i.test(why)) {
        useBackup("시트 공유 설정을 '링크가 있는 모든 사용자 — 뷰어'로 바꿔 주세요");
      } else {
        useBackup(why);
      }
      return;
    }
    var t = fromGviz(res.table);
    var r = toQuiz(t.labels, t.rows);
    if (!best || r.list.length > best.list.length) best = r;
    // 글자로 적은 정답(주관식)을 구글이 빈칸으로 넘겨 준 경우 → 방식을 바꿔 한 번 더
    if (r.needText && !retried) {
      retried = true;
      say("정답 칸을 글자로 읽지 못한 줄이 있어 다른 방식으로 한 번 더 받아 봅니다.");
      askJson(way || (PLAN[step] || {}), !noHeader);
      return;
    }
    if (!best.list.length) {
      if (nextWay("쓸 수 있는 문제가 없음")) return;
      useBackup("시트에서 쓸 수 있는 문제를 찾지 못함");
      return;
    }
    finishLoad(best);
  }
  // ---------- 설정 시트 ( A열 항목 / B열 값 ) ----------
  var setDone = false;
  // 관리자용 이름 (이 파일 안에만 두고 밖으로 내보내지 않습니다).
  // 설정 시트의 '관리자 …' 항목이 비어 있거나 시트를 못 읽으면 아래 기본값을 씁니다.
  var ADMIN_PW = "sciencelove.";
  var USED_ID  = "";        // 실제로 문제를 읽어 온 문서 번호
  function applySettings(rows){
    var C2 = window.QUIZ_CONFIG = window.QUIZ_CONFIG || {};
    var S  = window.SETTINGS = window.SETTINGS || {};
    var used = [];
    rows.forEach(function (r) {
      var raw = txt(r[0]), k = key(raw);
      if (!k) return;
      if (/^[*#]|^\/\//.test(raw)) return;          // * 나 # 로 시작하는 줄은 설명입니다
      // B열부터 오른쪽 칸을 모두 이어 붙여 한 문장으로 만듭니다 (나눠 적어도 됩니다)
      var parts = [];
      for (var i = 1; i < r.length; i++) { var one = txt(r[i]); if (one) parts.push(one) }
      var v = parts.join(" ").trim();
      if (!v) return;
      // 재미 효과 (Y / N · 없으면 Y) : 가까이 가면 반응하는 물건  /  효과음 (Y / N) : 그때 나는 소리
      if (/^재미/.test(k)) { S.fun = !/^(n|no|아니|x|0|끔|없)/i.test(String(v).trim()); used.push("재미 효과 " + (S.fun ? "Y" : "N")); return }
      if (/^(효과음|소리)/.test(k)) { S.fxSound = !/^(n|no|아니|x|0|끔|없)/i.test(String(v).trim()); used.push("효과음 " + (S.fxSound ? "Y" : "N")); return }
      // 방 수 : 탈출문에서 가까운 '문제가 있는 방' 을 몇 개까지 열지 (비우면 모든 방)
      if (/^방(수|개수|의수|갯수)$|^rooms?$/.test(k)) {
        var rn = parseInt(String(v).replace(/[^0-9]/g, ""), 10);
        if (rn > 0) { S.rooms = rn; used.push("방 수 " + rn) }
        return;
      }
      // NPC 문제 (Y / N · 없으면 N) : 일반 문제를 같은 곳 NPC 가 말로 알려 줍니다
      // ※ '문제' 가 들어간 다른 항목(최종 문제 · 다시 푸는 문제 수)보다 먼저 검사해야 합니다
      if (/npc|엔피씨/.test(k) && /문제|출제|질문/.test(k)) {
        S.npcQuiz = /^(y|예|네|참|t|1|응|켜|on)/i.test(v);
        used.push("NPC 문제 " + (S.npcQuiz ? "함(Y)" : "안 함(N)"));
        return;
      }
      if (/모둠|모듬|조별|협동|여럿|함께/.test(k)) {          // 모둠 활동인가? (Y / N)
        S.team = /^(y|예|네|o|참|t|1|응)/i.test(v);
        used.push("모둠 활동 " + (S.team ? "함(Y)" : "안 함(N)"));
        return;
      }
      if (/좀비|몬스터|zombie/.test(k)) {                    // 좀비가 나오는가? (Y / N, 비워 두면 N)
        S.zombie = /^(y|예|네|o|참|t|1|응)/i.test(v);
        used.push("좀비 " + (S.zombie ? "나옴(Y)" : "안 나옴(N)"));
        return;
      }
      if (/관리자|선생님|교사/.test(k)) { ADMIN_PW = v; used.push("관리자 이름"); return }
      if (/다시|되돌|복구/.test(k) && /문제|개수|갯수|수$/.test(k)) {     // 틀렸을 때 다시 푸는 문제 수
        var num = String(v).match(/\d+/);
        if (num) { C2.resetOnWrong = Math.max(0, Math.min(20, +num[0])); used.push("다시 푸는 문제 수 " + C2.resetOnWrong) }
        return;
      }
      if (k.indexOf("제목") >= 0 || k.indexOf("게임이름") >= 0) { S.title = v; used.push("게임 제목"); return }
      if (k.indexOf("이름") >= 0) { S.name = v; used.push("주인공 이름"); return }
      if (k.indexOf("표창장") >= 0 || k.indexOf("성공") >= 0 || k.indexOf("탈출문구") >= 0) {
        S.winText = v; used.push("표창장 문구"); return;
      }
      if (k.indexOf("문제") >= 0 && /최종|마지막|보물|상자/.test(k)) {
        C2.treasure = C2.treasure || {};
        C2.treasure.question = v;
        C2.treasure.parts = parts.slice();      // 칸별 조각 (여러 명이 나눠 볼 때 씁니다)
        used.push("최종 문제" + (parts.length > 1 ? " (" + parts.length + "조각)" : ""));
        return;
      }
      if (k.indexOf("정답") >= 0 || k.indexOf("비밀번호") >= 0) {
        C2.treasure = C2.treasure || {}; C2.treasure.answer = v; used.push("최종 정답"); return;
      }
    });
    if (used.length) say("설정 시트 반영:", used.join(", "));
    return used.length;
  }
  // 문제를 다 읽은 뒤, 같은 문서의 설정 탭을 한 번 더 읽습니다 (없으면 그냥 넘어갑니다)
  //  ① CSV(fetch) 로 읽고 → 막히거나 비어 있으면 ② JSONP(script) 로 한 번 더 읽습니다.
  //     (학교 망 · 파일로 열기처럼 fetch 가 막히는 곳에서도 '모둠 활동' 같은 설정이 빠지지 않게)
  var SET_STATE = "";       // "ok" · "empty" · "fail" (화면 안내에 씁니다)
  function loadSettings(id, after){
    var name = String(C.settingSheet === undefined ? "설정" : C.settingSheet).trim();
    if (!id || !name) { after(0); return }
    var root = "https://docs.google.com/spreadsheets/d/" + id + "/gviz/tq?";
    var done = false, triedJson = false;
    function finish(n, state){
      if (done) return; done = true; clearTimeout(timer);
      SET_STATE = state || (n ? "ok" : "fail");
      after(n);
    }
    var timer = setTimeout(function(){ if (done) return; say("설정 시트 응답이 없어 기본 설정으로 시작합니다."); finish(0, "fail") }, 14000);
    function viaJson(why){
      if (triedJson || done) return;
      triedJson = true;
      if (why) say("설정 시트 CSV 를 못 읽었습니다(" + why + "). JSONP 로 다시 읽습니다.");
      var cb = "__setCB" + (Date.now() % 100000);
      var tag = document.createElement("script");
      function cleanup(){
        try { delete window[cb] } catch (e) { window[cb] = undefined }
        if (tag.parentNode) tag.parentNode.removeChild(tag);
      }
      window[cb] = function (res){
        cleanup();
        try {
          var tb = res && res.table, rows = [];
          if (tb && tb.rows) {
            var labs = (tb.cols || []).map(function (c){ return String((c && c.label) || "").trim() });
            if (labs.some(Boolean)) rows.push(labs);           // 첫 줄을 제목으로 가져간 경우
            tb.rows.forEach(function (r){ rows.push((r.c || []).map(cellText)) });
          }
          var n = applySettings(rows);
          finish(n, n ? "ok" : (rows.length ? "empty" : "fail"));
        } catch (e) { finish(0, "fail") }
      };
      tag.onerror = function(){ cleanup(); finish(0, "fail") };
      tag.src = root + "tqx=out:json;responseHandler:" + cb + "&headers=0&sheet=" + encodeURIComponent(name) + fresh() + "&_=" + Date.now();
      document.body.appendChild(tag);
    }
    if (typeof fetch !== "function") { viaJson(""); return }
    try {
      fetch(root + "tqx=out:csv&sheet=" + encodeURIComponent(name) + fresh() + "&_=" + Date.now(), { credentials: "omit", cache: "no-store" })
        .then(function (res){ return res.ok ? res.text() : Promise.reject(new Error("HTTP " + res.status)) })
        .then(function (text){
          var t = String(text || "");
          if (/^\s*<(!doctype|html)/i.test(t)) { viaJson("HTML 응답"); return }
          var n = applySettings(parseCsv(t));
          if (n) finish(n, "ok"); else viaJson("내용 없음");
        })
        .catch(function (e){ viaJson(e && e.message ? e.message : String(e)) });
    } catch (e) { viaJson(String(e)) }
  }

  function finishLoad(r){
    if (!setDone) {                       // 설정 탭을 먼저 읽고 시작합니다
      setDone = true;
      var id = (PLAN[step] || {}).id || DEF_ID;
      showLoading("설정을 불러오는 중…");
      loadSettings(id, function (n){ r.setCount = n; bootWith(r) });
      return;
    }
    bootWith(r);
  }
  function bootWith(r){
    USED_ID = (PLAN[step] || {}).id || DEF_ID || "";
    say(r.list.length + "문제를 읽었습니다.");
    dbg("문제 내용:", r.list);

    var usedId = (PLAN[step] || {}).id;
    var fromAddr = FROM_ADDR && IDS.indexOf(usedId) >= 0;
    var where = fromAddr ? "주소에 적힌 구글 시트" : "구글 시트";
    var extra = r.skipped ? " (형식이 맞지 않는 " + r.skipped + "줄은 건너뜀)" : "";
    if (r.needText) extra += " ※ 글자로 적은 정답을 못 읽은 줄이 있습니다. 시트의 정답 칸에서 숫자 앞에 작은따옴표(')를 붙여 보세요";
    if (r.list.length > MAX) {
      extra += " (게임에는 앞에서부터 " + MAX + "문제만 씁니다)";
      r.list = r.list.slice(0, MAX);
    }
    if (FROM_ADDR && !fromAddr) extra += " ※ 주소의 시트를 못 읽어 기본 시트를 썼습니다";
    if (r.setCount) extra += " · 설정 시트도 반영했습니다" + (window.SETTINGS && window.SETTINGS.team ? " (모둠 활동)" : "")
                                         + (window.SETTINGS && window.SETTINGS.npcQuiz ? " (NPC 문제)" : "");
    else if (SET_STATE === "fail") extra += " ⚠ 설정 탭을 읽지 못해 기본 설정(1인용)으로 시작합니다. 탭 이름이 '설정' 인지 확인하세요";
    boot(r.list, where, "📄 " + where + "에서 문제 " + r.list.length + "개를 불러왔습니다." + extra);
  }

  // ---------- 관리자용 창구 ----------
  //  비밀번호와 시트 주소는 이 파일 안에만 있고, 맞을 때만 시트를 열어 줍니다.
  //  0 = 비밀번호가 다름 / 시트 없음,  1 = 새 탭으로 열림,  2 = 팝업이 막힘
  window.SHEET_ADMIN = {
    has: function(){ return !!ADMIN_PW },
    is: function (v){
      var a = String(ADMIN_PW || "").trim().toLowerCase();
      return !!a && String(v == null ? "" : v).trim().toLowerCase() === a;
    },
    open: function (v){
      if (!this.is(v)) return 0;
      var id = USED_ID || sheetId(C.url);
      if (!id || id === "PUBLISHED") return 0;
      var w = null;
      try { w = window.open("https://docs.google.com/spreadsheets/d/" + id + "/edit", "_blank") } catch (e) {}
      return w ? 1 : 2;
    }
  };

  // ---------- 시작 ----------
  if (C.use === false && !FROM_ADDR) { boot(BACKUP, "예비 문제(quiz.js)", ""); return }
  if (ID === "PUBLISHED") {
    useBackup("'웹에 게시' 주소 대신 브라우저 주소창의 /edit 주소를 넣어 주세요");
    return;
  }
  if (!PLAN.length) { useBackup("시트 주소가 비어 있거나 형식이 다름"); return }
  dbg(FROM_ADDR ? "주소에 적힌 시트를 씁니다: " + ID : "기본 시트를 씁니다: " + ID);
  showLoading(FROM_ADDR ? "주소에 적힌 시트에서 문제를 불러오는 중…" : "문제를 불러오는 중…");
  setTimeout(function(){                                   // 안전장치
    if (booted) return;
    if (best && best.list.length) { finishLoad(best); return }
    useBackup("응답이 없음");
  }, 20000);
  ask();
})();
