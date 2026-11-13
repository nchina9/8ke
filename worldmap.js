// ===================================================================
//  🗺️ 전체 지도 (worldmap.js)
//  방 하나가 아니라 게임 전체를 한 장에 보여 줍니다.
//   · 📍 지금 있는 곳 (방 안의 실제 위치까지)
//   · 다녀온 곳 (배치도 · 문제 위치가 보임) / 아직 안 가 본 곳 (흐리게 ?)
//   · ⭐ 다음 목표와 가는 길 (주황색) · 🔒 잠긴 문 · 🪜 계단 · 🚪 출구
//  여는 법 : 게임 화면 왼쪽 위 '🗺️ 전체 지도' 버튼 · M 키    닫는 법 : × · 닫기 · 바깥 누르기 · Esc
//
//  ▼ 게임마다 다른 곳은 아래 WM_CONF 한 곳뿐입니다.
//    layout : 방 id → [가로 칸, 세로 줄, 너비, 높이]  (칸 단위 · 너비/높이는 빼면 1)
//             새 방을 만들었는데 layout 에 없으면 문 방향으로 알아서 자리를 찾습니다.
// ===================================================================
window.WM_CONF = {
  "title": "송나라 시장 지도 (汴京)",
  "start": "gate",
  "layout": {
    "gate": [
      0,
      1.8,
      2,
      1
    ],
    "hall1": [
      0,
      1.05,
      3,
      0.55
    ],
    "class101": [
      0,
      0
    ],
    "class102": [
      1,
      0
    ],
    "science": [
      2,
      0
    ],
    "up2": [
      3,
      1.05,
      3,
      0.55
    ],
    "music": [
      3,
      0
    ],
    "art": [
      4,
      0
    ],
    "class201": [
      5,
      0
    ],
    "up3": [
      6,
      1.05,
      3,
      0.55
    ],
    "library": [
      6,
      0
    ],
    "computer": [
      7,
      0
    ],
    "broadcast": [
      8,
      0
    ],
    "up4": [
      9,
      1.05,
      3,
      0.55
    ],
    "class301": [
      9,
      0
    ],
    "class302": [
      10,
      0
    ],
    "office": [
      11,
      0
    ],
    "rooftop": [
      12,
      0.6,
      2,
      1
    ]
  },
  "legend": "<span>🚪 거리 문 (옆으로 이어져요)</span>"
};

