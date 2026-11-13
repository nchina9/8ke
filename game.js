// ===================================================================
//  多少钱? 타임머신 송나라 시장 탈출 - 게임 본체 (8과 Duōshao qián?)
//  문제는 구글 시트(설정은 data/quiz.js 맨 위), 맵은 data/maps.js 에서 고칩니다.
// ===================================================================

// 맵 한 칸 = 3D 세상의 1m. 방은 가로 24칸 × 세로 13칸입니다.
const COLS = 24, ROWS = 13;
const canvas = document.getElementById("game");
const frameEl = document.getElementById("frame"), labelsEl = document.getElementById("labels");
// 3D 화면(WebGL) 켜기. 켤 수 없는 기기에서는 안내문을 띄웁니다.
let has3D = false;
try { has3D = !!(window.World3D && World3D.init(canvas, frameEl, labelsEl)) } catch (e) { has3D = false }

const SOLID = ["desk", "chair", "computer", "bookshelf", "board",
              "tree", "window", "chalkboard", "podium_l", "podium_r",
              "counter_l", "counter_r", "board_l", "board_m", "board_r",
              "locker_l", "locker_r", "standpodium_l", "standpodium_r", "musicstand",
              "piano_l", "piano_r", "easel", "artshelf", "labtable_l",
              "labtable_r", "chemcabinet", "readingdesk", "servercab", "mixer_l",
              "mixer_r", "gearbox", "plant", "extinguisher", "trophy_l",
              "trophy_r", "clock",
              // ↓ 옥상 · 미로 공원 · 교무실 물건 (미로 울타리 hedge 는 '#' 벽으로 씁니다)
              "hedge", "watertank", "vent", "solar", "bench",
              "flowerbed", "antenna", "telescope", "weatherbox", "signboard",
              "fountain", "statue", "lamp", "officedesk", "filecabinet",
              "printer", "sofa_l", "sofa_r", "watercooler",
              // ↓ 6과 장소 · 교통 물건 (blocker 는 비행기 날개 밑처럼 안 보이는 벽)
              "stall", "sink", "safe", "atm", "kiosk", "ticketmachine", "hbed", "redcross",
              "fruitstall", "tanghulu", "busstop", "trafficlight", "roundtable", "lantern",
              "bunk2", "bunk3", "infoscreen", "blocker", "stopsign", "yieldsign", "childcn",
              "childkr", "signpost", "bike", "horse", "hay", "brochure", "pond", "pavilion",
              "bus_l", "bus_m", "bus_r", "plane", "seat",
              // ↓ 7과 먹거리 물건
              "soypot", "wontonpot", "frywok", "ytbasket", "jbcart", "grill", "snackshelf", "fridge",
              "tastebar", "icecream", "bigcup", "bigbowl", "foodtable", "malatable", "ingredshelf",
              "steamer", "teatable", "teashelf", "bamboo", "pandarest", "bed", "deliverybox", "scooter",
              // ↓ 8과 송나라 시장 물건 (archway 는 지나가는 문이라 넣지 않습니다)
              "flag", "ustall", "cart", "donkey", "camel", "boat", "scalestall", "clothrack", "mannequin",
              "shoeshelf", "dyevat", "redpaper", "moneycounter", "qrstand", "crate"];

// ---------- 문제를 놓을 자리 (문제 순서대로 최대 24곳) ----------
const SPOTS = [
 // 성문 → 시장 거리 → 가게 → 강변을 골고루 돌며 배치합니다 (거리 한가운데 노점에도 문제가 있어요)
 {room:"gate",     x: 6.5, y: 6.5, name:"성문 앞 알림판",       floor:"성문 앞"},
 {room:"class101", x:18.5, y: 8.5, name:"옷가게 계산대",        floor:"첫째 거리"},
 {room:"up2",      x: 7.5, y: 7.5, name:"길거리 사과 저울",     floor:"둘째 거리"},
 {room:"music",    x:18.5, y: 5.5, name:"과일 가게 저울",       floor:"둘째 거리"},
 {room:"library",  x:19.5, y: 5.5, name:"책 읽는 탁자",         floor:"셋째 거리"},
 {room:"class301", x:18.5, y: 8.5, name:"买一送一 할인판",      floor:"넷째 거리"},
 {room:"up4",      x:13.5, y: 8.5, name:"낙타 상인의 짐",       floor:"넷째 거리"},
 {room:"class102", x:18.5, y: 8.5, name:"신발 가게 계산대",     floor:"첫째 거리"},
 {room:"hall1",    x:10.5, y: 8.5, name:"당나귀 짐 보따리",     floor:"첫째 거리"},
 {room:"art",      x:18.5, y: 5.5, name:"찐빵 찜기",            floor:"둘째 거리"},
 {room:"computer", x:18.5, y:10.5, name:"QR 결제 팻말",         floor:"셋째 거리"},
 {room:"office",   x:18.5, y: 2.5, name:"찻잎 선반",            floor:"넷째 거리"},
 {room:"gate",     x:16.5, y: 8.5, name:"서역 낙타",            floor:"성문 앞"},
 {room:"science",  x:18.5, y: 5.5, name:"파란 염색 항아리",     floor:"첫째 거리"},
 {room:"class201", x:18.5, y:10.5, name:"마파두부 메뉴판",      floor:"둘째 거리"},
 {room:"up3",      x:11.5, y: 8.5, name:"책 수레",              floor:"셋째 거리"},
 {room:"broadcast",x:18.5, y: 5.5, name:"환전소 계산대",        floor:"셋째 거리"},
 {room:"class302", x:18.5, y: 8.5, name:"가격 맞히기 판",       floor:"넷째 거리"},
 {room:"rooftop",  x: 5.5, y: 9.5, name:"무지개 다리 꼭대기",   floor:"강변"},
 // 그 다음 자리
 {room:"rooftop",  x: 5.5, y: 4.5, name:"강변 안내판",          floor:"강변"},
 {room:"class101", x: 5.5, y: 2.5, name:"비단옷 걸이",          floor:"첫째 거리"},
 {room:"music",    x: 7.5, y: 6.5, name:"과일 좌판",            floor:"둘째 거리"},
 {room:"library",  x: 9.5, y: 9.5, name:"서점 계산대",          floor:"셋째 거리"},
 {room:"office",   x:18.5, y: 6.5, name:"찻상",                 floor:"넷째 거리"},
 {room:"class102", x: 5.5, y: 2.5, name:"신발 선반",            floor:"첫째 거리"}
];
// 예비 문제 자리 : 구글 시트 설정에서 '방 수' 를 줄였을 때, 고른 방의 자리가 문제 수보다 모자라면 여기서 더 씁니다
// (그래도 모자라면 한 자리에 문제가 여러 개 쌓여서, 하나를 풀면 다음 문제가 나타납니다)
const EXTRA_SPOTS = [
 {room:"class101",  x:14.5, y: 6.5, name:"마네킹", floor:"첫째 거리"},
 {room:"class102",  x: 9.5, y: 2.5, name:"다른 신발 선반", floor:"첫째 거리"},
 {room:"science",   x: 7.5, y: 2.5, name:"초록 염색 항아리", floor:"첫째 거리"},
 {room:"music",     x: 3.5, y: 2.5, name:"과일 가판대", floor:"둘째 거리"},
 {room:"art",       x:11.5, y: 2.5, name:"빵 카운터", floor:"둘째 거리"},
 {room:"class201",  x: 4.5, y: 6.5, name:"식탁", floor:"둘째 거리"},
 {room:"library",   x: 5.5, y: 2.5, name:"책장", floor:"셋째 거리"},
 {room:"computer",  x: 5.5, y: 2.5, name:"剪纸 판", floor:"셋째 거리"},
 {room:"broadcast", x: 3.5, y: 2.5, name:"금고", floor:"셋째 거리"},
 {room:"class301",  x: 5.5, y: 2.5, name:"물건 선반", floor:"넷째 거리"},
 {room:"class302",  x: 4.5, y: 6.5, name:"노점", floor:"넷째 거리"},
 {room:"office",    x: 4.5, y: 6.5, name:"찻상", floor:"넷째 거리"}
];

// ---------- 공원(rooftop) 미로 : 미로 끝에 반드시 문제 한 개 ----------
// 미로는 옥상(rooftop) 오른쪽 절반에 있습니다. 울타리를 통과할 수 없으므로
// 미로를 직접 걸어서 빠져나가야만 이 문제를 풀 수 있습니다.
// 문제가 몇 개든(1개여도) 마지막 문제는 항상 여기로 옮겨 놓습니다.
// 이 문제는 한 번 풀면 다른 문제를 틀려도 절대 되돌아가지 않습니다 (미로를 다시 걷지 않도록).
const MAZE_SPOT = { room:"rooftop", x:22.5, y:2.5, name:"짐 상자 미로 끝 비밀 화단", floor:"강변" };

// ---------- 방 수 (구글 시트 '설정' 탭의 '방 수') ----------
// 방 수를 적으면 탈출문에서 가까운 '문제가 있는 방' 만 그 수만큼 열고, 나머지 방은 닫아 버립니다
// (닫힌 방으로 가는 문 자리는 벽으로 바뀌고 전체 지도에서도 사라집니다).
//  · 세는 방   : 문제 자리가 있는 방만 셉니다. 출발 곳 · 탈출문이 있는 곳 · 복도는 세지 않습니다.
//  · 고르는 순서: 탈출문이 있는 곳에서 문을 적게 지나는 방부터. 거리가 같으면 SPOTS 목록에 먼저 나오는 방부터.
//  · 가는 길의 복도는 자동으로 열립니다. 문제는 고른 방 안에서만 나옵니다.
//  · 비워 두거나 전체 방 수 이상이면 지금처럼 모든 방이 나옵니다.
const START_ROOM = "gate";
const ROOMS = (function () {
  const lim = parseInt((window.SETTINGS || {}).rooms, 10);
  const M = window.MAPS || {};
  if (!(lim > 0) || !M[START_ROOM]) return null;
  const exitRoom = Object.keys(M).find(id => (M[id].doors || []).some(d => d.exit)) || START_ROOM;
  const fixed = new Set([START_ROOM, exitRoom]);                       // 늘 열려 있는 곳 (세지 않음)
  (M[exitRoom].doors || []).forEach(function (d){ if (d.exit && d.to && M[d.to]) fixed.add(d.to) });
  const dist = {}, par = {}, q = [exitRoom];                          // 탈출문이 있는 곳에서 문을 따라 퍼져 나갑니다
  dist[exitRoom] = 0;
  while (q.length) {
    const a = q.shift();
    for (const d of (M[a].doors || [])) {
      if (d.exit || !d.to || !M[d.to] || d.to in dist) continue;
      dist[d.to] = dist[a] + 1; par[d.to] = a; q.push(d.to);
    }
  }
  const pri = {};                                                      // 같은 거리일 때의 순서
  SPOTS.forEach(function (s, i){ if (!(s.room in pri)) pri[s.room] = i });
  EXTRA_SPOTS.forEach(function (s, i){ if (!(s.room in pri)) pri[s.room] = 1000 + i });
  if (MAZE_SPOT && !(MAZE_SPOT.room in pri)) pri[MAZE_SPOT.room] = 2000;
  const quizRooms = Object.keys(pri).filter(id => !fixed.has(id) && id in dist);
  if (lim >= quizRooms.length) return null;
  quizRooms.sort((a, b) => dist[a] - dist[b] || pri[a] - pri[b]);
  const chosen = quizRooms.slice(0, lim);
  const active = new Set(fixed);
  chosen.forEach(function (id){ let r = id; while (r && !active.has(r)) { active.add(r); r = par[r] } });
  for (let r = par[START_ROOM]; r; r = par[r]) active.add(r);          // 출발 곳에서 탈출문까지 가는 길
  const far = chosen.slice().sort((a, b) => dist[b] - dist[a] || pri[b] - pri[a])[0];
  for (const id of Object.keys(M)) if (!active.has(id)) delete M[id];
  for (const id of Object.keys(M)) {                                   // 닫힌 방으로 가는 문 → 벽(또는 바닥)
    const mp = M[id];
    mp.doors = (mp.doors || []).filter(function (d){
      if (d.exit || !d.to || M[d.to]) return true;
      const wall = function (x, y){ const c = (mp.rows[y] || "")[x]; return c === undefined || c === "#" || (mp.obj || {})[c] === "window" };
      const inLine = (wall(d.x - 1, d.y) && wall(d.x + 1, d.y)) || (wall(d.x, d.y - 1) && wall(d.x, d.y + 1));
      const row = mp.rows[d.y];
      mp.rows[d.y] = row.slice(0, d.x) + (inLine ? "#" : ".") + row.slice(d.x + 1);
      return false;
    });
  }
  return { limit: lim, chosen: chosen, active: active, far: far };
})();
// 문제를 놓을 자리 목록 : 방 수를 정했으면 고른 방의 자리 → 예비 자리 순서로
const USE_SPOTS = (function () {
  if (!ROOMS) return SPOTS;
  const inR = s => ROOMS.chosen.indexOf(s.room) >= 0;
  const base = SPOTS.filter(inR), byRoom = {};
  EXTRA_SPOTS.filter(inR).forEach(function (s){ (byRoom[s.room] = byRoom[s.room] || []).push(s) });
  for (let k = 0; ; k++) {                                             // 예비 자리는 방을 번갈아 가며 덧붙입니다
    let any = false;
    for (const id of ROOMS.chosen) if (byRoom[id] && byRoom[id][k]) { base.push(byRoom[id][k]); any = true }
    if (!any) break;
  }
  return base.length ? base : SPOTS.filter(s => s.room === ROOMS.chosen[0]);
})();
const mazeOn = !ROOMS || ROOMS.active.has(MAZE_SPOT.room);             // 미로 방이 닫히면 마지막 문제는 가장 먼 방으로
const FAR_SPOT = (ROOMS && !mazeOn) ? (USE_SPOTS.filter(s => s.room === ROOMS.far).pop() || USE_SPOTS[USE_SPOTS.length - 1]) : null;

// ---------- 문제 / 비밀번호 준비 ----------
const CFG = window.QUIZ_CONFIG || {};
const QUIZ = (window.QUIZ || []).slice(0, SPOTS.length);

// 부품 상자 : 문제를 모두 풀면 교문 옆 상자가 열리고, 그 안의 마지막 문제 정답이 교문 비밀번호입니다.
const TRE = CFG.treasure || {};
const useTreasure = TRE.use !== false &&
      String(TRE.question || "").trim() !== "" && String(TRE.answer || "").trim() !== "";
const CHEST = { room: "gate", x: 9.5, y: 11.5, name: "타임머신 부품 상자" };
// ---------- 여럿이 나눠 보기 (부품 상자 쪽지 · 모둠 문제) ----------
// n개를 group 명이 나눌 때 role 번이 받을 [시작 위치, 개수]
function shareRange(n, g, r){
  let at = 0;
  for (let i = 1; i <= g; i++) {
    const cnt = Math.floor(n / g) + (i <= (n % g) ? 1 : 0);
    if (i === r) return [at, cnt];
    at += cnt;
  }
  return [0, 0];
}
// 글을 사람 수만큼 조각냅니다 (칸 → 낱말 → 글자 순서)
function splitText(text, cells, g){
  const q = String(text || "").trim();
  if (g <= 1) return { parts: [q], sep: " " };
  // 조각 수는 언제나 사람 수(g)와 같게 : 칸이나 낱말이 사람보다 많으면 앞에서부터 이어지는 것끼리 묶습니다
  const pack = function (list){ const out = []; for (let i = 1; i <= g; i++) { const r = shareRange(list.length, g, i); out.push(list.slice(r[0], r[0] + r[1]).join(" ")) } return out };
  const c = (cells || []).map(function (v){ return String(v).trim() }).filter(Boolean);
  if (c.length >= g) return { parts: pack(c), sep: " " };
  const w = q.split(/\s+/).filter(Boolean);
  if (w.length >= g) return { parts: pack(w), sep: " " };
  const flat = q.replace(/\s+/g, "");               // 글자로 자를 때는 띄어쓰기를 뺍니다
  const out = [];
  let at = 0;
  for (let i = 1; i <= g; i++) {
    const cnt = Math.floor(flat.length / g) + (i <= (flat.length % g) ? 1 : 0);
    out.push(flat.substr(at, cnt));
    at += cnt;
  }
  return { parts: out, sep: "" };
}
function myShare(parts){
  if (group <= 1) return parts;
  const r = shareRange(parts.length, group, role);
  return parts.slice(r[0], r[0] + r[1]);
}
function joinShare(parts, sep){ return parts.join(sep === " " ? "  " : "") }

// 부품 상자 쪽지
function chestSplit(){ return splitText(TRE.question, TRE.parts, Math.max(1, group)) }
function chestParts(){ return chestSplit().parts }
function myParts(){ return myShare(chestParts()) }
function myPieceText(){ return joinShare(myParts(), chestSplit().sep) }

// 모둠 문제 : 문제와 보기를 나눠 봅니다 (혼자 할 때는 그대로 다 보입니다)
function isTeamQ(q){ return !!(q && q.team) && group > 1 }
function teamQuestionText(q){
  const sp = splitText(q.question, null, group);
  return { text: joinShare(myShare(sp.parts), sp.sep), sep: sep2(sp.sep), total: sp.parts.length };
}
function sep2(s){ return s }
// 내가 볼 수 있는 보기 번호들
function myOptionIndexes(q){
  const n = (q.options || []).length;
  if (!n) return [];
  const r = shareRange(n, group, role);
  const out = [];
  for (let i = r[0]; i < r[0] + r[1]; i++) out.push(i);
  return out;
}
let chestOpened = false;

let PASS = useTreasure
  ? String(TRE.answer).trim()
  : (String(CFG.password === undefined ? "3142" : CFG.password).trim() || "3142");
// 자리마다 한 글자씩 공개하는 방식일 때만, 비밀번호가 문제 수보다 길지 않게 맞춥니다
if (!useTreasure && PASS.length > QUIZ.length) PASS = PASS.slice(0, Math.max(1, QUIZ.length));
const HINTS = CFG.hints || [];
const RESET_ON_WRONG = CFG.resetOnWrong === undefined ? 2 : Math.max(0, +CFG.resetOnWrong);
const useHints = (CFG.showHints === "auto" || CFG.showHints === undefined)
  ? QUIZ.length <= 8 : !!CFG.showHints;

// 문제 자리에 문제를 하나씩 배치
// 문제 자리에 문제를 하나씩 배치 (자리가 모자라면 앞 자리부터 다시 돌아가며 같은 자리에 쌓습니다)
const stations = QUIZ.map(function (q, i){
  const sp = USE_SPOTS[i % USE_SPOTS.length];
  return { room: sp.room, x: sp.x, y: sp.y, name: sp.name, floor: sp.floor, q: q, i: i };
});
if (stations.length && FAR_SPOT) {
  const last = stations[stations.length - 1], sp = FAR_SPOT;
  last.room = sp.room; last.x = sp.x; last.y = sp.y; last.name = sp.name; last.floor = sp.floor;
}
// 마지막 문제는 언제나 옥상 미로 끝에 둡니다 (미로를 통과해야만 풀 수 있는 문제)
if (stations.length && mazeOn) {
  const last = stations[stations.length - 1];
  last.room = MAZE_SPOT.room; last.x = MAZE_SPOT.x; last.y = MAZE_SPOT.y;
  last.name = MAZE_SPOT.name; last.floor = MAZE_SPOT.floor;
  last.maze = true;   // ← 이 표시가 있으면 틀려도 되돌아가지 않습니다
}

// 같은 자리에 쌓인 문제 묶음 : 맨 앞(안 푼 것 중 번호가 가장 작은 것) 하나만 보입니다
const STACK = {};
stations.forEach(function (s){ s.stack = s.room + ":" + s.x + ":" + s.y; (STACK[s.stack] = STACK[s.stack] || []).push(s) });
function shownSt(s){
  const same = STACK[s.stack];
  if (!same || same.length < 2) return true;
  for (const t of same) if (!solvedQ.has(t.i)) return t === s;
  return same[same.length - 1] === s;
}

// 비밀번호 글자를 문제 전체에 골고루 나눠 배치 (부품 상자를 쓰면 나누지 않습니다)
const digitAt = {};
if (!useTreasure) (function () {
  const N = stations.length, L = PASS.length;
  for (let i = 0; i < L; i++) digitAt[L === 1 ? 0 : Math.round(i * (N - 1) / (L - 1))] = i;
})();

const visited = new Set(["gate"]);   // 한 번이라도 들어간 방
let passOk = false;                  // 비밀번호를 맞혔는지
const solvedQ = new Set();
const tries = {};                    // 문제별로 틀린 횟수                     // 푼 문제 번호
const found = useTreasure ? [] : PASS.split("").map(() => null);  // 알아낸 비밀번호 글자

// ---------- 게임 상태 ----------
const VERSION = "v69 3D · 8과";             // 고칠 때마다 올립니다 (index.html 의 ?v= · sheet.js 의 VER 와 함께)

let maps = {}, room = "gate", keys = new Set(), last = performance.now(), step = 0;
const SET = window.SETTINGS || {};     // 구글 시트 '설정' 탭에서 읽어 온 값
const DEFAULT_NAME = String(SET.name || "1번홍길동").trim() || "1번홍길동";
// 게임 제목 (설정 시트의 '제목' 칸)
const GAME_TITLE = String(SET.title || "").trim() || "多少钱? 타임머신 송나라 시장 탈출";
(function(){
  const t = document.querySelector("header .title") || document.querySelector(".title");
  if (t) t.textContent = "⏱ " + GAME_TITLE;
  document.title = GAME_TITLE;
})();
let started = false;                   // 시작 화면에서 이름을 넣어야 true 가 됩니다
const MAX_GROUP = 10;                  // 함께할 수 있는 최대 인원
const TEAM_MODE = SET.team === true;   // 구글 시트 설정의 "모둠 활동인가(Y/N)"
const NPC_QUIZ  = SET.npcQuiz === true; // 구글 시트 설정의 "NPC 문제(Y/N)" — 없으면 N
let group = 1, role = 1;               // 함께하는 사람 수 / 내 역할 번호
let p = { x: 5.5, y: 9.5, dir: 0, frame: 0, name: DEFAULT_NAME };
let bubbles = [];
const CHAT = [
  "Duōshao qián? 얼마예요?",
  "Piányi yìdiǎnr ba! 좀 싸게 해 주세요!",
  "Qǐng shāo děng. 잠시만 기다려 주세요.",
  "송나라 시장은 정말 북적북적하네요!",
  "옷은 jiàn, 신발은 shuāng, 책은 běn으로 세요.",
  "말할 때는 kuài(块), 글로 쓸 때는 yuán(元)!",
  "买一送一! 하나 사면 하나 더!",
  "타임머신이 왜 멈췄는지 모르겠어요."
].concat(SET.zombie === true ? [
  "좀비는 느리니까 침착하게 피해 다니세요!",
  "주사기를 맞은 좀비는 10초 동안 기절한대요.",
  "빨간 물약을 마시면 하트가 하나 차요.",
  "주사기가 떨어지면 바닥의 💉 를 주워요."
] : []);
const npcs = [
  {room:"gate", x:8.5, y:8.5, name:"이한나", skin:"hanna", chat:["와, 타임머신이 진짜 송나라 시장에 왔어!", "타임머신 부품을 사야 현재로 돌아갈 수 있대."]},
  {room:"gate", x:13.5, y:10.5, name:"김동민", skin:"dongmin", chat:["Zhè shuāng xié duōshao qián? 이 신발 얼마예요?", "Piányi yìdiǎnr ba! 좀 싸게 해 주세요!"]},
  {room:"gate", x:10.5, y:9.5, name:"판다 기관사", skin:"panda1", chat:["⏱ 타임머신이 고장 났어요! 부품 상자를 열어야 해요 🐼", "문제를 다 풀면 상자가 열린대요!", "냠냠~ 송나라 대나무도 맛있네!"]},
  {room:"gate", x:18.5, y:6.5, name:"성문 지기", skin:"song3", chat:["汴京(변경)에 온 것을 환영하오!", "시장 거리는 성문 안쪽이라오."]},
  {room:"hall1", x:8.5, y:6.5, name:"옷감 장수", skin:"song1", chat:["Wǒ yào mǎi yí jiàn qípáo? 치파오 한 벌 사려고?", "옷을 셀 때는 jiàn(件)을 쓴다오."]},
  {room:"hall1", x:15.5, y:6.5, name:"신발 장수", skin:"song4", chat:["신발은 짝이라 shuāng(双)으로 센다오.", "Yì shuāng xié!"]},
  {room:"hall1", x:12.5, y:8.5, name:"시장 아이", skin:"song5", chat:["시장 구경 재미있어요!", "물건 값은 kuài(块)로 말해요."]},
  {room:"class101", x:10.5, y:7.5, name:"판매원", skin:"teacher2", chat:["Nín kàn, zhè jiàn zěnmeyàng? 이 옷 어때요?", "Yǒu. Qǐng shāo děng. 있어요. 잠시만 기다리세요."]},
  {room:"class101", x:15.5, y:9.5, name:"이한나", skin:"hanna", chat:["Wǒ yào mǎi yí jiàn qípáo.", "Búcuò, yǒu hóngsè de ma? 좋네요, 빨간색 있어요?"]},
  {room:"class102", x:10.5, y:7.5, name:"판매원", skin:"song2", chat:["Wǔbǎi kuài. 500위안이에요.", "Nà sìbǎi wǔ ba. Qǐng sǎo yíxià. 그럼 450! 스캔해 주세요."]},
  {room:"class102", x:16.5, y:9.5, name:"김동민", skin:"dongmin", chat:["Zhè shuāng xié duōshao qián?", "Piányi yìdiǎnr ba!"]},
  {room:"science", x:10.5, y:7.5, name:"염색 장인", skin:"song3", chat:["hóngsè 빨강, huángsè 노랑, lǜsè 초록!", "lánsè 파랑, báisè 하양, hēisè 검정!"]},
  {room:"science", x:15.5, y:9.5, name:"손님", skin:"song5", chat:["Yǒu lǜsè de ma? 초록색 있어요?", "de(的)는 '~한 것'이라는 뜻도 있대요."]},
  {room:"up2", x:8.5, y:6.5, name:"떡 장수", skin:"song2", chat:["따끈한 炊饼(찐빵) 사시오!", "Liǎng ge miànbāo! 빵 두 개!"]},
  {room:"up2", x:15.5, y:6.5, name:"낙타 상인", skin:"song4", chat:["서역에서 낙타 타고 왔다오.", "숫자 2는 양사 앞에서 liǎng(两)이라 하오."]},
  {room:"music", x:10.5, y:7.5, name:"과일 장수", skin:"cook", chat:["Yì jīn píngguǒ! 사과 한 근!", "jīn(斤)은 무게 단위, 한 근은 500g이라오."]},
  {room:"music", x:15.5, y:9.5, name:"판다 사과", skin:"panda2", chat:["사과도 맛있지만 대나무가 최고! 🐼🎋", "Duōshao qián? 얼마예요?"]},
  {room:"art", x:10.5, y:8.5, name:"빵집 주인", skin:"song1", chat:["Wǒ yào mǎi liǎng ge miànbāo.", "gè(个)는 수사 뒤에서 경성으로 읽어요."]},
  {room:"art", x:16.5, y:6.5, name:"왕징징", skin:"wangjj", chat:["miànbāo(面包)는 빵이에요.", "송나라엔 炊饼(찐빵)이 있었대!"]},
  {room:"class201", x:10.5, y:7.5, name:"식당 할머니", skin:"nurse", chat:["얼굴에 곰보가 있는 할머니(婆)가 만든 두부 요리라서 麻婆豆腐!", "청두 손님들이 좋아하지."]},
  {room:"class201", x:16.5, y:8.5, name:"장페이", skin:"zhangpei", chat:["와, 마파두부 진짜 밥도둑이다!", "Duōshao qián?"]},
  {room:"up3", x:8.5, y:6.5, name:"글방 선생", skin:"principal", chat:["책은 běn(本)으로 센다오. Sān běn shū!", "빨간색은 부와 행복을 뜻하지."]},
  {room:"up3", x:15.5, y:6.5, name:"환전 상인", skin:"song3", chat:["1元 = 10角 = 100分이라오.", "말할 때는 kuài · máo, 글로는 yuán · jiǎo!"]},
  {room:"library", x:15.5, y:9.5, name:"서점 주인", skin:"teacher", chat:["Wǒ yào mǎi yì běn shū.", "Qǐng ānjìng! 조용히 해 주세요."]},
  {room:"library", x:6.5, y:9.5, name:"책벌레", skin:"song5", chat:["Sān běn shū! 책 세 권!", "책 읽을 땐 Qǐng ānjìng~"]},
  {room:"computer", x:10.5, y:7.5, name:"剪纸 장인", skin:"song2", chat:["jiǎnzhǐ(剪纸)는 빨간 종이를 오려 만든 장식이에요.", "중국 사람들은 빨간색을 가장 좋아한다오."]},
  {room:"computer", x:15.5, y:8.5, name:"놀란 상인", skin:"song4", chat:["Qǐng sǎo yíxià? 이 네모난 그림을 '스캔'하라고?", "미래에는 휴대폰으로 돈을 낸다니!"]},
  {room:"broadcast", x:10.5, y:7.5, name:"钱庄 주인", skin:"principal", chat:["중국 화폐는 人民币(rénmínbì), ¥, CNY로 써요.", "지폐 뒷면에는 중국의 명소가 그려져 있지."]},
  {room:"broadcast", x:15.5, y:9.5, name:"판다 계산원", skin:"panda3", chat:["100元 지폐에는 인민대회당! 🐼", "8은 fā(发)와 발음이 비슷해서 인기 숫자!"]},
  {room:"up4", x:8.5, y:6.5, name:"장터 장수", skin:"song1", chat:["买一送一! 하나 사면 하나 더!", "打八折 — 20% 할인이라오."]},
  {room:"up4", x:15.5, y:6.5, name:"흥정꾼", skin:"song4", chat:["Piányi yìdiǎnr ba!", "가격이 높으면 Wǎng xià! 낮으면 Wǎng shàng!"]},
  {room:"class301", x:11.5, y:8.5, name:"잡화점 주인", skin:"cook", chat:["mǎi yī sòng yī — 하나 사면 하나 더 드려요!", "bā zhé(八折)는 80%만 내면 돼요."]},
  {room:"class301", x:16.5, y:6.5, name:"손님", skin:"song5", chat:["8折가 80% 할인인 줄 알았어!", "아니야, 20% 할인이야."]},
  {room:"class302", x:11.5, y:8.5, name:"흥정 대장", skin:"song3", chat:["Duōshao qián? 얼마인지 맞혀 보시오!", "Wǎng shàng! 더 높게! · Wǎng xià! 더 낮게!"]},
  {room:"class302", x:16.5, y:6.5, name:"판다 흥정왕", skin:"panda1", chat:["Piányi yìdiǎnr ba~ 🐼", "Yìbǎi kuài? Wǎng xià!"]},
  {room:"office", x:10.5, y:8.5, name:"찻집 이야기꾼", skin:"principal", chat:["옛날 옛적 송나라 시장에서는…", "Qǐng shāo děng! 잠시 기다리시오, 차가 나온다오."]},
  {room:"office", x:15.5, y:9.5, name:"차 손님", skin:"song2", chat:["Qǐng ràng yíxià. 좀 비켜 주세요.", "ràng(让)은 '양보하다'예요."]},
  {room:"rooftop", x:3.5, y:5.5, name:"뱃사공", skin:"song4", chat:["무지개 다리(虹桥) 아래로 배가 지나간다오.", "다리 꼭대기에서 강을 내려다보시오!"]},
  {room:"rooftop", x:8.5, y:6.5, name:"짐꾼", skin:"song1", chat:["짐 상자 미로 끝에 마지막 문제가 있다오.", "상자는 넘을 수 없으니 길을 찾으시오!"]},
  {room:"rooftop", x:2.5, y:11.5, name:"판다 뱃놀이", skin:"panda2", chat:["강바람 시원하다~ 🐼", "Duōshao qián? 뱃삯은 얼마?"]}
];

// ---------- NPC 문제 (설정 탭 'NPC 문제' 가 Y 일 때만) ----------
// 일반 문제는 시험지에 보기(또는 입력칸)만 있고 문제 글은 적혀 있지 않습니다.
// 학생은 같은 곳 담당 NPC 에게 말을 걸어 문제를 듣고, 그 문제를 기억해서 시험지로 돌아와 답을 고릅니다.
// · 담당 NPC 는 그 문제를 풀기 전까지 말을 걸 때마다 위치와 문제를 말해 줍니다 (잊어버리면 다시 들으면 됩니다)
// · 문제 글은 NPC 에게 들은 뒤에도 시험지에 나오지 않습니다 (맞힌 뒤에만 보입니다)
// · 모둠 문제와 미로 끝(마지막) 문제는 제외합니다 (미로를 되돌아 나오지 않게)
// · 담당은 게임 시작 때 한 번만, 문제 번호 순서대로 그곳 NPC 에게 돌아가며 맡깁니다
//   (문제 3개 · NPC 2명이면 1번째 NPC 가 2개, 2번째 NPC 가 1개 → 이어하기에도 늘 같은 결과)
const heardQ = new Set();              // NPC 에게 한 번이라도 들은 문제 번호
let lastQuizSt = null;                 // 마지막으로 열어 본 문제 자리 (그 문제부터 먼저 알려 줍니다)
if (NPC_QUIZ) (function(){
  const turn = {};
  for (const s of stations) {
    if (s.q.team || s.maze) continue;
    const f = npcs.filter(n => n.room === s.room);
    if (!f.length) continue;           // NPC 가 없는 곳은 예전처럼 문제가 바로 보입니다
    const k = turn[s.room] || 0;
    s.teller = f[k % f.length];
    turn[s.room] = k + 1;
  }
})();
// 아직 한 번도 NPC 에게 듣지 않은 문제인가? (다른 NPC 의 귀띔 · 힌트에 씁니다)
function needAsk(s){ return !!(s && s.teller) && !heardQ.has(s.i) && !solvedQ.has(s.i) }
// 이 NPC 가 맡은 문제 가운데 아직 못 푼 것들
function questionsOf(n){ return stations.filter(s => s.teller === n && !solvedQ.has(s.i)) }
// 담당 NPC 는 문제만 말합니다 (말풍선은 7초면 사라져서 긴 문제도 읽을 수 있게 대화창으로)
// 두 문제 이상 맡았으면 : 방금 열어 본 문제를 먼저, 아니면 말 걸 때마다 번갈아 말합니다.
function tellQuiz(n){
  const list = questionsOf(n);
  let s = list.indexOf(lastQuizSt) >= 0 ? lastQuizSt : null;
  if (!s) { n.qi = (n.qi || 0) + 1; s = list[(n.qi - 1) % list.length] }
  heardQ.add(s.i);
  n.dir = p.y < n.y ? 3 : p.y > n.y ? 0 : p.x < n.x ? 1 : 2;   // 말 거는 쪽을 봅니다
  n.frame = 0;
  // 어느 자리에 있는 문제인지 위치를 먼저 말하고 문제를 알려 줍니다
  showDialog("🗣 " + n.name,
             "「" + s.name + "」에 있는 문제는 이거야.\n\n" + String(s.q.question || "").trim());
  saveState();
}

// NPC 대사: 문제 위치 → 문제 힌트 → 잡담 순서로 돌아가며 말함
function roomName(id){ return (maps[id] && maps[id].name) || id }
function lineWhere(){
  const mine = stations.filter(s => s.room === room && !solvedQ.has(s.i));
  if (mine.length) {
    const a = mine.find(needAsk);
    if (a) return "이 방 " + a.name + " 문제는 " + iGa(a.teller.name) + " 알고 있대요. 말을 걸어 보세요!";
    return "이 방 " + mine[0].name + " 쪽에 문제가 붙어 있어요.";
  }
  const left = stations.filter(s => !solvedQ.has(s.i));
  if (left.length) {
    const s = left[Math.floor(Math.random() * left.length)];
    return roomName(s.room) + "에 아직 문제가 남아 있대요.";
  }
  if (useTreasure) {
    if (!chestOpened) return "성문 앞 타임머신 옆 부품 상자가 이제 열릴 것 같던데요? 가 보세요!";
    return group > 1
      ? "쪽지가 조각나 있대요. 친구들 조각까지 모아야 답을 알 수 있어요!"
      : "상자에서 나온 물음의 답을 타임머신 잠금 장치에 넣으면 돼요!";
  }
  if (found.indexOf(null) >= 0) return "문제는 다 풀렸는데 번호를 다 못 모으셨나 봐요.";
  return "이제 타임머신에 " + PASS.length + "자리 번호를 넣으면 현재로 돌아갈 수 있어요!";
}
// ---------- 여러 개 고르는 문제 도우미 ----------
function isMulti(q){ return !!(q && q.multi && q.multi.length > 1) }
function rightSet(q){ return isMulti(q) ? q.multi.slice() : [q.answer] }
function sameSet(a, b){
  const x = (a || []).slice().sort(function (m, n){ return m - n });
  const y = (b || []).slice().sort(function (m, n){ return m - n });
  return x.length === y.length && x.every(function (v, i){ return v === y[i] });
}

// ---------- 튕겼을 때 이어하기 (5분 안에 같은 이름으로 들어오면 그대로) ----------
const SAVE_KEY = "schoolEscape.save";
const SAVE_MIN = 5;                                   // 몇 분 안에 들어와야 이어할지
function quizSig(){                                   // 문제가 바뀌었는지 알아보는 표시
  let h = QUIZ.length * 7919;
  if (ROOMS) { const t = ROOMS.chosen.join(","); for (let i = 0; i < t.length; i++) h = (h * 31 + t.charCodeAt(i)) | 0 }   // 방 수가 바뀌면 이어하기 기록을 새로
  for (const q of QUIZ) {
    const t = String(q.question || "");
    for (let i = 0; i < t.length; i++) h = (h * 31 + t.charCodeAt(i)) | 0;
  }
  return String(h);
}
let resetting = false;                 // '처음부터' 를 누른 뒤에는 절대 다시 저장하지 않습니다
function saveState(){
  if (!started || finished || resetting) return;
  try {
    localStorage.setItem(SAVE_KEY, JSON.stringify({
      at: Date.now(), name: p.name, sig: quizSig(),
      group: group, role: role,
      solved: Array.from(solvedQ), tries: tries, found: found,
      heard: Array.from(heardQ),
      chest: chestOpened, pass: passOk,
      life: life, ammo: ammo,
      room: room, x: p.x, y: p.y
    }));
  } catch (e) {}
}
function clearSave(){ try { localStorage.removeItem(SAVE_KEY) } catch (e) {} }
// 처음부터 : 저장된 기록을 지우고 새로 시작합니다 (같은 이름으로 들어와도 이어하기가 되지 않음)
function restartGame(){
  resetting = true;
  clearSave();
  location.reload();
}
setInterval(saveState, 30000);
// 창을 닫거나 다른 앱으로 넘어가는 순간에도 한 번 더 기록합니다 (튕겼을 때 바로 그 자리에서 이어지게)
addEventListener("pagehide", saveState);
document.addEventListener("visibilitychange", function(){ if (document.hidden) saveState() });        // 돌아다니기만 해도 30초마다 한 번씩 기록을 새로 합니다
// 5분 안에 저장된 기록 (이름은 따지지 않음) : 시작 화면에서 이름 · 역할을 미리 골라 두는 데 씁니다
function peekSave(){
  let v = null;
  try { v = JSON.parse(localStorage.getItem(SAVE_KEY) || "null") } catch (e) { return null }
  if (!v || !v.at) return null;
  if (Date.now() - v.at > SAVE_MIN * 60000) { clearSave(); return null }   // 시간이 지났으면 버립니다
  if (v.sig !== quizSig()) { clearSave(); return null }                    // 문제가 바뀌었으면 버립니다
  return v;
}
function readSave(name){
  const v = peekSave();
  if (!v) return null;
  const a = String(v.name || "").trim().toLowerCase();
  if (!a || a !== String(name || "").trim().toLowerCase()) return null;    // 이름이 달라도 안 됩니다
  return v;
}
// 시작 화면에 넘길 이어하기 정보 (없으면 null)
function resumeInfo(){
  const v = peekSave();
  if (!v || !String(v.name || "").trim()) return null;
  return { name: v.name, group: v.group || 1, role: v.role || 1,
           ago: Math.max(1, Math.ceil((Date.now() - v.at) / 60000)) };
}
// 저장해 둔 진행 상황을 되살립니다
function restoreSave(v){
  (v.solved || []).forEach(function (i){ if (stations.some(s => s.i === i)) solvedQ.add(i) });
  (v.heard || []).forEach(function (i){ if (stations.some(s => s.i === i)) heardQ.add(i) });
  if (v.tries) for (const k in v.tries) tries[k] = v.tries[k];
  if (Array.isArray(v.found) && v.found.length === found.length) {
    for (let i = 0; i < found.length; i++) found[i] = v.found[i];
  }
  chestOpened = !!v.chest;
  passOk = !!v.pass;
  if (v.life > 0) life = Math.min(MAX_LIFE, Math.round(v.life));
  if (v.ammo >= 0) ammo = Math.round(v.ammo);
  updateVitals();
  if (v.room && maps[v.room]) setRoom(v.room, v.x, v.y);
  else load3d();                                      // 문 색깔을 푼 문제에 맞게 다시 칠합니다
  return solvedQ.size;
}