(function () {
  const C = window.WM_CONF || {};
  const WM = { on: false, zoom: 0, last: null, W: 176, H: 118, GX: 72, GY: 66, PAD: 30 };
  const DIRV = { N: [0, -1], S: [0, 1], W: [-1, 0], E: [1, 0] };
  const WORD = C.word || "비밀번호";
  const G = name => { try { return eval(name) } catch (e) { return undefined } };   // 게임 본체(game.js)의 값 읽기
  const eul = w => { const c = String(w).charCodeAt(String(w).length - 1); return w + (c >= 0xAC00 && c <= 0xD7A3 && (c - 0xAC00) % 28 ? "을" : "를") };

  // ---------- 문이 방의 어느 쪽에 있는지 ----------
  function blockedAt(m, x, y){
    if (x < 0 || y < 0 || y >= m.rows.length || x >= m.rows[0].length) return true;
    const c = m.rows[y][x], o = (m.obj || {})[c], SOL = G("SOLID") || [];
    return c === "#" || SOL.indexOf(o) >= 0 || o === "window";
  }
  function doorDir(m, d){
    const R = m.rows.length, Cc = m.rows[0].length;
    if (d.x <= 0) return "W"; if (d.x >= Cc - 1) return "E"; if (d.y <= 0) return "N"; if (d.y >= R - 1) return "S";
    const n = blockedAt(m, d.x, d.y - 1), s = blockedAt(m, d.x, d.y + 1), w = blockedAt(m, d.x - 1, d.y), e = blockedAt(m, d.x + 1, d.y);
    if (n && !s) return "N"; if (s && !n) return "S"; if (w && !e) return "W"; if (e && !w) return "E";
    const cand = [["W", d.x], ["E", Cc - 1 - d.x], ["N", d.y], ["S", R - 1 - d.y]].sort((a, b) => a[1] - b[1]);
    return cand[0][1] <= 2 ? cand[0][0] : "";
  }
  function doorObj(m, d){ return ((m.obj || {})[m.rows[d.y] ? m.rows[d.y][d.x] : ""]) || "" }
  function isStair(m, d){ return /stair/i.test(doorObj(m, d)) }
  function lockedDoor(d){
    const lo = G("lockOpen");
    if (d.lock && typeof lo === "function" && !lo(d.lock)) return true;
    return false;
  }
  function passOkNow(){ return !!G("passOk") }
  function gatedDoor(d, maps){ return !!(d.exit && maps[d.to] && !passOkNow()) }        // 비밀번호를 맞혀야 들어가는 방

  // ---------- 방 자리 (칸 단위) ----------
  function layoutUnits(){
    const maps = G("maps"), ids = Object.keys(maps), pos = {}, used = {}, K = (x, y) => Math.round(x) + "," + Math.round(y);
    const L = C.layout || {};
    for (const id of ids) if (L[id]) {
      const v = L[id]; pos[id] = [v[0], v[1], v[2] || 1, v[3] || 1];
      for (let a = 0; a < pos[id][2]; a++) used[K(v[0] + a, v[1])] = id;
    }
    const start = C.start && maps[C.start] ? C.start : (maps.gate ? "gate" : ids[0]);
    if (!pos[start]) { pos[start] = [0, 0, 1, 1]; used[K(0, 0)] = start }
    const around = [[0, -1], [1, 0], [-1, 0], [0, 1], [1, -1], [-1, -1], [1, 1], [-1, 1], [0, -2], [2, 0], [-2, 0], [0, 2]];
    for (let changed = true; changed;) {
      changed = false;
      for (const id of ids) {
        if (!pos[id]) continue;
        for (const d of (maps[id].doors || [])) {
          if (!d.to || !maps[d.to] || pos[d.to]) continue;
          const m = maps[id], dir = doorDir(m, d), v = DIRV[dir] || [0, -1];
          const R = m.rows.length, Cc = m.rows[0].length;
          const k = dir === "N" || dir === "S" ? Math.round((d.x - (Cc - 1) / 2) / (Cc / 3)) : Math.round((d.y - (R - 1) / 2) / (R / 3));
          const bx = pos[id][0] + v[0] + (v[1] ? k : 0), by = pos[id][1] + v[1] + (v[0] ? k : 0);
          let placed = false;
          for (const o of [[0, 0]].concat(around)) {
            if (!used[K(bx + o[0], by + o[1])]) { pos[d.to] = [bx + o[0], by + o[1], 1, 1]; used[K(bx + o[0], by + o[1])] = d.to; placed = true; break }
          }
          if (placed) changed = true;
        }
      }
    }
    let bottom = 0, nx = 0;
    for (const id in pos) bottom = Math.max(bottom, pos[id][1] + pos[id][3]);
    for (const id of ids) if (!pos[id]) pos[id] = [nx++, Math.ceil(bottom) + 0.2, 1, 1];
    return pos;
  }
  function rectsPx(){
    const u = layoutUnits(), W = WM.W, H = WM.H, GX = WM.GX, GY = WM.GY, out = {};
    for (const id in u) {
      const [x, y, w, h] = u[id];
      out[id] = { x: x * (W + GX), y: y * (H + GY), w: w * W + Math.max(0, w - 1) * GX, h: h * H + Math.max(0, h - 1) * GY };
    }
    return out;
  }

  // ---------- 길 찾기 : 다음 목표 ----------
  function leftIn(id){ const st = G("stations") || [], sq = G("solvedQ"); return st.filter(s => s.room === id && !sq.has(s.i)).length }
  function hasQ(id){ return (G("stations") || []).some(s => s.room === id) }
  function goal(){
    const maps = G("maps"), room = G("room"), roomName = G("roomName"), withRo = G("withRo") || (w => w + "(으)로");
    const prev = {}, order = [room], seen = new Set([room]);
    for (let i = 0; i < order.length; i++) {
      for (const d of (maps[order[i]].doors || [])) {
        if (!d.to || !maps[d.to] || seen.has(d.to) || lockedDoor(d) || gatedDoor(d, maps)) continue;
        seen.add(d.to); prev[d.to] = order[i]; order.push(d.to);
      }
    }
    const pathTo = t => { const pth = [t]; while (pth[0] !== room) pth.unshift(prev[pth[0]]); return pth };
    const st = G("stations") || [], sq = G("solvedQ"), total = st.length - sq.size;
    if (total > 0) {
      const t = order.find(id => leftIn(id) > 0);
      if (t) return { room: t, path: pathTo(t),
        text: t === room ? "이 곳에 문제가 " + leftIn(t) + "개 남아 있어요. 문제 표시를 찾아 E를 누르세요."
                         : roomName(t) + "에 풀지 않은 문제가 " + leftIn(t) + "개 있어요." };
      for (const id of order) for (const d of (maps[id].doors || [])) {
        if (!d.to || !lockedDoor(d) || seen.has(d.to)) continue;
        return { room: id, path: pathTo(id), text: (id === room ? "이 곳" : roomName(id)) + "의 미션을 마치면 " + withRo(roomName(d.to)) + " 가는 문이 열려요." };
      }
      return { room: null, path: [room], text: "남은 문제 " + total + "개를 찾아 둘러보세요." };
    }
    const CH = G("CHEST"), useT = G("useTreasure"), opened = G("chestOpened"), passOk = passOkNow();
    const exitRoom = Object.keys(maps).find(id => (maps[id].doors || []).some(d => d.exit));
    const exitDoor = exitRoom && maps[exitRoom].doors.find(d => d.exit);
    if (useT && !opened && CH && seen.has(CH.room))
      return { room: CH.room, path: pathTo(CH.room), text: "문제를 다 풀었어요! " + roomName(CH.room) + "의 🎁 " + eul(CH.name || "보물상자") + " 열어 보세요." };
    if (exitRoom && !passOk && seen.has(exitRoom))
      return { room: exitRoom, path: pathTo(exitRoom), exit: true,
               text: roomName(exitRoom) + "의 " + (exitDoor.label || "출구") + "에서 " + eul(WORD) + " 입력하세요." };
    if (exitDoor && maps[exitDoor.to] && passOk) {
      const t = exitDoor.to;
      const p2 = seen.has(t) ? pathTo(t) : (seen.has(exitRoom) ? pathTo(exitRoom).concat([t]) : [room]);
      return { room: t, path: p2, text: C.finalText || (withRo(roomName(t)) + " 들어가세요.") };
    }
    if (exitRoom) return { room: exitRoom, path: seen.has(exitRoom) ? pathTo(exitRoom) : [room], exit: true,
                           text: roomName(exitRoom) + "의 " + (exitDoor.label || "출구") + "에서 마지막 평가를 보세요." };
    return { room: null, path: [room], text: "출구를 찾아보세요." };
  }

  // ---------- 그리기 ----------
  function tileColor(m, c, o){
    const out = !!m.ground && m.ground !== "floor";
    if (c === "#") return out ? "#8fb58f" : "#9c8468";
    if (/ice|water|pond|pool/.test(o || "")) return "#c6e7f7";
    if (/sand|gravel/.test(o || "")) return "#e3d3aa";
    const SOL = G("SOLID") || [];
    if (o && SOL.indexOf(o) >= 0) return "#b8bec8";
    return "";
  }
  function svg(gl){
    const maps = G("maps"), room = G("room"), visited = G("visited"), st = G("stations") || [], sq = G("solvedQ");
    const p = G("p"), esc = G("esc"), CH = G("CHEST"), useT = G("useTreasure"), passOk = passOkNow();
    const fs = G("frontSpot");
    const R = rectsPx(), W = WM.W, H = WM.H, GX = WM.GX;
    const onPath = {};
    for (let i = 0; i + 1 < gl.path.length; i++) { onPath[gl.path[i] + ">" + gl.path[i + 1]] = 1; onPath[gl.path[i + 1] + ">" + gl.path[i]] = 1 }
    let bx0 = 1e9, by0 = 1e9, bx1 = -1e9, by1 = -1e9;
    const grow = (x0, y0, x1, y1) => { bx0 = Math.min(bx0, x0); by0 = Math.min(by0, y0); bx1 = Math.max(bx1, x1); by1 = Math.max(by1, y1) };
    const hits = (x0, y0, x1, y1, skip) => {           // 선분이 다른 방을 가로지르는지
      for (const id in R) {
        if (skip.indexOf(id) >= 0) continue;
        const r = R[id];
        if (Math.max(x0, x1) > r.x - 4 && Math.min(x0, x1) < r.x + r.w + 4 && Math.max(y0, y1) > r.y - 4 && Math.min(y0, y1) < r.y + r.h + 4) return true;
      }
      return false;
    };
    let edges = "", rooms = "", marks = "";
    // ----- 방 사이 길 -----
    const done = {};
    for (const a in maps) for (const d of (maps[a].doors || [])) {
      const b = d.to; if (!b || !maps[b] || !R[b] || !R[a]) continue;
      const key = a < b ? a + "|" + b : b + "|" + a; if (done[key]) continue; done[key] = 1;
      const back = (maps[b].doors || []).find(e => e.to === a);
      const locked = lockedDoor(d) || (back && lockedDoor(back)) || gatedDoor(d, maps) || (back && gatedDoor(back, maps));
      const cable = !!(d.cable || (back && back.cable));
      const stair = isStair(maps[a], d) || (back && isStair(maps[b], back));
      const A = R[a], B = R[b], Cc = maps[a].rows[0].length, Rr = maps[a].rows.length;
      let dp = null, mx, my;
      const ox0 = Math.max(A.x, B.x) + 16, ox1 = Math.min(A.x + A.w, B.x + B.w) - 16;
      const oy0 = Math.max(A.y, B.y) + 14, oy1 = Math.min(A.y + A.h, B.y + B.h) - 14;
      if (ox1 >= ox0 && (B.y >= A.y + A.h || A.y >= B.y + B.h)) {            // 위아래로 잇기
        const top = A.y < B.y ? A : B, bot = top === A ? B : A, y1 = top.y + top.h, y2 = bot.y;
        const pref = Math.min(ox1, Math.max(ox0, A.x + (d.x + 0.5) / Cc * A.w));
        const cand = [pref];
        for (let k = 0; k <= 10; k++) cand.push(ox0 + (ox1 - ox0) * k / 10);
        cand.sort((u, v) => Math.abs(u - pref) - Math.abs(v - pref));
        const x = cand.find(xx => !hits(xx, y1, xx, y2, [a, b]));
        if (x !== undefined) { dp = "M" + x + " " + y1 + " L" + x + " " + y2; mx = x; my = (y1 + y2) / 2 }
      } else if (oy1 >= oy0 && (B.x >= A.x + A.w || A.x >= B.x + B.w)) {     // 옆으로 잇기
        const lf = A.x < B.x ? A : B, rt = lf === A ? B : A, x1 = lf.x + lf.w, x2 = rt.x;
        const pref = Math.min(oy1, Math.max(oy0, A.y + (d.y + 0.5) / Rr * A.h));
        const cand = [pref];
        for (let k = 0; k <= 10; k++) cand.push(oy0 + (oy1 - oy0) * k / 10);
        cand.sort((u, v) => Math.abs(u - pref) - Math.abs(v - pref));
        const y = cand.find(yy => !hits(x1, yy, x2, yy, [a, b]));
        if (y !== undefined) { dp = "M" + x1 + " " + y + " L" + x2 + " " + y; mx = (x1 + x2) / 2; my = y }
      }
      if (!dp) {                                                           // 대각선 방 : 문에서 나가 ㄱ자로 꺾어 잇기
        const dirA = doorDir(maps[a], d), dirB = back ? doorDir(maps[b], back) : "";
        const Cb = maps[b].rows[0].length, Rb = maps[b].rows.length;
        const cl = (v, lo, hi) => Math.min(hi, Math.max(lo, v));
        const segOK = pts => { for (let i = 0; i + 1 < pts.length; i++) if (hits(pts[i][0], pts[i][1], pts[i + 1][0], pts[i + 1][1], [a, b])) return false; return true };
        let pts = null;
        if ((dirA === "N" && B.y + B.h <= A.y) || (dirA === "S" && B.y >= A.y + A.h)) {
          const x1 = cl(A.x + (d.x + 0.5) / Cc * A.w, A.x + 14, A.x + A.w - 14), y1 = dirA === "N" ? A.y : A.y + A.h;
          const y2 = dirA === "N" ? B.y + B.h : B.y;
          const x2 = (dirB === "N" || dirB === "S") ? cl(B.x + (back.x + 0.5) / Cb * B.w, B.x + 14, B.x + B.w - 14) : B.x + B.w / 2;
          const ym = (y1 + y2) / 2;
          pts = [[x1, y1], [x1, ym], [x2, ym], [x2, y2]];
        } else if ((dirA === "W" && B.x + B.w <= A.x) || (dirA === "E" && B.x >= A.x + A.w)) {
          const y1 = cl(A.y + (d.y + 0.5) / Rr * A.h, A.y + 14, A.y + A.h - 14), x1 = dirA === "W" ? A.x : A.x + A.w;
          const x2 = dirA === "W" ? B.x + B.w : B.x;
          const y2 = (dirB === "W" || dirB === "E") ? cl(B.y + (back.y + 0.5) / Rb * B.h, B.y + 14, B.y + B.h - 14) : B.y + B.h / 2;
          const xm = (x1 + x2) / 2;
          pts = [[x1, y1], [xm, y1], [xm, y2], [x2, y2]];
        }
        if (pts && segOK(pts)) {
          dp = "M" + pts.map(q => q[0] + " " + q[1]).join(" L");
          mx = (pts[1][0] + pts[2][0]) / 2; my = (pts[1][1] + pts[2][1]) / 2;
        }
      }
      if (!dp) {                                                           // 멀리 떨어진 방 : 둥글게 돌아가기
        const ax = A.x + A.w / 2, ay = A.y + A.h / 2, bx = B.x + B.w / 2, by = B.y + B.h / 2;
        const vx = bx - ax, vy = by - ay, Ln = Math.hypot(vx, vy) || 1;
        let nx = -vy / Ln, ny = vx / Ln;
        const off = (Math.abs(nx) > Math.abs(ny) ? Math.max(A.w, B.w) : Math.max(A.h, B.h)) * 0.8 + 30;
        let cx = (ax + bx) / 2 + nx * off, cy = (ay + by) / 2 + ny * off;
        if (hits(cx - 10, cy - 10, cx + 10, cy + 10, [a, b])) { nx = -nx; ny = -ny; cx = (ax + bx) / 2 + nx * off; cy = (ay + by) / 2 + ny * off }
        const sx = ax + nx * A.w / 2, sy = ay + ny * A.h / 2, ex = bx + nx * B.w / 2, ey = by + ny * B.h / 2;
        dp = "M" + sx + " " + sy + " Q" + cx + " " + cy + " " + ex + " " + ey;
        mx = 0.25 * sx + 0.5 * cx + 0.25 * ex; my = 0.25 * sy + 0.5 * cy + 0.25 * ey;
        grow(Math.min(cx, sx, ex) - 10, Math.min(cy, sy, ey) - 10, Math.max(cx, sx, ex) + 10, Math.max(cy, sy, ey) + 10);
      }
      const col = locked ? "#a3abb8" : cable ? "#5b94d6" : stair ? "#b99ad8" : "#c7b48f";
      edges += '<path d="' + dp + '" fill="none" stroke="' + col + '" stroke-width="' + (cable ? 5 : 8) + '" stroke-linecap="round" stroke-linejoin="round"' +
               (locked || cable ? ' stroke-dasharray="' + (cable ? "10 8" : "4 10") + '"' : "") + "/>";
      if (onPath[a + ">" + b]) edges += '<path class="wmHot" d="' + dp + '" fill="none" stroke="#ff8a3d" stroke-width="7" stroke-linecap="round" stroke-dasharray="14 10"/>';
      if (locked) { marks += '<g transform="translate(' + mx + " " + my + ')"><circle r="15" fill="#fff" stroke="#8a93a1" stroke-width="2.5"/><text y="6" font-size="17" text-anchor="middle">🔒</text></g>'; grow(mx - 16, my - 16, mx + 16, my + 16) }
      else if (cable || stair) {
        const t = cable ? "🚡 케이블카" : "🪜 계단", w2 = cable ? 44 : 30;
        marks += '<g transform="translate(' + mx + " " + my + ')"><rect x="-' + w2 + '" y="-13" width="' + (w2 * 2) + '" height="26" rx="13" fill="' + (cable ? "#eaf3ff" : "#f3ecfb") +
                 '" stroke="' + col + '" stroke-width="2"/><text y="5" font-size="13" font-weight="800" fill="' + (cable ? "#2f5f9a" : "#6a4a9a") + '" text-anchor="middle">' + t + "</text></g>";
        grow(mx - w2 - 2, my - 15, mx + w2 + 2, my + 15);
      }
    }
    // ----- 방 -----
    for (const id in R) {
      const m = maps[id], r = R[id], x = r.x, y = r.y, w = r.w, h = r.h, here = id === room, seen = visited.has(id);
      const left = leftIn(id), has = hasQ(id), goalHere = gl.room === id, small = h < H * 0.8;
      grow(x - 10, y - 30, x + w + 10, y + h + 10);
      if (goalHere) rooms += '<rect class="wmGoal" x="' + (x - 7) + '" y="' + (y - 7) + '" width="' + (w + 14) + '" height="' + (h + 14) + '" rx="20" fill="none" stroke="#ff8a3d" stroke-width="5"/>';
      rooms += '<rect x="' + x + '" y="' + y + '" width="' + w + '" height="' + h + '" rx="15" fill="' + (here ? "#fff5cc" : seen ? "#eef8f1" : "#eceef2") +
               '" stroke="' + (here ? "#e0485a" : seen ? "#6cc98f" : "#b8bfca") + '" stroke-width="' + (here ? 4 : 2.5) + '"' + (seen ? "" : ' stroke-dasharray="7 6"') + "/>";
      rooms += '<text x="' + (x + 11) + '" y="' + (y + 21) + '" font-size="15" font-weight="800" fill="' + (seen ? "#3d3325" : "#8a8f99") + '">' + esc(m.name || id) + "</text>";
      if (has) {
        const badge = left ? "❓" + left : "✓";
        rooms += '<g transform="translate(' + (x + w - 12) + " " + (y + 16) + ')"><rect x="-' + (left ? 30 : 16) + '" y="-12" width="' + (left ? 34 : 22) + '" height="22" rx="11" fill="' +
                 (left ? "#ffe3a3" : "#c9efd5") + '"/><text x="' + (left ? -13 : -5) + '" y="4" font-size="12.5" font-weight="800" text-anchor="middle" fill="' + (left ? "#9a5b00" : "#2b7a4b") + '">' + badge + "</text></g>";
      }
      // 배치도 칸 (가로 세로 비율 그대로)
      const aw = w - 16, ah = h - (small ? 30 : 37), COLS = m.rows[0].length, ROWS = m.rows.length;
      const t = Math.min(aw / COLS, ah / ROWS), pw = t * COLS, ph = t * ROWS;
      const ix = x + 8 + (aw - pw) / 2, iy = y + (small ? 26 : 29) + (ah - ph) / 2;
      if (seen && t > 1.2) {
        rooms += '<rect x="' + ix + '" y="' + iy + '" width="' + pw + '" height="' + ph + '" rx="4" fill="' + (m.ground && m.ground !== "floor" ? "#fbfdf7" : "#f7ecd8") + '"/>';
        const byCol = {};
        for (let ty = 0; ty < ROWS; ty++) for (let tx = 0; tx < COLS; tx++) {
          const c = m.rows[ty][tx], o = (m.obj || {})[c], col = tileColor(m, c, o);
          if (!col) continue;
          byCol[col] = (byCol[col] || "") + "M" + (ix + tx * t).toFixed(1) + " " + (iy + ty * t).toFixed(1) + "h" + (t + 0.25).toFixed(2) + "v" + (t + 0.25).toFixed(2) + "h-" + (t + 0.25).toFixed(2) + "z";
        }
        for (const col in byCol) rooms += '<path d="' + byCol[col] + '" fill="' + col + '"/>';
        for (const dd of (m.doors || [])) {
          const lk = lockedDoor(dd) || gatedDoor(dd, maps);
          rooms += '<rect x="' + (ix + dd.x * t - 1) + '" y="' + (iy + dd.y * t - 1) + '" width="' + (t + 2) + '" height="' + (t + 2) + '" rx="2" fill="' +
                   (lk ? "#6b7280" : dd.exit ? "#3fae6a" : isStair(m, dd) ? "#9a7ad0" : "#f2a93b") + '"/>';
        }
        for (const s of st) if (s.room === id) {
          const f = typeof fs === "function" ? fs(s) : s, ok = sq.has(s.i);
          rooms += '<circle cx="' + (ix + f.x * t) + '" cy="' + (iy + f.y * t) + '" r="' + (ok ? 3.3 : 4.3) + '" fill="' + (ok ? "#3fae6a" : "#ffb300") +
                   '" stroke="' + (ok ? "#fff" : "#8a5200") + '" stroke-width="1.2"/>';
        }
        if (CH && id === CH.room && useT && !passOk)
          rooms += '<text x="' + (ix + CH.x * t) + '" y="' + (iy + CH.y * t + 5) + '" font-size="13" text-anchor="middle">🎁</text>';
      } else if (!seen) {
        rooms += '<text x="' + (x + w / 2) + '" y="' + (y + h / 2 + (small ? 14 : 12)) + '" font-size="' + (small ? 22 : 32) + '" font-weight="800" fill="#c3c8d0" text-anchor="middle">?</text>';
        if (!small) rooms += '<text x="' + (x + w / 2) + '" y="' + (y + h - 12) + '" font-size="11.5" font-weight="700" fill="#8a8f99" text-anchor="middle">아직 안 가 본 곳</text>';
      }
      if (goalHere) { marks += '<g transform="translate(' + (x + w / 2) + " " + (y - 13) + ')"><rect x="-50" y="-14" width="100" height="26" rx="13" fill="#ff8a3d"/>' +
                               '<text y="5" font-size="13.5" font-weight="800" fill="#fff" text-anchor="middle">⭐ 다음 목표</text></g>'; grow(x + w / 2 - 52, y - 30, x + w / 2 + 52, y) }
      if (here && p) {
        const px = ix + p.x * t, py = iy + p.y * t;
        marks += '<circle class="wmMeRing" cx="' + px + '" cy="' + py + '" r="11" fill="none" stroke="#e0485a" stroke-width="3"/>' +
                 '<circle cx="' + px + '" cy="' + py + '" r="6" fill="#e0485a" stroke="#fff" stroke-width="2"/>' +
                 '<g transform="translate(' + px + " " + (py - 17) + ')"><rect x="-17" y="-11" width="34" height="19" rx="9.5" fill="#e0485a"/>' +
                 '<text y="3.5" font-size="11.5" font-weight="800" fill="#fff" text-anchor="middle">📍나</text></g>';
      }
      // 바깥으로 나가는 출구
      for (const dd of (m.doors || [])) if (dd.exit && !maps[dd.to]) {
        const v = DIRV[doorDir(m, dd) || "S"];
        const cx = x + w / 2 + v[0] * (w / 2 + GX * 0.62), cy = y + h / 2 + v[1] * (h / 2 + 28);
        const sx = x + w / 2 + v[0] * w / 2, sy = y + h / 2 + v[1] * h / 2;
        edges += '<path d="M' + sx + " " + sy + " L" + cx + " " + (cy - v[1] * 12) + '" stroke="' + (gl.exit ? "#ff8a3d" : "#3fae6a") + '" stroke-width="6" stroke-linecap="round"' +
                 (gl.exit ? ' class="wmHot" stroke-dasharray="14 10"' : "") + "/>";
        const label = "🚪 " + (dd.label || "출구") + (passOk ? " (열림)" : " 🔒"), lw = Math.max(70, label.length * 7.4);
        marks += '<g transform="translate(' + cx + " " + cy + ')"><rect x="-' + lw + '" y="-15" width="' + (lw * 2) + '" height="30" rx="15" fill="' + (passOk ? "#3fae6a" : "#fff") +
                 '" stroke="' + (gl.exit ? "#ff8a3d" : "#3fae6a") + '" stroke-width="' + (gl.exit ? 4 : 2) + '"/><text y="5.5" font-size="13.5" font-weight="800" text-anchor="middle" fill="' +
                 (passOk ? "#fff" : "#2b7a4b") + '">' + esc(label) + "</text></g>";
        grow(cx - lw - 4, cy - 18, cx + lw + 4, cy + 18);
      }
    }
    const vb = [bx0 - 10, by0 - 10, bx1 - bx0 + 20, by1 - by0 + 20];
    const f = R[room] ? [R[room].x + R[room].w / 2, R[room].y + R[room].h / 2] : [vb[0] + vb[2] / 2, vb[1] + vb[3] / 2];
    return { vb: vb, focus: f, html: '<svg class="wmSvg" viewBox="' + vb.join(" ") + '" preserveAspectRatio="xMidYMid meet" role="img" aria-label="전체 지도">' + edges + rooms + marks + "</svg>" };
  }

  // ---------- 창 ----------
  function ensure(){
    let m = document.getElementById("worldMap");
    if (m) return m;
    m = document.createElement("div");
    m.id = "worldMap"; m.className = "modal";
    m.innerHTML =
      '<div class="box wmBox">' +
        '<div class="head"><b>🗺️ ' + (C.title || "전체 지도") + '</b><button id="wmX" aria-label="지도 닫기">×</button></div>' +
        '<div class="wmNow" id="wmNow"></div>' +
        '<div class="wmTools"><button id="wmZo" aria-label="작게 보기">－</button><span id="wmZl">100%</span>' +
          '<button id="wmZi" aria-label="크게 보기">＋</button><button id="wmMe" aria-label="내 위치로">📍 내 위치</button></div>' +
        '<div class="wmWrap" id="wmWrap"></div>' +
        '<div class="wmLegend">' +
          '<span><i class="wm-me"></i>나</span><span><i class="wm-seen"></i>다녀온 곳</span><span><i class="wm-unseen"></i>안 가 본 곳</span>' +
          '<span><i class="wm-goal"></i>다음 목표 · 가는 길</span><span><i class="wm-q"></i>남은 문제</span><span><i class="wm-ok"></i>푼 문제</span>' +
          (C.legend || "") +
        "</div>" +
        '<button id="wmOk" class="okbtn wide">닫기</button>' +
      "</div>";
    document.body.appendChild(m);
    const close = () => { if (WM.on) toggle(false) };
    document.getElementById("wmX").onclick = close;
    document.getElementById("wmOk").onclick = close;
    document.getElementById("wmZi").onclick = () => zoomBy(1.35);
    document.getElementById("wmZo").onclick = () => zoomBy(1 / 1.35);
    document.getElementById("wmMe").onclick = () => focus(true);
    m.addEventListener("click", e => { if (e.target === m) close() });          // 바깥을 누르면 닫기
    addEventListener("keydown", function (e){
      if (!WM.on) return;
      if (e.key === "Escape" || e.key === "Enter") { e.preventDefault(); e.stopImmediatePropagation(); close() }
    }, true);
    addEventListener("resize", () => { if (WM.on) { WM.zoom = 0; render() } });
    return m;
  }
  function render(){
    const maps = G("maps"), room = G("room"), visited = G("visited"), st = G("stations") || [], sq = G("solvedQ"), esc = G("esc"), roomName = G("roomName");
    if (!maps || !maps[room]) return;
    const gl = goal();
    const nV = Object.keys(maps).filter(id => visited.has(id)).length, nA = Object.keys(maps).length;
    const route = gl.path.length > 1 ? '<div class="wmRoute">가는 길 : ' + gl.path.map(id => esc(roomName(id))).join(" → ") + "</div>" : "";
    document.getElementById("wmNow").innerHTML =
      '<div class="wmStat"><span>📍 지금 <b>' + esc(roomName(room)) + '</b></span><span>다녀온 곳 <b>' + nV + " / " + nA + '</b></span><span>남은 문제 <b>' + (st.length - sq.size) + "</b>개</span></div>" +
      '<div class="wmGoalText">⭐ ' + esc(gl.text) + "</div>" + route;
    const out = svg(gl);
    WM.last = out;
    const wr = document.getElementById("wmWrap");
    wr.innerHTML = out.html;
    if (!WM.zoom) {       // 처음 : 글자가 읽힐 만큼 (좁은 화면 · 방이 많은 지도는 크게 시작)
      const sWhole = Math.min((wr.clientWidth - 8) / out.vb[2], (wr.clientHeight - 8) / out.vb[3]) || 1;
      WM.zoom = Math.round(Math.min(2.6, Math.max(1, 0.62 / sWhole)) * 10) / 10;
    }
    apply();
    focus(false);
  }
  function apply(){
    const wr = document.getElementById("wmWrap"), sv = wr && wr.querySelector("svg");
    if (!sv) return;
    const z = WM.zoom || 1;
    sv.style.width = Math.max(120, (wr.clientWidth - 8) * z) + "px";
    sv.style.height = Math.max(90, (wr.clientHeight - 8) * z) + "px";
    wr.classList.toggle("zoomed", z > 1.01);
    document.getElementById("wmZl").textContent = Math.round(z * 100) + "%";
  }
  function zoomBy(k){
    const wr = document.getElementById("wmWrap");
    const cx = (wr.scrollLeft + wr.clientWidth / 2) / (wr.scrollWidth || 1), cy = (wr.scrollTop + wr.clientHeight / 2) / (wr.scrollHeight || 1);
    WM.zoom = Math.min(4, Math.max(1, Math.round((WM.zoom || 1) * k * 10) / 10));
    apply();
    wr.scrollLeft = cx * wr.scrollWidth - wr.clientWidth / 2;
    wr.scrollTop = cy * wr.scrollHeight - wr.clientHeight / 2;
  }
  function focus(smooth){
    const wr = document.getElementById("wmWrap"), sv = wr && wr.querySelector("svg"), o = WM.last;
    if (!sv || !o) return;
    const sw = sv.clientWidth, sh = sv.clientHeight, vb = o.vb;
    const s = Math.min(sw / vb[2], sh / vb[3]), ox = (sw - vb[2] * s) / 2, oy = (sh - vb[3] * s) / 2;
    const L = ox + (o.focus[0] - vb[0]) * s + 4 - wr.clientWidth / 2, T = oy + (o.focus[1] - vb[1]) * s + 4 - wr.clientHeight / 2;
    if (smooth && wr.scrollTo) wr.scrollTo({ left: L, top: T, behavior: "smooth" }); else { wr.scrollLeft = L; wr.scrollTop = T }
  }
  function toggle(on){
    const m = ensure();
    const want = on === undefined ? !WM.on : !!on;
    if (want === WM.on) return WM.on;
    if (want) {
      const mo = G("modalOpen");
      if (typeof mo === "function" && mo()) return false;           // 다른 창이 열려 있으면 열지 않습니다
      if (G("started") === false || G("finished") === true) return false;
      if (document.pointerLockElement && document.exitPointerLock) { try { document.exitPointerLock() } catch (e) {} }
      WM.on = true; m.classList.add("open"); render();
      const k = G("keys"); if (k && k.clear) k.clear();
    } else { WM.on = false; m.classList.remove("open") }
    const b = document.getElementById("wmBtn"); if (b) b.classList.toggle("on", WM.on);
    if (typeof C.onToggle === "function") C.onToggle(WM.on);
    return WM.on;
  }
  window.WorldMap = { toggle: toggle, isOpen: () => WM.on, render: render };

  // ---------- 버튼 · M 키 ----------
  function boot(){
    if (C.button !== false && !document.getElementById("wmBtn")) {
      const b = document.createElement("button");
      b.id = "wmBtn"; b.type = "button"; b.title = "전체 지도 (M)";
      b.innerHTML = "🗺️ 전체 지도";
      b.addEventListener("click", e => { e.stopPropagation(); toggle() });
      (document.getElementById("frame") || document.body).appendChild(b);
    }
    if (C.keyM !== false) addEventListener("keydown", function (e){
      const tag = (e.target && e.target.tagName) || "";
      if (tag === "INPUT" || tag === "TEXTAREA") return;
      if (e.repeat) return;
      if (e.code === "KeyM" || e.key === "m" || e.key === "M" || e.key === "ㅡ") toggle();
    });
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", boot); else boot();
})();