// ---------- 주관식(직접 입력) 문제 도우미 ----------
function isText(q){
  return !!(q && (q.type === "text" || ((q.answers || []).length && !(q.options || []).length)));
}
function answerOf(q){
  return isText(q) ? String(q.answerText || (q.answers || [])[0] || "")
                   : String((q.options || [])[q.answer] || "");
}
// 띄어쓰기·대소문자·마침표는 무시하고 맞춰 줍니다
function normAns(s){
  return String(s == null ? "" : s).normalize("NFD").replace(/[\u0300-\u036f]/g, "")   // 성조 부호 빼기 (ǒ→o · ü→u)
    .replace(/[\u2019\u2018]/g, "'").toLowerCase()
    .replace(/[\s\u00a0]/g, "").replace(/[.,!?·"'`~。，？！]/g, "");
}
function answerOk(q, v){
  const t = normAns(v);
  if (!t) return false;
  const list = (q.answers && q.answers.length) ? q.answers : [answerOf(q)];
  return list.some(function (a){ return normAns(a) === t });
}

// 문제 하나에 대한 힌트를 순서대로 만들어 줍니다 (NPC 대화와 힌트 버튼이 같이 씁니다)
function hintFor(q, seq){
  const ans = answerOf(q);
  const wrong = isText(q) ? [] : q.options.filter(function (o, i) { return rightSet(q).indexOf(i) < 0 });
  const list = ["이 문제는 " + (q.category || "8과") + " 쪽 내용이에요."];
  if (isMulti(q)) list.push("정답이 " + q.multi.length + "개예요. 모두 골라야 해요.");
  if (isText(q) && ans.length) list.push("정답은 " + ans.length + "글자예요.");
  if (wrong.length) list.push("보기 중에 '" + wrong[seq % wrong.length] + "' 은(는) 답이 아니에요.");
  if (ans.length >= 3) list.push("정답은 '" + ans.charAt(0) + "' 로 시작해요.");
  list.push("천천히 다시 읽어 보면 보일 거예요!");
  return list[seq % list.length];
}
// 틀렸을 때 주는 힌트 — 틀릴수록 점점 더 친절해집니다
function wrongHint(q, n){
  const ans = answerOf(q);
  const wrong = isText(q) ? [] : q.options.filter(function (o, i) { return rightSet(q).indexOf(i) < 0 });
  if (n <= 1) return "이 문제는 " + (q.category || "8과") + " 쪽 내용이에요.";
  if (isMulti(q)) {
    if (n === 2) return "정답이 " + q.multi.length + "개예요. 빠짐없이 골라야 해요.";
    if (wrong.length) return "보기 중에 '" + wrong[n % wrong.length] + "' 은(는) 답이 아니에요.";
    return "하나만 고르면 안 돼요. 답이 되는 것을 모두 찾아보세요!";
  }
  if (isText(q)) {
    if (n === 2 && ans.length) return "정답은 " + ans.length + "글자예요.";
    if (ans.length >= 2) return "정답은 '" + ans.charAt(0) + "' 로 시작해요.";
    return "천천히 다시 읽어 보면 보일 거예요!";
  }
  if (n === 2 && wrong.length) return "보기 중에 '" + wrong[Math.floor(Math.random() * wrong.length)] + "' 은(는) 답이 아니에요.";
  if (ans.length >= 3) return "정답은 '" + ans.charAt(0) + "' 로 시작해요.";
  if (wrong.length) return "보기 중에 '" + wrong[0] + "' 은(는) 답이 아니에요.";
  return "천천히 다시 읽어 보면 보일 거예요!";
}
function roomFriend(){
  const f = npcs.filter(n => n.room === room);
  if (!f.length) return null;
  // 한 방에 여럿이 있으면 가장 가까이 있는 사람이 말해 줍니다
  return f.slice().sort(function (a, b){ return dist(a.x, a.y) - dist(b.x, b.y) })[0];
}
function lineHint(n){
  const mine = stations.filter(s => s.room === room && !solvedQ.has(s.i) && !needAsk(s));
  if (mine.length) {
    n.hi = (n.hi || 0) + 1;
    return hintFor(mine[0].q, n.hi);
  }
  const left = stations.length - solvedQ.size;
  if (left > 0) return "남은 문제가 " + left + "개래요. 힘내세요!";
  return "고생하셨어요. 타임머신 앞에서 봬요.";
}
// 문제에 딸린 NPC 대사 (시트의 NPC대화1~3). 그 문제를 풀고 나면 더 이상 나오지 않습니다.
function roomQuizLines(){
  const out = [];
  for (const s of stations) {
    if (s.room !== room || solvedQ.has(s.i)) continue;
    for (const t of (s.q.npc || [])) if (t) out.push(t);
  }
  return out;
}
function npcLine(n){
  n.turn = (n.turn || 0) + 1;
  const mine = stations.filter(s => s.room === room && !solvedQ.has(s.i));
  const extra = roomQuizLines();
  // 못 푼 문제에 딸린 대사가 있으면 자주 섞어서 들려 줍니다
  if (extra.length && Math.random() < 0.45) return pick(extra, n);
  // 같은 방에 못 푼 문제가 있으면 가끔(대략 세 번에 한 번) 문제 힌트를 흘려 줍니다
  if (mine.length && Math.random() < 0.33) return lineHint(n);
  if (n.turn % 2 === 1) return lineWhere();
  return pick((n.chat || []).concat(CHAT), n);
}
// 방금 한 말을 연달아 또 하지 않도록 한 번 더 뽑아 봅니다
function pick(list, n){
  if (!list.length) return "…";
  let t = list[Math.floor(Math.random() * list.length)];
  if (list.length > 1 && n && t === n.said) t = list[Math.floor(Math.random() * list.length)];
  if (n) n.said = t;
  return t;
}

// NPC 돌아다니기 (지금 있는 방의 NPC만 움직입니다)
function npcBusy(x, y, me){
  for (const s of stations) if (s.room === room && Math.hypot(x - s.x, y - s.y) < 1.4) return true;
  for (const s of stations) if (s.room === room) { const f = frontSpot(s); if (Math.hypot(x - f.x, y - f.y) < 1.0) return true }   // 동그라미 위에도 서지 않게
  for (const dd of (map().doors || [])) if (Math.hypot(x - dd.x - .5, y - dd.y - .5) < 1.4) return true;
  // 한 방에 여럿이 있을 때 서로 겹쳐 서지 않도록
  for (const o of npcs) {
    if (o === me || o.room !== room) continue;
    if (Math.hypot(x - o.x, y - o.y) < 1.0) return true;
  }
  return false;
}
function moveNpcs(dt){
  const now = performance.now();
  for (const n of npcs) {
    if (n.room !== room) continue;
    if (n.hold && now < n.hold) { n.frame = 0; continue }   // 말을 거는 동안에는 서 있습니다
    n.t = (n.t === undefined ? 0 : n.t) - dt;
    if (n.t <= 0 || n.mv === undefined) {
      n.t = 0.7 + Math.random() * 2.0;
      n.mv = Math.floor(Math.random() * 6);
    }
    if (!(n.mv < 4)) continue;          // 4,5 는 잠깐 멈춤 (undefined 도 여기서 걸러짐)                       // 잠깐 멈춤
    const dx = [0, 0, -1, 1][n.mv], dy = [-1, 1, 0, 0][n.mv];
    n.dir = n.mv === 0 ? 3 : n.mv === 1 ? 0 : n.mv === 2 ? 1 : 2;
    const sp = 1.6 * dt, nx = n.x + dx * sp, ny = n.y + dy * sp;
    if (!bodyBlocked(nx, ny) && !npcBusy(nx, ny, n)) {
      n.x = nx; n.y = ny;
      n.st = (n.st || 0) + dt;
      if (n.st > .2) { n.frame = 1 - (n.frame || 0); n.st = 0 }
    } else { n.t = 0 }                             // 막히면 바로 방향 바꾸기
  }
}

// ===================================================================
//  🧟 좀비 · 💉 주사기 · ❤ 회복약  (리니지처럼 방마다 몬스터가 있습니다)
//   · 좀비는 방에 들어갈 때마다 제자리에서 다시 나타나고, 가까이 가면 느릿느릿 쫓아옵니다.
//   · 좀비에게 닿으면 라이프(❤)가 1 줄어듭니다. 0 이 되면 정문으로 돌아갑니다 (푼 문제는 그대로).
//   · E : 가까운 좀비를 주사기로 찌릅니다 → 10초 동안 기절 (기절한 좀비는 공격하지 못합니다).
//   · 바닥의 ❤ 회복약은 라이프를 1, 💉 주사기는 공격 횟수를 1 채워 줍니다. 주운 뒤 잠시 뒤 다시 생깁니다.
//   · 구글 시트 설정 탭의 "좀비(Y/N)" 가 Y 일 때만 나옵니다 (비워 두면 N).
//   ▼ 숫자만 바꾸면 난이도가 달라집니다.
// ===================================================================
const MAX_LIFE     = 5;      // 최대 라이프 (하트 개수)
const START_AMMO   = 5;      // 처음 가진 주사기 (공격 횟수)
const ZOMBIE_ON    = SET.zombie === true;   // 구글 시트 설정의 "좀비(Y/N)" (비어 있으면 N : 좀비 없음)
const AMMO_PACK    = 1;      // 💉 주사기 아이템 하나로 늘어나는 공격 횟수
const POTION_HEAL  = 1;      // ❤ 회복약 하나로 회복되는 하트
const ITEM_SKIP    = 3;      // 아이템 개수 : 방 3곳 중 1곳은 비워 둡니다 (전체 18방 → 12개, ❤ 6 · 💉 6)
const STUN_SEC     = 10;     // 주사기에 맞은 좀비가 기절해 있는 시간 (초)
const Z_SPEED      = 1.15;   // 좀비가 쫓아오는 빠르기 (주인공은 4)
const Z_WANDER     = 0.45;   // 혼자 어슬렁거릴 때 빠르기
const Z_SEE        = 6;      // 이 거리(칸)보다 가까워지면 쫓아오기 시작
const Z_LOSE       = 10;     // 이 거리보다 멀어지면 쫓기를 그만둠
const Z_HIT_R      = 0.62;   // 이만큼 붙으면 공격받음
const ATTACK_R     = 1.8;    // 주사기가 닿는 거리
const HURT_SAFE    = 1.3;    // 한 번 다치면 이 시간 동안은 다치지 않음 (초)
const ENTER_SAFE   = 1.5;    // 방에 막 들어온 뒤 안전한 시간 (초)
const ITEM_RESPAWN = 60;     // 주운 아이템이 다시 생기는 시간 (초)

let life = MAX_LIFE, ammo = START_AMMO;
let hurtT = 0, atkT = 0, atkCool = 0, enterSafe = 0, atkFace = 0;
let zombies = [];            // 지금 방에서 움직이는 좀비
const ZHOME = {};            // 방 id → 좀비가 처음 서 있는 자리들
const ITEMS = {};            // 방 id → [{kind, x, y, gone}]
let gameT = 0;               // 게임 시간 (창이 열려 있거나 순간이동 중에는 멈춥니다)
let fx = [], fxId = 0;       // 머리 위로 떠오르는 글자 (-1 ❤ · +3 💉 …)
let warpWhy = "magic";       // 순간이동 이유 : magic(오답) / zombie(좀비에게 당함)

// 늘 같은 자리에 놓이도록 방 이름으로 정해지는 난수
function seeded(str){
  let h = 2166136261;
  for (let i = 0; i < str.length; i++) h = Math.imul(h ^ str.charCodeAt(i), 16777619);
  return function () {
    h = (h + 0x6D2B79F5) | 0;
    let t = Math.imul(h ^ (h >>> 15), h | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
function freeIn(id, gx, gy){
  const r = maps[id];
  if (!r || !(gx >= 0 && gy >= 0 && gx < COLS && gy < ROWS)) return false;
  const c = r.rows[gy][gx];
  if (c === "#") return false;
  if (SOLID.includes(r.obj ? r.obj[c] : undefined)) return false;
  if (useTreasure && CHEST.room === id && gx === Math.floor(CHEST.x) && gy === Math.floor(CHEST.y)) return false;
  return true;
}
// 이 방으로 들어오는 자리 (처음 서는 곳 · 다른 방에서 문으로 들어오는 곳 · 이 방의 문)
function entriesOf(id){
  const M = maps[id], out = [];
  if (M.spawn) out.push({ x: M.spawn[0], y: M.spawn[1] });
  for (const k in maps) for (const d of (maps[k].doors || []))
    if (d.to === id && d.tx !== undefined && d.tx !== null) out.push({ x: d.tx, y: d.ty });
  for (const d of (M.doors || [])) out.push({ x: d.x + .5, y: d.y + .5 });
  return out;
}
function nearest(list, x, y){
  let m = 1e9;
  for (const v of list) m = Math.min(m, Math.hypot(v.x - x, v.y - y));
  return m;
}
// 게임을 시작할 때 한 번 : 방마다 좀비 자리와 아이템 자리를 정합니다
function planWorld(){
  if (!ZOMBIE_ON) return;                         // 설정 시트 좀비(Y/N) 가 Y 가 아니면 좀비 · 아이템 없음
  const ids = Object.keys(maps);
  let itemRoom = 0;                               // 아이템을 놓은 방 수 (❤ · 💉 를 번갈아 놓습니다)
  ids.forEach(function (id, idx){
    const M = maps[id], rnd = seeded("zombie:" + id);
    const ent = entriesOf(id);
    const avoid = [];
    stations.filter(s => s.room === id).forEach(function (s){ avoid.push({ x: s.x, y: s.y }); avoid.push(frontSpot(s)) });
    npcs.filter(n => n.room === id).forEach(n => avoid.push({ x: n.x, y: n.y }));
    if (useTreasure && CHEST.room === id) avoid.push({ x: CHEST.x, y: CHEST.y });
    // 들어오는 곳에서 걸어서 갈 수 있는 칸만 고릅니다
    const seen = new Set(), q = [];
    for (const e of ent) {
      const gx = Math.floor(e.x), gy = Math.floor(e.y), k = gx + gy * COLS;
      if (freeIn(id, gx, gy) && !seen.has(k)) { seen.add(k); q.push(k) }
    }
    for (let h = 0; h < q.length; h++) {
      const c = q[h], x = c % COLS, y = (c / COLS) | 0;
      for (const d of [[1,0],[-1,0],[0,1],[0,-1]]) {
        const nx = x + d[0], ny = y + d[1], k = nx + ny * COLS;
        if (!seen.has(k) && freeIn(id, nx, ny)) { seen.add(k); q.push(k) }
      }
    }
    const isDoor = (gx, gy) => (M.doors || []).some(d => d.x === gx && d.y === gy);
    const cells = [];
    seen.forEach(function (k){
      const gx = k % COLS, gy = (k / COLS) | 0;
      if (isDoor(gx, gy)) return;
      const o = M.obj ? M.obj[M.rows[gy][gx]] : "";
      if (o === "stairup" || o === "stairdown" || o === "entrance" || o === "exitgate") return;
      const x = gx + .5, y = gy + .5;
      cells.push({ x: x, y: y, e: nearest(ent, x, y), a: nearest(avoid, x, y), r: rnd() });
    });
    cells.sort((a, b) => a.r - b.r);

    // --- 좀비 : 복도 1마리 · 교실과 운동장 · 옥상은 2마리 ---
    const hall = /복도/.test(M.name || "") || cells.length < 90;
    const want = hall ? 1 : 2;
    const homes = [];
    const takeZ = function (minE, test){
      for (const c of cells) {
        if (homes.length >= want) return;
        if (c.e < minE || c.a < 1.3 || !test(c)) continue;
        if (homes.some(h => Math.hypot(h.x - c.x, h.y - c.y) < 4)) continue;
        homes.push({ x: c.x, y: c.y });
      }
    };
    if (id === "rooftop") {                       // 옥상 : 공원에 1마리, 미로 속에 1마리
      takeZ(4.5, c => c.x < 11);
      takeZ(3, c => c.x > 12 && c.x < 21);
    }
    takeZ(4.5, () => true);
    takeZ(3.5, () => true);
    takeZ(2.5, () => true);                       // 문이 많은 복도는 조금 가까워도 괜찮게
    ZHOME[id] = homes;

    // --- 아이템 : 방 3곳 중 2곳에 하나씩, ❤ 회복약 / 💉 주사기를 번갈아 ---
    const kinds = (ITEM_SKIP && idx % ITEM_SKIP === ITEM_SKIP - 1) ? []
                : [itemRoom++ % 2 ? "syringe" : "potion"];
    const items = [];
    for (const kind of kinds) {
      for (const c of cells) {
        if (c.e < 2.2 || c.a < 1.6) continue;
        if (homes.some(h => Math.hypot(h.x - c.x, h.y - c.y) < 2)) continue;
        if (items.some(t => Math.hypot(t.x - c.x, t.y - c.y) < 3)) continue;
        items.push({ kind: kind, x: c.x, y: c.y, gone: 0 });
        break;
      }
    }
    ITEMS[id] = items;
  });
}
// 방에 들어갈 때마다 그 방의 좀비가 제자리에 다시 나타납니다
function spawnZombies(){
  zombies = (ZHOME[room] || []).map(function (h, i){
    return { id: room + "_" + i, x: h.x, y: h.y, hx: h.x, hy: h.y, stun: 0, cool: 0, hit: 0,
             aggro: false, wait: 0.6 + i * 0.4, wt: 0, wx: 0, wy: 0 };
  });
  enterSafe = ENTER_SAFE;
  flowKey = "";
  fx = [];
}

// 주인공이 있는 칸에서부터 걸음 수를 세어 둡니다 (좀비가 책상을 돌아서 쫓아오도록)
let flow = null, flowKey = "";
function buildFlow(){
  const gx = Math.floor(p.x), gy = Math.floor(p.y), key = room + ":" + gx + "," + gy;
  if (key === flowKey) return;
  flowKey = key;
  flow = new Int16Array(COLS * ROWS).fill(-1);
  const st = gx + gy * COLS;
  if (!(gx >= 0 && gy >= 0 && gx < COLS && gy < ROWS)) return;
  flow[st] = 0;
  const q = [st];
  for (let h = 0; h < q.length; h++) {
    const c = q[h], x = c % COLS, y = (c / COLS) | 0;
    for (const d of [[1,0],[-1,0],[0,1],[0,-1]]) {
      const nx = x + d[0], ny = y + d[1];
      if (!(nx >= 0 && ny >= 0 && nx < COLS && ny < ROWS)) continue;
      const k = nx + ny * COLS;
      if (flow[k] < 0 && freeIn(room, nx, ny)) { flow[k] = flow[c] + 1; q.push(k) }
    }
  }
}
function chaseTarget(z){
  const gx = Math.floor(z.x), gy = Math.floor(z.y);
  if (Math.hypot(p.x - z.x, p.y - z.y) < 1.3 || !flow) return { x: p.x, y: p.y };
  const here = flow[gx + gy * COLS];
  if (here < 0) return { x: p.x, y: p.y };
  const at = (x, y) => (x >= 0 && y >= 0 && x < COLS && y < ROWS) ? flow[x + y * COLS] : -1;
  let best = null, bv = here;
  for (const d of [[1,0],[-1,0],[0,1],[0,-1],[1,1],[1,-1],[-1,1],[-1,-1]]) {
    const nx = gx + d[0], ny = gy + d[1], v = at(nx, ny);
    if (v < 0 || v >= bv) continue;
    if (d[0] && d[1] && (at(gx + d[0], gy) < 0 || at(gx, gy + d[1]) < 0)) continue;   // 모서리는 대각선으로 못 지나감
    bv = v; best = { x: nx + .5, y: ny + .5 };
  }
  return best || { x: p.x, y: p.y };
}
function zBlocked(x, y){
  const R = 0.2;
  return blocked(x - R, y - R) || blocked(x + R, y - R) || blocked(x - R, y + R) || blocked(x + R, y + R);
}
function zMove(z, tx, ty, sp){
  let dx = tx - z.x, dy = ty - z.y;
  const d = Math.hypot(dx, dy);
  if (d < 1e-4) return false;
  const s = Math.min(d, sp);
  dx = dx / d * s; dy = dy / d * s;
  if (!zBlocked(z.x + dx, z.y + dy)) { z.x += dx; z.y += dy; return true }
  let moved = false;
  if (dx && !zBlocked(z.x + dx, z.y)) { z.x += dx; moved = true }
  if (dy && !zBlocked(z.x, z.y + dy)) { z.y += dy; moved = true }
  return moved;
}
function updateZombies(dt){
  gameT += dt;
  if (hurtT > 0) hurtT -= dt;
  if (atkT > 0) atkT -= dt;
  if (atkCool > 0) atkCool -= dt;
  if (enterSafe > 0) enterSafe -= dt;
  buildFlow();
  for (const z of zombies) {
    if (z.hit > 0) z.hit = Math.max(0, z.hit - dt * 3);
    if (z.cool > 0) z.cool -= dt;
    if (z.stun > 0) {                                 // 기절 : 움직이지도, 공격하지도 못합니다
      z.stun -= dt;
      if (z.stun <= 0) { z.stun = 0; z.wait = 0.5; floatText("😵 깨어남!", z.x, z.y, "info") }
      continue;
    }
    if (z.wait > 0) { z.wait -= dt; continue }
    const pd = Math.hypot(p.x - z.x, p.y - z.y);
    if (!z.aggro && pd < Z_SEE) { z.aggro = true; floatText("❗", z.x, z.y, "alert") }
    else if (z.aggro && pd > Z_LOSE) z.aggro = false;
    if (z.aggro) {
      if (pd > Z_HIT_R * 0.75) { const t = chaseTarget(z); zMove(z, t.x, t.y, Z_SPEED * dt) }
      if (pd < Z_HIT_R && z.cool <= 0 && hurtT <= 0 && enterSafe <= 0) { zombieHit(z); if (warping()) return }
    } else {                                          // 혼자 어슬렁어슬렁 (제자리에서 너무 멀어지면 돌아감)
      z.wt -= dt;
      if (z.wt <= 0) {
        z.wt = 1 + Math.random() * 2.2;
        if (Math.hypot(z.x - z.hx, z.y - z.hy) > 3) {
          const a = Math.atan2(z.hy - z.y, z.hx - z.x); z.wx = Math.cos(a); z.wy = Math.sin(a);
        } else if (Math.random() < 0.35) { z.wx = 0; z.wy = 0 }
        else { const a = Math.random() * Math.PI * 2; z.wx = Math.cos(a); z.wy = Math.sin(a) }
      }
      if ((z.wx || z.wy) && !zMove(z, z.x + z.wx, z.y + z.wy, Z_WANDER * dt)) z.wt = 0;
    }
  }
  // 좀비끼리 한 자리에 겹치지 않게 살짝 밀어냅니다
  for (let i = 0; i < zombies.length; i++) for (let j = i + 1; j < zombies.length; j++) {
    const a = zombies[i], b = zombies[j], dx = b.x - a.x, dy = b.y - a.y, d = Math.hypot(dx, dy);
    if (d >= 0.55 || d < 1e-4) continue;
    const push = (0.55 - d) / 2, ux = dx / d * push, uy = dy / d * push;
    if (!a.stun && !zBlocked(a.x - ux, a.y - uy)) { a.x -= ux; a.y -= uy }
    if (!b.stun && !zBlocked(b.x + ux, b.y + uy)) { b.x += ux; b.y += uy }
  }
  pickItems();
}
// 좀비에게 공격당함
function zombieHit(z){
  life = Math.max(0, life - 1);
  hurtT = HURT_SAFE; z.cool = 1.1;
  const dx = p.x - z.x, dy = p.y - z.y, d = Math.hypot(dx, dy) || 1;
  for (let k = 0; k < 7; k++) {                       // 뒤로 살짝 밀려납니다
    const nx = p.x + dx / d * 0.09, ny = p.y + dy / d * 0.09;
    if (bodyBlocked(nx, ny)) break;
    p.x = nx; p.y = ny;
  }
  floatText("-1 ❤", p.x, p.y, "hurt");
  flashHurt(); sfx("hurt"); updateVitals("h");
  if (life <= 0) { knockedOut(); return }
  if (life === 1) notice("⚠ 라이프가 1 남았습니다! ❤ 회복약을 찾거나 E 로 좀비를 기절시키세요.", 2800);
  else notice("🧟 좀비에게 물렸습니다! 라이프 " + life + " / " + MAX_LIFE, 1600);
}
// 라이프가 0 : 정문으로 돌아가서 다시 시작 (푼 문제는 그대로)
function knockedOut(){
  keys.clear();
  life = MAX_LIFE;
  ammo = Math.max(ammo, START_AMMO);
  hurtT = HURT_SAFE;
  startWarp("zombie");
  updateVitals();
  setTimeout(saveState, 0);
}
// E 로 찌를 수 있는(깨어 있는) 가장 가까운 좀비
function nearZombie(){
  let best = null, br = ATTACK_R;
  for (const z of zombies) {
    if (z.stun > 0) continue;
    const r = Math.hypot(p.x - z.x, p.y - z.y);
    if (r < br) { br = r; best = z }
  }
  return best;
}
function attackZombie(z){
  if (atkCool > 0) return;
  ammo--;
  atkCool = 0.45; atkT = 0.32;
  const dx = z.x - p.x, dy = z.y - p.y;
  atkFace = Math.atan2(dx, dy);
  p.dir = Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? 2 : 1) : (dy > 0 ? 0 : 3);
  z.stun = STUN_SEC; z.hit = 1; z.aggro = true; z.wait = 0;
  const d = Math.hypot(dx, dy) || 1;                  // 찔린 좀비는 살짝 뒤로
  for (let k = 0; k < 4; k++) {
    const nx = z.x + dx / d * 0.08, ny = z.y + dy / d * 0.08;
    if (zBlocked(nx, ny)) break;
    z.x = nx; z.y = ny;
  }
  floatText("💉 기절!", z.x, z.y, "stun");
  sfx("stab"); updateVitals("a");
  if (ammo === 0) notice("💉 주사기를 다 썼습니다! 바닥의 💉 주사기 아이템을 찾아 보충하세요.", 2600);
  else notice("💉 명중! 좀비가 " + STUN_SEC + "초 동안 기절합니다. (남은 주사기 " + ammo + ")", 1600);
}
// ---------- 아이템 줍기 (위로 걸어가면 저절로 줍습니다) ----------
function itemUp(it){ return !it.gone || gameT >= it.gone }
function pickItems(){
  for (const it of (ITEMS[room] || [])) {
    if (!itemUp(it)) continue;
    it.gone = 0;
    if (Math.hypot(p.x - it.x, p.y - it.y) > 0.62) continue;
    if (it.kind === "potion") {
      if (life >= MAX_LIFE) {
        if (!it.told || gameT - it.told > 4) { it.told = gameT; floatText("라이프 가득!", it.x, it.y, "info") }
        continue;                                     // 라이프가 가득하면 두고 갑니다
      }
      const before = life;
      life = Math.min(MAX_LIFE, life + POTION_HEAL);
      floatText("+" + (life - before) + " ❤", p.x, p.y, "heal");
      notice("❤ 회복약을 마셨습니다! 라이프 " + life + " / " + MAX_LIFE, 1600);
      sfx("heal"); updateVitals("h");
    } else {
      ammo += AMMO_PACK;
      floatText("+" + AMMO_PACK + " 💉", p.x, p.y, "ammo");
      notice("💉 주사기를 주웠습니다! 공격 횟수 +" + AMMO_PACK + " (지금 " + ammo + "번)", 1600);
      sfx("pick"); updateVitals("a");
    }
    it.gone = gameT + ITEM_RESPAWN;
    saveState();
  }
}
// ---------- 화면 표시 : 라이프 · 주사기 ----------
function updateVitals(bump){
  const v = document.getElementById("vital");
  if (!v) return;
  v.style.display = ZOMBIE_ON ? "" : "none";
  if (!ZOMBIE_ON) return;
  const h = document.getElementById("hearts"), a = document.getElementById("ammo");
  let s = "";
  for (let i = 0; i < MAX_LIFE; i++) s += i < life ? "<i>❤️</i>" : "<i class=\"off\">🤍</i>";
  if (h) h.innerHTML = s;
  if (a) { a.textContent = ammo; a.parentNode.classList.toggle("zero", ammo <= 0) }
  v.classList.toggle("low", life <= 1);
  if (bump) {
    const el = v.querySelector(bump === "h" ? ".hearts" : ".ammo");
    if (el) { el.classList.remove("bump"); void el.offsetWidth; el.classList.add("bump") }
  }
}
function flashHurt(){
  const el = document.getElementById("hurt");
  if (!el) return;
  el.classList.remove("on"); void el.offsetWidth; el.classList.add("on");
}
function floatText(t, x, y, cls){
  fx.push({ id: ++fxId, t: t, x: x, y: y, cls: cls || "info", born: performance.now() });
  if (fx.length > 12) fx.shift();
}
// ---------- 가까이 가면 반응하는 물건 (react.js 의 GAME_REACT) ----------
// 주인공이 물건 가까이 가면 말풍선 · 그림 · 짧은 소리로 반응합니다 (문제 · 진행과는 상관없는 재미용).
// 구글 시트 '설정' 탭의 '재미 효과 | N' 이면 모두 꺼지고, '효과음 | N' 이면 소리만 꺼집니다.
const reactCool = {};
let reactLast = 0;
const FX_API = {
  room: function (){ return room },
  player: function (){ return { x: p.x, y: p.y } },
  project: function (x, h, y){ return World3D.project(x, h, y) },
  muted: function (){ return false },
  busy: function (){ return !started || finished || modalOpen() || warping() }
};
window.GAME_FX = FX_API;
function reactTick(){
  const R = window.GAME_REACT;
  if (!R || SET.fun === false || FX_API.busy()) return;
  const now = performance.now();
  if (now - reactLast < 1300) return;                    // 반응이 너무 몰리지 않게
  const m = map(), px = p.x, py = p.y;
  let best = null;
  for (let yy = Math.floor(py) - 2; yy <= Math.floor(py) + 2; yy++) {
    const row = m.rows[yy]; if (!row) continue;
    for (let xx = Math.floor(px) - 2; xx <= Math.floor(px) + 2; xx++) {
      const o = (m.obj || {})[row[xx]], spec = o && R[o];
      if (!spec) continue;
      const d = Math.hypot(px - xx - .5, py - yy - .5);
      if (d > (spec.r || 1.4)) continue;
      const key = room + ":" + xx + ":" + yy;
      if ((reactCool[key] || 0) > now || (reactCool[room + ":" + o] || 0) > now) continue;
      if (!best || d < best.d) best = { d: d, o: o, spec: spec, key: key, x: xx + .5, y: yy + .5 };
    }
  }
  if (!best) return;
  const s = best.spec;
  reactCool[best.key] = now + (s.cool || 12) * 1000;
  reactCool[room + ":" + best.o] = now + (s.typeCool || 3) * 1000;
  if (s.p !== undefined && Math.random() > s.p) return;
  reactLast = now;
  try { s.fn(FX_API, { o: best.o, x: best.x, y: best.y, room: room }) } catch (e) { console.warn("react", e) }
}

// ---------- 짧은 효과음 (따로 파일 없이 브라우저가 소리를 만듭니다) ----------
let AC = null;
function sfx(kind){
  const S = { stab: [900, 1500, 0.12, "square", 0.05], hurt: [240, 80, 0.28, "sawtooth", 0.08],
              heal: [523, 1046, 0.3, "sine", 0.12], pick: [660, 1320, 0.2, "triangle", 0.12] }[kind];
  if (!S) return;
  try {
    AC = AC || new (window.AudioContext || window.webkitAudioContext)();
    if (AC.state === "suspended") AC.resume();
    const t = AC.currentTime, o = AC.createOscillator(), g = AC.createGain();
    o.type = S[3];
    o.frequency.setValueAtTime(S[0], t);
    o.frequency.exponentialRampToValueAtTime(S[1], t + S[2]);
    g.gain.setValueAtTime(S[4], t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + S[2]);
    o.connect(g); g.connect(AC.destination);
    o.start(t); o.stop(t + S[2] + 0.03);
  } catch (e) {}
}

// ---------- 맵 불러오기 ----------
function start(x){
  maps = x; planWorld(); setRoom("gate", 5.5, 9.5); startRender(); updateVitals();
  askName();
}
// 시작 화면 (start.js). 파일이 없으면 이름 없이 바로 시작합니다.
function askName(){
  if (!window.StartScreen || !StartScreen.open) { started = true; return }
  started = false;
  StartScreen.open({
    title: GAME_TITLE,
    subtitle: "타임머신이 고장 나 송나라 시장 거리에 떨어졌어요! 가게마다 물건을 사고 흥정하며 8과 문제를 풀고, 타임머신을 고쳐 현재로 돌아가세요.",
    example: DEFAULT_NAME,
    max: 12,
    onAdmin: function (name) {                 // 선생님이 관리자 비밀번호를 넣었을 때
      return window.SHEET_ADMIN ? SHEET_ADMIN.open(name) : 0;
    },
    team: TEAM_MODE,
    resume: resumeInfo(),                  // 🔄 5분 안에 다시 들어오면 이름 · 역할이 미리 골라져 있습니다
    version: VERSION + (ROOMS ? " · 🚪 방 " + ROOMS.limit + "개" : "") + (ZOMBIE_ON ? " · 🧟 좀비" : "") + (NPC_QUIZ ? " · 🗣 NPC 문제" : ""),
    minGroup: 2,
    baseMax: 5,
    maxGroup: MAX_GROUP
  }, function (info) {
    p.name = info.name;                    // 캐릭터 위 이름표와 표창장에 함께 쓰입니다
    group = Math.max(1, Math.min(MAX_GROUP, info.group || 1));
    role  = Math.max(1, Math.min(group, info.role || 1));
    started = true;
    const hudName = document.querySelector("#hud .person b");
    if (hudName) hudName.textContent = p.name;
    const back = readSave(p.name);                 // 5분 안에 같은 이름으로 다시 들어왔다면
    if (back) {
      const n = restoreSave(back);
      mission(); saveState();
      notice("🔄 " + p.name + " 님, 아까 풀던 곳에서 이어합니다. (푼 문제 " + n + "개)", 4200);
      return;
    }
    clearSave();
    mission();
    if (ZOMBIE_ON) setTimeout(function(){
      notice("🧟 시장 곳곳에 좀비가 있어요! 가까이 오면 E 로 💉 주사기 공격 (" + ammo + "번). ❤ 회복약 · 💉 주사기를 주우세요.", 6000);
    }, 3300);
    notice(group > 1
      ? "📍 송나라 汴京 성문 앞 — " + p.name + " (" + group + "명 중 " + role + "번 역할) 출발!"
      : "📍 송나라 汴京 성문 앞 — " + p.name + " 도착! Duōshao qián?", 3000);
  });
}
// 화면 가운데 안내문 (데이터 오류 · 3D 를 켤 수 없음 · 자가진단)
function sysmsg(title, lines, tone){
  const el = document.getElementById("sysmsg");
  if (!el) { alert(title + "\n" + lines.join("\n")); return }
  el.innerHTML = "<div class=\"sbox\"><b>" + esc(title) + "</b>" +
    lines.map(function (l){ return "<p>" + esc(l) + "</p>" }).join("") + "</div>";
  el.className = "show" + (tone ? " " + tone : "");
}
function hideSysmsg(){ const el = document.getElementById("sysmsg"); if (el) el.className = "" }
function fail(msg){
  sysmsg("데이터를 불러오지 못했습니다",
    [msg, "구글 시트 주소와 공유 설정, data 폴더의 quiz.js 를 확인하세요."]);
}
function no3D(){
  sysmsg("3D 화면을 켤 수 없습니다", [
    "이 브라우저(또는 기기)에서는 3D 그래픽(WebGL)을 쓸 수 없습니다.",
    "크롬 · 엣지 · 사파리 최신 버전으로 열거나, 브라우저 설정에서 '하드웨어 가속'을 켜 주세요.",
    "lib 폴더의 three.min.js 와 world3d.js 파일이 함께 올라가 있는지도 확인하세요."
  ]);
}
function load(){
  if (!has3D) { no3D(); return }
  if (QUIZ.length === 0) { fail("문제가 하나도 없습니다. (시트와 data/quiz.js 모두 비어 있음)"); return }
  if (window.QUIZ_NOTICE) setTimeout(function(){ notice(window.QUIZ_NOTICE, 6000) }, 900);
  if (window.MAPS) { start(window.MAPS); return }
  fetch("data/maps.json").then(r => r.json()).then(start)
    .catch(e => fail(location.protocol === "file:"
      ? "로컬(file://) 실행에서는 maps.json을 읽을 수 없습니다." : String(e)));
}

// ---------- 방 이동 ----------
function map(){ return maps[room] }
// 지금 방을 3D 로 새로 짓습니다 (문 색깔은 가 본 곳 / 다 푼 곳에 따라 달라집니다)
function load3d(){
  if (!has3D || !map()) return;
  try { World3D.loadRoom(room, map(), { doorState: doorTile }) } catch (e) { oops("3D 방 만들기", e) }
}
function setRoom(id, x, y){
  room = id;
  visited.add(id);
  p.x = (x === undefined || x === null) ? map().spawn[0] : x;
  p.y = (y === undefined || y === null) ? map().spawn[1] : y;
  unstick();                                             // 혹시 물건 칸 위에 섰으면 가장 가까운 빈 칸으로
  spawnZombies();                                       // 🧟 이 방의 좀비가 제자리에 다시 나타납니다
  load3d();
  document.getElementById("place").textContent = map().name;
  if (started && !finished) setTimeout(saveState, 0);   // 방을 옮길 때마다 기록
  document.getElementById("where").textContent = map().name;
  mission(); notice("📍 " + map().name);
  // 처음 올라온 곳은 한 번만 짧게 안내합니다
  if (!firstTold[id]) {
    firstTold[id] = 1;
    const tip = ROOM_TIP[id];
    if (tip) setTimeout(function(){ notice(tip, 5200) }, 1500);
  }
}
const firstTold = {};
const ROOM_TIP = {
  gate:     "⏱ 타임머신이 송나라 汴京(변경) 성문 앞에 떨어졌어요! 성문으로 들어가면 시장 거리예요. 거리는 옆으로(→) 이어집니다.",
  hall1:    "🧵 첫째 거리 · 옷과 신발 거리예요. 비단 옷가게 · 신발 가게 · 염색 가게가 있고, 오른쪽 끝 문으로 다음 거리에 가요.",
  up2:      "🍎 둘째 거리 · 먹거리 거리예요. 과일 가게 · 빵 가게 · 마파두부 식당이 있어요.",
  up3:      "📚 셋째 거리 · 책과 종이 거리예요. 서점 · 剪纸 가게 · 환전소(钱庄)가 있어요.",
  up4:      "💰 넷째 거리 · 장터 거리예요. 买一送一 잡화점 · 흥정 마당 · 찻집이 있고, 오른쪽 끝은 강변이에요.",
  rooftop:  "🌉 강변 무지개 다리(虹桥)예요! 다리 꼭대기에 올라가 보세요. 오른쪽 짐 상자 미로 끝에 마지막 문제가 있습니다!"
};

// ---------- HUD ----------
function mission(){
  const n = solvedQ.size, N = stations.length;
  document.getElementById("progress").textContent = n + " / " + N;
  document.getElementById("pass").textContent = found.map(v => v === null ? "?" : v).join(" ");
  const here = stations.filter(s => s.room === room && !solvedQ.has(s.i));
  let t;
  if (n < N) {
    t = here.length
      ? "이 방에 떠 있는 📝 시험지로 가서 E를 눌러 문제를 푸세요."
      : "남은 문제 " + (N - n) + "개를 찾아 시장 거리와 가게를 다녀 보세요.";
  } else if (useTreasure) {
    t = !chestOpened ? "문제를 다 풀었습니다! 성문 앞 타임머신 옆 부품 상자를 열어 보세요."
      : passOk ? "마지막 평가만 남았습니다. 타임머신에서 E를 누르세요."
      : "부품 상자 속 마지막 문제의 답을 타임머신에 입력하세요.";
  } else if (found.indexOf(null) >= 0) {
    t = "문제를 다 풀었습니다. 알아낸 번호로 타임머신을 켜세요.";
  } else {
    t = "🎉 비밀번호 " + found.join("") + " 를 알아냈습니다. 성문 앞 타임머신으로 가세요.";
  }
  document.getElementById("mission").textContent = t;
  // 제목줄 한 줄 상태판 : 이름 · 푼 문제 · 비밀번호 · 현재 미션
  const mini = document.getElementById("mini");
  if (mini) {
    mini.innerHTML = "";
    const add = function (cls, big, small, val) {
      const s = document.createElement("span");
      s.className = "chip" + (cls ? " " + cls : "");
      const l1 = document.createElement("span"); l1.className = "lg"; l1.textContent = big;
      const l2 = document.createElement("span"); l2.className = "sm"; l2.textContent = small;
      s.appendChild(l1); s.appendChild(l2);
      if (val !== undefined) { const b = document.createElement("b"); b.textContent = val; s.appendChild(b) }
      mini.appendChild(s);
    };
    add("who", "👤 " + p.name, "👤 " + p.name);
    add("", "푼 문제", "문제", n + " / " + N);
    if (group > 1) add("", "역할", "역할", role + " / " + group);
    if (useTreasure) {
      add("", "부품 상자", "상자", passOk ? "통과" : chestOpened ? "열림" : n >= N ? "열 수 있음" : "잠김");
    } else {
      add("", "비밀번호", "비번", found.map(v => v === null ? "?" : v).join(" "));
    }
    const m = document.createElement("span"); m.className = "msn"; m.textContent = t;
    mini.appendChild(m);
  }
  document.getElementById("ctrlMsg").textContent = t;
  const cs = document.getElementById("ctrlStat");
  cs.innerHTML = "";
  const chip = function (label, val) {
    const s = document.createElement("span");
    s.textContent = label;
    const bb = document.createElement("b"); bb.textContent = val;
    s.appendChild(bb); cs.appendChild(s);
  };
  chip("푼 문제", n + " / " + N);
  if (useTreasure) chip("부품 상자", passOk ? "통과" : chestOpened ? "열림" : n >= N ? "열 수 있음" : "잠김");
  else chip("비밀번호", found.map(v => v === null ? "?" : v).join(" "));
}
function notice(t, ms){
  const n = document.getElementById("notice");
  n.textContent = t; n.style.display = "block";
  clearTimeout(notice.t);
  notice.t = setTimeout(function(){ n.style.display = "none" }, ms || 1800);
}
// 말풍선은 글자가 길수록 조금 더 오래 띄워 둡니다 (선생님이 적은 긴 대사도 읽을 수 있게)
// 받침에 따라 '로' / '으로' 를 골라 붙입니다 (계단으로 · 과학실로 · 교실로)
// 받침에 따라 '이' / '가' 를 골라 붙입니다 (체육 선생님이 · 경비 아저씨가)
function iGa(word){
  const w = String(word).trim(), c = w.charCodeAt(w.length - 1);
  if (!(c >= 0xAC00 && c <= 0xD7A3)) return w + "(이)가";
  return w + ((c - 0xAC00) % 28 ? "이" : "가");
}
function withRo(word){
  const w = String(word).trim(), c = w.charCodeAt(w.length - 1);
  if (!(c >= 0xAC00 && c <= 0xD7A3)) return w + "(으)로";
  const jong = (c - 0xAC00) % 28;
  return w + (jong === 0 || jong === 8 ? "로" : "으로");
}
function bubble(t, x, y, who){
  const ms = Math.max(2600, Math.min(7000, 1500 + String(t).length * 110));
  const until = performance.now() + ms;
  bubbles.push({ t: t, x: x, y: y, who: who, until: until });
  return until;
}

// ---------- 충돌 / 근접 판정 ----------
function blocked(x, y){
  const r = map();
  if (!r) return true;
  const gx = Math.floor(x), gy = Math.floor(y);
  // NaN 은 모든 비교가 false 라서 반드시 이렇게 뒤집어 검사해야 합니다
  if (!(gx >= 0 && gy >= 0 && gx < COLS && gy < ROWS)) return true;
  if (chestHere() && gx === Math.floor(CHEST.x) && gy === Math.floor(CHEST.y)) return true;
  const c = r.rows[gy][gx];
  if (c === "#") return true;
  if (SOLID.includes(r.obj ? r.obj[c] : undefined)) return true;
  // ⛰ 입체 맵 : 지금 선 칸과 두 단 이상 높이가 다르면 축대(절벽)라서 못 갑니다 (한 단은 계단)
  if (r.lift) {
    const here = liftOf(r, Math.floor(p.x), Math.floor(p.y));
    if (Math.abs(liftOf(r, gx, gy) - here) > 1) return true;
  }
  return false;
}
function liftOf(r, gx, gy){
  const row = r && r.lift && r.lift[gy];
  const v = row ? parseInt(row.charAt(gx), 10) : 0;
  return v > 0 ? v : 0;
}
// 3D 캐릭터는 몸통이 있으니, 가운데 한 점이 아니라 발밑 네모(가로 0.44칸)로 부딪힘을 봅니다.
// 미로 길과 문은 한 칸 폭이라 충분히 지나갈 수 있습니다.
const BODY_X = 0.22, BODY_Y = 0.17;
// 방에 들어가거나 이어하기를 했을 때 몸이 물건 · 벽에 걸려 있으면, 가장 가까운 빈 자리로 살짝 옮깁니다
function unstick(){
  if (!bodyBlocked(p.x, p.y)) return;
  let best = null, bd = 1e9;
  for (let gy = 0; gy < ROWS; gy++) for (let gx = 0; gx < COLS; gx++) {
    const x = gx + .5, y = gy + .5;
    if (bodyBlocked(x, y)) continue;
    const d = Math.hypot(x - p.x, y - p.y);
    if (d < bd) { bd = d; best = { x: x, y: y } }
  }
  if (!best) return;
  if (!blocked(p.x, p.y) && bd > 0.6) return;            // 가장자리만 살짝 닿은 것은 그대로 (걸으면 빠져나옵니다)
  p.x = best.x; p.y = best.y;
}
function bodyBlocked(x, y){
  return blocked(x - BODY_X, y - BODY_Y) || blocked(x + BODY_X, y - BODY_Y) ||
         blocked(x - BODY_X, y + BODY_Y) || blocked(x + BODY_X, y + BODY_Y) || blocked(x, y);
}
// 모서리에 살짝 걸리면 길 가운데 쪽으로 슬쩍 밀어 줍니다 (문·미로 입구를 쉽게 통과)
function slide(axis, dir, s, bad){
  const cur = axis === "x" ? p.y : p.x;
  const c1 = Math.floor(cur) + .5, c2 = c1 + (cur > c1 ? 1 : -1);
  for (const c of [c1, c2]) {
    const d = c - cur;
    if (Math.abs(d) > 0.49 || Math.abs(d) < 0.004) continue;
    const ahead = axis === "x" ? bad(p.x + dir * 0.35, c) : bad(c, p.y + dir * 0.35);
    if (ahead) continue;
    const st = Math.sign(d) * Math.min(Math.abs(d), s * 0.9);
    if (axis === "x") { if (!bad(p.x, p.y + st)) { p.y += st; return true } }
    else { if (!bad(p.x + st, p.y)) { p.x += st; return true } }
  }
  return false;
}
function dist(a, b){ return Math.hypot(p.x - a, p.y - b) }
function nearDoor(){
  return (map().doors || []).map(d => ({ d: d, r: dist(d.x + .5, d.y + .5) }))
    .filter(v => v.r < 1.4).sort((a, b) => a.r - b.r)[0];
}
function nearStation(){
  return stations.filter(s => s.room === room && shownSt(s)).map(s => ({ s: s, r: dist(s.x, s.y) }))
    .filter(v => v.r < 1.6).sort((a, b) => a.r - b.r)[0];
}
function nearNpc(){
  return npcs.filter(v => v.room === room).map(n => ({ n: n, r: dist(n.x, n.y) }))
    .filter(v => v.r < 1.6).sort((a, b) => a.r - b.r)[0];
}
// ---------- 부품 상자 ----------
function chestHere(){ return useTreasure && CHEST.room === room }
function nearChest(){
  if (!chestHere()) return undefined;
  const r = dist(CHEST.x, CHEST.y);
  return r < 1.7 ? { c: CHEST, r: r } : undefined;
}
function chestReady(){ return solvedQ.size >= stations.length }
function openChest(){
  const N = stations.length;
  if (!chestReady()) {
    showDialog("🔒 부품 상자가 잠겨 있다",
      "묵직한 자물쇠에 숫자판이 붙어 있습니다. 지금은 " + solvedQ.size + " / " + N + ".\n" +
      "시장 곳곳의 문제를 모두 풀면 저절로 열린다고 합니다.");
    return;
  }
  const first = !chestOpened;
  chestOpened = true;
  mission(); saveState();
  const note = String(TRE.note || "").trim();

  if (group <= 1) {                       // 혼자 하기 : 문제 전체가 보입니다
    showDialog(first ? "🎁 부품 상자가 열렸다!" : "📜 상자 속 쪽지",
      (first ? "상자 안에는 보물 대신 낡은 쪽지 한 장이 들어 있습니다.\n\n"
             : "쪽지를 다시 펼쳐 봅니다.\n\n") +
      "❓ " + String(TRE.question || "").trim() + "\n\n" +
      (note ? note + "\n\n" : "") +
      "이 물음의 답이 타임머신 비밀번호입니다.\n타임머신 앞에서 E를 눌러 입력하세요.");
    return;
  }

  const split = chestSplit();             // 함께하기 : 내 조각만 보입니다
  const mine = myPieceText();
  showDialog((first ? "🎁 부품 상자가 열렸다! — " : "📜 내 쪽지 조각 — ") + role + "번 역할",
    (first ? "상자 안에 쪽지가 조각조각 찢어져 있습니다.\n" : "") +
    "내 몫으로 보이는 조각은 이것뿐입니다.\n\n" +
    (mine ? "❝ " + mine + " ❞" : "(이 역할에는 조각이 없습니다)") + "\n\n" +
    "쪽지는 모두 " + split.parts.length + "조각이고, " + group + "명이 1번부터 한 조각씩 나눠 가졌습니다.\n" +
    (split.sep === " "
      ? "친구들의 조각을 번호 순서대로 이어 붙이면 마지막 문제가 됩니다.\n"
      : "친구들의 조각을 번호 순서대로 띄어쓰기 없이 이어 붙이면 마지막 문제가 됩니다.\n") +
    (note ? note + "\n" : "") +
    "그 답이 타임머신 비밀번호입니다.");
}
function nearAny(){
  // 문제 동그라미 위(또는 바로 옆)에 서 있으면, 옆에 NPC · 문 · 상자가 더 가까이 있어도 문제를 먼저 엽니다
  const st = nearStation();
  if (st) { const f = frontSpot(st.s); if (Math.hypot(p.x - f.x, p.y - f.y) < 0.8) return st }
  return [st, nearNpc(), nearChest(), nearDoor()].filter(Boolean).sort((a, b) => a.r - b.r)[0];
}

// ---------- 창 열고 닫기 ----------
function modalOpen(){ return !!document.querySelector(".modal.open") }
function openModal(id){ document.getElementById(id).classList.add("open") }
function closeModal(id){ document.getElementById(id).classList.remove("open") }

// ---------- 상호작용 ----------
// 이 친구의 대화 말풍선이 아직 떠 있나요?
function npcTalking(n){
  const now = performance.now();
  return bubbles.some(b => b.talk && b.who === n.name && b.until > now);
}
function interact(){
  if (!started || finished || modalOpen() || warping()) return;
  // 💉 깨어 있는 좀비가 가까이 있으면 E 는 주사기 공격이 먼저입니다
  const zt = nearZombie();
  if (zt) {
    if (ammo > 0) { attackZombie(zt); return }
    notice("💉 주사기가 없습니다! 도망쳐서 💉 주사기 아이템을 찾으세요.", 2200);
    if (!nearAny()) return;
  }
  const t = nearAny();
  if (!t) { notice("문이나 문제, 사람 가까이에서 E를 눌러 보세요."); return }
  if (t.s) { openQuiz(t.s); return }
  if (t.n) {
    const n = t.n;
    if (npcTalking(n)) return;                        // 말풍선이 사라지기 전에는 다시 말을 걸 수 없습니다
    if (questionsOf(n).length) { tellQuiz(n); return }  // NPC 문제 : 담당 NPC 는 문제만 말합니다
    n.hold = bubble(npcLine(n), n.x, n.y, n.name);   // 말풍선이 사라질 때까지 멈춰 있습니다
    bubbles[bubbles.length - 1].talk = true;          // 주인공이 걸어가면 바로 사라지는 대화 말풍선
    n.dir = p.y < n.y ? 3 : p.y > n.y ? 0 : p.x < n.x ? 1 : 2;   // 말 거는 쪽을 봅니다
    n.frame = 0;
    return;
  }
  if (t.c) { openChest(); return }
  const d = t.d;
  if (d.exit) {
    if (solvedQ.size < stations.length) {
      notice("문제를 모두 풀어야 타임머신이 켜집니다. (" + solvedQ.size + "/" + stations.length + ")");
      return;
    }
    if (passOk) { openExam(); return }   // 비밀번호는 통과했으니 바로 평가로
    // 부품 상자를 지나쳐 바로 교문으로 온 경우
    if (useTreasure && !chestOpened) {
      showDialog("🔒 타임머신이 멈춰 있다",
        "잠금 장치에 비밀번호를 넣어야 열립니다.\n\n" +
        "타임머신 바로 옆에 부품 상자가 놓여 있습니다.\n" +
        (group > 1
          ? "먼저 상자를 열어 내 쪽지 조각을 확인하고, 친구들의 조각과 합쳐 답을 알아내세요."
          : "먼저 상자를 열어 마지막 문제를 풀고, 그 답을 비밀번호로 입력하세요."));
      return;
    }
    openPad(); return;
  }
  // 도착 안내 말풍선 : 캐릭터가 움직이기 시작하면 바로 사라집니다
  bubble(withRo(d.label || "다른 곳") + " 이동했습니다.", p.x, p.y, p.name);
  bubbles[bubbles.length - 1].moveHide = true;
  setRoom(d.to, d.tx, d.ty);
}

// ---------- 문제 창 ----------
let curStation = null, answered = false, pendingWarp = false;
function shuffled(n){
  const a = [];
  for (let i = 0; i < n; i++) a.push(i);
  for (let i = a.length - 1; i > 0; i--) {
    const j2 = Math.floor(Math.random() * (i + 1));
    const t = a[i]; a[i] = a[j2]; a[j2] = t;
  }
  return a;
}
function openQuiz(st){
  curStation = st; answered = solvedQ.has(st.i);
  document.getElementById("quizTitle").textContent = st.name;
  document.getElementById("quizNum").textContent = (st.i + 1) + " / " + stations.length;
  // 모둠 문제면 내 조각만 보여 줍니다
  const teamQ = isTeamQ(st.q);
  const tbox = document.getElementById("quizTeam");
  lastQuizSt = st;
  if (teamQ) {
    const tq = teamQuestionText(st.q);
    document.getElementById("quizQ").textContent = tq.text ? "❝ " + tq.text + " ❞" : "(내 조각이 없습니다)";
    tbox.style.display = "block";
    tbox.innerHTML = '<b>👥 모둠 문제</b> · ' + group + '명 중 <b>' + role + '번</b> · 문제 ' +
      tq.total + '조각 가운데 내 조각만 보입니다<br>친구들의 조각을 번호 순서대로 모아 문제를 완성하세요.';
  } else if (st.teller && !answered) {
    // NPC 문제 : 문제 글은 보여 주지 않습니다 (들은 뒤에도). 보기 · 입력칸은 그대로 나옵니다.
    const who = st.teller.name, heard = heardQ.has(st.i);
    const act = isText(st.q) ? "답을 적으세요" : "답을 고르세요";
    document.getElementById("quizQ").textContent = heard
      ? "🗣 " + who + "에게 들은 문제예요."
      : "🗣 이 문제는 " + iGa(who) + " 알고 있어요.";
    tbox.style.display = "block";
    tbox.innerHTML = heard
      ? '<b>🗣 NPC 문제</b> · 시험지에는 문제가 적혀 있지 않아요.<br><b>' + esc(who) +
        '</b>에게 들은 문제를 떠올리며 ' + act + '. 기억이 안 나면 다시 물어봐도 돼요.'
      : '<b>🗣 NPC 문제</b> · 시험지에는 문제가 적혀 있지 않아요.<br>이 방에 있는 <b>' + esc(who) +
        '</b>에게 가서 <b>E</b> 를 눌러 말을 걸면 문제를 알려 줘요.';
  } else if (st.teller) {
    // 이미 맞힌 NPC 문제는 문제 글을 보여 줍니다
    document.getElementById("quizQ").textContent = st.q.question;
    tbox.style.display = "block";
    tbox.innerHTML = '🗣 <b>' + esc(st.teller.name) + '</b>에게 들은 문제예요.';
  } else {
    document.getElementById("quizQ").textContent = st.q.question;
    tbox.style.display = "none";
    tbox.innerHTML = "";
  }
  putImage(document.getElementById("quizImg"), st.q, "qimg");
  const box = document.getElementById("quizOpts");
  box.innerHTML = "";
  if (isText(st.q)) {
    // ── 주관식 : 직접 입력 ──
    const wrap = document.createElement("div"); wrap.className = "textans";
    const inp = document.createElement("input");
    inp.id = "quizAns"; inp.className = "ansinput"; inp.type = "text";
    inp.setAttribute("autocomplete", "off"); inp.setAttribute("autocorrect", "off");
    inp.setAttribute("autocapitalize", "off"); inp.spellcheck = false;
    inp.placeholder = "정답을 입력하세요";
    const go = document.createElement("button");
    go.id = "quizAnsGo"; go.className = "okbtn wide";
    go.textContent = "정답 확인";
    if (answered) {
      inp.value = answerOf(st.q); inp.disabled = true; inp.classList.add("right");
      go.disabled = true; go.style.display = "none";
    }
    go.onclick = function(){ submitText() };
    inp.onkeydown = function (e) {
      if (e.key === "Enter") { e.preventDefault(); e.stopPropagation(); submitText() }
      else if (e.key !== "Escape") e.stopPropagation();   // 글자 입력이 게임 조작으로 새지 않게
    };
    wrap.appendChild(inp); wrap.appendChild(go);
    box.appendChild(wrap);
    if (!answered) setTimeout(function(){ try { inp.value = ""; inp.focus() } catch (e) {} }, 0);
  } else {
  // 모둠 문제는 보기 번호를 친구들과 맞춰야 하므로 섞지 않습니다
  const multi = isMulti(st.q);
  st.order = st.q.team
    ? st.q.options.map(function (o, i){ return i })
    : shuffled(st.q.options.length);
  st.picked = new Set();
  const mineOpt = teamQ ? myOptionIndexes(st.q) : null;
  const rights = rightSet(st.q);
  if (multi && !answered) {
    const note = document.createElement("div");
    note.className = "multinote";
    note.textContent = "✔ 정답이 여러 개입니다. 모두 고른 뒤 [정답 확인]을 누르세요.";
    box.appendChild(note);
  }
  st.order.forEach(function (orig, k) {
    const b = document.createElement("button");
    b.className = "opt";
    const no = document.createElement("span"); no.className = "no"; no.textContent = k + 1;
    const tx = document.createElement("span"); tx.className = "tx";
    const hidden = teamQ && mineOpt.indexOf(orig) < 0;
    tx.textContent = hidden ? "🔒 친구가 가진 보기" : st.q.options[orig];
    if (hidden) b.classList.add("locked");
    b.appendChild(no); b.appendChild(tx);
    b.onclick = function(){ multi ? toggleOpt(k) : choose(k) };
    if (answered) b.disabled = true;
    if (answered && rights.indexOf(orig) >= 0) b.classList.add("right");
    if (!answered && st.wrongPicks && st.wrongPicks.indexOf(orig) >= 0) {
      b.classList.add("wrong"); b.disabled = true;
    }
    box.appendChild(b);
  });
  if (multi && !answered) {
    const go = document.createElement("button");
    go.id = "quizMultiGo"; go.className = "okbtn wide";
    go.textContent = "정답 확인 (0개 선택)";
    go.onclick = submitMulti;
    box.appendChild(go);
  }
  }
  document.getElementById("quizFeed").innerHTML = answered ? feedback(st) : "";
  const ok = document.getElementById("quizOk");
  ok.textContent = "확인";
  ok.style.display = answered ? "block" : "none";
  openModal("quiz");
}

function esc(s){ return String(s === undefined || s === null ? "" : s).replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;") }
// 문제에 그림이 있으면 넣어 줍니다 (주소가 잘못되면 조용히 숨깁니다)
function putImage(boxEl, q, cls){
  if (!boxEl) return;
  boxEl.innerHTML = "";
  if (!q || !q.image) { boxEl.style.display = "none"; return }
  boxEl.style.display = "block";
  const im = document.createElement("img");
  im.className = cls || "qimg";
  im.alt = "문제 그림";
  im.loading = "lazy";
  im.onerror = function(){ boxEl.style.display = "none" };
  im.src = q.image;
  boxEl.appendChild(im);
}
function feedback(st){
  const exp = String(st.q.explanation || "");
  let h = '<div class="ok">정답입니다!</div>';
  if (exp) h += '<div class="exp">' + esc(exp) + '</div>';
  const di = digitAt[st.i];
  if (di !== undefined) {
    h += '<div class="digit">🔑 비밀번호 <b>' + (di + 1) + '번째</b> 글자는 <b>' + PASS[di] + '</b> 입니다.</div>';
  } else if (useTreasure && solvedQ.size >= stations.length) {
    h += '<div class="digit">🎁 문제를 모두 풀었습니다! 타임머신 옆 <b>부품 상자</b>가 열립니다.</div>';
  } else if (useHints && HINTS.length) {
    h += '<div class="hint">💡 ' + esc(HINTS[st.i % HINTS.length]) + '</div>';
  } else {
    h += '<div class="hint">남은 문제 ' + (stations.length - solvedQ.size) + '개</div>';
  }
  return h;
}
// 이미 푼 문제 중 몇 개를 다시 풀어야 하는 상태로 되돌립니다
function resetSome(exclude){
  // 모둠 문제는 친구들과 다시 맞춰야 해서 되돌리지 않습니다
  // 옥상 미로 끝 문제도 되돌리지 않습니다 (미로를 다시 걸어야 해서)
  const pool = stations.filter(s => s.i !== exclude && solvedQ.has(s.i) && !s.q.team && !s.maze);
  const lost = [];
  for (let k = 0; k < RESET_ON_WRONG && pool.length; k++) {
    const s = pool.splice(Math.floor(Math.random() * pool.length), 1)[0];
    solvedQ.delete(s.i);
    s.wrongPicks = null;
    lost.push((s.i + 1) + "번 " + s.name + " (" + (s.floor || "") + ")");
  }
  return lost;
}
// 틀렸을 때 (객관식·주관식 공통) — 마법에 걸려 정문으로 돌아갑니다
function wrongAnswer(st){
  showMark(false);
  tries[st.i] = (tries[st.i] || 0) + 1;
  const lost = resetSome(st.i);
  const friend = roomFriend();
  const stay = !!st.maze;   // 미로 끝 문제는 그 자리에서 다시 풀 수 있게 합니다
  let h = '<div class="no2">' + (stay ? '아쉬워요. 다시 한 번 생각해 보세요!' : '아쉬워요. 마법에 걸렸습니다!') + '</div>';
  h += '<div class="magic">' + (stay
      ? '🌿 <b>미로 끝 문제는 성문 앞으로 돌아가지 않습니다.</b><br>여기서 <b>E</b> 를 눌러 바로 다시 풀 수 있어요.'
      : '✨ <b>성문 앞 광장으로 돌아가게 됩니다.</b>');
  if (lost.length) {
    h += '<br>그리고 이미 푼 문제 <b>' + lost.length + '개</b>가 다시 풀어야 할 문제로 바뀌었어요.<br>· ' +
         lost.map(esc).join('<br>· ');
  }
  h += '</div>';
  h += '<div class="friend"><b>' + esc(friend ? friend.name : "누군가") + ': </b>' +
       esc(wrongHint(st.q, tries[st.i])) + '</div>';
  document.getElementById("quizFeed").innerHTML = h;
  const ok = document.getElementById("quizOk");
  ok.textContent = stay ? "확인 — 여기서 다시 풀기" : "확인 — 성문 앞으로 돌아가기";
  ok.style.display = "block";
  pendingWarp = !stay;
  mission(); saveState();
}
// 주관식 정답 제출
function submitText(){
  if (answered || !curStation) return;
  const st = curStation, inp = document.getElementById("quizAns");
  if (!inp) return;
  const v = String(inp.value || "").trim();
  if (!v) {
    document.getElementById("quizFeed").innerHTML = '<div class="no2">정답을 입력해 주세요.</div>';
    try { inp.focus() } catch (e) {}
    return;
  }
  const go = document.getElementById("quizAnsGo");
  if (answerOk(st.q, v)) {
    answered = true;
    inp.value = answerOf(st.q); inp.disabled = true; inp.classList.add("right");
    if (go) go.style.display = "none";
    solvedQ.add(st.i);
    const di = digitAt[st.i];
    if (di !== undefined) found[di] = PASS[di];
    showMark(true);
    document.getElementById("quizFeed").innerHTML = feedback(st);
    document.getElementById("quizOk").style.display = "block";
    mission(); saveState();
    return;
  }
  inp.disabled = true; inp.classList.add("wrongin");
  if (go) go.disabled = true;
  wrongAnswer(st);
}
// 여러 개 고르는 문제 : 눌렀다 뗐다 하며 고릅니다
function toggleOpt(k){
  if (answered || !curStation) return;
  const st = curStation;
  const btns = document.getElementById("quizOpts").querySelectorAll(".opt");
  if (!btns[k] || btns[k].disabled) return;
  const orig = st.order ? st.order[k] : k;
  if (!st.picked) st.picked = new Set();
  if (st.picked.has(orig)) { st.picked.delete(orig); btns[k].classList.remove("on") }
  else { st.picked.add(orig); btns[k].classList.add("on") }
  const go = document.getElementById("quizMultiGo");
  if (go) go.textContent = "정답 확인 (" + st.picked.size + "개 선택)";
}
function submitMulti(){
  if (answered || !curStation) return;
  const st = curStation;
  const picked = Array.from(st.picked || []);
  if (!picked.length) {
    document.getElementById("quizFeed").innerHTML = '<div class="no2">정답이라고 생각하는 보기를 모두 골라 주세요.</div>';
    return;
  }
  const btns = document.getElementById("quizOpts").querySelectorAll(".opt");
  for (const b of btns) b.disabled = true;
  const go = document.getElementById("quizMultiGo");
  if (go) go.style.display = "none";
  const rights = rightSet(st.q);
  if (sameSet(picked, rights)) {
    answered = true;
    st.order.forEach(function (orig, k){ if (rights.indexOf(orig) >= 0) btns[k].classList.add("right") });
    solvedQ.add(st.i);
    const di = digitAt[st.i];
    if (di !== undefined) found[di] = PASS[di];
    showMark(true);
    document.getElementById("quizFeed").innerHTML = feedback(st);
    document.getElementById("quizOk").style.display = "block";
    mission(); saveState();
    return;
  }
  st.order.forEach(function (orig, k){
    if (picked.indexOf(orig) >= 0 && rights.indexOf(orig) < 0) btns[k].classList.add("wrong");
  });
  st.wrongPicks = [];
  wrongAnswer(st);
}
function choose(i){
  if (answered || !curStation) return;
  if (isMulti(curStation.q)) { toggleOpt(i); return }
  const st = curStation, btns = document.getElementById("quizOpts").querySelectorAll(".opt");
  if (!btns[i] || btns[i].disabled) return;
  const orig = st.order ? st.order[i] : i;
  if (orig !== st.q.answer) {
    btns[i].classList.add("wrong");
    for (const b of btns) b.disabled = true;
    st.wrongPicks = (st.wrongPicks || []).concat([orig]);
    wrongAnswer(st);
    return;
  }
  answered = true;
  for (const b of btns) b.disabled = true;
  btns[i].classList.add("right");
  solvedQ.add(st.i);
  const di = digitAt[st.i];
  if (di !== undefined) found[di] = PASS[di];
  showMark(true);
  document.getElementById("quizFeed").innerHTML = feedback(st);
  document.getElementById("quizOk").style.display = "block";
  mission(); saveState();
}

// ---------- 비밀번호 창 (키보드로 직접 입력) ----------
function openPad(){
  const inp = document.getElementById("padText");
  inp.value = "";
  inp.maxLength = 30;   // 글자 수로 정답 길이를 눈치채지 못하게 넉넉히
  document.getElementById("padHint").textContent = !useTreasure
    ? "알아낸 글자: " + found.map(v => v === null ? "?" : v).join(" ")
    : group > 1
      ? "📜 내 조각: " + (myPieceText() || "(없음)") + "   → 친구들 조각과 합쳐 답을 입력하세요"
      : "📜 " + String(TRE.question || "").trim() + "   → 답을 입력하세요";
  document.getElementById("padMsg").textContent = "";
  openModal("pad");
  // 창을 연 키가 입력칸에 들어가지 않도록 한 박자 뒤에 비우고 커서를 둡니다
  setTimeout(function(){ try { inp.value = ""; inp.focus() } catch (e) {} }, 0);
}
function checkPad(){
  const inp = document.getElementById("padText");
  const msg = document.getElementById("padMsg");
  const v = String(inp.value || "").trim();
  if (!v) { msg.textContent = "비밀번호를 입력해 주세요."; return }
  // 답이 여러 개면 / 로 나눠 적습니다 (예: huoche/火车/기차) · 성조 부호는 있어도 없어도 됩니다
  if (PASS.split("/").some(function (a){ return normAns(a) && normAns(a) === normAns(v) })) { closeModal("pad"); finish(); return }
  msg.textContent = "❌ 비밀번호가 다릅니다. 다시 입력하세요.";
  inp.value = "";
  try { inp.focus() } catch (e) {}
}

// ---------- 복습 화면 ----------
function openReview(){
  const sum = document.getElementById("reviewSum");
  const box = document.getElementById("reviewList");
  sum.innerHTML = ""; box.innerHTML = "";
  let perfect = 0, wrongTotal = 0;
  for (const st of stations) {
    const t = tries[st.i] || 0;
    if (t === 0) perfect++;
    wrongTotal += t;
  }
  const s1 = document.createElement("div");
  s1.innerHTML = "모두 <b>" + stations.length + "문제</b> 중 <b>" + perfect +
                 "문제</b>를 한 번에 맞혔어요. (틀린 횟수 합계 " + wrongTotal + "번)";
  sum.appendChild(s1);

  for (const st of stations) {
    const t = tries[st.i] || 0;
    const item = document.createElement("div"); item.className = "ritem";

    const head = document.createElement("div"); head.className = "rhead";
    const no = document.createElement("span"); no.className = "rno"; no.textContent = (st.i + 1) + "번";
    const where = document.createElement("span"); where.textContent = st.name;
    const tag = document.createElement("span");
    tag.className = "rtry " + (t === 0 ? "good" : "bad");
    tag.textContent = t === 0 ? "한 번에 정답" : t + "번 틀림";
    head.appendChild(no); head.appendChild(where); head.appendChild(tag);

    const q = document.createElement("div"); q.className = "rq"; q.textContent = st.q.question;
    const qim = document.createElement("div"); qim.className = "qimgbox small";
    putImage(qim, st.q, "qimg small");

    const ops = document.createElement("div"); ops.className = "rops";
    if (isText(st.q)) {
      const d = document.createElement("div"); d.className = "rop ok";
      d.textContent = "정답  " + answerOf(st.q) +
        ((st.q.answers || []).length > 1 ? "   (" + st.q.answers.slice(1).join(", ") + " 도 정답)" : "");
      ops.appendChild(d);
    } else {
      const rights2 = rightSet(st.q);
      if (isMulti(st.q)) {
        const n3 = document.createElement("div"); n3.className = "multinote small";
        n3.textContent = "✔ 정답이 " + st.q.multi.length + "개인 문제";
        ops.appendChild(n3);
      }
      st.q.options.forEach(function (o, i) {
        const isRight = rights2.indexOf(i) >= 0;
        const d = document.createElement("div");
        d.className = "rop" + (isRight ? " ok" : "");
        d.textContent = (isRight ? "정답  " : "　　　") + o;
        ops.appendChild(d);
      });
    }

    const ex = document.createElement("div"); ex.className = "rexp";
    ex.textContent = String(st.q.explanation || "");
    item.appendChild(head); item.appendChild(q); item.appendChild(qim); item.appendChild(ops);
    if (ex.textContent) item.appendChild(ex);
    box.appendChild(item);
  }
  openModal("review");
}

// ---------- 결과 창 ----------
function closeQuiz(){
  closeModal("quiz");
  if (pendingWarp) { pendingWarp = false; startWarp() }
}
let dialogNext = null, dialogConfirm = false;
// 창을 열기 전에 버튼 모양을 기본으로 되돌립니다
function resetDialogButtons(){
  document.getElementById("dialogNo").style.display = "none";
  const ok = document.getElementById("dialogOk");
  ok.textContent = "확인";
  ok.classList.remove("danger");
}
function showDialog(t, txt, next){
  dialogNext = next || null;
  dialogConfirm = false;
  resetDialogButtons();
  if (t.indexOf("탈출 성공") < 0) document.getElementById("dialogReview").style.display = "none";
  document.getElementById("dialogTitle").textContent = t;
  document.getElementById("dialogText").textContent = txt;
  openModal("dialog"); mission();
}
// 되묻는 창 : '취소' 를 누르거나 X 로 닫으면 아무 일도 일어나지 않습니다
function askDialog(t, txt, yesText, onYes){
  dialogNext = onYes || null;
  dialogConfirm = true;
  resetDialogButtons();
  document.getElementById("dialogReview").style.display = "none";
  document.getElementById("dialogNo").style.display = "inline-block";
  const ok = document.getElementById("dialogOk");
  ok.textContent = yesText || "확인";
  ok.classList.add("danger");
  document.getElementById("dialogTitle").textContent = t;
  document.getElementById("dialogText").textContent = txt;
  openModal("dialog");
}
function finish(){                       // 비밀번호를 맞혔을 때
  passOk = true;
  saveState();
  showDialog("🎉 비밀번호가 맞았습니다!",
    "축하합니다! 비밀번호 " + PASS.split("/")[0] + " 로 타임머신이 켜졌습니다! ⏱\n" +
    "마지막으로 지금까지 푼 문제를 평가합니다.", openExam);
}
// ---------- 탈출 성공 : 표창장 화면 + 불꽃놀이 ----------
let finished = false;
function escaped(){                      // 평가에서 100점을 맞았을 때
  if (finished) return;
  finished = true;
  clearSave();
  closeModal("exam"); closeModal("quiz"); closeModal("pad"); closeModal("dialog");
  keys.clear();
  document.getElementById("winName").textContent = p.name;
  const body = String(SET.winText || "").trim();      // 설정 시트에 문구가 있으면 그것으로
  if (body) {
    document.getElementById("winBody").innerHTML =
      body.split(/\r?\n/).map(esc).join("<br>");
  }
  const d = new Date();
  document.getElementById("winDate").textContent =
    d.getFullYear() + "년 " + (d.getMonth() + 1) + "월 " + d.getDate() + "일";
  document.getElementById("win").classList.add("open");
  startFireworks("fire", 5, true);
}

// 불꽃놀이 (쏘아 올린 뒤 터집니다)
let fireCv = null, fireCx = null, sparks = [], shells = [], fireOn = false, fireLast = 0;
const FIRE_COLORS = ["#ffd166","#ff7b9c","#7ee0ff","#9dff9d","#ffffff","#ffa14a","#c79bff"];
function fireSize(){
  if (!fireCv) return;
  const r = Math.min(2, window.devicePixelRatio || 1);
  fireCv.width = Math.floor(innerWidth * r);
  fireCv.height = Math.floor(innerHeight * r);
  fireCx.setTransform(r, 0, 0, r, 0, 0);
}
function shoot(){
  if (!fireCv) return;
  const w = innerWidth, h = innerHeight;
  shells.push({
    x: w * (0.15 + Math.random() * 0.7), y: h + 10,
    vy: -(h * (0.0115 + Math.random() * 0.003)),
    top: h * (0.12 + Math.random() * 0.26),
    color: FIRE_COLORS[Math.floor(Math.random() * FIRE_COLORS.length)]
  });
}
function burst(x, y, color){
  const n = 70 + Math.floor(Math.random() * 40);
  for (let i = 0; i < n; i++) {
    const a = Math.random() * Math.PI * 2, sp = 1.1 + Math.random() * 3.6;
    sparks.push({
      x: x, y: y, px: x, py: y,
      vx: Math.cos(a) * sp, vy: Math.sin(a) * sp,
      life: 1, fade: 0.008 + Math.random() * 0.009,
      color: Math.random() < 0.22 ? "#ffffff" : color
    });
  }
}
function fireStep(t){
  if (!fireOn) return;
  const dt = Math.min(40, t - (fireLast || t)); fireLast = t;
  const k = dt / 16.7;
  fireCx.clearRect(0, 0, innerWidth, innerHeight);
  fireCx.lineCap = "round";
  for (let i = shells.length - 1; i >= 0; i--) {
    const s = shells[i];
    s.py = s.y; s.y += s.vy * k; s.vy += 0.035 * k;
    fireCx.globalAlpha = 0.9; fireCx.strokeStyle = s.color; fireCx.lineWidth = 2.5;
    fireCx.beginPath(); fireCx.moveTo(s.x, s.py + 9); fireCx.lineTo(s.x, s.y); fireCx.stroke();
    if (s.y <= s.top || s.vy >= 0) { burst(s.x, s.y, s.color); shells.splice(i, 1) }
  }
  for (let i = sparks.length - 1; i >= 0; i--) {
    const q = sparks[i];
    q.px = q.x; q.py = q.y;
    q.x += q.vx * k; q.y += q.vy * k;
    q.vy += 0.042 * k; q.vx *= 0.985; q.vy *= 0.985;
    q.life -= q.fade * k;
    if (q.life <= 0) { sparks.splice(i, 1); continue }
    fireCx.globalAlpha = Math.max(0, q.life);
    fireCx.strokeStyle = q.color; fireCx.lineWidth = 2.2;
    fireCx.beginPath(); fireCx.moveTo(q.px, q.py); fireCx.lineTo(q.x, q.y); fireCx.stroke();
  }
  fireCx.globalAlpha = 1;
  requestAnimationFrame(fireStep);
}
// id 로 지정한 캔버스에 불꽃을 쏩니다. shots = 발수, keep = 그 뒤로도 가끔 계속 쏠지
let fireTimers = [];
function startFireworks(id, shots, keep){
  fireCv = document.getElementById(id || "fire");
  if (!fireCv || !fireCv.getContext) return;
  fireCx = fireCv.getContext("2d");
  fireSize();
  addEventListener("resize", fireSize);
  fireTimers.forEach(clearInterval); fireTimers = [];
  sparks = []; shells = []; fireOn = true; fireLast = 0;
  let n = 1, all = shots || 5;
  shoot();                                    // 처음 한 발
  if (all > 1) {
    const first = setInterval(function () {    // 이어서 나머지
      shoot();
      if (++n >= all) clearInterval(first);
    }, 520);
    fireTimers.push(first);
  }
  if (keep) fireTimers.push(setInterval(function(){ if (fireOn && !document.hidden) shoot() }, 3400));
  requestAnimationFrame(fireStep);
}
function stopFireworks(){
  fireOn = false;
  fireTimers.forEach(clearInterval); fireTimers = [];
  sparks = []; shells = [];
  try { fireCx && fireCx.clearRect(0, 0, innerWidth, innerHeight) } catch (e) {}
}

// ---------- 정답 O / 오답 X 표시 ----------
let markT = 0;
function showMark(ok){
  const box = document.getElementById("mark"), tx = document.getElementById("markTxt");
  if (!box || !tx) return;
  clearTimeout(markT);
  box.className = ok ? "on ok" : "on no";
  tx.textContent = ok ? "O" : "X";
  tx.style.animation = "none"; void tx.offsetWidth; tx.style.animation = "";
  if (ok) startFireworks("markFx", 2, false);          // 표창장과 같은 불꽃놀이
  else if (!finished) stopFireworks();                 // 앞의 불꽃이 남아 있으면 정리
  markT = setTimeout(function () {
    box.className = "";
    if (ok) stopFireworks();
  }, ok ? 1800 : 1100);
}

// ---------- 마지막 평가 (시험) ----------
let examPick = {}, examState = {}, examOrder = {};
function openExam(){
  examPick = {}; examState = {};
  examOrder = {};
  for (const st of stations) {
    examOrder[st.i] = st.q.team                       // 모둠 문제는 보기 순서를 섞지 않습니다
      ? st.q.options.map(function (o, i){ return i })
      : shuffled(st.q.options.length);
  }
  document.getElementById("examNum").textContent = "0 / " + stations.length;
  document.getElementById("examHint").textContent =
    "이번에는 정답 표시가 없습니다. " + stations.length + "문제를 모두 다시 풀어 100점을 맞아야 나갈 수 있어요.";
  document.getElementById("examMsg").innerHTML = "";
  drawExam();
  openModal("exam");
}
function examCount(){
  let n = 0;
  for (const st of stations) if (examPick[st.i] !== undefined) n++;
  return n;
}
function drawExam(){
  const box = document.getElementById("examList");
  box.innerHTML = "";
  for (const st of stations) {
    const state = examState[st.i];
    const item = document.createElement("div");
    item.className = "eq" + (state === "ok" ? " ok" : state === "bad" ? " bad" : "");

    const head = document.createElement("div"); head.className = "eqhead";
    const no = document.createElement("span"); no.className = "rno"; no.textContent = (st.i + 1) + "번";
    const where = document.createElement("span"); where.textContent = st.name;
    head.appendChild(no); head.appendChild(where);
    if (state) {
      const m = document.createElement("span");
      m.className = "eqmark " + (state === "ok" ? "ok" : "bad");
      m.textContent = state === "ok" ? "정답" : "다시 풀기";
      head.appendChild(m);
    }
    const q = document.createElement("div"); q.className = "eqq"; q.textContent = st.q.question;
    const qim = document.createElement("div"); qim.className = "qimgbox small";
    putImage(qim, st.q, "qimg small");

    const ops = document.createElement("div"); ops.className = "eops";
    if (isMulti(st.q)) {
      const n2 = document.createElement("div"); n2.className = "multinote small";
      n2.textContent = "✔ 정답이 여러 개입니다. 모두 고르세요.";
      ops.appendChild(n2);
    }
    if (isText(st.q)) {
      const inp = document.createElement("input");
      inp.className = "ansinput exam"; inp.type = "text";
      inp.setAttribute("autocomplete", "off"); inp.spellcheck = false;
      inp.placeholder = "정답을 입력하세요";
      inp.value = examPick[st.i] === undefined ? "" : String(examPick[st.i]);
      if (state === "ok") { inp.disabled = true; inp.classList.add("right") }
      inp.onkeydown = function (e){ if (e.key !== "Escape") e.stopPropagation() };
      inp.oninput = function(){ pickExamText(st.i, inp.value, item) };
      ops.appendChild(inp);
    } else
    examOrder[st.i].forEach(function (orig, k) {
      const many = isMulti(st.q);
      const picked = many ? (examPick[st.i] || []) : examPick[st.i];
      const b = document.createElement("button");
      b.className = "eop";
      if (state === "ok" && rightSet(st.q).indexOf(orig) >= 0) b.classList.add("right");
      else if (many ? picked.indexOf(orig) >= 0 : picked === orig) b.classList.add("sel");
      if (state === "ok") b.disabled = true;
      const no2 = document.createElement("span"); no2.className = "no"; no2.textContent = k + 1;
      const tx = document.createElement("span"); tx.textContent = st.q.options[orig];
      b.appendChild(no2); b.appendChild(tx);
      b.onclick = function(){ many ? pickExamMulti(st.i, orig) : pickExam(st.i, orig) };
      ops.appendChild(b);
    });
    item.appendChild(head); item.appendChild(q); item.appendChild(qim); item.appendChild(ops);
    box.appendChild(item);
  }
  document.getElementById("examNum").textContent = examCount() + " / " + stations.length;
}
function pickExamText(i, v, item){
  if (examState[i] === "ok") return;
  if (String(v).trim() === "") delete examPick[i]; else examPick[i] = v;
  examState[i] = undefined;
  if (item) {
    item.classList.remove("bad");
    const m = item.querySelector(".eqmark");
    if (m && m.parentNode) m.parentNode.removeChild(m);
  }
  document.getElementById("examNum").textContent = examCount() + " / " + stations.length;
}
function pickExamMulti(i, orig){
  if (examState[i] === "ok") return;
  const cur = (examPick[i] || []).slice();
  const at = cur.indexOf(orig);
  if (at >= 0) cur.splice(at, 1); else cur.push(orig);
  if (cur.length) examPick[i] = cur; else delete examPick[i];
  examState[i] = undefined;
  drawExam();
}
function pickExam(i, orig){
  if (examState[i] === "ok") return;
  examPick[i] = orig;
  examState[i] = undefined;
  drawExam();
}
function gradeExam(){
  const msg = document.getElementById("examMsg");
  if (examCount() < stations.length) {
    msg.innerHTML = '<div class="no2">아직 안 고른 문제가 있어요. (' +
      examCount() + " / " + stations.length + ")</div>";
    return;
  }
  let right = 0;
  for (const st of stations) {
    const ok = isText(st.q) ? answerOk(st.q, examPick[st.i])
      : isMulti(st.q) ? sameSet(examPick[st.i] || [], st.q.multi)
      : examPick[st.i] === st.q.answer;
    examState[st.i] = ok ? "ok" : "bad";
    if (ok) right++; else delete examPick[st.i];
  }
  const score = Math.round(right / stations.length * 100);
  drawExam();
  if (right === stations.length) {
    closeModal("exam");
    escaped();
    return;
  }
  msg.innerHTML = '<div class="score">' + score + "점 (" + right + " / " + stations.length +
    ')</div><div class="exp">틀린 문제를 다시 풀어 100점을 만들어야 나갈 수 있어요.</div>';
}

// ---------- 마법 순간이동 연출 ----------
let warpK = 0, warpDir = 0;          // warpDir 1: 빨려 들어감, -1: 다시 나타남
function warping(){ return warpDir !== 0 }
function startWarp(why){ warpWhy = why || "magic"; warpDir = 1; warpK = 0 }
function stepWarp(dt){
  if (warpDir === 1) {
    warpK += dt / 0.85;
    if (warpK >= 1) {
      warpK = 1; warpDir = -1;
      setRoom("gate");
      notice(warpWhy === "zombie" ? "🧟 좀비에게 당해 성문 앞으로 돌아왔습니다. 라이프가 다시 가득 찼어요! (푼 문제는 그대로)"
                                  : "✨ 마법이 걸려 성문 앞으로 돌아왔습니다!", warpWhy === "zombie" ? 4000 : 1800);
    }
  } else {
    warpK -= dt / 0.7;
    if (warpK <= 0) { warpK = 0; warpDir = 0 }
  }
}
function drawWarp(e){
  const el = document.getElementById("warp");
  if (!el) return;
  if (e <= 0.001) { if (el.style.display !== "none") el.style.display = "none"; return }
  el.style.display = "block";
  el.style.setProperty("--k", e.toFixed(3));
  const back = warpDir === -1, zb = warpWhy === "zombie";
  if (el._back !== back || el._why !== warpWhy) {
    el._back = back; el._why = warpWhy;
    el.classList.toggle("zombie", zb);
    el.querySelector("b").textContent = zb ? (back ? "⏱ 성문 앞에서 다시 깨어났습니다" : "🧟 좀비에게 당했습니다")
                                           : (back ? "✨ 성문 앞에 도착했습니다" : "✨ 마법에 걸렸습니다");
    el.querySelector("small").textContent = zb ? (back ? "라이프 회복! 푼 문제는 그대로예요" : "성문 앞으로 돌아갑니다")
                                               : (back ? "다시 문제를 찾아 출발하세요" : "성문 앞으로 돌아갑니다");
  }
  el.querySelector(".wt").style.opacity = Math.min(1, Math.max(0, (e - 0.25) / 0.45)).toFixed(2);
}

// ---------- 이동 ----------
function update(dt){
  if (!started || finished) { keys.clear(); return }   // 시작 전 · 탈출 성공 뒤에는 움직이지 않습니다
  if (warping()) { stepWarp(dt); keys.clear(); return }
  if (modalOpen()) { keys.clear(); return }
  let dx = 0, dy = 0;
  if (keys.has("ArrowLeft") || keys.has("a")) dx--;
  if (keys.has("ArrowRight")|| keys.has("d")) dx++;
  if (keys.has("ArrowUp")   || keys.has("w")) dy--;
  if (keys.has("ArrowDown") || keys.has("s")) dy++;
  moveNpcs(dt);
  updateZombies(dt);                                    // 🧟 좀비 · 아이템
  reactTick();                                          // 🎈 가까이 가면 반응하는 물건
  if (warping()) return;                                // 좀비에게 당해 정문으로 가는 중
  if (dx || dy) {
    if (dx && dy) { dx *= .707; dy *= .707 }
    p.dir = Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? 2 : 1) : (dy > 0 ? 0 : 3);
    const s = 4 * dt, nx = p.x + dx * s, ny = p.y + dy * s, ox = p.x, oy = p.y;
    // 이미 무언가에 끼어 있으면(저장 위치 등) 가운데 한 점으로만 검사해서 빠져나올 수 있게
    const bad = bodyBlocked(p.x, p.y) ? blocked : bodyBlocked;
    if (dx) { if (!bad(nx, p.y)) p.x = nx; else if (!dy) slide("x", Math.sign(dx), s, bad) }
    if (dy) { if (!bad(p.x, ny)) p.y = ny; else if (!dx) slide("y", Math.sign(dy), s, bad) }
    // 주인공이 실제로 움직이면 : '이동했습니다' 말풍선과 대화 말풍선을 바로 지웁니다
    // (가만히 있으면 예전처럼 시간이 지나 저절로 사라집니다)
    if (bubbles.length && (p.x !== ox || p.y !== oy)) {
      const gone = bubbles.filter(b => b.talk || (b.moveHide && b.who === p.name));
      if (gone.length) {
        bubbles = bubbles.filter(b => gone.indexOf(b) < 0);
        for (const n of npcs) if (n.hold && gone.some(b => b.talk && b.who === n.name)) n.hold = 0;   // 멈춰 있던 친구도 다시 걷기
      }
    }
    step += dt; if (step > .16) { p.frame = 1 - p.frame; step = 0 }
  }
}

// ---------- 그리기 (3D) ----------
// E 버튼 안내 글자
function promptText(t){
  return t.s ? (solvedQ.has(t.s.i) ? "E : 다시 보기" : "E : 문제 풀기")
    : t.n ? (npcTalking(t.n) ? "" : "E : 말 걸기")
    : t.c ? (!chestReady() ? "🔒 부품 상자 잠김 (" + solvedQ.size + "/" + stations.length + ")"
        : chestOpened ? "E : 쪽지 다시 보기" : "E : 부품 상자 열기")
    : t.d.exit ? (solvedQ.size < stations.length ? "🔒 타임머신 고장 (" + solvedQ.size + "/" + stations.length + ")"
        : passOk ? "E : 마지막 평가"
        : (useTreasure && !chestOpened) ? "E : 타임머신 (부품 상자 먼저)"
        : "E : 비밀번호 입력")
    : t.d.to === "gate" ? "E : 성문 앞으로 나가기"
    : "E : " + (t.d.label || "이동");
}
// 문 타일 고르기: 안 가본 곳 / 가본 곳 / 문제를 다 푼 곳
function doorState(dd){
  if (!dd || !dd.to || dd.exit) return "door";
  const here = stations.filter(s => s.room === dd.to);
  if (here.length && here.every(s => solvedQ.has(s.i))) return "doorclear";
  return visited.has(dd.to) ? "doorvisited" : "door";
}
function doorTile(x, y){
  for (const dd of (map().doors || [])) if (dd.x === x && dd.y === y) return doorState(dd);
  return "door";
}
// 문제 표시(시험지)와 바닥 동그라미를 놓을 자리 : 문제가 물건 안에 있으면
// 그 물건 바로 앞(가능하면 화면 쪽 아래 칸)의 빈 칸으로 옮겨서 건물 · 소품과 겹치지 않게 합니다.
function tileFree(r, gx, gy){
  if (gx < 0 || gy < 0 || gx >= COLS || gy >= ROWS) return false;
  if (CHEST.room === r.id && gx === Math.floor(CHEST.x) && gy === Math.floor(CHEST.y)) return false;
  const c = r.rows[gy][gx];
  if (c === "#") return false;
  return !SOLID.includes(r.obj ? r.obj[c] : undefined);
}
function frontSpot(s){
  if (s._f) return s._f;
  const r = maps[s.room];
  if (!r) return { x: s.x, y: s.y };
  r.id = s.room;
  const sx = Math.floor(s.x), sy = Math.floor(s.y);
  if (tileFree(r, sx, sy)) return (s._f = { x: s.x, y: s.y });
  let best = null, bs = 1e9;
  for (let gy = sy - 2; gy <= sy + 2; gy++) for (let gx = sx - 2; gx <= sx + 2; gx++) {
    if (!tileFree(r, gx, gy)) continue;
    const cx = gx + .5, cy = gy + .5, d = Math.hypot(cx - s.x, cy - s.y);
    if (d > 1.5) continue;                                  // 그 자리에서 E 로 문제를 열 수 있는 거리
    const isDoor = (r.doors || []).some(dd => dd.x === gx && dd.y === gy);
    const sc = d - 0.7 * (cy - s.y) + (isDoor ? 3 : 0);       // 아래쪽(화면 앞쪽)일수록 좋게
    if (sc < bs) { bs = sc; best = { x: cx, y: cy } }
  }
  return (s._f = best || { x: s.x, y: s.y });
}
// 문 이름표를 3D 세상 어디에 띄울지 (벽문은 문 위, 바닥 출구는 발판 위, 계단은 계단 위)
function signSpot(r, dd){
  const row = r.rows, c = row[dd.y][dd.x], o = r.obj ? r.obj[c] : "";
  const up = dd.y > 0 ? row[dd.y - 1][dd.x] : "#";
  const down = dd.y + 1 < ROWS ? row[dd.y + 1][dd.x] : "#";
  const X = dd.x + .5;
  if (c === "D") {
    if (up === "#" || (r.obj && r.obj[up] === "window")) return { x: X, h: 2.2, y: dd.y + 1.02 };
    if (down === "#") return { x: X, h: 0.95, y: dd.y + 0.5 };
    return { x: X, h: 2.2, y: dd.y + 0.6 };
  }
  if (o === "entrance") {
    // 복도 끝 옆벽에 난 현관 : 문 위 출구 표지 바로 위에 띄웁니다
    const L = dd.x > 0 ? row[dd.y][dd.x - 1] : "#", R = dd.x + 1 < COLS ? row[dd.y][dd.x + 1] : "#";
    if (r.ground !== "grass" && up !== "#" && (L === "#" || R === "#"))
      return { x: L === "#" ? dd.x + 0.12 : dd.x + 0.88, h: 2.75, y: dd.y + 0.5, side: L === "#" ? "L" : "R" };
    // 운동장에서 본 본관 현관 : 문을 가리지 않게 현관 바로 오른쪽 벽에 붙입니다
    if (r.ground === "grass") return { x: X + 1.2, h: 1.25, y: dd.y + 1.08 };
    return { x: X, h: 2.2, y: dd.y + 1.0 };
  }
  if (o === "exitgate") return { x: X, h: 1.45, y: dd.y + 0.5 };
  if (o === "stairup")  return { x: X, h: 1.75, y: dd.y + 0.5 };
  if (o === "stairdown") return { x: X, h: 1.05, y: dd.y + 0.5 };
  return { x: X, h: 1.5, y: dd.y + 0.5 };
}
let lastDraw = 0;
function draw3d(){
  const now = performance.now();
  let dt = lastDraw ? (now - lastDraw) / 1000 : 0.016;
  lastDraw = now;
  if (!(dt > 0)) dt = 0; if (dt > 0.1) dt = 0.1;
  const r = map();
  const k = warpK, ez = k * k * (3 - 2 * k);
  const L = World3D.label;
  World3D.begin(dt);

  // --- 말풍선 정리 (말하는 사람은 고개를 까딱까딱) ---
  bubbles = bubbles.filter(b => b.until > now);
  const talking = {};
  for (const b of bubbles) if (b.who) talking[b.who] = 1;

  // --- 주인공 (마법에 걸리면 빙글빙글 돌며 작아집니다) ---
  World3D.anim(World3D.char("player", "player"), p.x, p.y, dt,
    { dir: p.dir, spin: ez * ez * 14, scale: Math.max(0.02, 1 - 0.98 * ez), talk: talking[p.name],
      tool: ZOMBIE_ON && ammo > 0, attack: atkT > 0 ? atkT / 0.32 : 0, face: atkT > 0 ? atkFace : undefined,
      hide: hurtT > 0 && Math.floor(hurtT * 12) % 2 === 1 });
  // --- 🧟 좀비 ---
  for (const z of zombies) {
    const near = z.aggro && !z.stun && Math.hypot(p.x - z.x, p.y - z.y) < 1.6;
    World3D.anim(World3D.char("z" + z.id, "zombie"), z.x, z.y, dt,
      { zombie: true, stun: z.stun > 0, hit: z.hit, face: near ? Math.atan2(p.x - z.x, p.y - z.y) : undefined });
  }
  // --- ❤ 회복약 · 💉 주사기 아이템 ---
  const items = ITEMS[room] || [];
  items.forEach(function (it, i){ if (itemUp(it)) World3D.item("it" + i, it.kind, it.x, it.y) });
  // --- 학교 사람들 ---
  npcs.forEach(function (n, i){
    if (n.room !== room) return;
    World3D.anim(World3D.char("npc" + i, n.skin), n.x, n.y, dt,
      { dir: n.dir || 0, talk: !!talking[n.name] });
  });
  // --- 문제 자리 : 바닥의 빛나는 동그라미 ---
  const here = stations.filter(s => s.room === room && shownSt(s));
  for (const s of here) { const f = frontSpot(s); World3D.ring("s" + s.i, f.x, f.y, solvedQ.has(s.i) ? "done" : "quiz") }
  // --- 부품 상자 ---
  if (chestHere()) World3D.chest(CHEST.x, CHEST.y, chestReady(), chestOpened);
  // --- 교문 : 문제를 다 풀면 불이 켜집니다 ---
  const allDone = solvedQ.size === stations.length;
  const exitLock = useTreasure && !chestOpened && !passOk;
  for (const e of (r.doors || [])) if (e.exit && allDone) World3D.ring("exit", e.x + .5, e.y + .5, exitLock ? "lock" : "exit");

  // --- 카메라가 주인공을 따라갑니다 (이름표 위치를 계산하기 전에) ---
  World3D.follow(p.x, p.y, dt, ez);

  if (warpK <= 0.04) {                          // 순간이동 중에는 이름표·말풍선을 숨김
    // 중국어 간판 (maps.js 의 signs : 3D 위치에 떠 있는 글자)
    (r.signs || []).forEach(function (sg, i){ L("sg" + i, "lbl hz", sg.t, sg.x, sg.h || 1.8, sg.y) });
    // 문 이름표
    for (const dd of (r.doors || [])) {
      if (!dd.label) continue;
      const st = doorState(dd);
      const done = dd.exit ? allDone : (st === "doorclear");
      const sp = signSpot(r, dd);
      if (sp.side) {                             // 옆벽 현관 : 눈에 띄는 초록 출구 팻말 + 화살표
        L("door" + dd.x + "_" + dd.y, "lbl sign out",
          sp.side === "L" ? "◀ " + dd.label + " (밖으로)" : dd.label + " (밖으로) ▶", sp.x, sp.h, sp.y);
        continue;
      }
      L("door" + dd.x + "_" + dd.y, "lbl sign" + (done ? " clear" : st === "doorvisited" ? " seen" : "") + (dd.exit ? " exit" : ""),
        (done && !dd.exit ? "★ " : "") + dd.label, sp.x, sp.h, sp.y);
    }
    // 문제 표시 : 눈높이에 떠 있는 시험지 (? / ✓)
    for (const s of here) {
      const ok = solvedQ.has(s.i), f = frontSpot(s);
      if (Math.hypot(p.x - f.x, p.y - f.y) < 0.75) continue;   // 올라서 있으면 E 안내가 대신 뜹니다
      L("mk" + s.i, "lbl paper " + (ok ? "done" : "quiz"), ok ? "✓" : "?", f.x, 1.0, f.y);
    }
    if (chestHere()) {
      L("mkchest", "lbl mark " + (!chestReady() ? "lock" : chestOpened ? "done" : "quiz"),
        !chestReady() ? "🔒" : chestOpened ? "✓" : "!", CHEST.x, 1.55, CHEST.y);
      L("chest", "lbl name chest", (chestReady() ? "🎁 " : "") + CHEST.name, CHEST.x, 0.95, CHEST.y);
    }
    for (const e of (r.doors || [])) if (e.exit && allDone)
      L("mkexit", "lbl mark " + (exitLock ? "lock" : "quiz"), exitLock ? "🔒" : "!", e.x + .5, 2.1, e.y + .5);
    // 이름표 (말하는 중에는 숨겨서 말풍선을 가리지 않게)
    npcs.forEach(function (n, i){
      if (n.room !== room || talking[n.name]) return;
      L("nm" + i, "lbl name npc", n.name, n.x, 1.32, n.y);
    });
    // 🧟 좀비 이름표 · 기절 남은 시간
    for (const z of zombies) {
      if (z.stun > 0) L("zs" + z.id, "lbl stun", "💫 " + Math.ceil(z.stun), z.x, 1.62, z.y);
      else L("zn" + z.id, "lbl name zombie" + (z.aggro ? " mad" : ""), "🧟 좀비", z.x, 1.36, z.y);
    }
    // 아이템 이름표
    items.forEach(function (it, i){
      if (!itemUp(it)) return;
      L("il" + i, "lbl name item " + it.kind, it.kind === "potion" ? "❤ 회복약" : "💉 주사기 +" + AMMO_PACK, it.x, 0.78, it.y);
    });
    // 떠오르는 글자 (-1 ❤ · +3 💉 · 기절!)
    fx = fx.filter(f => now - f.born < 1100);
    for (const f of fx) {
      const k = (now - f.born) / 1100;
      L("fx" + f.id, "lbl fx " + f.cls, f.t, f.x, 1.7 + k * 0.7, f.y);
    }
    const zt = (started && !modalOpen()) ? nearZombie() : null;
    const t = (started && !modalOpen()) ? nearAny() : null;
    if (!talking[p.name]) L("nmP", "lbl name me", p.name || "여행자", p.x, 1.32, p.y);
    const pt = zt ? (ammo > 0 ? "E : 💉 주사기 공격 (" + ammo + ")" : "💉 주사기 없음! 도망치세요")
             : t ? promptText(t) : "";
    // 화면의 E 버튼도 좀비 옆에서는 💉 로 바뀝니다
    const eb = document.getElementById("e"), want = zt && ammo > 0 ? "💉" : "E";
    if (eb && eb.textContent !== want) { eb.textContent = want; eb.classList.toggle("atk", want !== "E") }
    if (pt) L("prompt", "lbl prompt", pt, p.x, talking[p.name] ? 2.35 : 1.78, p.y);
    // 말풍선 (말하는 사람 머리 위를 따라다닙니다)
    bubbles.forEach(function (b, i){
      let x = b.x, y = b.y;
      if (b.who === p.name) { x = p.x; y = p.y }
      else { const n = npcs.find(v => v.room === room && v.name === b.who); if (n) { x = n.x; y = n.y } }
      L("bb" + i + "_" + b.until, "lbl bubble", { who: b.who || "", t: b.t }, x, 1.45, y);
    });
  }
  World3D.end();
  drawWarp(ez);
}
let errShown = 0, lastErr = "";
function oops(where, e){
  lastErr = where + ": " + (e && e.message ? e.message : e);
  if (Date.now() - errShown < 4000) return;
  errShown = Date.now();
  try { notice("⚠ " + where + " 오류: " + (e && e.message ? e.message : e)) } catch (x) {}
  if (typeof console !== "undefined") console.error(where, e);
}
let renderId = 0, lastFrameAt = 0;
function render(id){
  if (id !== renderId) return;         // 옛 루프는 스스로 멈춤
  frames++; lastFrameAt = Date.now();
  try {
    if (maps[room] && has3D) draw3d();
  } catch (e) { oops("그리기", e) }
  requestAnimationFrame(function(){ render(id) });
}
function startRender(){ renderId++; const id = renderId; lastFrameAt = Date.now(); render(id) }

// ---------- 화면 맞추기 (3D 화면은 남는 공간을 꽉 채웁니다) ----------
const hasTouch = (typeof matchMedia === "function" && matchMedia("(pointer:coarse)").matches)
              || (typeof navigator !== "undefined" && navigator.maxTouchPoints > 0);
const PAD_NAME = ["없음", "원형", "화살표"];
let padMode = hasTouch ? 1 : 0;   // 0 숨김 / 1 원형 / 2 화살표
try { const v = localStorage.getItem("padMode"); if (v !== null) padMode = +v } catch (e) {}
if (!(padMode === 0 || padMode === 1 || padMode === 2)) padMode = hasTouch ? 1 : 0;

function layout(){
  const st = document.getElementById("stage");
  const b = document.body; if (!b) return;
  const w = st.clientWidth || 0, h = st.clientHeight || 0;
  if (!w || !h) {                      // 모바일에서 첫 순간에는 크기가 0 일 수 있습니다
    if ((layout.retry = (layout.retry || 0) + 1) < 40) setTimeout(layout, 120);
    return;
  }
  layout.retry = 0;
  const portrait = h >= w * 0.9;
  const on = padMode !== 0;

  b.classList.remove("bar"); b.classList.remove("overlay");
  b.classList.toggle("small", w < 760 || h < 430);
  if (on) b.classList.add(portrait ? "bar" : "overlay");

  if (hasTouch && portrait !== wasPortrait) {
    if (portrait) showRotate();
    wasPortrait = portrait;
  }

  const ctrl = document.getElementById("controls");
  let barH = 0, padSize;

  if (on && portrait) {
    // 세로 화면: 게임은 위쪽, 아래 막대는 버튼. 3D 는 어떤 비율도 그릴 수 있어 화면을 꽉 채웁니다
    barH = Math.round(Math.max(172, Math.min(300, h * 0.38)));
    if (h - barH < 160) barH = Math.max(120, h - 160);
    ctrl.style.height = barH + "px";
    padSize = Math.min(230, Math.max(112, Math.min((barH - 90) * 0.82, w * 0.50)));
  } else {
    ctrl.style.height = "";
    padSize = Math.min(170, Math.max(104, Math.min(h * 0.36, w * 0.22)));
  }
  const de = document.documentElement;
  if (de && de.style && de.style.setProperty) de.style.setProperty("--pad", Math.round(padSize) + "px");

  const fw = w, fh = Math.max(60, h - barH);
  const fit = document.getElementById("fit");
  fit.style.width = fw + "px";
  fit.style.height = fh + "px";
  fit.style.left = "0px";
  fit.style.top = "0px";
  const frame = document.getElementById("frame");
  frame.style.width = fw + "px";
  frame.style.height = fh + "px";
  if (has3D) World3D.resize(fw, fh);
}

let wasPortrait = null;
function showRotate(){
  const el = document.getElementById("rotate");
  if (!el) return;
  el.classList.add("show");
  clearTimeout(showRotate.t);
  showRotate.t = setTimeout(function(){ el.classList.remove("show") }, 3800);
}

function applyPad(){
  const b = document.body;
  if (b) {
    b.classList.remove("ctrl", "pad-round", "pad-cross");
    if (padMode === 1) { b.classList.add("ctrl"); b.classList.add("pad-round") }
    if (padMode === 2) { b.classList.add("ctrl"); b.classList.add("pad-cross") }
  }
  keys.clear(); clearJoy(); joyOn = false;
  if (typeof holdEnders !== "undefined") for (const fn of holdEnders) fn();
  const knob = document.getElementById("joyKnob");
  if (knob && knob.style) knob.style.transform = "";
  const rp = document.getElementById("dpadRound");
  if (rp && rp.classList) rp.classList.remove("grab");
  document.getElementById("padBtn").textContent = "🎮 " + PAD_NAME[padMode];
  try { localStorage.setItem("padMode", padMode) } catch (e) {}
  layout();
}

// ---------- 전체화면 ----------
const docEl = (typeof document !== "undefined" && document.documentElement) || {};
const canFs = !!(docEl.requestFullscreen || docEl.webkitRequestFullscreen);
function fsOn(){ return !!(document.fullscreenElement || document.webkitFullscreenElement) }
function toggleFs(){
  if (!canFs) { notice("이 브라우저는 전체화면을 지원하지 않습니다."); return }
  if (!fsOn()) {
    const r = docEl.requestFullscreen || docEl.webkitRequestFullscreen;
    const out = r.call(docEl); if (out && out.catch) out.catch(function(){});
  } else {
    const x = document.exitFullscreen || document.webkitExitFullscreen;
    if (x) x.call(document);
  }
}
function onFs(){
  document.getElementById("fsBtn").textContent = fsOn() ? "⛶ 창모드" : "⛶ 전체화면";
  setTimeout(layout, 60);
}

// ---------- 입력 ----------
addEventListener("keydown", function (e) {
  if (!started || finished) return;              // 시작 전 · 성공 화면에서는 조작을 받지 않습니다
  keys.add(e.key);
  if (e.code && e.code.indexOf("Key") === 0) keys.add(e.code.slice(3).toLowerCase());
  if (!modalOpen() && ["ArrowUp","ArrowDown","ArrowLeft","ArrowRight"," "].includes(e.key)) e.preventDefault();
  if (document.getElementById("quiz").classList.contains("open")) {
    const textMode = curStation && isText(curStation.q);
    const multiMode = curStation && isMulti(curStation.q);
    if (!textMode && "12345".indexOf(e.key) >= 0) choose(+e.key - 1);
    if (e.key === "Escape") closeQuiz();
    else if (e.key === "Enter") {
      if (multiMode && !answered) submitMulti();
      else if (!(textMode && !answered)) closeQuiz();
    }
    return;
  }
  if (document.getElementById("exam").classList.contains("open")) {
    if (e.key === "Escape") closeModal("exam");
    return;
  }
  if (document.getElementById("review").classList.contains("open")) {
    if (e.key === "Escape" || e.key === "Enter") closeModal("review");
    return;
  }
  if (document.getElementById("dialog").classList.contains("open")) {
    if (e.key === "Escape") closeDialog(false);                 // ESC 는 언제나 '취소'
    else if (e.key === "Enter" && !dialogConfirm) closeDialog(true);
    return;                                    // 되묻는 창은 Enter 로 지나가지 않게 합니다
  }
  if (document.getElementById("pad").classList.contains("open")) {
    if (e.key === "Escape") closeModal("pad");
    return;                                    // 글자 입력은 입력창이 직접 처리합니다
  }
  if (e.code === "KeyE" || e.key.toLowerCase() === "e") {
    if (e.preventDefault) e.preventDefault();      // 눌린 글자가 입력칸에 찍히지 않게
    interact();
  }
});
addEventListener("keyup", function (e) {
  keys.delete(e.key);
  if (e.code && e.code.indexOf("Key") === 0) keys.delete(e.code.slice(3).toLowerCase());
});
// ---------- 화면 조작 버튼 (터치 / 펜 / 마우스 모두 대응) ----------
// 기기마다 pointer / touch / mouse 중 무엇이 먼저 오는지 달라서 셋 다 받고,
// active 로 중복을 막습니다. 손가락이 버튼 밖으로 살짝 벗어나도 떼기 전까지는 눌린 상태를 유지합니다.
function pointOf(ev){
  if (ev.touches && ev.touches.length) return { x: ev.touches[0].clientX, y: ev.touches[0].clientY };
  if (ev.changedTouches && ev.changedTouches.length)
    return { x: ev.changedTouches[0].clientX, y: ev.changedTouches[0].clientY };
  return { x: ev.clientX || 0, y: ev.clientY || 0 };
}
function stop(ev){ if (ev && ev.cancelable !== false && ev.preventDefault) ev.preventDefault() }

const holdEnders = [];                 // 눌린 상태를 강제로 푸는 함수 모음
function bindHold(el, onDown, onUp){
  if (!el || !el.addEventListener) return;
  let active = false, since = 0;
  const start = function (ev) {
    stop(ev);
    // 손을 뗀 신호를 못 받아 눌린 채로 굳는 경우가 있어, 오래된 눌림은 새 눌림으로 봅니다
    if (active && Date.now() - since < 500) return;
    active = true; since = Date.now();
    if (el.classList) el.classList.add("held");
    onDown(pointOf(ev), ev);
  };
  const end = function (ev) {
    if (!active) return;
    active = false;
    if (el.classList) el.classList.remove("held");
    if (onUp) onUp();
  };
  holdEnders.push(end);
  el.addEventListener("pointerdown", function (ev) {
    if (el.setPointerCapture && ev.pointerId !== undefined) { try { el.setPointerCapture(ev.pointerId) } catch (e) {} }
    start(ev);
  });
  el.addEventListener("pointerup", end);
  el.addEventListener("pointercancel", end);
  el.addEventListener("touchstart", start, { passive: false });
  el.addEventListener("touchend", end);
  el.addEventListener("touchcancel", end);
  el.addEventListener("mousedown", start);
  el.addEventListener("mouseup", end);
  el.addEventListener("mouseleave", end);
  el.addEventListener("contextmenu", function (ev) { stop(ev); return false });
  return { move: function (fn) { 
    el.addEventListener("pointermove", function (ev) { if (active) { stop(ev); fn(pointOf(ev)) } });
    el.addEventListener("touchmove", function (ev) { if (active) { stop(ev); fn(pointOf(ev)) } }, { passive: false });
    el.addEventListener("mousemove", function (ev) { if (active) fn(pointOf(ev)) });
  } };
}

// 화면 어디서든 손을 떼면 눌린 버튼을 모두 풀어 줍니다 (버튼이 눌린 채 굳는 것을 막습니다)
function releaseHolds(){ for (const f of holdEnders) f() }
addEventListener("pointerup", releaseHolds);
addEventListener("pointercancel", releaseHolds);
addEventListener("touchend", releaseHolds);
addEventListener("touchcancel", releaseHolds);
addEventListener("mouseup", releaseHolds);
addEventListener("blur", releaseHolds);
if (document.addEventListener)
  document.addEventListener("visibilitychange", function(){ releaseHolds(); keys.clear() });

// ---------- 원형 조이스틱: 가운데를 누른 뒤 가고 싶은 쪽으로 밀면 이동 ----------
const ARROWS = ["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight"];
let joyOn = false;
function clearJoy(){ for (const k of ARROWS) keys.delete(k) }
function joyAim(dx, dy, R){
  clearJoy();
  const d = Math.hypot(dx, dy);
  if (d < R * 0.30) return;                     // 가운데 근처는 멈춤
  const nx = dx / d, ny = dy / d;
  if (nx > 0.38) keys.add("ArrowRight");
  if (nx < -0.38) keys.add("ArrowLeft");
  if (ny > 0.38) keys.add("ArrowDown");
  if (ny < -0.38) keys.add("ArrowUp");
}
function setupJoystick(){
  const pad = document.getElementById("dpadRound");
  const knob = document.getElementById("joyKnob");
  if (!pad || !pad.addEventListener) return;
  let cx = 0, cy = 0, R = 40;
  function center(){
    const r = pad.getBoundingClientRect ? pad.getBoundingClientRect() : null;
    if (r && r.width) { cx = r.left + r.width / 2; cy = r.top + r.height / 2; R = r.width * 0.33 }
  }
  function aim(pt){
    let dx = pt.x - cx, dy = pt.y - cy;
    const d = Math.hypot(dx, dy);
    if (d > R) { dx = dx / d * R; dy = dy / d * R }
    if (knob && knob.style) knob.style.transform = "translate(" + Math.round(dx) + "px," + Math.round(dy) + "px)";
    joyAim(dx, dy, R);
  }
  const h = bindHold(pad,
    function (pt) { joyOn = true; center(); if (pad.classList) pad.classList.add("grab"); aim(pt) },
    function () { joyOn = false; clearJoy(); if (pad.classList) pad.classList.remove("grab");
                  if (knob && knob.style) knob.style.transform = "" });
  if (h) h.move(aim);
}
setupJoystick();

// ---------- 십자(화살표) 패드 ----------
document.querySelectorAll("[data-key]").forEach(function (b) {
  const k = b.dataset.key;
  bindHold(b, function(){ keys.add(k) }, function(){ keys.delete(k) });
});

// ---------- E 버튼 ----------
bindHold(document.getElementById("e"), function(){ interact() });

document.getElementById("padBtn").onclick = function(){ padMode = (padMode + 1) % 3; applyPad() };
document.getElementById("fsBtn").onclick = toggleFs;
if (!canFs) document.getElementById("fsBtn").style.display = "none";
addEventListener("resize", layout);
addEventListener("orientationchange", function(){ setTimeout(layout, 160) });
if (document.addEventListener) {
  document.addEventListener("fullscreenchange", onFs);
  document.addEventListener("webkitfullscreenchange", onFs);
}
document.getElementById("quizClose").onclick = closeQuiz;
document.getElementById("quizOk").onclick = closeQuiz;
document.getElementById("reviewBtn").onclick = openReview;
document.getElementById("winReview").onclick = openReview;
document.getElementById("winRestart").onclick = function(){
  askDialog("🔄 처음부터 다시 시작",
    "표창장 화면을 닫고 성문 앞에서 처음부터 다시 시작합니다.\n지금까지 푼 기록은 사라집니다.",
    "네, 처음부터", restartGame);
};
document.getElementById("reviewOk").onclick = function(){ closeModal("review") };
document.getElementById("reviewClose").onclick = function(){ closeModal("review") };
document.getElementById("dialogReview").onclick = function(){ closeModal("dialog"); openReview() };
document.getElementById("dialogReview").style.display = "none";
document.getElementById("padClose").onclick = function(){ closeModal("pad") };
document.getElementById("padGo").onclick = checkPad;
document.getElementById("padText").onkeydown = function (e) {
  if (e.stopPropagation) e.stopPropagation();
  if (e.key === "Enter") checkPad();
};
function closeDialog(yes){
  closeModal("dialog");
  const f = dialogNext; dialogNext = null;
  const wasAsk = dialogConfirm; dialogConfirm = false;
  resetDialogButtons();
  if (f && (!wasAsk || yes === true)) f();     // 되묻는 창은 '확인' 을 눌렀을 때만 실행
}
document.getElementById("closeDialog").onclick = function(){ closeDialog(false) };
document.getElementById("dialogOk").onclick = function(){ closeDialog(true) };
document.getElementById("dialogNo").onclick = function(){ closeDialog(false) };
document.getElementById("examClose").onclick = function(){ closeModal("exam") };
document.getElementById("examGo").onclick = gradeExam;
// 처음부터 : 잘못 눌렀을 수 있으니 한 번 되묻습니다
document.getElementById("resetBtn").onclick = function(){
  const n = solvedQ.size, N = stations.length;
  const got = found.filter(function (v){ return v !== null }).length;
  let txt = n > 0
    ? "지금까지 푼 문제 " + n + "개" + (got ? "와 알아낸 비밀번호 " + got + "글자" : "") +
      "가 모두 사라지고, 성문 앞에서 다시 시작합니다."
    : "아직 푼 문제가 없습니다. 처음부터 다시 시작할까요?";
  if (n > 0) txt += "\n정말 처음부터 다시 시작할까요?";
  askDialog("🔄 처음부터 다시 시작", txt, "네, 처음부터", restartGame);
};

// ---------- 시작 / 자가진단 ----------
let ticks = 0, frames = 0;
try { document.getElementById("ver").textContent = VERSION } catch (e) {}

function diagnose(force){
  if (!force && ticks > 3 && frames > 3) return;
  if (!has3D && !force) return;                   // 3D 안내문이 이미 떠 있습니다
  const st = document.getElementById("stage");
  const lines = [
    "맵 데이터: " + (window.MAPS ? "읽음" : "못 읽음") +
      " / 문제: " + (window.QUIZ ? window.QUIZ.length + "개" : "못 읽음") +
      " (" + (window.QUIZ_SOURCE || "알 수 없음") + ")",
    "3D: " + (has3D ? "켜짐" : "꺼짐") + " (three.js " + (window.THREE ? "r" + THREE.REVISION : "없음") + ")",
    "그리기 " + frames + "프레임, 이동 " + ticks + "프레임",
    lastErr ? ("마지막 오류: " + lastErr) : "오류 기록 없음",
    "버전 " + VERSION + " · 화면 " + (st.clientWidth || 0) + "x" + (st.clientHeight || 0),
    force ? "화면을 누르면 닫힙니다." : "브라우저를 완전히 새로고침하거나 캐시를 지운 뒤 다시 열어 주세요."
  ];
  sysmsg(force ? "🔎 상태 확인" : "게임이 제대로 시작되지 않았습니다", lines, force ? "info" : "diag");
  // 느린 기기에서 처음 3D 를 준비하느라 늦었던 것이라면, 움직이기 시작하는 순간 안내문을 닫습니다
  if (!force) {
    const f0 = frames;
    const iv = setInterval(function (){
      const el = document.getElementById("sysmsg");
      if (!el || !el.classList.contains("diag")) { clearInterval(iv); return }
      if (frames > f0 + 3 && ticks > 3) { hideSysmsg(); clearInterval(iv) }
    }, 700);
  }
}
document.getElementById("sysmsg").onclick = function(){ if (this.classList.contains("info")) hideSysmsg() };
addEventListener("error", function (ev) {
  lastErr = (ev && ev.message ? ev.message : "알 수 없는 오류") +
            (ev && ev.lineno ? " (" + ev.lineno + "줄)" : "");
  try { notice("⚠ " + lastErr) } catch (e) {}
});
setTimeout(function(){ diagnose(false) }, 4000);
document.getElementById("ver").onclick = function(){ diagnose(true) };

applyPad();
layout();
load();
function loop(t){
  ticks++;
  let dt = (t - last) / 1000;
  if (!(dt > 0)) dt = 0;                // 첫 프레임 시각이 앞서거나 NaN 인 경우 방지
  update(Math.min(.05, dt));
  last = t;
}
let tickId = 0, lastTickAt = 0;
function tick(t, id){
  if (id !== tickId) return;           // 옛 루프는 스스로 멈춤
  lastTickAt = Date.now();
  try { loop(t) } catch (e) { oops("이동", e); last = t }
  requestAnimationFrame(function (t2){ tick(t2, id) });   // 오류가 나도 다음 프레임은 반드시 예약
}
function startTick(){
  tickId++; const id = tickId;
  last = performance.now(); lastTickAt = Date.now();
  requestAnimationFrame(function (t){ tick(t, id) });
}
startTick();

// 어떤 이유로든 루프가 멈추면 스스로 다시 시작합니다.
// 다른 창을 보다 돌아오거나 화면이 잠깐 멈추는 것은 정상이라, 조용히 되살리고
// 여러 번 되풀이될 때만 화면에 알립니다.
let stalls = 0;
function wakeTimers(){ const n = Date.now(); lastTickAt = n; lastFrameAt = n }
addEventListener("visibilitychange", wakeTimers);
addEventListener("focus", wakeTimers);
addEventListener("pageshow", wakeTimers);
setInterval(function () {
  if (document.hidden) return;
  const n = Date.now();
  const deadTick  = n - lastTickAt > 4000;
  const deadFrame = maps[room] && n - lastFrameAt > 4000;
  if (!deadTick && !deadFrame) return;
  stalls++;
  if (stalls >= 3) oops("화면", { message: "잠깐 멈춰서 다시 시작했습니다" });
  else if (typeof console !== "undefined") console.warn("루프를 조용히 다시 시작했습니다 (" + stalls + "번째)");
  if (deadTick) startTick();
  if (deadFrame) startRender();
}, 2000);
