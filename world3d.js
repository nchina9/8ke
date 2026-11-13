// ===================================================================
//  우리학교 탈출 3D - 3D 그리기 모듈 (world3d.js)
//
//  * 맵(data/maps.js)의 글자 한 칸을 3D 바닥 · 벽 · 가구로 바꿔 그립니다.
//  * 게임 규칙(문제 · 이동 · 충돌 · 저장)은 game.js 가 그대로 맡고,
//    이 파일은 '눈에 보이는 것'만 담당합니다.
//  * 멀리 있는 것이 통나무처럼 둥글게 아래로 휘어지는 '굽은 세상' 효과를 씁니다.
//  * 사람 · 동물 캐릭터와 가구는 모두 도형을 조립해 만들므로 그림 파일이 필요 없습니다.
// ===================================================================
window.World3D = (function () {
  "use strict";
  var T = window.THREE;
  if (!T) return null;
  try { if (T.ColorManagement) T.ColorManagement.legacyMode = false } catch (e) {}

  // ================================================================
  //  1. 굽은 세상 : 카메라가 보는 곳에서 멀어질수록 바닥이 아래로 휩니다
  // ================================================================
  var U = { uCurve: { value: 0.006 }, uCurveZ: { value: 0 } };
  function curved(mat) {
    mat.onBeforeCompile = function (sh) {
      sh.uniforms.uCurve = U.uCurve;
      sh.uniforms.uCurveZ = U.uCurveZ;
      sh.vertexShader = "uniform float uCurve;\nuniform float uCurveZ;\n" +
        sh.vertexShader.replace("#include <project_vertex>", [
          "vec4 mvPosition = vec4( transformed, 1.0 );",
          "#ifdef USE_INSTANCING",
          "  mvPosition = instanceMatrix * mvPosition;",
          "#endif",
          "vec4 cw = modelMatrix * mvPosition;",
          "float cdz = cw.z - uCurveZ;",
          "cw.y -= uCurve * cdz * cdz;",
          "mvPosition = viewMatrix * cw;",
          "gl_Position = projectionMatrix * mvPosition;"
        ].join("\n"));
    };
    mat.customProgramCacheKey = function () { return "curvedWorld1" };
    return mat;
  }

  // 여러 가구를 한 덩어리로 합쳐 그릴 때 쓰는 재질 (색은 꼭짓점마다 따로 들어갑니다)
  var MAT = {
    lit:   curved(new T.MeshLambertMaterial({ vertexColors: true })),
    glow:  curved(new T.MeshBasicMaterial({ vertexColors: true })),
    glass: curved(new T.MeshLambertMaterial({ vertexColors: true, transparent: true,
                                              opacity: 0.42, depthWrite: false })),
    // 반투명 벽 (복도 앞쪽 창가 벽 : 뒤에 선 캐릭터와 바닥이 비쳐 보임)
    fade:  curved(new T.MeshLambertMaterial({ vertexColors: true, transparent: true,
                                              opacity: 0.38, depthWrite: false }))
  };
  var charMats = {};
  function charMat(hex) {
    var k = String(hex);
    if (!charMats[k]) charMats[k] = curved(new T.MeshLambertMaterial({ color: hex }));
    return charMats[k];
  }

  // ================================================================
  //  2. 도형 틀 (한 번 만든 것은 기억해 두고 다시 씁니다)
  // ================================================================
  var G = {};
  function flat(g) {
    var n = g.index ? g.toNonIndexed() : g;
    return { p: n.attributes.position.array, n: n.attributes.normal.array };
  }
  // 모서리가 둥근 상자
  function rboxT(w, h, d, r) {
    r = Math.max(0, Math.min(r, w / 2 - 0.002, h / 2 - 0.002, d / 2 - 0.002));
    var key = "rb" + w.toFixed(3) + "," + h.toFixed(3) + "," + d.toFixed(3) + "," + r.toFixed(3);
    if (G[key]) return G[key];
    var g;
    if (r < 0.004) {
      g = new T.BoxGeometry(w, h, d);
    } else {
      g = new T.BoxGeometry(1, 1, 1, 3, 3, 3);
      var pa = g.attributes.position, na = g.attributes.normal;
      var hw = w / 2, hh = h / 2, hd = d / 2;
      var m = function (a, half) { return Math.abs(a) > 0.34 ? Math.sign(a) * half : Math.sign(a) * (half - r) };
      for (var i = 0; i < pa.count; i++) {
        var x = m(pa.getX(i), hw), y = m(pa.getY(i), hh), z = m(pa.getZ(i), hd);
        var qx = Math.max(-(hw - r), Math.min(hw - r, x));
        var qy = Math.max(-(hh - r), Math.min(hh - r, y));
        var qz = Math.max(-(hd - r), Math.min(hd - r, z));
        var dx = x - qx, dy = y - qy, dz = z - qz, L = Math.sqrt(dx * dx + dy * dy + dz * dz);
        if (L > 1e-6) {
          dx /= L; dy /= L; dz /= L;
          x = qx + dx * r; y = qy + dy * r; z = qz + dz * r;
          na.setXYZ(i, dx, dy, dz);
        }
        pa.setXYZ(i, x, y, z);
      }
    }
    return (G[key] = flat(g));
  }
  function sphT(seg) {
    var key = "sp" + seg;
    return G[key] || (G[key] = flat(new T.SphereGeometry(1, seg * 2, seg)));
  }
  function cylT(rt, rb, h, seg) {
    var key = "cy" + rt.toFixed(3) + "," + rb.toFixed(3) + "," + h.toFixed(3) + "," + seg;
    return G[key] || (G[key] = flat(new T.CylinderGeometry(rt, rb, h, seg)));
  }
  function planeT(w, d) {
    var key = "pl" + w.toFixed(3) + "," + d.toFixed(3);
    return G[key] || (G[key] = flat(new T.PlaneGeometry(w, d).rotateX(-Math.PI / 2)));
  }
  function torusT(R, r) {
    var key = "to" + R.toFixed(3) + "," + r.toFixed(3);
    return G[key] || (G[key] = flat(new T.TorusGeometry(R, r, 6, 18)));
  }

  // ================================================================
  //  3. 조립기 : 도형을 잔뜩 붙인 뒤 한 번에 한 덩어리로 만듭니다
  // ================================================================
  function Builder() {
    this.A = { lit: { p: [], n: [], c: [] }, glow: { p: [], n: [], c: [] }, glass: { p: [], n: [], c: [] },
              fade: { p: [], n: [], c: [] } };
    this.mode = "lit";
    this.M = new T.Matrix4();
    this.S = [];
    this._v = new T.Vector3(); this._n = new T.Vector3();
    this._nm = new T.Matrix3(); this._c = new T.Color();
    this._L = new T.Matrix4(); this._W = new T.Matrix4();
    this._E = new T.Euler(); this._Q = new T.Quaternion();
    this._P = new T.Vector3(); this._Sc = new T.Vector3();
  }
  var BP = Builder.prototype;
  // 기준점 옮기기 (x, y, z 로 옮기고 ry 만큼 돌림) — push 와 pop 은 짝을 맞춥니다
  BP.push = function (x, y, z, ry) {
    this.S.push(this.M.clone());
    var t = new T.Matrix4().makeRotationY(ry || 0);
    t.setPosition(x, y, z);
    this.M.multiply(t);
    return this;
  };
  BP.pop = function () { this.M = this.S.pop(); return this };
  BP.add = function (tpl, L, color) {
    var W = this._W.multiplyMatrices(this.M, L);
    this._nm.getNormalMatrix(W);
    var A = this.A[this.mode], c = this._c.set(color);
    var P = tpl.p, N = tpl.n, v = this._v, n = this._n;
    for (var i = 0; i < P.length; i += 3) {
      v.set(P[i], P[i + 1], P[i + 2]).applyMatrix4(W);
      A.p.push(v.x, v.y, v.z);
      n.set(N[i], N[i + 1], N[i + 2]).applyMatrix3(this._nm).normalize();
      A.n.push(n.x, n.y, n.z);
      A.c.push(c.r, c.g, c.b);
    }
    return this;
  };
  BP.mat = function (x, y, z, rx, ry, rz, sx, sy, sz) {
    this._E.set(rx || 0, ry || 0, rz || 0);
    this._Q.setFromEuler(this._E);
    this._P.set(x, y, z);
    this._Sc.set(sx === undefined ? 1 : sx, sy === undefined ? 1 : sy, sz === undefined ? 1 : sz);
    return this._L.compose(this._P, this._Q, this._Sc);
  };
  // 상자 : (x, 바닥높이 y0, z) 에 가로 w · 높이 h · 깊이 d
  BP.box = function (x, y0, z, w, h, d, color, r) {
    if (r === undefined) r = Math.min(0.05, Math.min(w, h, d) * 0.22);
    return this.add(rboxT(w, h, d, r), this.mat(x, y0 + h / 2, z), color);
  };
  // 기울인 상자 (가운데를 중심으로 돌림)
  BP.boxR = function (x, yc, z, w, h, d, color, r, rx, ry, rz) {
    if (r === undefined) r = Math.min(0.04, Math.min(w, h, d) * 0.22);
    return this.add(rboxT(w, h, d, r), this.mat(x, yc, z, rx, ry, rz), color);
  };
  // 공 (가운데 x, y, z · 반지름 rx ry rz)
  BP.ball = function (x, y, z, rx, ry, rz, color, seg) {
    return this.add(sphT(seg || 7), this.mat(x, y, z, 0, 0, 0, rx, ry === undefined ? rx : ry, rz === undefined ? rx : rz), color);
  };
  // 원기둥 (바닥높이 y0)
  BP.cyl = function (x, y0, z, rt, rb, h, color, seg) {
    return this.add(cylT(rt, rb, h, seg || 12), this.mat(x, y0 + h / 2, z), color);
  };
  // 눕히거나 기울인 원기둥 (가운데 기준)
  BP.cylR = function (x, yc, z, rt, rb, h, color, seg, rx, ry, rz) {
    return this.add(cylT(rt, rb, h, seg || 12), this.mat(x, yc, z, rx, ry, rz), color);
  };
  BP.ring = function (x, yc, z, R, r, color, rx, ry, rz) {
    return this.add(torusT(R, r), this.mat(x, yc, z, rx, ry, rz), color);
  };
  // 바닥에 까는 얇은 판
  BP.floor = function (x, y, z, w, d, color) {
    return this.add(planeT(w, d), this.mat(x, y, z), color);
  };
  BP.glow = function (fn) { var m = this.mode; this.mode = "glow"; fn(); this.mode = m; return this };
  BP.fade = function (fn) { var m = this.mode; this.mode = "fade"; fn(); this.mode = m; return this };
  BP.glass = function (fn) { var m = this.mode; this.mode = "glass"; fn(); this.mode = m; return this };
  BP.build = function () {
    var grp = new T.Group();
    for (var k in this.A) {
      var A = this.A[k];
      if (!A.p.length) continue;
      var g = new T.BufferGeometry();
      g.setAttribute("position", new T.Float32BufferAttribute(A.p, 3));
      g.setAttribute("normal", new T.Float32BufferAttribute(A.n, 3));
      g.setAttribute("color", new T.Float32BufferAttribute(A.c, 3));
      var mesh = new T.Mesh(g, MAT[k]);
      mesh.frustumCulled = false;
      if (k === "glass") mesh.renderOrder = 2;
      if (k === "fade") mesh.renderOrder = 3;
      grp.add(mesh);
    }
    return grp;
  };

  // 칸마다 늘 같은 값이 나오는 '가짜 난수' (책 색 · 꽃 색이 새로고침해도 똑같게)
  function rnd(x, y, s) {
    var h = (Math.imul(x | 0, 374761393) + Math.imul(y | 0, 668265263) + Math.imul((s | 0) + 1, 1274126177)) | 0;
    h = Math.imul(h ^ (h >>> 13), 1274126177);
    h = h ^ (h >>> 16);
    return (h >>> 0) / 4294967296;
  }
  function pickc(list, v) { return list[Math.floor(v * list.length) % list.length] }
  function shade(hex, k) {           // k > 0 밝게, k < 0 어둡게
    var c = new T.Color(hex), w = new T.Color(k > 0 ? 0xffffff : 0x000000);
    return c.lerp(w, Math.abs(k));
  }

  // ================================================================
  //  4. 방마다 색깔 (바닥 · 벽 · 허리 벽 · 커튼 · 배경)
  //     새 방을 만들면 여기에 한 줄 추가하면 됩니다. 없으면 기본 교실 색을 씁니다.
  // ================================================================
  var WALL_H = 2.3, SHORT_H = 0.42, BUILD_H = 3.4;
  // ⛰ 입체 맵 : maps.js 의 lift(13줄 × 24글자, 0~9) = 칸마다 바닥 높이 (한 단 LV m)
  //   한 단 차이는 계단처럼 걸어 올라가고, 두 단 이상 차이는 절벽(못 지나감 · game.js 에서 막음)
  var LV = 0.34, curLift = null;
  function liftOf(L, x, y) {
    if (!L || !L[y]) return 0;
    var v = parseInt(L[y].charAt(x), 10);
    return v > 0 ? v : 0;
  }
  function hAt(x, z) { return liftOf(curLift, Math.floor(x), Math.floor(z)) * LV }
  var BASE = {
    floor: "wood", floorA: "#e2b77f", floorB: "#d6a970",
    wall: "#fbf1da", wains: "#9fd3a4", trim: "#ffffff", cap: "#6d5443",
    curtain: "#ffb7a6", locker: "#8fbde0", sofa: "#f0a46c", bg: "indoor"
  };
  var STYLES = {
    // ⏱ 타임머신 도착 : 汴京(변경) 성문 앞 광장 — 성문 누각(tower) + 회색 기와
    gate:      { floor: "tile", floorA: "#d9cdb4", floorB: "#cfc2a6", bg: "sky", outdoor: true, palace: true, tower: true, song: true,
                 bWall: "#9a8268", bBase: "#7a6a58", bRoof: "#4a4f5c", bTrim: "#f4ead2", riser: "#9a8f80", riserCap: "#c9bfae", awning: "#c8372d" },
    // 강변 무지개 다리 + 짐 상자 미로
    rooftop:   { floor: "tile", floorA: "#d6c9ae", floorB: "#cbbd9f", bg: "sky", outdoor: true, crates: true,
                 wains: "#b9a888", cap: "#d8ccb2", riser: "#9a8f80", riserCap: "#c9bfae" },
    // 시장 거리 4곳 (밖 · 흙길 + 가게 건물 + 운하)
    hall1:     { floor: "tile", floorA: "#d8c7a4", floorB: "#cebc97", bg: "sky", outdoor: true, awning: "#c8372d", bWall: "#d9b98a", bBase: "#8a7a66", bRoof: "#4a4f5c", bTrim: "#f4ead2", riser: "#9a8f80", riserCap: "#c9bfae", song: true, palace: true },
    up2:       { floor: "tile", floorA: "#d9c9a2", floorB: "#cfbe95", bg: "sky", outdoor: true, awning: "#3f9b6a", bWall: "#d9b98a", bBase: "#8a7a66", bRoof: "#4a4f5c", bTrim: "#f4ead2", riser: "#9a8f80", riserCap: "#c9bfae", song: true, palace: true },
    up3:       { floor: "tile", floorA: "#d6c8a8", floorB: "#ccbd9b", bg: "sky", outdoor: true, awning: "#2f6f9a", bWall: "#d9b98a", bBase: "#8a7a66", bRoof: "#4a4f5c", bTrim: "#f4ead2", riser: "#9a8f80", riserCap: "#c9bfae", song: true, palace: true },
    up4:       { floor: "tile", floorA: "#dac6a0", floorB: "#d0bb93", bg: "sky", outdoor: true, awning: "#e8a33a", bWall: "#d9b98a", bBase: "#8a7a66", bRoof: "#4a4f5c", bTrim: "#f4ead2", riser: "#9a8f80", riserCap: "#c9bfae", song: true, palace: true },
    // 가게 안 (나무 바닥 · 종이 격자창)
    class101:  { floorA: "#c9a87a", floorB: "#bd9b6c", wains: "#7a3b22", wall: "#f4ead2", curtain: "#c8372d", cap: "#5a2a18" },   // 비단 옷가게
    class102:  { floorA: "#c4a074", floorB: "#b89466", wains: "#5a2a18", wall: "#f1e4c8", curtain: "#2f6f9a", cap: "#3d2a1a" },   // 신발 가게
    science:   { floor: "tile", floorA: "#d9cdb4", floorB: "#cfc2a6", wains: "#2f6f9a", wall: "#f4ead2", curtain: "#f2c14e", cap: "#5a2a18" }, // 염색 가게
    music:     { floorA: "#c9a87a", floorB: "#bd9b6c", wains: "#3f9b6a", wall: "#f6ecd4", curtain: "#e8a33a", cap: "#5a2a18" },   // 과일 가게
    art:       { floorA: "#c9a87a", floorB: "#bd9b6c", wains: "#a8693f", wall: "#f6ecd4", curtain: "#ffcf73", cap: "#5a2a18", dish: ["#fbf3df", "#f2d27a"] }, // 빵 가게
    class201:  { floorA: "#b98b5b", floorB: "#ab7e50", wains: "#7a3b22", wall: "#f4e6cc", curtain: "#c8372d", cap: "#3d2a1a" },   // 마파두부 식당
    library:   { floorA: "#b98b5b", floorB: "#ab7e50", wains: "#5a3d2b", wall: "#f6e7c8", curtain: "#9bc98a", cap: "#3d2a1a" },   // 서점
    computer:  { floorA: "#c9a87a", floorB: "#bd9b6c", wains: "#c8372d", wall: "#fff2e2", curtain: "#d42a24", cap: "#7a1f1a" },   // 剪纸 가게
    broadcast: { floor: "tile", floorA: "#cfc2a6", floorB: "#c4b698", wains: "#5a2a18", wall: "#f1e4c8", curtain: "#c9a227", cap: "#3d2a1a" }, // 钱庄 환전소
    class301:  { floorA: "#c9a87a", floorB: "#bd9b6c", wains: "#e8a33a", wall: "#fff6e2", curtain: "#ff8fa3", cap: "#5a2a18" },   // 买一送一 잡화점
    class302:  { floor: "tile", floorA: "#d9cdb4", floorB: "#cfc2a6", wains: "#8a5530", wall: "#f4ead2", curtain: "#e8c35a", cap: "#5a2a18" }, // 흥정 마당
    office:    { floorA: "#c9a87a", floorB: "#bd9b6c", wains: "#3f9b6a", wall: "#f8f2e2", curtain: "#e6c48a", sofa: "#c0392b", cap: "#3d2a1a" } // 찻집
  };
  function styleFor(id, M) {
    var s = {}, k;
    for (k in BASE) s[k] = BASE[k];
    var over = STYLES[id];
    if (!over && M && M.ground === "grass") over = STYLES.gate;
    if (!over && M && (M.ground === "rooftop" || M.wall === "parapet")) over = STYLES.rooftop;
    if (over) for (k in over) s[k] = over[k];
    return s;
  }

  // ================================================================
  //  5. 방 한 개 만들기
  // ================================================================
  var FAMILY = {                       // 옆으로 이어 붙는 여러 칸짜리 가구
    board_l: "cboard", board_m: "cboard", board_r: "cboard",
    podium_l: "podium", podium_r: "podium",
    counter_l: "counter", counter_r: "counter",
    locker_l: "locker", locker_r: "locker",
    standpodium_l: "stage", standpodium_r: "stage",
    piano_l: "piano", piano_r: "piano",
    labtable_l: "labtable", labtable_r: "labtable",
    mixer_l: "mixer", mixer_r: "mixer",
    trophy_l: "trophy", trophy_r: "trophy",
    sofa_l: "sofa", sofa_r: "sofa",
    board: "notice",
    bus_l: "bus", bus_m: "bus", bus_r: "bus",
    plane: "plane", seat: "seats"
  };
  // 벽에 붙여 두는 물건 (벽 반대쪽을 바라보게 돌립니다)
  var HUG = { bookshelf: 1, extinguisher: 1, chemcabinet: 1, servercab: 1, filecabinet: 1, printer: 1,
              watercooler: 1, artshelf: 1, gearbox: 1, clock: 1, chalkboard: 1, plant: 0,
              sink: 1, safe: 1, atm: 1, kiosk: 1, ticketmachine: 1, brochure: 1, shoeshelf: 1, redpaper: 1,
              snackshelf: 1, fridge: 1, ingredshelf: 1, teashelf: 1 };

  function buildRoom(id, M, opt) {
    opt = opt || {};
    var B = new Builder();
    var rows = M.rows, R = rows.length, C = rows[0].length, O = M.obj || {};
    var S = styleFor(id, M);
    var outdoor = !!S.outdoor && M.ground === "grass";
    var roof = M.ground === "rooftop" || M.wall === "parapet";

    function ch(x, y) { return (y < 0 || y >= R || x < 0 || x >= C) ? "#" : rows[y].charAt(x) }
    function ob(x, y) { return O[ch(x, y)] }
    function isHash(x, y) { return ch(x, y) === "#" }
    function wallLine(x, y) { return isHash(x, y) || ob(x, y) === "window" }
    function wallish(x, y) {
      if (isHash(x, y)) return true;
      var o = ob(x, y);
      if (o === "window") return true;
      if (o === "clock" && wallLine(x - 1, y) && wallLine(x + 1, y) && wallLine(x, y - 1)) return true;
      return false;
    }
    function open(x, y) { return x >= 0 && y >= 0 && x < C && y < R && !wallish(x, y) }
    function hugRot(x, y) {
      if (wallish(x, y - 1)) return 0;
      if (wallish(x - 1, y)) return Math.PI / 2;
      if (wallish(x + 1, y)) return -Math.PI / 2;
      if (wallish(x, y + 1)) return Math.PI;
      return 0;
    }
    var LIFT = M.lift || null;
    function lv(x, y) { return liftOf(LIFT, x, y) }
    var ctx = { B: B, S: S, ch: ch, ob: ob, wallish: wallish, open: open, outdoor: outdoor, roof: roof,
                R: R, C: C, id: id, lv: lv };
    // 복도처럼 화면 앞쪽(아래쪽) 벽이 창가이면, 그 벽은 반투명으로 그립니다
    ctx.fadeFront = false;
    if (!outdoor && !roof) {
      var lastY = -1, wn = 0;
      for (var yy = 0; yy < R; yy++) for (var xx = 0; xx < C; xx++) if (open(xx, yy)) lastY = yy;
      if (lastY >= 0 && lastY + 1 < R) for (xx = 0; xx < C; xx++) if (ob(xx, lastY + 1) === "window") wn++;
      ctx.fadeFront = wn >= 3;
      ctx.frontY = lastY + 1;
    }

    // ---------- 바닥 ----------
    for (var y = 0; y < R; y++) for (var x = 0; x < C; x++) {
      if (wallish(x, y)) {                          // 울타리 · 난간 밑도 땅을 깔아 틈이 안 보이게
        if (outdoor || roof) floorTile(ctx, x, y, outdoor ? "grass" : S.floor);
        continue;
      }
      var o = ob(x, y);
      if (o === "stairdown") continue;              // 내려가는 계단은 바닥에 구멍
      var L0 = lv(x, y);
      if (L0) B.push(0, L0 * LV, 0, 0);
      floorTile(ctx, x, y, o === "grass" ? "grass" : S.floor);
      if (L0) B.pop();
      if (L0) liftSides(ctx, x, y, L0);             // ⛰ 높은 칸의 옆면 (계단 · 축대)
    }
    // ---------- 벽 ----------
    for (y = 0; y < R; y++) for (x = 0; x < C; x++) {
      if (!wallish(x, y)) continue;
      if (outdoor) outdoorWall(ctx, x, y);
      else if (roof) parapet(ctx, x, y);
      else interiorWall(ctx, x, y);
    }
    // ---------- 문 ('D' 글자) ----------
    for (y = 0; y < R; y++) for (x = 0; x < C; x++) {
      if (ch(x, y) !== "D") continue;
      var st = opt.doorState ? opt.doorState(x, y) : "door";
      doorD(ctx, x, y, st);
    }
    // ---------- 가구 ----------
    for (y = 0; y < R; y++) {
      for (x = 0; x < C; x++) {
        var name = ob(x, y);
        if (!name || wallish(x, y)) continue;
        var fam = FAMILY[name];
        if (fam) {
          var x1 = x;
          while (x1 + 1 < C && FAMILY[ob(x1 + 1, y)] === fam && !wallish(x1 + 1, y)) x1++;
          var n = x1 - x + 1;
          var rot = wallish(x, y - 1) ? 0 : (wallish(x, y + 1) && !open(x, y - 1)) ? Math.PI : 0;
          B.push(x + n / 2, lv(x, y) * LV, y + 0.5, rot);
          if (RUN[fam]) RUN[fam](ctx, n, x, y);
          B.pop();
          x = x1;
          continue;
        }
        var fn = ONE[name];
        if (!fn) continue;
        var r2 = HUG[name] ? hugRot(x, y) : 0;
        B.push(x + 0.5, lv(x, y) * LV, y + 0.5, r2);
        fn(ctx, x, y);
        B.pop();
      }
    }
    // ---------- 바깥 풍경 (운동장 둘레의 잔디 · 나무) ----------
    if (outdoor) outdoorSurround(ctx);
    else if (!roof) windowGarden(ctx);

    var grp = B.build();
    // 카메라가 넘어가지 말아야 할 범위 (걸어 다닐 수 있는 칸 기준)
    var minX = C, maxX = 0, minY = R, maxY = 0;
    for (y = 0; y < R; y++) for (x = 0; x < C; x++) if (open(x, y)) {
      if (x < minX) minX = x; if (x > maxX) maxX = x;
      if (y < minY) minY = y; if (y > maxY) maxY = y;
    }
    return { group: grp, style: S, outdoor: !!S.outdoor, bounds: { minX: minX, maxX: maxX, minY: minY, maxY: maxY } };
  }

  // ---------- ⛰ 높은 칸의 옆면 : 한 단 차이는 돌계단, 두 단 이상은 돌 축대 ----------
  function liftSides(c, x, y, L) {
    var B = c.B, S = c.S, cx = x + 0.5, cz = y + 0.5;
    var stone = S.riser || "#cbb89a", cap = S.riserCap || "#e9dcc4";
    var N = [[0, 1, 0], [0, -1, Math.PI], [1, 0, Math.PI / 2], [-1, 0, -Math.PI / 2]];
    for (var i = 0; i < 4; i++) {
      var nx = x + N[i][0], ny = y + N[i][1];
      if (nx < 0 || ny < 0 || nx >= c.C || ny >= c.R || c.wallish(nx, ny)) continue;
      var Ln = c.lv(nx, ny);
      if (Ln >= L) continue;
      var top = L * LV, bot = Ln * LV, d = L - Ln;
      B.push(cx, 0, cz, N[i][2]);
      if (d === 1) {                                  // 계단 두 칸 (아래 칸이 바깥으로 살짝 나옴)
        B.box(0, bot, 0.5 + 0.1, 1.0, LV / 2, 0.2, stone, 0.02);
        B.box(0, bot, 0.5 - 0.05, 1.0, top - bot, 0.12, shade(stone, -0.06), 0.01);
        B.box(0, bot + LV / 2 - 0.012, 0.5 + 0.1, 1.0, 0.025, 0.2, cap, 0.005);
        B.box(0, top - 0.012, 0.5 - 0.05, 1.0, 0.025, 0.12, cap, 0.005);
      } else {                                        // 축대 (벽돌 줄무늬 + 난간)
        B.box(0, bot, 0.5 - 0.04, 1.0, top - bot, 0.1, shade(stone, -0.1), 0.01);
        for (var k = 1; k < d; k++) B.box(0, bot + k * LV, 0.5 + 0.012, 1.0, 0.02, 0.01, shade(stone, -0.22), 0);
        B.box(0, top, 0.5 - 0.04, 1.02, 0.07, 0.14, cap, 0.02);
        B.cyl(-0.42, top, 0.45, 0.03, 0.03, 0.42, "#b0703a", 6);
        B.cyl(0.42, top, 0.45, 0.03, 0.03, 0.42, "#b0703a", 6);
        B.box(0, top + 0.38, 0.45, 0.92, 0.04, 0.04, "#c98b55", 0.01);
      }
      B.pop();
    }
  }

  // ---------- 바닥 한 칸 ----------
  function floorTile(c, x, y, kind) {
    var B = c.B, S = c.S, cx = x + 0.5, cz = y + 0.5, j = rnd(x, y, 7) * 0.06 - 0.03;
    if (kind === "wood") {
      for (var k = 0; k < 2; k++) {
        var base = ((x + k + (y % 2)) % 2) ? S.floorA : S.floorB;
        B.floor(cx, 0, y + 0.25 + k * 0.5, 1, 0.5, shade(base, j + (rnd(x, y, k) - 0.5) * 0.05));
      }
      return;
    }
    if (kind === "grass") {
      var g = ((x + y) % 2) ? (c.S.floorA || "#93d36b") : (c.S.floorB || "#87c962");
      if (c.roof) g = ((x + y) % 2) ? "#9ad874" : "#8fcf69";
      B.floor(cx, 0, cz, 1, 1, shade(g, j));
      // 풀 한 포기 (걷는 데 방해되지 않는 작은 장식)
      if (rnd(x, y, 3) < 0.28) {
        var gx = cx + (rnd(x, y, 4) - 0.5) * 0.6, gz = cz + (rnd(x, y, 5) - 0.5) * 0.6;
        B.boxR(gx, 0.04, gz, 0.03, 0.1, 0.03, "#5fae4f", 0.01, 0, 0, 0.3);
        B.boxR(gx + 0.04, 0.035, gz, 0.03, 0.08, 0.03, "#6fbe5c", 0.01, 0, 0, -0.35);
      }
      return;
    }
    var a = ((x + y) % 2) ? S.floorA : S.floorB;
    if (kind === "carpet") a = S.floorA;
    B.floor(cx, 0, cz, 1, 1, shade(a, j * 0.6));
  }

  // ---------- 실내 벽 ----------
  function interiorWall(c, x, y) {
    var B = c.B, S = c.S, open = c.open, o = c.ob(x, y);
    var oS = open(x, y + 1), oN = open(x, y - 1), oE = open(x + 1, y), oW = open(x - 1, y);
    var oSE = open(x + 1, y + 1), oSW = open(x - 1, y + 1), oNE = open(x + 1, y - 1), oNW = open(x - 1, y - 1);
    if (!(oS || oN || oE || oW || oSE || oSW || oNE || oNW)) return;
    var cx = x + 0.5, cz = y + 0.5;
    // 카메라 쪽(남쪽) 벽은 낮게 잘라서 방 안이 잘 보이게 합니다
    var low = (oN || oNE || oNW) && !(oS || oSE || oSW || oE || oW);
    if (low) {
      // 방 쪽 가장자리에만 얇은 반쪽 벽을 세웁니다 (그 너머는 잘라 낸 단면처럼 비워 둠)
      var d = 0.34, wz = cz - 0.5 + d / 2;
      if (c.ch(x, y - 1) === "D") {                 // 교실 문 아래는 뚫어서 출구로
        B.floor(cx, 0.002, cz - 0.5 + 0.35, 1, 0.7, S.floorB);
        B.box(cx - 0.47, 0, wz, 0.06, SHORT_H + 0.08, d, S.trim, 0.02);
        B.box(cx + 0.47, 0, wz, 0.06, SHORT_H + 0.08, d, S.trim, 0.02);
        return;
      }
      var lowWall = function () {
      B.box(cx, 0, wz, 1, SHORT_H, d, S.wains, 0);
      if (o === "window") {                           // 낮은 창 : 흰 창틀 + 유리
        B.box(cx, SHORT_H, wz, 1.02, 0.06, d + 0.04, "#ffffff", 0.02);
        B.glass(function () { B.box(cx, SHORT_H + 0.06, wz, 0.92, 0.26, 0.06, "#cfeeff", 0) });
        B.box(cx - 0.48, SHORT_H + 0.06, wz, 0.04, 0.34, 0.08, "#ffffff", 0.01);
        B.box(cx, SHORT_H + 0.36, wz, 1.02, 0.04, 0.1, "#ffffff", 0.01);
      } else B.box(cx, SHORT_H, wz, 1.02, 0.06, d + 0.04, S.cap, 0.02);
      };
      if (c.fadeFront && y === c.frontY) {
        // 반투명 앞벽 : 겹치는 조각 없이 판 하나 + 윗단 하나로 깔끔하게
        B.fade(function () {
          // 얇은 판으로 그려서 칸과 칸 사이 옆면이 비쳐 보이지 않게 합니다
          B.box(cx, 0, cz - 0.5 + 0.03, 1.001, SHORT_H + 0.3, 0.02, o === "window" ? "#dff3ff" : S.wains, 0);
        });
        B.box(cx, SHORT_H + 0.3, cz - 0.5 + 0.03, 1.001, 0.04, 0.06, "#ffffff", 0);   // 윗단은 또렷하게
      } else lowWall();
      return;
    }
    var face = oS ? 0 : oE ? Math.PI / 2 : oW ? -Math.PI / 2 : oN ? Math.PI : 0;
    B.push(cx, 0, cz, face);
    if (o === "window") windowWall(c, x, y);
    else {
      plainWall(c);
      if (o === "clock") wallClock(c);
    }
    B.pop();
  }
  function plainWall(c) {
    var B = c.B, S = c.S;
    B.box(0, 0, 0, 1, 0.9, 1, S.wains, 0);
    B.box(0, 0.9, 0, 1, WALL_H - 0.9, 1, S.wall, 0);
    B.box(0, 0.86, 0.49, 1, 0.08, 0.05, S.trim, 0);
    B.box(0, 0, 0.49, 1, 0.1, 0.04, shade(S.wains, -0.2), 0);
    B.box(0, WALL_H, 0, 1, 0.05, 1, S.cap, 0);
  }
  function windowWall(c, x, y) {
    var B = c.B, S = c.S;
    B.box(0, 0, 0, 1, 0.9, 1, S.wains, 0);
    B.box(0, 1.95, 0, 1, WALL_H - 1.95, 1, S.wall, 0);
    B.box(-0.45, 0.9, 0, 0.1, 1.05, 1, S.wall, 0);
    B.box(0.45, 0.9, 0, 0.1, 1.05, 1, S.wall, 0);
    B.box(0, 0, 0.49, 1, 0.1, 0.04, shade(S.wains, -0.2), 0);
    B.box(0, 0.86, 0.1, 0.96, 0.06, 0.82, S.trim, 0.02);          // 창턱
    B.glow(function () { B.box(0, 0.92, -0.32, 0.82, 1.03, 0.02, rnd(x, y, 1) < 0.5 ? "#d9f2ff" : "#cdeeff", 0) });
    B.glass(function () { B.box(0, 0.92, -0.12, 0.8, 1.02, 0.03, "#bfe7ff", 0) });
    B.box(0, 0.92, -0.1, 0.05, 1.02, 0.06, S.trim, 0);             // 가운데 창살
    B.box(0, 1.4, -0.1, 0.8, 0.05, 0.06, S.trim, 0);
    // 양옆 커튼 (살짝 주름진 모양)
    for (var s = -1; s <= 1; s += 2) {
      B.box(s * 0.37, 0.98, 0.34, 0.13, 0.97, 0.07, S.curtain, 0.035);
      B.box(s * 0.37, 1.18, 0.39, 0.15, 0.05, 0.05, shade(S.curtain, -0.15), 0.02);
    }
    B.box(0, 1.94, 0.35, 1, 0.05, 0.08, shade(S.cap, 0.3), 0.02);   // 커튼 봉
    B.box(0, WALL_H, 0, 1, 0.05, 1, S.cap, 0);
  }
  function wallClock(c) {
    var B = c.B;
    B.cylR(0, 1.55, 0.52, 0.22, 0.22, 0.06, "#e9a44c", 20, Math.PI / 2, 0, 0);
    B.cylR(0, 1.55, 0.555, 0.18, 0.18, 0.02, "#fffdf5", 20, Math.PI / 2, 0, 0);
    B.boxR(0, 1.6, 0.57, 0.02, 0.11, 0.01, "#3b2f2a", 0, 0, 0, 0);
    B.boxR(0.03, 1.55, 0.57, 0.08, 0.02, 0.01, "#3b2f2a", 0, 0, 0, 0.4);
  }

  // ---------- 운동장 가장자리 울타리 · 학교 건물 ----------
  function outdoorWall(c, x, y) {
    var B = c.B, S = c.S, cx = x + 0.5, cz = y + 0.5;
    var edge = x === 0 || y === 0 || x === c.C - 1 || y === c.R - 1;
    if (edge) {
      if (y === 0 && x > 2 && x < c.C - 3) return;          // 건물 뒤라 안 보이는 자리
      if (S.bamboo && y !== c.R - 1) bambooHedge(B, cx, cz, x, y);
      else hedge(B, cx, cz, y === c.R - 1 ? 0.42 : 0.72, x, y);     // 카메라 쪽 울타리는 낮게
      return;
    }
    B.box(cx, 0, cz, 1, 0.4, 1, S.bBase, 0);
    B.box(cx, 0.4, cz, 1, BUILD_H - 0.4, 1, S.bWall, 0);
    if (S.palace) {                                          // 톈안먼 : 파란 처마 띠 + 노란 기와 두 겹
      B.box(cx, BUILD_H - 0.25, cz, 1.0, 0.25, 1.02, "#2f6f9a", 0);
      B.box(cx, BUILD_H, cz + 0.12, 1.02, 0.1, 1.3, S.bRoof, 0.02);
      B.box(cx, BUILD_H + 0.1, cz, 1.0, 0.22, 0.95, shade(S.bRoof, -0.08), 0);
      if (S.tower && y === 1 && x >= 7 && x <= 16) {        // 가운데 높은 성루
        B.box(cx, BUILD_H + 0.32, cz, 1, 0.85, 0.9, "#b8302a", 0);
        B.box(cx, BUILD_H + 0.95, cz, 1.0, 0.2, 0.92, "#2f6f9a", 0);
        B.box(cx, BUILD_H + 1.15, cz + 0.1, 1.04, 0.1, 1.3, S.bRoof, 0.02);
        B.box(cx, BUILD_H + 1.25, cz, 1.0, 0.25, 0.7, shade(S.bRoof, -0.08), 0);
        if (x === 7 || x === 16) B.box(cx, BUILD_H + 1.5, cz, 0.3, 0.25, 0.3, S.bRoof, 0.04);
        if (x % 2 === 0) B.glow(function () { B.box(cx, BUILD_H + 0.5, cz + 0.46, 0.4, 0.4, 0.02, "#ffe9a8", 0.02) });
      }
    } else
    B.box(cx, BUILD_H, cz, 1.06, 0.2, 1.06, S.bRoof, 0.03);
    if (c.open(x, y + 1)) {                                  // 건물 앞면 장식
      B.box(cx, 1.78, cz + 0.5, 1, 0.1, 0.08, S.bBase, 0);
      var win = S.song ? songWindow : schoolWindow;
      if (c.ob(x, y) === "window") win(B, cx, 0.75, cz + 0.5);
      if (c.ob(x, y - 1) === "window") win(B, cx, 2.18, cz + 0.5);
      if (S.song && x % 2 === 0) {                            // 처마 밑 홍등
        B.cyl(cx, 2.9, cz + 0.62, 0.005, 0.005, 0.3, "#3b2f2a", 4);
        B.glow(function () { B.ball(cx, 2.78, cz + 0.62, 0.13, 0.11, 0.13, "#ff3b30", 10) });
      }
    }
    if (c.open(x - 1, y) || c.open(x + 1, y)) {
      var sx = c.open(x - 1, y) ? cx - 0.5 : cx + 0.5;
      B.box(sx, 1.78, cz, 0.08, 0.1, 1, S.bBase, 0);
    }
  }
  function schoolWindow(B, x, y0, z) {
    B.box(x, y0 - 0.05, z + 0.02, 0.72, 0.84, 0.05, "#fffaf0", 0.02);
    B.glow(function () { B.box(x, y0, z + 0.05, 0.6, 0.72, 0.02, "#bfe6fb", 0) });
    B.box(x, y0, z + 0.07, 0.04, 0.72, 0.02, "#fffaf0", 0);
    B.box(x, y0 + 0.34, z + 0.07, 0.6, 0.04, 0.02, "#fffaf0", 0);
    B.box(x, y0 - 0.08, z + 0.08, 0.78, 0.05, 0.1, "#fffaf0", 0.02);
  }
  function hedge(B, cx, cz, h, x, y) {
    B.box(cx, 0, cz, 0.98, h, 0.98, shade("#5cb468", (rnd(x, y, 2) - 0.5) * 0.08), 0.16);
    B.ball(cx - 0.18, h - 0.02, cz + 0.12, 0.2, 0.12, 0.2, "#6cc475");
    B.ball(cx + 0.2, h - 0.04, cz - 0.1, 0.18, 0.1, 0.18, "#66bf70");
    if (rnd(x, y, 6) < 0.3) {                                 // 울타리에 핀 작은 꽃
      var fc = pickc(["#ffffff", "#ffd1dc", "#fff08a"], rnd(x, y, 8));
      B.ball(cx + (rnd(x, y, 10) - 0.5) * 0.6, h * (0.4 + rnd(x, y, 11) * 0.5), cz + 0.5, 0.045, 0.045, 0.02, fc, 5);
    }
  }
  function bambooHedge(B, cx, cz, x, y) {          // 🎋 대나무 숲 울타리
    B.box(cx, 0, cz, 0.96, 0.34, 0.96, "#5f9a4a", 0.08);
    B.box(cx, 0.34, cz, 0.9, 0.04, 0.9, "#4f8a3e", 0.02);
    for (var k = 0; k < 5; k++) {
      var bx = cx + (rnd(x, y, k) - 0.5) * 0.7, bz = cz + (rnd(x, y, k + 9) - 0.5) * 0.7;
      var h = 0.75 + rnd(x, y, k + 20) * 0.45, col = pickc(["#7cc56a", "#6db85c", "#8fd27a"], rnd(x, y, k + 30));
      B.cyl(bx, 0, bz, 0.045, 0.05, h, col, 7);
      for (var j = 1; j < 4; j++) B.cyl(bx, h * j / 4, bz, 0.055, 0.055, 0.02, shade(col, -0.2), 7);
      B.ball(bx + 0.1, h - 0.05, bz, 0.16, 0.05, 0.08, "#5ea84f", 6);
      B.ball(bx - 0.08, h * 0.75, bz + 0.05, 0.13, 0.04, 0.07, "#77c266", 6);
    }
  }
  function parapet(c, x, y) {
    var B = c.B, open = c.open;
    var any = false;
    for (var dy = -1; dy <= 1; dy++) for (var dx = -1; dx <= 1; dx++) if (open(x + dx, y + dy)) any = true;
    if (!any) return;
    var cx = x + 0.5, cz = y + 0.5;
    B.box(cx, 0, cz, 1, 0.55, 1, "#cfc8b6", 0);
    B.box(cx, 0.55, cz, 1.04, 0.07, 1.04, "#ebe5d6", 0.02);
    if ((x + y) % 3 === 0) B.box(cx, 0.62, cz, 0.06, 0.45, 0.06, "#9aa6ae", 0.02);   // 난간 기둥
  }
  function outdoorSurround(c) {
    var B = c.B, R = c.R, C = c.C;
    // 운동장 밖 넓은 잔디
    for (var z = -14; z < R + 12; z += 2) for (var x = -16; x < C + 16; x += 2) {
      var inside = x >= 0 && x + 2 <= C && z >= 0 && z + 2 <= R;
      if (inside) continue;
      B.floor(x + 1, -0.01, z + 1, 2, 2, shade(((x + z) / 2) % 2 ? "#86c962" : "#7dc05a", (rnd(x, z, 1) - 0.5) * 0.06));
    }
    // 둘레에 둥근 나무와 꽃
    for (var i = 0; i < 70; i++) {
      var side = i % 3;
      var tx, tz;
      if (side === 0) { tx = -1.5 - rnd(i, 1, 1) * 9; tz = -6 + rnd(i, 2, 1) * (R + 14) }
      else if (side === 1) { tx = C + 1.5 + rnd(i, 3, 1) * 9; tz = -6 + rnd(i, 4, 1) * (R + 14) }
      else { tx = -6 + rnd(i, 5, 1) * (C + 12); tz = R + 1.3 + rnd(i, 6, 1) * 6 }
      if (rnd(i, 7, 1) < 0.62) {
        B.push(tx, 0, tz, 0); roundTree(B, i, 17, 0.8 + rnd(i, 8, 1) * 0.4); B.pop();
      } else {
        flowerPatch(B, tx, tz, i);
      }
    }
    // 건물 뒤쪽 나무 줄
    for (i = 0; i < 12; i++) {
      B.push(2 + i * 1.8 + rnd(i, 9, 2) * 0.6, 0, -0.6 - rnd(i, 10, 2) * 1.2, 0);
      roundTree(B, i, 29, 1.1 + rnd(i, 11, 2) * 0.4);
      B.pop();
    }
  }
  // 복도처럼 아래쪽 벽이 창문이면, 창밖으로 화단과 나무가 보이게 합니다
  function windowGarden(c) {
    var B = c.B, R = c.R, C = c.C, last = -1, y, x;
    for (y = 0; y < R; y++) for (x = 0; x < C; x++) if (c.open(x, y)) last = y;
    if (last < 0 || last + 1 >= R - 1) return;
    var wy = last + 1, n = 0;
    for (x = 0; x < C; x++) if (c.ob(x, wy) === "window") n++;
    if (n < 3) return;
    var z0 = wy + 0.34;
    for (var z = z0; z < z0 + 16; z += 2) for (x = -8; x < C + 8; x += 2) {
      B.floor(x + 1, -0.25, z + 1, 2, 2, shade(((x + z) / 2) % 2 ? "#8fd06a" : "#86c962", (rnd(x, z, 13) - 0.5) * 0.06));
    }
    B.box(C / 2, -0.25, z0 + 0.3, C + 16, 0.12, 0.6, "#d9cfb8", 0);            // 건물 옆 보도블록
    for (var i = 0; i < 26; i++) {
      var tx = -4 + i * ((C + 8) / 26) + rnd(i, 1, 21) * 0.6, tz = z0 + 1.1 + rnd(i, 2, 21) * 1.8;
      B.push(tx, -0.25, tz, 0);
      if (rnd(i, 3, 21) < 0.55) roundTree(B, i, 41, 0.75 + rnd(i, 4, 21) * 0.35);
      else flowerPatch(B, 0, 0, i + 50);
      B.pop();
    }
  }
  function flowerPatch(B, x, z, s) {
    var col = pickc(["#ff8fa3", "#ffd23f", "#ffffff", "#c79bff", "#ff9a5a"], rnd(s, 1, 4));
    for (var k = 0; k < 5; k++) {
      var fx = x + (rnd(s, k, 5) - 0.5) * 0.9, fz = z + (rnd(s, k, 6) - 0.5) * 0.9;
      flower(B, fx, fz, col);
    }
  }
  // 동그란 꽃잎 5장짜리 꽃
  function flower(B, x, z, col, y0) {
    y0 = y0 || 0;
    B.box(x, y0, z, 0.025, 0.16, 0.025, "#5aa64a", 0.01);
    B.boxR(x + 0.04, y0 + 0.06, z, 0.07, 0.02, 0.04, "#6cbd58", 0.01, 0, 0, 0.4);
    for (var p = 0; p < 5; p++) {
      var a = p / 5 * Math.PI * 2;
      B.ball(x + Math.cos(a) * 0.055, y0 + 0.18, z + Math.sin(a) * 0.055, 0.045, 0.02, 0.045, col, 5);
    }
    B.ball(x, y0 + 0.19, z, 0.032, 0.022, 0.032, "#ffcf4a", 5);
  }
  function roundTree(B, x, y, sc) {
    sc = sc || 1;
    B.cyl(0, 0, 0, 0.09 * sc, 0.13 * sc, 0.75 * sc, "#9a6a43", 9);
    B.ball(0, 0.02, 0, 0.18 * sc, 0.05, 0.18 * sc, "#8a5c38", 7);
    var g1 = shade("#5fbb6c", (rnd(x, y, 1) - 0.5) * 0.1), g2 = shade("#72cb7b", (rnd(x, y, 2) - 0.5) * 0.1);
    B.ball(0, 1.12 * sc, 0, 0.56 * sc, 0.5 * sc, 0.56 * sc, g1, 9);
    B.ball(-0.28 * sc, 1.25 * sc, 0.16 * sc, 0.32 * sc, 0.3 * sc, 0.32 * sc, g2, 8);
    B.ball(0.3 * sc, 1.3 * sc, 0.08 * sc, 0.3 * sc, 0.28 * sc, 0.3 * sc, g2, 8);
    B.ball(0.02 * sc, 1.52 * sc, -0.04 * sc, 0.3 * sc, 0.26 * sc, 0.3 * sc, shade(g2, 0.08), 8);
    if (rnd(x, y, 3) < 0.45) {                              // 열매
      var fc = pickc(["#ff6b6b", "#ffb347", "#ff8fb1"], rnd(x, y, 4));
      for (var k = 0; k < 3; k++) {
        var a = rnd(x, y, 10 + k) * Math.PI * 2;
        B.ball(Math.cos(a) * 0.46 * sc, (1.0 + rnd(x, y, 20 + k) * 0.35) * sc, Math.sin(a) * 0.46 * sc + 0.08,
               0.07 * sc, 0.07 * sc, 0.07 * sc, fc, 6);
      }
    }
  }


  // ---------- 문 ('D' 글자) : 복도 벽의 문 · 교실 아래쪽 출구 ----------
  var DOOR_COL = { door: "#c98b52", doorvisited: "#e4b37b", doorclear: "#72c486" };
  function doorD(c, x, y, st) {
    var B = c.B, S = c.S, col = DOOR_COL[st] || DOOR_COL.door, wallish = c.wallish;
    var cx = x + 0.5, cz = y + 0.5;
    if (wallish(x, y - 1)) { B.push(cx, 0, cz, 0); wallDoor(c, col, st); B.pop(); return }
    if (wallish(x, y + 1)) {                                // 아래쪽(남쪽) 출구 : 발판과 화살표
      B.box(cx, 0, cz + 0.05, 0.86, 0.03, 0.86, shade(col, 0.25), 0.03);
      B.box(cx, 0.03, cz + 0.05, 0.74, 0.012, 0.74, col, 0.02);
      B.box(cx, 0.045, cz - 0.02, 0.12, 0.01, 0.34, "#fffaf0", 0.01);
      B.boxR(cx - 0.08, 0.05, cz + 0.2, 0.2, 0.01, 0.07, "#fffaf0", 0.01, 0, -0.8, 0);
      B.boxR(cx + 0.08, 0.05, cz + 0.2, 0.2, 0.01, 0.07, "#fffaf0", 0.01, 0, 0.8, 0);
      return;
    }
    if (wallish(x - 1, y)) { B.push(cx, 0, cz, Math.PI / 2); wallDoor(c, col, st); B.pop(); return }
    if (wallish(x + 1, y)) { B.push(cx, 0, cz, -Math.PI / 2); wallDoor(c, col, st); B.pop(); return }
    B.box(cx, 0, cz, 0.8, 0.03, 0.8, col, 0.03);
  }
  function wallDoor(c, col, st) {
    var B = c.B, S = c.S;
    B.box(0, 1.75, 0, 1, WALL_H - 1.75, 1, S.wall, 0);
    B.box(0, WALL_H, 0, 1, 0.05, 1, S.cap, 0);
    B.box(-0.45, 0, 0, 0.1, 1.75, 1, S.wains, 0);
    B.box(0.45, 0, 0, 0.1, 1.75, 1, S.wains, 0);
    B.box(0, 1.67, 0.08, 0.86, 0.1, 0.84, S.trim, 0.02);
    B.box(-0.41, 0, 0.08, 0.05, 1.7, 0.84, S.trim, 0.01);
    B.box(0.41, 0, 0.08, 0.05, 1.7, 0.84, S.trim, 0.01);
    B.box(0, 0.02, -0.34, 0.76, 1.64, 0.08, col, 0.03);          // 문짝
    B.box(0, 0.2, -0.29, 0.6, 0.5, 0.02, shade(col, -0.12), 0.02);
    B.glow(function () { B.box(0, 1.0, -0.29, 0.36, 0.44, 0.02, "#e2f5ff", 0.01) });
    B.box(0, 1.21, -0.28, 0.4, 0.04, 0.02, S.trim, 0);
    B.ball(0.27, 0.85, -0.27, 0.045, 0.045, 0.045, "#f2c14e");
    if (st === "doorclear") B.ball(0, 1.45, -0.28, 0.07, 0.07, 0.03, "#fff27a", 6);   // 다 푼 방 별표
    B.box(0, 1.86, 0.5, 0.66, 0.2, 0.04, "#fffaf0", 0.03);        // 문패
    B.box(0, 1.9, 0.52, 0.5, 0.05, 0.01, shade(col, -0.1), 0.01);
    B.box(0, 0, 0.3, 0.72, 0.02, 0.36, "#b26d4e", 0.02);           // 발판
  }

  // ================================================================
  //  6. 가구 (한 칸짜리)  — 기준점은 칸 가운데 바닥, 앞(+z)이 카메라 쪽
  // ================================================================
  var WOOD = "#e6bf8a", WOOD2 = "#c99a64", METAL = "#8e9aa6", DARK = "#4a4f5c";
  var BOOKS = ["#ef6f6c", "#f7b267", "#f4d35e", "#7bc8a4", "#5fa8d3", "#9b8ce0", "#f49cbb", "#88c057", "#e27d60"];
  // 앞이 뚫린 선반 틀 (옆판 · 윗판 · 받침 · 뒤판) — 안에 놓은 물건이 보입니다
  function hollow(B, w, h, d, zc, col, back) {
    var t = 0.06;
    B.box(-w / 2 + t / 2, 0, zc, t, h, d, col, 0.02);
    B.box(w / 2 - t / 2, 0, zc, t, h, d, col, 0.02);
    B.box(0, h - t, zc, w, t, d, col, 0.02);
    B.box(0, 0, zc, w, 0.06, d, col, 0.01);
    B.box(0, 0, zc - d / 2 + 0.03, w - 0.02, h, 0.05, back, 0.01);
  }
  var ONE = {
    desk: function (c, x, y) {
      var B = c.B;
      B.box(0, 0.44, 0.05, 0.8, 0.07, 0.54, WOOD, 0.03);
      B.box(0, 0.32, -0.02, 0.7, 0.12, 0.36, WOOD2, 0.02);
      for (var i = -1; i <= 1; i += 2) for (var k = -1; k <= 1; k += 2)
        B.box(i * 0.34, 0, 0.05 + k * 0.21, 0.045, 0.44, 0.045, METAL, 0.015);
      chair(B, 0, -0.42, 0, c.S.wains);
      var v = rnd(x, y, 1);
      if (v < 0.3) B.box(0.18, 0.51, 0.08, 0.2, 0.04, 0.26, pickc(BOOKS, rnd(x, y, 2)), 0.01);
      else if (v < 0.45) B.boxR(-0.15, 0.525, 0.1, 0.22, 0.03, 0.06, "#ffd166", 0.012, 0, 0.4, 0);
    },
    chair: function (c) { chair(c.B, 0, 0, Math.PI, c.S.wains) },
    computer: function (c, x, y) {
      var B = c.B;
      B.box(0, 0.44, 0, 0.86, 0.07, 0.6, "#eef1f4", 0.03);
      B.box(-0.38, 0, 0, 0.05, 0.44, 0.52, METAL, 0.015);
      B.box(0.38, 0, 0, 0.05, 0.44, 0.52, METAL, 0.015);
      B.box(0, 0.51, -0.14, 0.14, 0.04, 0.12, "#5c6370", 0.02);
      B.box(0, 0.54, -0.16, 0.05, 0.12, 0.04, "#5c6370", 0.01);
      B.box(0, 0.64, -0.17, 0.5, 0.34, 0.06, "#3d4350", 0.03);
      var sc = pickc(["#7fd6ff", "#9ff0c8", "#ffe08a", "#c8b6ff"], rnd(x, y, 3));
      B.glow(function () {
        B.box(0, 0.67, -0.135, 0.44, 0.27, 0.01, sc, 0);
        B.box(-0.06, 0.74, -0.128, 0.26, 0.03, 0.005, "#ffffff", 0);
        B.box(-0.1, 0.69, -0.128, 0.18, 0.03, 0.005, "#ffffff", 0);
      });
      B.box(0, 0.51, 0.1, 0.4, 0.025, 0.13, "#f7f8fa", 0.01);
      B.ball(0.3, 0.52, 0.1, 0.04, 0.02, 0.055, "#f7f8fa", 6);
      chair(B, 0, 0.44, Math.PI, "#7aa7d8");
    },
    chalkboard: function (c) { wallBoard(c.B, 1) },
    bookshelf: function (c, x, y) {
      var B = c.B;
      B.box(-0.44, 0, -0.05, 0.07, 1.42, 0.52, "#a87145", 0.02);    // 옆판
      B.box(0.44, 0, -0.05, 0.07, 1.42, 0.52, "#a87145", 0.02);
      B.box(0, 0, -0.28, 0.9, 1.42, 0.06, "#7a4e2e", 0.01);         // 뒤판
      B.box(0, 0, -0.05, 0.9, 0.08, 0.5, "#a87145", 0.01);          // 받침
      for (var s = 0; s < 3; s++) {
        var y0 = 0.1 + s * 0.43;
        B.box(0, y0 - 0.03, 0.03, 0.86, 0.04, 0.44, "#b98356", 0.01);
        var xx = -0.38;
        for (var k = 0; k < 9 && xx < 0.36; k++) {
          var w = 0.06 + rnd(x * 7 + k, y * 3 + s, 1) * 0.05;
          var h = 0.26 + rnd(x * 7 + k, y * 3 + s, 2) * 0.1;
          var col = pickc(BOOKS, rnd(x * 7 + k, y * 3 + s, 3));
          var tilt = (rnd(x * 7 + k, y * 3 + s, 4) < 0.12) ? 0.25 : 0;
          if (tilt) B.boxR(xx + w / 2 + 0.02, y0 + h / 2, 0.06, w, h, 0.3, col, 0, 0, 0, -tilt);
          else B.box(xx + w / 2, y0, 0.06, w, h, 0.3, col, 0);
          xx += w + 0.008;
        }
      }
      B.box(0, 1.42, -0.05, 0.98, 0.05, 0.56, "#b98356", 0.02);
    },
    tree: function (c, x, y) { roundTree(c.B, x, y, 1) },
    plant: function (c, x, y) {
      var B = c.B;
      B.cyl(0, 0, 0, 0.19, 0.14, 0.3, "#e28b5c", 14);
      B.cyl(0, 0.28, 0, 0.21, 0.21, 0.05, "#ef9c6c", 14);
      B.cyl(0, 0.3, 0, 0.17, 0.17, 0.02, "#6b4a33", 12);
      var g = shade("#63c070", (rnd(x, y, 1) - 0.5) * 0.12);
      B.ball(0, 0.56, 0, 0.26, 0.24, 0.26, g, 8);
      B.ball(-0.15, 0.7, 0.05, 0.16, 0.15, 0.16, shade(g, 0.1), 7);
      B.ball(0.14, 0.74, -0.03, 0.15, 0.14, 0.15, shade(g, 0.12), 7);
      B.ball(0.02, 0.86, 0.02, 0.13, 0.12, 0.13, shade(g, 0.16), 7);
    },
    extinguisher: function (c) {
      var B = c.B;
      B.box(0, 0, -0.28, 0.34, 0.04, 0.22, "#d9d2c3", 0.02);
      B.cyl(0, 0.04, -0.28, 0.11, 0.11, 0.46, "#e24b4b", 14);
      B.ball(0, 0.5, -0.28, 0.11, 0.07, 0.11, "#e24b4b", 8);
      B.cyl(0, 0.54, -0.28, 0.035, 0.035, 0.08, "#2f3440", 8);
      B.boxR(0.06, 0.62, -0.26, 0.12, 0.03, 0.04, "#2f3440", 0.01, 0, 0, -0.3);
      B.boxR(0.1, 0.35, -0.18, 0.03, 0.3, 0.03, "#2f3440", 0.01, 0.2, 0, 0.2);
      B.box(0, 0.2, -0.165, 0.12, 0.1, 0.01, "#fffaf0", 0.005);
    },
    musicstand: function (c) {
      var B = c.B;
      for (var i = 0; i < 3; i++) {
        var a = i / 3 * Math.PI * 2;
        B.boxR(Math.cos(a) * 0.14, 0.06, Math.sin(a) * 0.14, 0.3, 0.025, 0.025, DARK, 0.01, 0, -a, 0.35);
      }
      B.cyl(0, 0, 0, 0.018, 0.018, 0.9, DARK, 8);
      B.boxR(0, 0.98, 0.02, 0.5, 0.34, 0.02, DARK, 0.01, -0.45, 0, 0);
      B.boxR(-0.1, 1.0, 0.045, 0.2, 0.28, 0.005, "#fffdf5", 0, -0.45, 0, 0);
      B.boxR(0.12, 1.0, 0.045, 0.2, 0.28, 0.005, "#fffdf5", 0, -0.45, 0, 0);
      for (var l = 0; l < 4; l++) B.boxR(0, 1.08 - l * 0.055, 0.075 + l * 0.024, 0.38, 0.005, 0.002, "#6b5c7a", 0, -0.45, 0, 0);
    },
    easel: function (c, x, y) {
      var B = c.B;
      B.boxR(-0.2, 0.62, 0.06, 0.04, 1.26, 0.04, "#b98356", 0.015, 0.12, 0, 0.16);
      B.boxR(0.2, 0.62, 0.06, 0.04, 1.26, 0.04, "#b98356", 0.015, 0.12, 0, -0.16);
      B.boxR(0, 0.6, -0.2, 0.04, 1.2, 0.04, "#b98356", 0.015, -0.3, 0, 0);
      B.box(0, 0.5, 0.12, 0.56, 0.04, 0.08, "#b98356", 0.015);
      B.boxR(0, 0.84, 0.1, 0.56, 0.62, 0.03, "#fffdf8", 0.01, -0.12, 0, 0);
      B.boxR(-0.1, 0.9, 0.125, 0.22, 0.18, 0.005, "#8fd3f5", 0.005, -0.12, 0, 0);
      B.boxR(0.1, 0.78, 0.125, 0.18, 0.2, 0.005, "#7bc86c", 0.005, -0.12, 0, 0);
      B.boxR(0.12, 0.98, 0.127, 0.1, 0.1, 0.005, "#ffcf4a", 0.005, -0.12, 0, 0.7);
      B.boxR(-0.12, 0.72, 0.127, 0.14, 0.06, 0.005, "#ff8fa3", 0.005, -0.12, 0, 0);
    },
    artshelf: function (c, x, y) {
      var B = c.B;
      hollow(B, 0.92, 1.05, 0.46, -0.08, "#f1d2a8", "#c79a6e");
      for (var s = 0; s < 2; s++) {
        var y0 = 0.08 + s * 0.48;
        B.box(0, y0 - 0.02, -0.02, 0.84, 0.03, 0.38, "#f1d2a8", 0.01);
        for (var k = 0; k < 4; k++) {
          var jc = pickc(["#ff6b6b", "#ffd23f", "#4dabf7", "#69db7c", "#b197fc", "#ff922b"], rnd(x + k, y + s, 5));
          B.cyl(-0.3 + k * 0.2, y0, 0.02, 0.06, 0.06, 0.14, "#f5f7fa", 10);
          B.cyl(-0.3 + k * 0.2, y0 + 0.14, 0.02, 0.062, 0.062, 0.03, jc, 10);
        }
      }
      B.ball(-0.2, 1.13, -0.05, 0.12, 0.09, 0.12, "#d98b5f", 8);        // 찰흙 항아리
      B.cyl(-0.2, 1.18, -0.05, 0.06, 0.08, 0.06, "#d98b5f", 10);
      B.boxR(0.2, 1.12, -0.05, 0.22, 0.14, 0.03, "#fffdf8", 0.01, 0, 0, 0.1);
    },
    chemcabinet: function (c, x, y) {
      var B = c.B;
      hollow(B, 0.9, 1.5, 0.46, -0.08, "#d5e8ee", "#eef7fa");
      for (var s = 0; s < 3; s++) {
        var y0 = 0.1 + s * 0.44;
        B.box(0, y0 - 0.02, -0.06, 0.8, 0.02, 0.38, "#bcd3da", 0);
        for (var k = 0; k < 4; k++) {
          var lc = pickc(["#ff6b9d", "#ffd23f", "#4dd4ac", "#6aa9ff", "#c77dff"], rnd(x + k, y + s, 9));
          var px = -0.28 + k * 0.19;
          if ((k + s) % 2) {
            B.glow(function () { B.cyl(px, y0, -0.02, 0.055, 0.07, 0.12, lc, 10) });
            B.cyl(px, y0 + 0.12, -0.02, 0.02, 0.04, 0.12, "#e8f6fb", 8);
          } else {
            B.glow(function () { B.cyl(px, y0, -0.02, 0.05, 0.05, 0.2, lc, 10) });
            B.cyl(px, y0 + 0.2, -0.02, 0.052, 0.052, 0.04, "#5b6b76", 10);
          }
        }
      }
      B.glass(function () { B.box(0, 0.06, 0.16, 0.82, 1.36, 0.02, "#dff4ff", 0) });
      B.box(0, 0.06, 0.17, 0.03, 1.36, 0.03, "#b7ccd4", 0);
      B.box(-0.06, 0.7, 0.19, 0.03, 0.14, 0.03, "#8a9aa3", 0.01);
      B.box(0.06, 0.7, 0.19, 0.03, 0.14, 0.03, "#8a9aa3", 0.01);
    },
    readingdesk: function (c) {
      var B = c.B;
      B.box(0, 0.44, 0, 0.88, 0.07, 0.62, "#c9955f", 0.03);
      for (var i = -1; i <= 1; i += 2) for (var k = -1; k <= 1; k += 2)
        B.box(i * 0.36, 0, k * 0.24, 0.06, 0.44, 0.06, "#a8784a", 0.02);
      B.boxR(-0.08, 0.525, 0.05, 0.22, 0.015, 0.3, "#fffdf5", 0.005, 0, 0.1, 0.12);   // 펼친 책
      B.boxR(0.13, 0.525, 0.07, 0.22, 0.015, 0.3, "#fffdf5", 0.005, 0, 0.1, -0.12);
      B.box(0.03, 0.51, 0.06, 0.46, 0.012, 0.32, "#d9534f", 0.004);
      B.cyl(-0.3, 0.51, -0.18, 0.07, 0.08, 0.03, "#3f7f5a", 12);                  // 스탠드
      B.boxR(-0.3, 0.68, -0.18, 0.025, 0.34, 0.025, "#c9a227", 0.01, 0, 0, 0.12);
      B.cyl(-0.26, 0.82, -0.14, 0.05, 0.13, 0.12, "#3f9a64", 14);
      B.glow(function () { B.ball(-0.26, 0.82, -0.14, 0.05, 0.03, 0.05, "#fff4b0", 6) });
      chair(B, 0, -0.46, 0, "#a8784a");
    },
    servercab: function (c, x, y) {
      var B = c.B;
      B.box(0, 0, -0.06, 0.82, 1.6, 0.6, "#3c4350", 0.03);
      B.box(0, 0.08, 0.24, 0.72, 1.44, 0.02, "#2c323c", 0.01);
      B.glow(function () {
        for (var r2 = 0; r2 < 8; r2++) {
          B.box(-0.18, 0.2 + r2 * 0.17, 0.26, 0.28, 0.04, 0.01, "#4b5566", 0);
          for (var k = 0; k < 3; k++) {
            var lc = pickc(["#6bff9e", "#6bd0ff", "#6bff9e", "#ffd66b"], rnd(x + k, y + r2, 2));
            B.box(0.14 + k * 0.07, 0.21 + r2 * 0.17, 0.265, 0.035, 0.035, 0.01, lc, 0);
          }
        }
      });
    },
    gearbox: function (c, x, y) {
      var B = c.B;
      B.box(0, 0, -0.06, 0.8, 0.9, 0.56, "#a9b5bf", 0.04);
      B.box(0, 0.1, 0.22, 0.68, 0.7, 0.02, "#8d99a4", 0.02);
      for (var k = 0; k < 3; k++) {
        B.cylR(-0.2 + k * 0.2, 0.6, 0.25, 0.07, 0.07, 0.04, "#fffaf0", 14, Math.PI / 2, 0, 0);
        B.boxR(-0.2 + k * 0.2, 0.62, 0.275, 0.012, 0.06, 0.01, "#e24b4b", 0, 0, 0, 0.5 - k * 0.4);
      }
      B.glow(function () {
        B.box(-0.2, 0.3, 0.24, 0.06, 0.06, 0.02, "#ff5d5d", 0);
        B.box(-0.08, 0.3, 0.24, 0.06, 0.06, 0.02, "#6bff9e", 0);
      });
      for (k = 0; k < 4; k++) B.box(0.14, 0.24 + k * 0.05, 0.24, 0.24, 0.02, 0.02, "#6d7984", 0.005);
    },
    watertank: function (c) {
      var B = c.B;
      for (var i = -1; i <= 1; i += 2) for (var k = -1; k <= 1; k += 2) B.box(i * 0.28, 0, k * 0.28, 0.06, 0.32, 0.06, "#8a959e", 0.02);
      B.box(0, 0.3, 0, 0.8, 0.05, 0.8, "#8a959e", 0.02);
      B.cyl(0, 0.35, 0, 0.44, 0.44, 0.78, "#a9d6e6", 18);
      B.ball(0, 1.13, 0, 0.44, 0.14, 0.44, "#a9d6e6", 10);
      B.cyl(0, 0.52, 0, 0.45, 0.45, 0.05, "#7fb3c7", 18);
      B.cyl(0, 0.9, 0, 0.45, 0.45, 0.05, "#7fb3c7", 18);
      B.cyl(0, 1.24, 0, 0.08, 0.08, 0.06, "#7fb3c7", 10);
    },
    vent: function (c) {
      var B = c.B;
      B.box(0, 0, 0, 0.82, 0.48, 0.82, "#b9c2c9", 0.05);
      B.cyl(0, 0.48, 0, 0.3, 0.3, 0.04, "#6d7780", 16);
      for (var k = 0; k < 4; k++) B.boxR(0, 0.53, 0, 0.56, 0.015, 0.06, "#4f5860", 0.005, 0, k * Math.PI / 4, 0);
      for (k = 0; k < 4; k++) B.box(0, 0.08 + k * 0.08, 0.41, 0.6, 0.025, 0.02, "#9aa4ac", 0.005);
    },
    solar: function (c) {
      var B = c.B;
      B.box(0, 0, 0.1, 0.06, 0.34, 0.06, METAL, 0.02);
      B.box(0, 0, -0.18, 0.06, 0.58, 0.06, METAL, 0.02);
      B.boxR(0, 0.5, -0.04, 0.9, 0.04, 0.6, "#dfe6ee", 0.015, 0.55, 0, 0);
      B.boxR(0, 0.52, -0.035, 0.84, 0.02, 0.54, "#3b5c9a", 0.005, 0.55, 0, 0);
      for (var k = -1; k <= 1; k++) B.boxR(k * 0.28, 0.535, -0.035, 0.012, 0.012, 0.54, "#a9c1e8", 0, 0.55, 0, 0);
      B.boxR(0, 0.535, -0.035, 0.84, 0.012, 0.012, "#a9c1e8", 0, 0.55, 0, 0);
    },
    bench: function (c) {
      var B = c.B;
      for (var i = -1; i <= 1; i += 2) {
        B.box(i * 0.36, 0, 0.05, 0.06, 0.3, 0.3, "#556270", 0.02);
        B.box(i * 0.36, 0.3, -0.12, 0.06, 0.34, 0.05, "#556270", 0.02);
      }
      for (var k = 0; k < 3; k++) B.box(0, 0.3, -0.06 + k * 0.1, 0.9, 0.04, 0.085, "#c98b55", 0.015);
      for (k = 0; k < 2; k++) B.box(0, 0.44 + k * 0.12, -0.13, 0.9, 0.08, 0.035, "#c98b55", 0.015);
    },
    flowerbed: function (c, x, y) {
      var B = c.B;
      B.box(0, 0, 0, 0.94, 0.3, 0.94, "#c9845a", 0.05);
      B.box(0, 0.28, 0, 0.98, 0.05, 0.98, "#d99a6e", 0.03);
      B.box(0, 0.25, 0, 0.84, 0.06, 0.84, "#6b4a33", 0.02);
      var cols = ["#ff8fa3", "#ffd23f", "#ffffff", "#c79bff", "#ff9a5a", "#ff6b6b"];
      for (var k = 0; k < 7; k++) {
        var fx = (rnd(x, y, k * 2) - 0.5) * 0.66, fz = (rnd(x, y, k * 2 + 1) - 0.5) * 0.66;
        flower(B, fx, fz, pickc(cols, rnd(x + k, y, 3)), 0.3);
      }
    },
    antenna: function (c) {
      var B = c.B;
      B.box(0, 0, 0, 0.5, 0.08, 0.5, "#9aa4ac", 0.02);
      B.cyl(0, 0.08, 0, 0.035, 0.045, 1.5, "#b8c1c8", 8);
      for (var k = 0; k < 3; k++) B.box(0, 0.7 + k * 0.28, 0, 0.44 - k * 0.1, 0.025, 0.025, "#b8c1c8", 0.01);
      B.cylR(0.12, 1.2, 0.1, 0.2, 0.05, 0.1, "#eef2f5", 16, 0.9, 0.5, 0);
      B.glow(function () { B.ball(0, 1.62, 0, 0.045, 0.045, 0.045, "#ff5d5d", 6) });
    },
    telescope: function (c) {
      var B = c.B;
      for (var i = 0; i < 3; i++) {
        var a = i / 3 * Math.PI * 2 + 0.4;
        B.boxR(Math.cos(a) * 0.14, 0.34, Math.sin(a) * 0.14, 0.03, 0.72, 0.03, "#6d5b4a", 0.01, Math.sin(a) * 0.3, 0, -Math.cos(a) * 0.3);
      }
      B.ball(0, 0.72, 0, 0.06, 0.06, 0.06, "#4a3e33", 6);
      B.cylR(0, 0.86, -0.05, 0.07, 0.09, 0.62, "#f3f5f8", 14, -1.0, 0, 0);
      B.cylR(0, 1.1, -0.22, 0.1, 0.1, 0.06, "#4d7cc7", 14, -1.0, 0, 0);
      B.cylR(0, 0.7, 0.07, 0.04, 0.04, 0.08, "#4a3e33", 8, -1.0, 0, 0);
    },
    weatherbox: function (c) {
      var B = c.B;
      for (var i = -1; i <= 1; i += 2) for (var k = -1; k <= 1; k += 2) B.box(i * 0.24, 0, k * 0.2, 0.05, 0.62, 0.05, "#f3f3ee", 0.015);
      B.box(0, 0.6, 0, 0.62, 0.5, 0.52, "#fbfbf6", 0.03);
      B.boxR(0, 1.16, 0, 0.72, 0.07, 0.62, "#fbfbf6", 0.02, 0, 0, 0);
      for (k = 0; k < 5; k++) B.box(0, 0.66 + k * 0.085, 0.265, 0.56, 0.035, 0.02, "#dcdcd3", 0.005);
    },
    signboard: function (c) {
      var B = c.B;
      B.box(0, 0, 0, 0.08, 1.05, 0.08, "#9a6a43", 0.02);
      B.box(0, 0.62, 0.05, 0.72, 0.36, 0.05, "#e6bf8a", 0.03);
      B.box(0, 0.62, 0.075, 0.64, 0.28, 0.01, "#fff4dc", 0.02);
      B.box(-0.1, 0.78, 0.085, 0.28, 0.035, 0.005, "#7a5236", 0);
      B.box(-0.04, 0.72, 0.085, 0.4, 0.03, 0.005, "#7a5236", 0);
      B.boxR(0.2, 0.7, 0.085, 0.12, 0.12, 0.005, "#5fbb6c", 0, 0, 0, 0.785);
    },
    fountain: function (c) {
      var B = c.B;
      B.cyl(0, 0, 0, 0.48, 0.5, 0.26, "#d9d3c6", 20);
      B.cyl(0, 0.24, 0, 0.5, 0.5, 0.05, "#ebe6db", 20);
      B.glow(function () { B.cyl(0, 0.2, 0, 0.42, 0.42, 0.05, "#8fd8f5", 20) });
      B.cyl(0, 0.2, 0, 0.07, 0.09, 0.4, "#d9d3c6", 10);
      B.cyl(0, 0.58, 0, 0.2, 0.12, 0.08, "#ebe6db", 16);
      B.glow(function () {
        B.cyl(0, 0.62, 0, 0.17, 0.17, 0.04, "#a6e3fa", 16);
        B.ball(0, 0.74, 0, 0.05, 0.1, 0.05, "#c9efff", 6);
      });
    },
    statue: function (c) {
      var B = c.B;
      B.box(0, 0, 0, 0.62, 0.42, 0.62, "#d8d2c4", 0.04);
      B.box(0, 0.42, 0, 0.5, 0.06, 0.5, "#e8e3d7", 0.03);
      B.box(0, 0.18, 0.31, 0.34, 0.12, 0.01, "#c9a227", 0.01);
      B.cyl(0, 0.48, 0, 0.05, 0.12, 0.1, "#c7c9cc", 10);
      B.ball(0, 0.86, 0, 0.3, 0.3, 0.3, "#8fc8e8", 12);                // 지구본 조각상
      B.ball(-0.1, 0.94, 0.2, 0.12, 0.1, 0.1, "#7bc86c", 7);
      B.ball(0.14, 0.78, 0.2, 0.1, 0.12, 0.08, "#7bc86c", 7);
      B.ring(0, 0.86, 0, 0.36, 0.025, "#c9a227", 0.35, 0, 0.35);
    },
    lamp: function (c) {
      var B = c.B;
      B.cyl(0, 0, 0, 0.14, 0.18, 0.1, "#4d5a66", 12);
      B.cyl(0, 0.1, 0, 0.045, 0.05, 1.45, "#4d5a66", 10);
      B.cyl(0, 1.52, 0, 0.16, 0.08, 0.08, "#4d5a66", 12);
      B.glow(function () { B.ball(0, 1.7, 0, 0.16, 0.16, 0.16, "#fff3b0", 10) });
      B.cyl(0, 1.84, 0, 0.05, 0.18, 0.08, "#4d5a66", 12);
    },
    officedesk: function (c, x, y) {
      var B = c.B;
      B.box(0, 0.44, 0, 0.94, 0.07, 0.64, "#d8b27c", 0.03);
      B.box(-0.3, 0, 0, 0.3, 0.44, 0.58, "#c39a64", 0.02);
      B.box(0.42, 0, 0, 0.05, 0.44, 0.58, "#c39a64", 0.015);
      for (var k = 0; k < 3; k++) B.box(-0.3, 0.06 + k * 0.13, 0.3, 0.24, 0.1, 0.01, "#b08652", 0.01);
      B.box(0.15, 0.51, -0.16, 0.12, 0.03, 0.1, "#5c6370", 0.01);
      B.box(0.15, 0.6, -0.18, 0.44, 0.28, 0.05, "#3d4350", 0.03);
      B.glow(function () { B.box(0.15, 0.62, -0.15, 0.38, 0.22, 0.01, "#c9ecff", 0) });
      B.box(-0.2, 0.51, 0.08, 0.26, 0.03, 0.3, "#fffdf5", 0.005);
      B.box(-0.18, 0.54, 0.06, 0.26, 0.03, 0.3, "#fff1c9", 0.005);
      B.cyl(0.36, 0.51, 0.16, 0.04, 0.035, 0.09, pickc(["#ff8fa3", "#6aa9ff", "#ffd23f"], rnd(x, y, 5)), 10);
      chair(B, 0, -0.46, 0, "#6f8fbf");
    },
    filecabinet: function (c) {
      var B = c.B;
      B.box(0, 0, -0.1, 0.72, 1.22, 0.5, "#b8c2cc", 0.03);
      for (var k = 0; k < 3; k++) {
        B.box(0, 0.08 + k * 0.38, 0.16, 0.64, 0.33, 0.02, "#c9d2da", 0.02);
        B.box(0, 0.3 + k * 0.38, 0.18, 0.2, 0.04, 0.03, "#7c8894", 0.01);
        B.box(0, 0.18 + k * 0.38, 0.172, 0.16, 0.06, 0.005, "#fffaf0", 0);
      }
    },
    printer: function (c) {
      var B = c.B;
      B.box(0, 0, -0.05, 0.82, 0.8, 0.6, "#e4e8ec", 0.04);
      B.box(0, 0.8, -0.05, 0.84, 0.08, 0.62, "#8d99a4", 0.03);
      B.box(0, 0.1, 0.26, 0.7, 0.26, 0.02, "#cfd5db", 0.02);
      B.box(0, 0.42, 0.26, 0.7, 0.2, 0.02, "#cfd5db", 0.02);
      B.box(0.3, 0.55, 0.3, 0.18, 0.02, 0.2, "#fffdf5", 0.005);
      B.glow(function () {
        B.box(-0.22, 0.87, 0.14, 0.2, 0.02, 0.1, "#9ff0c8", 0);
        B.box(0.1, 0.87, 0.14, 0.04, 0.02, 0.04, "#ff7a7a", 0);
      });
    },
    watercooler: function (c) {
      var B = c.B;
      B.box(0, 0, -0.1, 0.46, 0.9, 0.44, "#f5f7fa", 0.04);
      B.box(0, 0.5, 0.13, 0.3, 0.16, 0.04, "#d7dde3", 0.02);
      B.box(-0.07, 0.56, 0.16, 0.05, 0.06, 0.05, "#4dabf7", 0.01);
      B.box(0.07, 0.56, 0.16, 0.05, 0.06, 0.05, "#ff6b6b", 0.01);
      B.cyl(0, 0.9, -0.1, 0.06, 0.06, 0.08, "#dfe6ec", 10);
      B.glass(function () {
        B.cyl(0, 0.98, -0.1, 0.17, 0.17, 0.4, "#6fc3ff", 16);
        B.ball(0, 1.38, -0.1, 0.17, 0.08, 0.17, "#6fc3ff", 8);
      });
    },
    clock: function (c) {                              // 방 안에 서 있는 괘종시계
      var B = c.B;
      B.box(0, 0, -0.12, 0.46, 1.6, 0.34, "#a8693f", 0.04);
      B.box(0, 1.6, -0.12, 0.52, 0.08, 0.38, "#8a5432", 0.03);
      B.cylR(0, 1.32, 0.06, 0.17, 0.17, 0.03, "#fffdf5", 20, Math.PI / 2, 0, 0);
      B.boxR(0, 1.36, 0.08, 0.02, 0.1, 0.01, "#3b2f2a", 0, 0, 0, 0);
      B.boxR(0.03, 1.32, 0.08, 0.08, 0.02, 0.01, "#3b2f2a", 0, 0, 0, 0.4);
      B.glass(function () { B.box(0, 0.25, 0.05, 0.3, 0.72, 0.02, "#ffe9b0", 0) });
      B.cyl(0, 0.3, 0.02, 0.07, 0.07, 0.02, "#e6b84a", 12);
      B.box(0, 0.37, 0.02, 0.02, 0.5, 0.02, "#e6b84a", 0);
    },
    // ================= 🇨🇳 6과 你去哪儿? — 장소 · 교통 물건 =================
    stall: function (c, x, y) {                        // 화장실 칸
      var B = c.B, col = c.S.locker;
      B.box(0, 0, -0.2, 0.34, 0.36, 0.4, "#ffffff", 0.08);          // 변기
      B.box(0, 0.36, -0.36, 0.36, 0.3, 0.12, "#f4f7f9", 0.04);
      B.box(-0.46, 0.05, 0, 0.05, 1.45, 0.9, "#e8eef2", 0.01);
      B.box(0.46, 0.05, 0, 0.05, 1.45, 0.9, "#e8eef2", 0.01);
      B.box(0, 0.05, -0.43, 0.92, 1.45, 0.04, "#dfe6ea", 0.01);
      B.box(0, 0.12, 0.43, 0.84, 1.36, 0.05, col, 0.02);           // 문
      B.box(0.3, 0.72, 0.47, 0.05, 0.12, 0.03, "#8e9aa6", 0.01);
      B.glow(function () { B.box(-0.22, 1.25, 0.462, 0.16, 0.07, 0.01, rnd(x, y, 3) < 0.5 ? "#4dd47a" : "#ff6b6b", 0) });
    },
    sink: function (c) {                               // 세면대 + 거울
      var B = c.B;
      B.box(0, 0, -0.15, 0.7, 0.76, 0.5, "#f4f7f9", 0.04);
      B.box(0, 0.76, -0.15, 0.78, 0.06, 0.56, "#dfe7ec", 0.02);
      B.cyl(0, 0.8, -0.12, 0.2, 0.15, 0.04, "#bfe3f5", 14);
      B.cyl(0, 0.82, -0.36, 0.025, 0.025, 0.2, "#b8c1c8", 8);
      B.boxR(0, 1.0, -0.29, 0.03, 0.03, 0.14, "#b8c1c8", 0.01, 0, 0, 0);
      B.box(0, 1.12, -0.42, 0.6, 0.72, 0.03, "#9aa6b0", 0.02);
      B.glow(function () { B.box(0, 1.16, -0.4, 0.53, 0.64, 0.01, "#e3f6ff", 0) });
      B.ball(0.26, 0.86, -0.02, 0.05, 0.035, 0.04, "#ff9fcf", 6);
    },
    safe: function (c) {                               // 은행 금고
      var B = c.B;
      B.box(0, 0, 0, 0.8, 1.05, 0.7, "#5d6875", 0.05);
      B.box(0, 0.08, 0.35, 0.68, 0.88, 0.02, "#74828f", 0.02);
      B.cylR(0.06, 0.52, 0.37, 0.13, 0.13, 0.04, "#f2c14e", 16, Math.PI / 2, 0, 0);
      for (var k = 0; k < 3; k++) B.boxR(0.06, 0.52, 0.4, 0.34, 0.03, 0.02, "#c9a227", 0.005, 0, 0, k * Math.PI / 3);
      B.box(-0.24, 0.42, 0.37, 0.05, 0.22, 0.04, "#c9ced4", 0.01);
      B.box(0, 1.05, 0, 0.84, 0.05, 0.74, "#46505b", 0.02);
    },
    atm: function (c) { atmBox(c.B, "#2f6fb3", "#ffcf4a") },          // 현금인출기
    kiosk: function (c) { atmBox(c.B, "#f2a23a", "#4dd47a") },        // 자전거 대여 키오스크
    ticketmachine: function (c) { atmBox(c.B, "#e8eef2", "#2f6fb3") },// 지하철 표 자판기
    hbed: function (c) {                               // 병원 침대
      var B = c.B;
      for (var i = -1; i <= 1; i += 2) for (var k = -1; k <= 1; k += 2) {
        B.cyl(i * 0.27, 0.05, k * 0.4, 0.025, 0.025, 0.36, METAL, 6);
        B.ball(i * 0.27, 0.05, k * 0.4, 0.05, 0.05, 0.05, DARK, 6);
      }
      B.box(0, 0.38, 0, 0.62, 0.08, 0.92, "#c7d3dc", 0.03);
      B.box(0, 0.46, 0, 0.58, 0.1, 0.88, "#ffffff", 0.04);
      B.box(0, 0.56, -0.3, 0.42, 0.08, 0.2, "#eaf6ff", 0.04);
      B.box(0, 0.55, 0.12, 0.62, 0.06, 0.58, "#9fd0ee", 0.03);
      B.box(0, 0.38, -0.46, 0.64, 0.6, 0.04, "#c7d3dc", 0.02);
      B.box(0, 0.38, 0.46, 0.64, 0.36, 0.04, "#c7d3dc", 0.02);
      B.cyl(0.36, 0, -0.32, 0.02, 0.02, 1.5, "#b8c1c8", 6);          // 링거 걸이
      B.box(0.36, 1.32, -0.32, 0.1, 0.16, 0.05, "#dff4ff", 0.03);
    },
    redcross: function (c) {                           // 적십자 팻말
      var B = c.B;
      B.cyl(0, 0, 0, 0.25, 0.28, 0.06, "#8e9aa6", 14);
      B.cyl(0, 0.06, 0, 0.035, 0.035, 1.25, "#b8c1c8", 8);
      B.box(0, 1.3, 0, 0.62, 0.62, 0.1, "#ffffff", 0.04);
      B.glow(function () {
        B.box(0, 1.42, 0.055, 0.15, 0.38, 0.02, "#e8323c", 0);
        B.box(0, 1.54, 0.055, 0.38, 0.14, 0.02, "#e8323c", 0);
      });
    },
    fruitstall: function (c, x, y) {                   // 과일 가판대
      var B = c.B;
      B.box(0, 0, 0, 0.92, 0.6, 0.72, "#c99a64", 0.04);
      B.box(0, 0.6, 0, 0.96, 0.05, 0.78, "#e6bf8a", 0.02);
      var F = [["#3f9b4a", 0.12, 2], ["#ff8a2a", 0.075, 3], ["#e8323c", 0.05, 4], ["#ffd23f", 0.07, 3], ["#f7a1b5", 0.075, 3], ["#8e44ad", 0.05, 4]];
      for (var k = 0; k < 2; k++) {
        var cx = k ? 0.22 : -0.22, f = F[Math.floor(rnd(x + k, y, 3) * F.length) % F.length];
        B.box(cx, 0.65, 0.05, 0.4, 0.1, 0.6, "#a8743f", 0.02);
        for (var a = 0; a < f[2]; a++) for (var b = 0; b < f[2] + 1; b++) {
          var px = cx - 0.15 + (a + 0.5) * (0.3 / f[2]), pz = -0.2 + (b + 0.5) * (0.5 / (f[2] + 1));
          B.ball(px, 0.75 + f[1] * 0.8, pz + 0.05, f[1], f[1] * 0.92, f[1], f[0], 7);
          if (f[1] > 0.1) B.box(px, 0.75 + f[1] * 1.5, pz + 0.05, 0.01, 0.01, f[1] * 1.6, "#1f5f2a", 0);
        }
      }
      for (var s = -1; s <= 1; s += 2) B.cyl(s * 0.44, 0.65, -0.34, 0.02, 0.02, 0.95, "#8a5c38", 6);
      for (var i = 0; i < 5; i++) B.boxR(-0.4 + i * 0.2, 1.62, -0.06, 0.2, 0.03, 0.66, i % 2 ? "#ffffff" : "#e8443a", 0.005, -0.3, 0, 0);
    },
    tanghulu: function (c) {                           // 탕후루 수레
      var B = c.B;
      B.box(0, 0.18, 0, 0.84, 0.52, 0.56, "#d9534f", 0.04);
      B.box(0, 0.7, 0, 0.9, 0.04, 0.6, "#f2c14e", 0.02);
      for (var s = -1; s <= 1; s += 2) {
        B.cylR(s * 0.44, 0.17, 0.05, 0.17, 0.17, 0.05, DARK, 14, 0, 0, Math.PI / 2);
        B.cylR(s * 0.47, 0.17, 0.05, 0.06, 0.06, 0.02, "#f2c14e", 10, 0, 0, Math.PI / 2);
      }
      B.cyl(0, 0.74, -0.1, 0.03, 0.03, 0.75, "#c99a64", 8);
      B.ball(0, 1.58, -0.1, 0.14, 0.2, 0.14, "#e6c27a", 10);
      for (var k = 0; k < 8; k++) {
        var a = k / 8 * Math.PI * 2, px = Math.cos(a) * 0.11, pz = -0.1 + Math.sin(a) * 0.11;
        B.cyl(px, 1.5, pz, 0.006, 0.006, 0.42, "#f3e2b8", 4);
        for (var b = 0; b < 4; b++) B.ball(px * 1.15, 1.76 + b * 0.085, pz + (pz + 0.1) * 0.15, 0.042, 0.04, 0.042, b % 2 ? "#ff3b4f" : "#e8203a", 7);
      }
      B.glass(function () { B.box(0, 0.74, 0.12, 0.7, 0.3, 0.28, "#dff4ff", 0.02) });
      for (var j = 0; j < 4; j++) B.boxR(-0.24 + j * 0.16, 0.8, 0.12, 0.02, 0.02, 0.22, "#ff3b4f", 0.005, 0, 0.3, 0);
    },
    busstop: function (c) {                            // 버스 정류장 표지판
      var B = c.B;
      B.cyl(0, 0, 0, 0.18, 0.2, 0.06, "#8e9aa6", 12);
      B.cyl(0, 0.06, 0, 0.04, 0.04, 1.85, "#8e9aa6", 8);
      B.cylR(0, 1.85, 0.03, 0.24, 0.24, 0.04, "#ffffff", 20, Math.PI / 2, 0, 0);
      B.cylR(0, 1.85, 0.05, 0.2, 0.2, 0.02, "#2f9e5a", 20, Math.PI / 2, 0, 0);
      B.glow(function () {
        B.box(0, 1.78, 0.07, 0.22, 0.12, 0.01, "#ffffff", 0.02);
        B.box(0, 1.8, 0.075, 0.18, 0.05, 0.01, "#9fe0ff", 0);
      });
      B.box(0, 0.75, 0.05, 0.4, 0.66, 0.04, "#ffffff", 0.02);
      for (var k = 0; k < 6; k++) B.box(-0.04, 0.87 + k * 0.08, 0.075, 0.28, 0.02, 0.005, k % 3 ? "#9aa6b0" : "#2f9e5a", 0);
    },
    trafficlight: function (c) {                       // 신호등
      var B = c.B;
      B.cyl(0, 0, 0, 0.2, 0.22, 0.06, "#5f6f80", 12);
      B.cyl(0, 0.06, 0, 0.045, 0.05, 1.42, "#5f6f80", 8);
      B.box(0, 1.45, 0, 0.28, 0.74, 0.24, "#2f3540", 0.05);
      var L = [["#ff4d4d", 2.0], ["#ffc93c", 1.82], ["#4dff8a", 1.64]];
      B.glow(function () { L.forEach(function (l) { B.ball(0, l[1], 0.12, 0.08, 0.08, 0.04, l[0], 10) }) });
      L.forEach(function (l) { B.boxR(0, l[1] + 0.09, 0.15, 0.2, 0.025, 0.08, "#2f3540", 0.005, 0.3, 0, 0) });
    },
    roundtable: function (c, x, y) {                   // 중국 식당 원탁
      var B = c.B;
      B.cyl(0, 0, 0, 0.25, 0.3, 0.05, "#7a4a2b", 14);
      B.cyl(0, 0.05, 0, 0.06, 0.06, 0.6, "#7a4a2b", 10);
      B.cyl(0, 0.6, 0, 0.47, 0.47, 0.08, "#e8443a", 22);
      B.cyl(0, 0.68, 0, 0.44, 0.44, 0.02, "#fff6ea", 22);
      B.cyl(0, 0.7, 0, 0.2, 0.2, 0.025, "#e6bf8a", 18);
      var food = ["#e8823a", "#7bc86c", "#f2c14e", "#c0392b", "#fff2d0"];
      for (var k = 0; k < 4; k++) {
        var a = k / 4 * Math.PI * 2 + 0.4, px = Math.cos(a) * 0.3, pz = Math.sin(a) * 0.3;
        B.cyl(px, 0.7, pz, 0.08, 0.06, 0.02, "#ffffff", 12);
        B.ball(px, 0.73, pz, 0.055, 0.03, 0.055, pickc(food, rnd(x + k, y, 5)), 7);
      }
      B.ball(0, 0.76, 0, 0.09, 0.06, 0.09, "#c0392b", 8);
      for (var s = 0; s < 4; s++) {
        var b = s / 4 * Math.PI * 2 + Math.PI / 4;
        B.cyl(Math.cos(b) * 0.68, 0, Math.sin(b) * 0.68, 0.14, 0.14, 0.42, "#c0392b", 12);
        B.cyl(Math.cos(b) * 0.68, 0.42, Math.sin(b) * 0.68, 0.15, 0.15, 0.03, "#f2c14e", 12);
      }
    },
    lantern: function (c) {                            // 빨간 등롱
      var B = c.B;
      B.cyl(0, 0, 0, 0.2, 0.24, 0.06, "#5a3d2b", 12);
      B.cyl(0, 0.06, 0, 0.03, 0.03, 1.55, "#5a3d2b", 8);
      B.box(0.14, 1.58, 0, 0.34, 0.035, 0.035, "#5a3d2b", 0.01);
      B.cyl(0.28, 1.28, 0, 0.006, 0.006, 0.3, "#3b2f2a", 4);
      B.glow(function () { B.ball(0.28, 1.08, 0, 0.21, 0.18, 0.21, "#ff3b30", 12) });
      B.cyl(0.28, 1.24, 0, 0.09, 0.09, 0.04, "#f2c14e", 12);
      B.cyl(0.28, 0.88, 0, 0.09, 0.09, 0.04, "#f2c14e", 12);
      B.cyl(0.28, 0.72, 0, 0.012, 0.03, 0.16, "#f2c14e", 6);
    },
    bunk2: function (c) { bunk(c.B, [0.32, 1.18], "#a8693f", "#ffffff", "#e8a0b4") },   // 软卧 2층 침대
    bunk3: function (c) { bunk(c.B, [0.22, 0.8, 1.38], METAL, "#dfe6ec", "#4f6db0") },   // 硬卧 3층 침대
    infoscreen: function (c) {                         // 출발 안내 전광판
      var B = c.B;
      for (var s = -1; s <= 1; s += 2) B.cyl(s * 0.36, 0, 0, 0.035, 0.035, 0.9, "#8e9aa6", 8);
      B.box(0, 0.85, 0, 0.96, 0.78, 0.12, "#2a2f3a", 0.04);
      B.glow(function () {
        B.box(0, 0.9, 0.065, 0.88, 0.68, 0.01, "#0d2a4a", 0);
        for (var k = 0; k < 5; k++) {
          B.box(-0.22, 1.46 - k * 0.12, 0.072, 0.34, 0.05, 0.005, k ? "#ffd23f" : "#9fe0ff", 0);
          B.box(0.25, 1.46 - k * 0.12, 0.072, 0.22, 0.05, 0.005, k === 2 ? "#ff6b6b" : "#4dff8a", 0);
        }
      });
    },
    stopsign: function (c) {                           // 정지 · 停
      var B = c.B;
      signPole(B);
      B.cylR(0, 1.45, 0.02, 0.33, 0.33, 0.03, "#ffffff", 8, Math.PI / 2, Math.PI / 8, 0);
      B.cylR(0, 1.45, 0.04, 0.29, 0.29, 0.03, "#e03b3b", 8, Math.PI / 2, Math.PI / 8, 0);
    },
    yieldsign: function (c) {                          // 양보 · 让 (거꾸로 된 삼각형)
      var B = c.B;
      signPole(B);
      B.cylR(0, 1.5, 0.02, 0.4, 0.4, 0.03, "#e03b3b", 3, Math.PI / 2, 0, 0);
      B.cylR(0, 1.53, 0.04, 0.25, 0.25, 0.03, "#ffffff", 3, Math.PI / 2, 0, 0);
    },
    childcn: function (c) {                            // 중국 어린이 주의 (노란 삼각형)
      var B = c.B;
      signPole(B);
      B.cylR(0, 1.45, 0.02, 0.4, 0.4, 0.03, "#2f2f38", 3, Math.PI / 2, Math.PI, 0);
      B.cylR(0, 1.43, 0.04, 0.32, 0.32, 0.03, "#ffd23f", 3, Math.PI / 2, Math.PI, 0);
      kids(B, 1.4, 0.065, 0.8);
    },
    childkr: function (c) {                            // 한국 어린이 보호 (파란 판)
      var B = c.B;
      signPole(B);
      B.box(0, 1.17, 0.03, 0.58, 0.58, 0.03, "#2f6fd6", 0.06);
      B.cylR(0, 1.44, 0.05, 0.25, 0.25, 0.02, "#ffffff", 3, Math.PI / 2, Math.PI, 0);
      kids(B, 1.42, 0.07, 0.65);
    },
    signpost: function (c) {                           // 东南西北 방향 표지판
      var B = c.B;
      B.cyl(0, 0, 0, 0.2, 0.24, 0.08, "#8a5c38", 12);
      B.cyl(0, 0.08, 0, 0.04, 0.045, 2.0, "#8a5c38", 8);
      B.ball(0, 2.1, 0, 0.07, 0.07, 0.07, "#f2c14e", 8);
      var D = [[0, "#e8443a", 1.85], [Math.PI, "#2f9e5a", 1.65], [Math.PI / 2, "#2f6fd6", 1.45], [-Math.PI / 2, "#f2a23a", 1.25]];
      D.forEach(function (d) {
        B.push(0, 0, 0, d[0]);
        B.box(0.32, d[2], 0, 0.52, 0.15, 0.04, d[1], 0.02);
        B.boxR(0.6, d[2] + 0.075, 0, 0.11, 0.11, 0.04, d[1], 0.01, 0, 0, Math.PI / 4);
        B.box(0.3, d[2] + 0.06, 0.025, 0.3, 0.03, 0.005, "#ffffff", 0);
        B.pop();
      });
    },
    bike: function (c, x, y) {                         // 자전거
      var B = c.B, col = pickc(["#ff6b9d", "#4dabf7", "#ffd23f", "#69db7c", "#b197fc"], rnd(x, y, 2));
      B.push(0, 0, 0, (rnd(x, y, 4) - 0.5) * 0.4);
      for (var s = -1; s <= 1; s += 2) {
        B.ring(s * 0.3, 0.25, 0, 0.21, 0.03, DARK, 0, 0, 0);
        B.ball(s * 0.3, 0.25, 0, 0.035, 0.035, 0.035, "#b8c1c8", 6);
      }
      B.boxR(-0.15, 0.43, 0, 0.035, 0.42, 0.035, col, 0.01, 0, 0, -0.45);
      B.boxR(0.06, 0.55, 0, 0.42, 0.035, 0.035, col, 0.01, 0, 0, -0.1);
      B.boxR(0.02, 0.4, 0, 0.46, 0.035, 0.035, col, 0.01, 0, 0, 0.62);
      B.boxR(0.27, 0.45, 0, 0.035, 0.44, 0.035, col, 0.01, 0, 0, 0.3);
      B.box(-0.15, 0.23, 0, 0.3, 0.03, 0.03, col, 0.005);
      B.box(-0.1, 0.65, 0, 0.2, 0.045, 0.1, "#2f3540", 0.02);
      B.box(0.33, 0.68, 0, 0.04, 0.04, 0.4, "#2f3540", 0.01);
      B.box(0.42, 0.52, 0, 0.16, 0.13, 0.24, "#e6bf8a", 0.02);
      B.pop();
    },
    horse: function (c, x, y) {                        // 말
      var B = c.B, fur = pickc(["#b0703a", "#8a5530", "#d9b38a", "#f5f0e6"], rnd(x, y, 6)), mane = "#4a2e1a";
      B.push(0, 0, 0, (rnd(x, y, 7) - 0.5) * 0.5);
      for (var i = -1; i <= 1; i += 2) for (var k = -1; k <= 1; k += 2) {
        B.cyl(i * 0.26, 0.06, k * 0.1, 0.045, 0.04, 0.7, fur, 8);
        B.cyl(i * 0.26, 0, k * 0.1, 0.05, 0.05, 0.07, "#3b2f2a", 8);
      }
      B.ball(0, 0.88, 0, 0.42, 0.25, 0.21, fur, 12);
      B.boxR(0.37, 1.12, 0, 0.15, 0.44, 0.15, fur, 0.06, 0, 0, -0.5);
      B.boxR(0.33, 1.2, 0, 0.06, 0.42, 0.17, mane, 0.03, 0, 0, -0.5);
      B.boxR(0.56, 1.3, 0, 0.34, 0.15, 0.14, fur, 0.06, 0, 0, -0.45);
      B.ball(0.68, 1.22, 0, 0.07, 0.06, 0.07, shade(fur, -0.15), 7);
      for (var s = -1; s <= 1; s += 2) {
        B.ball(0.53, 1.38, s * 0.07, 0.025, 0.025, 0.02, "#1f1a17", 6);
        B.boxR(0.46, 1.48, s * 0.05, 0.04, 0.1, 0.03, fur, 0.01, 0, 0, -0.2);
      }
      B.boxR(-0.46, 0.78, 0, 0.07, 0.38, 0.09, mane, 0.03, 0, 0, 0.4);
      B.box(-0.02, 1.04, 0, 0.3, 0.06, 0.44, "#d9534f", 0.03);
      B.pop();
    },
    hay: function (c) {                                // 건초 더미
      var B = c.B;
      B.box(0, 0, 0, 0.82, 0.48, 0.6, "#e8c35a", 0.08);
      B.box(-0.2, 0, 0, 0.04, 0.49, 0.62, "#b8862f", 0.01);
      B.box(0.2, 0, 0, 0.04, 0.49, 0.62, "#b8862f", 0.01);
      B.box(0, 0.48, 0, 0.6, 0.3, 0.45, "#f0d06a", 0.08);
    },
    brochure: function (c, x, y) {                     // 관광 안내 책자 꽂이
      var B = c.B;
      B.box(0, 0, -0.12, 0.84, 1.55, 0.3, "#b07d4f", 0.03);
      for (var r = 0; r < 4; r++) for (var k = 0; k < 4; k++)
        B.boxR(-0.3 + k * 0.2, 0.25 + r * 0.34, 0.05, 0.16, 0.24, 0.02, pickc(BOOKS, rnd(x + k, y + r, 3)), 0.01, -0.2, 0, 0);
    },
    pond: function (c, x, y) {                         // 연못 (오리 · 물고기)
      var B = c.B, ob = c.ob;
      B.floor(0, 0.03, 0, 1, 1, ((x + y) % 2) ? "#6ec0f0" : "#66b8ea");
      var edge = [[-1, 0, -0.48, 0, 0.06, 1], [1, 0, 0.48, 0, 0.06, 1], [0, -1, 0, -0.48, 1, 0.06], [0, 1, 0, 0.48, 1, 0.06]];
      edge.forEach(function (e) {
        var nb = ob(x + e[0], y + e[1]);
        if (nb === "pond" || nb === "boat") return;
        B.box(e[2], 0, e[3], e[4], 0.12, e[5], "#b9b1a0", 0.02);
      });
      if (rnd(x, y, 1) < 0.5) B.cyl(-0.2, 0.035, 0.15, 0.12, 0.12, 0.01, "#5fae4f", 10);
      var v = rnd(x, y, 2);
      if (c.S.song) v = v < 0.85 ? 0.45 + v * 0.4 : 0.9;     // 운하 : 오리는 드물게, 물고기 위주
      if (v < 0.45) {                                  // 오리
        B.ball(0.1, 0.12, -0.05, 0.13, 0.09, 0.1, "#ffffff", 8);
        B.ball(0.2, 0.25, -0.05, 0.07, 0.07, 0.07, "#ffffff", 8);
        B.box(0.28, 0.22, -0.05, 0.08, 0.025, 0.05, "#ff9a2a", 0.01);
      } else if (v < 0.8) {                            // 물고기
        B.ball(0.15, 0.05, 0.1, 0.09, 0.03, 0.04, "#ff7a3a", 6);
        B.ball(-0.15, 0.05, -0.2, 0.08, 0.03, 0.035, "#ff9a5a", 6);
      }
    },
    pavilion: function (c) {                           // 공원 정자
      var B = c.B;
      B.box(0, 0, 0, 0.98, 0.1, 0.98, "#d8cbb2", 0.03);
      for (var i = -1; i <= 1; i += 2) for (var k = -1; k <= 1; k += 2) B.cyl(i * 0.38, 0.1, k * 0.38, 0.04, 0.04, 1.35, "#c8372d", 8);
      B.box(0, 1.4, 0, 0.92, 0.1, 0.92, "#2f6f9a", 0.02);
      B.cylR(0, 1.68, 0, 0.03, 0.82, 0.46, "#3f9b6a", 4, 0, Math.PI / 4, 0);
      B.ball(0, 1.95, 0, 0.07, 0.09, 0.07, "#f2c14e", 8);
      B.box(0, 0.1, 0.2, 0.6, 0.3, 0.2, "#a8693f", 0.03);
    },
    // ================= 🍜 7과 你吃饭了吗? — 먹거리 물건 =================
    soypot: function (c) { stovePot(c.B, "#fbf3df", "dou") },          // 豆浆 콩국 솥
    wontonpot: function (c) { stovePot(c.B, "#e9c98a", "wonton") },     // 馄饨 만둣국 솥
    frywok: function (c) {                             // 油条 튀김 솥
      var B = c.B;
      stoveBase(B);
      B.cyl(0, 0.62, 0, 0.42, 0.28, 0.18, "#3d4350", 18);
      B.cyl(0, 0.76, 0, 0.38, 0.38, 0.02, "#e8b33a", 18);
      for (var k = 0; k < 5; k++) B.boxR(-0.2 + k * 0.1, 0.8, (k % 2) * 0.1 - 0.05, 0.07, 0.06, 0.42, "#d9902f", 0.03, 0, 0.3 * (k - 2), 0);
      B.box(0.36, 0.78, -0.1, 0.03, 0.03, 0.5, "#c9a227", 0.01);
      steam(B, 0, 0.9, 0, 3);
    },
    ytbasket: function (c) {                           // 油条 바구니
      var B = c.B;
      B.box(0, 0, 0, 0.8, 0.62, 0.6, "#c99a64", 0.04);
      B.cyl(0, 0.62, 0, 0.32, 0.26, 0.2, "#c9a46a", 14);
      for (var k = 0; k < 8; k++) B.boxR(-0.18 + (k % 4) * 0.12, 0.86 + Math.floor(k / 4) * 0.05, (k % 2) * 0.08 - 0.04, 0.06, 0.05, 0.46, k % 3 ? "#e09a35" : "#c97a25", 0.025, 0.1, 0.4 * ((k % 3) - 1), 0);
    },
    jbcart: function (c) {                             // 煎饼 수레 (둥근 철판)
      var B = c.B;
      B.box(0, 0.16, 0, 0.9, 0.56, 0.62, "#3fae5a", 0.04);
      for (var s = -1; s <= 1; s += 2) B.cylR(s * 0.46, 0.15, 0.05, 0.15, 0.15, 0.05, DARK, 12, 0, 0, Math.PI / 2);
      B.cyl(0, 0.72, 0, 0.36, 0.36, 0.05, "#2f3540", 20);
      B.cyl(0, 0.77, 0, 0.3, 0.3, 0.01, "#f2d27a", 20);
      B.cyl(0.05, 0.775, 0.02, 0.16, 0.16, 0.01, "#ffcf4a", 14);
      B.box(-0.08, 0.785, -0.05, 0.14, 0.01, 0.05, "#6fbf5f", 0);
      B.boxR(0.3, 0.82, 0.18, 0.18, 0.02, 0.08, "#b8c1c8", 0.005, 0, 0.6, 0);
      for (var k = 0; k < 2; k++) B.cyl(-0.38, 0.72 + k * 0.001, -0.18 + k * 0.14, 0.06, 0.06, 0.12, k ? "#ff9a2a" : "#e8443a", 10);
      B.cyl(-0.42, 0.72, 0.25, 0.02, 0.02, 1.0, "#c99a64", 6);
      B.box(-0.42, 1.55, 0.25, 0.04, 0.3, 0.5, "#e8443a", 0.02);
    },
    grill: function (c, x, y) {                        // 串儿 꼬치구이 화로
      var B = c.B;
      B.box(0, 0, 0, 0.9, 0.62, 0.5, "#5d6875", 0.04);
      B.box(0, 0.62, 0, 0.92, 0.12, 0.52, "#3d4350", 0.02);
      B.glow(function () { B.box(0, 0.7, 0, 0.8, 0.03, 0.4, "#ff6a2a", 0) });
      for (var k = 0; k < 7; k++) {
        var kx = -0.36 + k * 0.12;
        B.box(kx, 0.79, 0, 0.012, 0.012, 0.62, "#e6d2a8", 0);
        for (var j = 0; j < 4; j++) B.box(kx, 0.79, -0.1 + j * 0.065, 0.05, 0.045, 0.05, j % 2 ? "#a8502a" : "#c0602f", 0.015);
      }
      steam(B, 0, 0.95, 0, 4, "#d9d9d9");
    },
    snackshelf: function (c, x, y) {                   // 零食 간식 선반 (瓜子 · 辣条)
      var B = c.B;
      B.box(0, 0, -0.18, 0.92, 1.6, 0.4, "#e6bf8a", 0.03);
      for (var r = 0; r < 4; r++) {
        var y0 = 0.1 + r * 0.38;
        B.box(0, y0 - 0.02, -0.12, 0.84, 0.03, 0.36, "#c99a64", 0);
        for (var k = 0; k < 4; k++) {
          var v = rnd(x + k, y + r, 3), col = v < 0.3 ? "#e8443a" : v < 0.55 ? "#3d3a35" : v < 0.8 ? "#f2c14e" : "#7bc8a4";
          B.box(-0.3 + k * 0.2, y0, -0.06, 0.17, 0.26, 0.12, col, 0.03);
          B.box(-0.3 + k * 0.2, y0 + 0.15, 0.005, 0.1, 0.06, 0.005, "#ffffff", 0);
        }
      }
    },
    fridge: function (c) {                             // 可乐 냉장고
      var B = c.B;
      B.box(0, 0, -0.08, 0.8, 1.75, 0.6, "#e8443a", 0.05);
      B.glass(function () { B.box(0, 0.12, 0.23, 0.66, 1.4, 0.02, "#dff4ff", 0) });
      for (var r = 0; r < 4; r++) for (var k = 0; k < 4; k++) {
        B.cyl(-0.22 + k * 0.15, 0.16 + r * 0.34, 0.05, 0.05, 0.05, 0.22, r % 2 ? "#5a2a1a" : "#3a1a10", 8);
        B.cyl(-0.22 + k * 0.15, 0.38 + r * 0.34, 0.05, 0.02, 0.04, 0.06, "#e8443a", 8);
      }
      B.glow(function () { B.box(0, 1.58, 0.225, 0.6, 0.12, 0.01, "#ffffff", 0.02) });
    },
    tastebar: function (c) {                           // 맛 체험대 (시다 · 달다 · 쓰다 · 짜다)
      var B = c.B;
      B.box(0, 0, 0, 0.94, 0.7, 0.62, "#f4e3c4", 0.04);
      B.box(0, 0.7, 0, 0.98, 0.05, 0.66, "#e6bf8a", 0.02);
      B.ball(-0.33, 0.83, 0, 0.09, 0.075, 0.075, "#ffe14a", 10);                    // 레몬 suān
      B.box(-0.11, 0.75, 0, 0.16, 0.03, 0.22, "#6b3a1f", 0.01);                   // 초콜릿 tián
      for (var k = 0; k < 3; k++) B.box(-0.11, 0.78, -0.07 + k * 0.07, 0.15, 0.015, 0.06, "#7a4528", 0.005);
      B.cyl(0.12, 0.75, 0, 0.09, 0.07, 0.07, "#ffffff", 12);                     // 쓴 약 kǔ
      B.cyl(0.12, 0.81, 0, 0.075, 0.075, 0.01, "#4a2e1a", 12);
      B.cyl(0.34, 0.75, 0, 0.055, 0.055, 0.18, "#e8eef2", 10);                   // 소금 xián
      B.cyl(0.34, 0.93, 0, 0.06, 0.05, 0.05, "#b8c1c8", 10);
    },
    icecream: function (c) {                           // 冰淇淋 아이스크림 수레
      var B = c.B;
      B.box(0, 0.16, 0, 0.84, 0.6, 0.56, "#9fd8f0", 0.06);
      for (var s = -1; s <= 1; s += 2) B.cylR(s * 0.43, 0.15, 0, 0.15, 0.15, 0.05, DARK, 12, 0, 0, Math.PI / 2);
      for (var k = 0; k < 3; k++) {
        var px = -0.24 + k * 0.24;
        B.cylR(px, 0.88, 0.05, 0.07, 0.005, 0.22, "#e6b56a", 10, Math.PI, 0, 0);
        B.ball(px, 1.02, 0.05, 0.09, 0.08, 0.09, ["#ff9fcf", "#fff2c2", "#8fd3a4"][k], 10);
      }
      for (var s2 = -1; s2 <= 1; s2 += 2) B.cyl(s2 * 0.38, 0.76, -0.24, 0.02, 0.02, 0.9, "#ffffff", 6);
      for (var i = 0; i < 5; i++) B.boxR(-0.4 + i * 0.2, 1.68, -0.02, 0.2, 0.03, 0.56, i % 2 ? "#ffffff" : "#ff9fcf", 0.005, -0.25, 0, 0);
    },
    bigcup: function (c) {                             // 🧋 왕 버블티 조형물 (珍珠奶茶)
      var B = c.B;
      B.cyl(0, 0, 0, 0.38, 0.4, 0.12, "#c99a64", 16);
      for (var k = 0; k < 18; k++) {                  // 바닥의 까만 타피오카 펄
        var a = k * 2.4, r = 0.1 + (k % 3) * 0.09;
        B.ball(Math.cos(a) * r, 0.2 + Math.floor(k / 6) * 0.11, Math.sin(a) * r, 0.07, 0.07, 0.07, "#2b1a12", 8);
      }
      B.cyl(0, 0.5, 0, 0.33, 0.3, 1.0, "#e9c9a0", 18);           // 밀크티
      B.cyl(0, 0.5, 0, 0.335, 0.335, 0.05, "#8a5530", 18);       // 흑당 줄무늬
      B.cyl(0, 1.0, 0, 0.345, 0.345, 0.04, "#a8693f", 18);
      B.glass(function () { B.cyl(0, 0.12, 0, 0.37, 0.3, 1.5, "#f7e3c4", 18) });
      B.cyl(0, 1.62, 0, 0.38, 0.38, 0.05, "#ffffff", 18);
      B.cylR(0.08, 2.0, 0, 0.04, 0.04, 0.9, "#ff6b9d", 8, 0, 0, -0.2);
    },
    bigbowl: function (c) {                            // 🍜 왕 국수 그릇 조형물
      var B = c.B;
      B.cyl(0, 0, 0, 0.32, 0.36, 0.3, "#8e9aa6", 14);
      B.cyl(0, 0.3, 0, 0.52, 0.22, 0.5, "#ffffff", 20);
      B.cyl(0, 0.79, 0, 0.5, 0.5, 0.03, "#b8402f", 20);
      B.cyl(0, 0.72, 0, 0.47, 0.47, 0.05, "#e8843a", 20);
      for (var k = 0; k < 8; k++) B.ring(Math.cos(k) * 0.18, 0.78, Math.sin(k) * 0.18, 0.09, 0.012, "#f7dfa0", Math.PI / 2, 0, 0);
      B.ball(0.2, 0.8, -0.1, 0.1, 0.03, 0.08, "#f2c14e", 8);
      B.ball(-0.18, 0.8, 0.15, 0.06, 0.03, 0.06, "#6fbf5f", 8);
      for (var s = -1; s <= 1; s += 2) B.boxR(0.12 + s * 0.04, 1.2, 0, 0.03, 0.9, 0.03, "#a8693f", 0.01, 0, 0, -0.35);
      steam(B, 0, 1.0, 0, 4);
    },
    foodtable: function (c, x, y) {                    // 식당 네모 탁자 + 음식 + 의자
      var B = c.B, dish = c.S.dish || ["#f2c14e", "#e8843a", "#fbf3df"];
      B.box(0, 0, 0, 0.08, 0.66, 0.08, "#7a4a2b", 0.02);
      B.box(0, 0.66, 0, 0.84, 0.06, 0.74, "#a8693f", 0.02);
      for (var k = 0; k < 3; k++) {
        var px = -0.24 + k * 0.24, pz = (k % 2) * 0.16 - 0.08;
        B.cyl(px, 0.72, pz, 0.11, 0.07, 0.07, "#ffffff", 12);
        B.cyl(px, 0.785, pz, 0.095, 0.095, 0.01, pickc(dish, rnd(x + k, y, 2)), 12);
      }
      B.box(0.3, 0.73, 0.25, 0.02, 0.01, 0.24, "#c0392b", 0);
      B.box(0.33, 0.73, 0.25, 0.02, 0.01, 0.24, "#c0392b", 0);
      for (var s = -1; s <= 1; s += 2) {
        B.cyl(s * 0.62, 0, 0, 0.15, 0.15, 0.42, "#c0392b", 12);
        B.cyl(s * 0.62, 0.42, 0, 0.16, 0.16, 0.03, "#f2c14e", 12);
      }
    },
    malatable: function (c, x, y) {                    // 麻辣烫 원탁 (빨간 국물 그릇)
      var B = c.B;
      B.cyl(0, 0, 0, 0.25, 0.3, 0.05, "#5a3d2b", 14);
      B.cyl(0, 0.05, 0, 0.06, 0.06, 0.6, "#5a3d2b", 10);
      B.cyl(0, 0.64, 0, 0.5, 0.5, 0.05, "#e8823a", 22);
      B.cyl(0, 0.69, 0, 0.22, 0.22, 0.03, "#fff6ea", 18);
      B.cyl(0, 0.72, 0, 0.18, 0.13, 0.12, "#ffffff", 14);
      B.cyl(0, 0.84, 0, 0.17, 0.17, 0.01, "#c8251c", 14);
      for (var k = 0; k < 6; k++) B.ball(Math.cos(k) * 0.09, 0.85, Math.sin(k) * 0.09, 0.03, 0.015, 0.03, pickc(["#6fbf5f", "#f2c14e", "#fff2d0", "#8a5530"], rnd(x + k, y, 4)), 6);
      B.cyl(0.3, 0.69, -0.2, 0.08, 0.06, 0.12, "#ffffff", 10);                    // 찻주전자
      B.ball(0.3, 0.84, -0.2, 0.03, 0.02, 0.03, "#ffffff", 6);
      steam(B, 0, 0.95, 0, 3, "#ffd2c2");
      for (var s = 0; s < 4; s++) {
        var b = s / 4 * Math.PI * 2 + Math.PI / 4;
        B.cyl(Math.cos(b) * 0.66, 0, Math.sin(b) * 0.66, 0.13, 0.13, 0.42, "#3d4350", 10);
        B.cyl(Math.cos(b) * 0.66, 0.42, Math.sin(b) * 0.66, 0.15, 0.15, 0.04, "#c0392b", 10);
      }
    },
    ingredshelf: function (c, x, y) {                  // 마라탕 재료 고르는 냉장고
      var B = c.B;
      B.box(0, 0, -0.1, 0.92, 1.3, 0.55, "#dfe6ec", 0.04);
      B.glass(function () { B.box(0, 0.1, 0.19, 0.84, 1.1, 0.02, "#e9f8ff", 0) });
      for (var r = 0; r < 3; r++) for (var k = 0; k < 4; k++) {
        var col = pickc(["#6fbf5f", "#f2c14e", "#fff2d0", "#e8843a", "#8a5530", "#c8251c"], rnd(x + k, y + r, 7));
        B.box(-0.3 + k * 0.2, 0.15 + r * 0.36, 0.0, 0.16, 0.08, 0.3, "#b8c1c8", 0.01);
        B.ball(-0.3 + k * 0.2, 0.26 + r * 0.36, 0.0, 0.07, 0.04, 0.12, col, 6);
      }
      B.glow(function () { B.box(0, 1.3, -0.1, 0.92, 0.12, 0.55, "#ff5a3c", 0.02) });
    },
    steamer: function (c) {                            // 包子 대나무 찜기 탑
      var B = c.B;
      B.box(0, 0, 0, 0.8, 0.55, 0.6, "#c99a64", 0.04);
      for (var k = 0; k < 4; k++) {
        B.cyl(0, 0.55 + k * 0.16, 0, 0.32, 0.32, 0.15, k % 2 ? "#d9b47a" : "#e6c48a", 18);
        B.cyl(0, 0.55 + k * 0.16 + 0.15, 0, 0.33, 0.33, 0.01, "#b8925a", 18);
      }
      B.cyl(0, 1.19, 0, 0.32, 0.2, 0.08, "#e6c48a", 18);
      B.ball(0, 1.3, 0, 0.06, 0.04, 0.06, "#b8925a", 8);
      for (var j = 0; j < 3; j++) B.ball(-0.22 + j * 0.22, 0.6, 0.38, 0.09, 0.07, 0.09, "#fffaf0", 10);
      steam(B, 0, 1.3, 0, 4);
    },
    teatable: function (c) {                           // 乌龙茶 찻상 (낮은 탁자 + 다기)
      var B = c.B;
      B.box(0, 0, 0, 0.82, 0.42, 0.62, "#7a4a2b", 0.04);
      B.box(0, 0.42, 0, 0.88, 0.05, 0.68, "#5a3720", 0.02);
      B.box(0, 0.47, 0, 0.5, 0.03, 0.34, "#3d2a1a", 0.01);
      B.ball(-0.08, 0.56, 0, 0.09, 0.07, 0.09, "#a8502a", 10);
      B.boxR(0.03, 0.57, 0, 0.1, 0.02, 0.02, "#a8502a", 0.01, 0, 0, 0.5);
      for (var k = 0; k < 4; k++) B.cyl(0.12 + (k % 2) * 0.08, 0.5, -0.08 + Math.floor(k / 2) * 0.14, 0.03, 0.025, 0.04, "#fffaf0", 8);
      for (var s = -1; s <= 1; s += 2) B.box(s * 0.62, 0, 0, 0.3, 0.2, 0.36, "#c0392b", 0.06);
      steam(B, -0.08, 0.7, 0, 2);
    },
    teashelf: function (c, x, y) {                     // 찻잎 통 선반
      var B = c.B;
      B.box(0, 0, -0.18, 0.92, 1.6, 0.4, "#7a4a2b", 0.03);
      for (var r = 0; r < 4; r++) {
        B.box(0, 0.08 + r * 0.38, -0.12, 0.84, 0.03, 0.36, "#5a3720", 0);
        for (var k = 0; k < 4; k++) {
          var col = pickc(["#3f9b6a", "#c0392b", "#f2c14e", "#2f6fb3", "#8a5530"], rnd(x + k, y + r, 3));
          B.cyl(-0.3 + k * 0.2, 0.11 + r * 0.38, -0.05, 0.07, 0.07, 0.22, col, 12);
          B.cyl(-0.3 + k * 0.2, 0.33 + r * 0.38, -0.05, 0.072, 0.072, 0.03, "#e6c48a", 12);
        }
      }
    },
    bamboo: function (c, x, y) {                       // 🎋 대나무 덤불
      var B = c.B;
      B.cyl(0, 0, 0, 0.42, 0.46, 0.12, "#8a6a4a", 14);
      for (var k = 0; k < 6; k++) {
        var a = k * 1.05 + rnd(x, y, k), r = 0.12 + rnd(x, y, k + 3) * 0.2, h = 1.4 + rnd(x, y, k + 7) * 1.0;
        var bx = Math.cos(a) * r, bz = Math.sin(a) * r, col = pickc(["#7cc56a", "#6db85c", "#8fd27a"], rnd(x, y, k + 11));
        B.cyl(bx, 0.1, bz, 0.04, 0.045, h, col, 7);
        for (var j = 1; j < 5; j++) B.cyl(bx, 0.1 + h * j / 5, bz, 0.05, 0.05, 0.02, shade(col, -0.2), 7);
        B.ball(bx + 0.12, 0.1 + h, bz, 0.18, 0.05, 0.08, "#5ea84f", 6);
        B.ball(bx - 0.1, h * 0.8, bz + 0.06, 0.15, 0.04, 0.07, "#77c266", 6);
      }
    },
    pandarest: function (c, x, y) {                    // 🐼 누워서 대나무 먹는 판다
      var B = c.B, W = "#ffffff", K = "#2f2f38";
      B.push(0, 0, 0, (rnd(x, y, 1) - 0.5) * 1.2);
      B.ball(0, 0.3, 0, 0.36, 0.28, 0.3, W, 12);
      B.ball(0, 0.3, 0.02, 0.37, 0.12, 0.31, K, 12);
      B.ball(0.38, 0.5, 0, 0.24, 0.22, 0.22, W, 12);
      for (var s = -1; s <= 1; s += 2) {
        B.ball(0.42, 0.7, s * 0.15, 0.08, 0.08, 0.06, K, 8);
        B.ball(0.55, 0.53, s * 0.08, 0.05, 0.065, 0.04, K, 8);
        B.ball(0.6, 0.52, s * 0.08, 0.02, 0.02, 0.02, W, 6);
        B.ball(-0.25, 0.18, s * 0.22, 0.12, 0.12, 0.12, K, 8);
        B.ball(0.12, 0.5, s * 0.25, 0.09, 0.15, 0.09, K, 8);
      }
      B.ball(0.6, 0.42, 0, 0.05, 0.035, 0.04, K, 6);
      B.cylR(0.42, 0.55, 0.24, 0.025, 0.025, 0.55, "#7cc56a", 7, 0.5, 0, -0.6);
      B.ball(0.62, 0.78, 0.36, 0.14, 0.04, 0.06, "#5ea84f", 6);
      B.pop();
    },
    bed: function (c) {                                // 기숙사 침대 (본문1)
      var B = c.B;
      B.box(0, 0, 0, 0.9, 0.36, 0.96, "#c99a64", 0.03);
      B.box(0, 0.36, 0, 0.86, 0.14, 0.92, "#ffffff", 0.05);
      B.box(0, 0.5, 0.15, 0.88, 0.06, 0.6, "#9fc8f0", 0.03);
      B.box(0, 0.5, -0.32, 0.5, 0.1, 0.22, "#c8b6ff", 0.05);
      B.box(0, 0.36, -0.47, 0.92, 0.6, 0.06, "#a8693f", 0.02);
    },
    deliverybox: function (c) {                        // 外卖 배달 상자 + 햄버거 (汉堡包)
      var B = c.B;
      B.box(0, 0, 0, 0.6, 0.5, 0.5, "#ffcf4a", 0.05);
      B.box(0, 0.12, 0.255, 0.4, 0.2, 0.01, "#2f6fb3", 0.02);
      B.ball(0, 0.62, 0, 0.18, 0.08, 0.18, "#e8a33a", 12);
      B.cyl(0, 0.55, 0, 0.19, 0.19, 0.03, "#6fbf5f", 14);
      B.cyl(0, 0.58, 0, 0.18, 0.18, 0.04, "#6b3a1f", 14);
      B.cyl(0, 0.53, 0, 0.17, 0.17, 0.03, "#e6b56a", 14);
      for (var k = 0; k < 4; k++) B.box(0.26 + (k % 2) * 0.04, 0.5, -0.12 + k * 0.05, 0.025, 0.2, 0.025, "#ffcf4a", 0.005);
      B.box(0.28, 0.5, -0.05, 0.12, 0.08, 0.2, "#e8443a", 0.01);
      B.cyl(-0.24, 0.5, -0.12, 0.06, 0.05, 0.2, "#e8443a", 10);
    },
    scooter: function (c) {                            // 배달 오토바이
      var B = c.B;
      for (var s = -1; s <= 1; s += 2) B.ring(s * 0.34, 0.18, 0, 0.15, 0.05, DARK, 0, 0, 0);
      B.box(0, 0.16, 0, 0.6, 0.14, 0.24, "#3fa0e8", 0.05);
      B.boxR(0.3, 0.5, 0, 0.12, 0.6, 0.22, "#3fa0e8", 0.04, 0, 0, -0.25);
      B.box(0.38, 0.82, 0, 0.04, 0.04, 0.46, "#2f3540", 0.01);
      B.box(-0.12, 0.34, 0, 0.36, 0.08, 0.24, "#2f3540", 0.03);
      B.box(-0.28, 0.42, 0, 0.36, 0.34, 0.36, "#ffcf4a", 0.04);
    },
    paifang: function (c) {},                          // (exitgate 가 패루로 그려집니다)
    // ================= 🏮 8과 多少钱? — 송나라 시장 물건 =================
    archway: function (c, x, y) {                      // 거리와 거리 사이 나무 문 (지나갈 수 있음)
      var B = c.B, rot = (x <= 1 || x >= c.C - 2) ? Math.PI / 2 : 0;
      B.push(0, 0, 0, rot);
      for (var s = -1; s <= 1; s += 2) {
        B.box(s * 0.52, 0, 0, 0.3, 0.25, 0.3, "#8a7a66", 0.04);
        B.cyl(s * 0.52, 0.25, 0, 0.08, 0.08, 2.1, "#7a3b22", 10);
      }
      B.box(0, 2.25, 0, 1.4, 0.14, 0.24, "#7a3b22", 0.02);
      B.box(0, 2.0, 0.02, 0.9, 0.22, 0.06, "#2f2a26", 0.02);
      B.box(0, 2.4, 0, 1.6, 0.08, 0.5, "#4a4f5c", 0.02);
      B.box(0, 2.48, 0, 1.3, 0.12, 0.3, "#3d424d", 0.02);
      B.pop();
    },
    flag: function (c, x, y) {                         // 酒旗 · 가게 깃발 장대
      var B = c.B, col = pickc(["#c8372d", "#2f6f9a", "#e8a33a", "#3f9b6a", "#f4ead2"], rnd(x, y, 3));
      B.cyl(0, 0, 0, 0.16, 0.18, 0.08, "#8a7a66", 10);
      B.cyl(0, 0.08, 0, 0.035, 0.04, 2.5, "#6b4a33", 8);
      B.box(0.2, 2.45, 0, 0.42, 0.03, 0.03, "#6b4a33", 0.01);
      B.boxR(0.22, 1.85, 0, 0.36, 1.1, 0.02, col, 0.01, 0, 0, 0.04);
      B.box(0.22, 1.3, 0.012, 0.36, 0.06, 0.012, "#2f2a26", 0);
      for (var k = 0; k < 3; k++) B.boxR(0.12 + k * 0.1, 1.24, 0, 0.05, 0.14, 0.02, col, 0.005, 0, 0, 0.1);
    },
    ustall: function (c, x, y) {                       // 큰 우산 노점 (물건은 칸마다 달라요)
      var B = c.B, v = rnd(x, y, 5);
      B.box(0, 0, 0, 0.9, 0.58, 0.66, "#a8743f", 0.03);
      B.box(0, 0.58, 0, 0.96, 0.05, 0.72, "#c99a64", 0.02);
      if (v < 0.25) for (var i = 0; i < 9; i++) B.ball(-0.3 + (i % 3) * 0.3, 0.7, -0.2 + Math.floor(i / 3) * 0.2, 0.08, 0.07, 0.08, i % 2 ? "#e8323c" : "#f2c14e", 8);
      else if (v < 0.5) for (var j = 0; j < 6; j++) B.ball(-0.28 + (j % 3) * 0.28, 0.69, -0.12 + Math.floor(j / 3) * 0.24, 0.1, 0.07, 0.1, "#fbf3df", 9);
      else if (v < 0.75) for (var k = 0; k < 4; k++) B.box(-0.3 + k * 0.2, 0.63, 0, 0.17, 0.08 + k * 0.03, 0.5, pickc(["#c8372d", "#2f6f9a", "#3f9b6a", "#f2c14e"], rnd(x + k, y, 2)), 0.02);
      else for (var m = 0; m < 5; m++) B.cyl(-0.32 + m * 0.16, 0.63, 0, 0.06, 0.07, 0.18, pickc(["#8a5530", "#c9a46a", "#5a7a9a"], rnd(x + m, y, 4)), 10);
      B.cyl(0.38, 0.63, -0.28, 0.025, 0.025, 1.45, "#6b4a33", 6);
      B.cylR(0.2, 2.15, -0.1, 0.06, 0.95, 0.32, pickc(["#f4ead2", "#e8c87a", "#d9b48a"], rnd(x, y, 9)), 14, 0.12, 0, -0.12);
      B.ball(0.25, 2.33, -0.12, 0.05, 0.05, 0.05, "#6b4a33", 6);
    },
    cart: function (c, x, y) {                         // 손수레 (짐 · 항아리)
      var B = c.B;
      B.box(0, 0.32, 0, 0.9, 0.12, 0.6, "#a8743f", 0.02);
      for (var s = -1; s <= 1; s += 2) {
        B.ring(0, 0.3, s * 0.34, 0.28, 0.035, "#6b4a33", 0, 0, 0);
        for (var k = 0; k < 3; k++) B.boxR(0, 0.3, s * 0.34, 0.03, 0.52, 0.02, "#6b4a33", 0, 0, 0, k * Math.PI / 3);
        B.boxR(-0.62, 0.42, s * 0.22, 0.6, 0.04, 0.04, "#8a5c38", 0.01, 0, 0, -0.25);
      }
      B.cyl(-0.18, 0.44, 0, 0.16, 0.12, 0.34, "#8a5530", 10);
      B.cyl(0.18, 0.44, -0.1, 0.13, 0.1, 0.28, "#c9a46a", 10);
      B.box(0.2, 0.44, 0.15, 0.3, 0.22, 0.2, "#d9c49a", 0.04);
    },
    donkey: function (c, x, y) {                       // 짐 실은 당나귀
      var B = c.B, fur = "#8e8780", dk = "#5f5a55";
      B.push(0, 0, 0, (rnd(x, y, 7) - 0.5) * 0.6);
      for (var i = -1; i <= 1; i += 2) for (var k = -1; k <= 1; k += 2) {
        B.cyl(i * 0.22, 0.05, k * 0.09, 0.04, 0.035, 0.52, fur, 8);
        B.cyl(i * 0.22, 0, k * 0.09, 0.045, 0.045, 0.06, "#3b2f2a", 8);
      }
      B.ball(0, 0.68, 0, 0.34, 0.2, 0.18, fur, 12);
      B.boxR(0.3, 0.88, 0, 0.12, 0.34, 0.12, fur, 0.05, 0, 0, -0.5);
      B.boxR(0.45, 1.02, 0, 0.28, 0.13, 0.12, fur, 0.05, 0, 0, -0.4);
      B.ball(0.56, 0.96, 0, 0.06, 0.05, 0.06, "#d9d2c8", 7);
      for (var s = -1; s <= 1; s += 2) {
        B.boxR(0.36, 1.18, s * 0.04, 0.04, 0.2, 0.03, dk, 0.01, 0, 0, -0.15 + s * 0.1);
        B.ball(0.45, 1.06, s * 0.055, 0.02, 0.02, 0.02, "#1f1a17", 6);
        B.box(0, 0.62, s * 0.24, 0.32, 0.26, 0.14, s > 0 ? "#c9a46a" : "#a8743f", 0.04);   // 짐 보따리
      }
      B.boxR(-0.36, 0.62, 0, 0.04, 0.26, 0.04, dk, 0.01, 0, 0, 0.3);
      B.box(0, 0.86, 0, 0.3, 0.05, 0.42, "#c8372d", 0.02);
      B.pop();
    },
    camel: function (c, x, y) {                        // 낙타 (실크로드 상인)
      var B = c.B, fur = "#d2a46c";
      B.push(0, 0, 0, (rnd(x, y, 7) - 0.5) * 0.5);
      for (var i = -1; i <= 1; i += 2) for (var k = -1; k <= 1; k += 2) B.cyl(i * 0.26, 0, k * 0.1, 0.045, 0.04, 0.85, fur, 8);
      B.ball(0, 1.0, 0, 0.42, 0.22, 0.2, fur, 12);
      B.ball(-0.12, 1.24, 0, 0.16, 0.16, 0.14, fur, 10);
      B.ball(0.14, 1.22, 0, 0.14, 0.14, 0.13, fur, 10);
      B.boxR(0.42, 1.25, 0, 0.12, 0.5, 0.12, fur, 0.05, 0, 0, -0.35);
      B.boxR(0.58, 1.5, 0, 0.3, 0.13, 0.13, fur, 0.05, 0, 0, -0.15);
      for (var s = -1; s <= 1; s += 2) {
        B.ball(0.6, 1.58, s * 0.06, 0.02, 0.02, 0.02, "#1f1a17", 6);
        B.box(-0.02, 0.92, s * 0.22, 0.22, 0.24, 0.12, s > 0 ? "#2f6f9a" : "#c8372d", 0.04);
      }
      B.box(0, 1.3, 0, 0.5, 0.05, 0.46, "#e8a33a", 0.02);
      B.pop();
    },
    boat: function (c, x, y) {                         // 강 위의 나룻배 (물 위)
      ONE.pond(c, x, y);
      var B = c.B;
      B.push(0, 0, 0, (rnd(x, y, 3) - 0.5) * 0.4);
      B.box(0, 0.04, 0, 0.92, 0.18, 0.5, "#8a5c38", 0.08);
      B.box(0, 0.22, 0, 0.84, 0.03, 0.42, "#6b4a33", 0.02);
      B.boxR(0.5, 0.14, 0, 0.16, 0.12, 0.36, "#8a5c38", 0.04, 0, 0, 0.5);
      B.boxR(-0.5, 0.14, 0, 0.16, 0.12, 0.36, "#8a5c38", 0.04, 0, 0, -0.5);
      if (rnd(x, y, 5) < 0.6) {                       // 작은 지붕
        for (var s = -1; s <= 1; s += 2) B.cyl(s * 0.18, 0.24, 0, 0.015, 0.015, 0.4, "#6b4a33", 5);
        B.boxR(0, 0.68, 0, 0.5, 0.04, 0.5, "#c9a46a", 0.03, 0.15, 0, 0);
      } else {
        B.box(-0.15, 0.25, 0, 0.3, 0.2, 0.3, "#d9c49a", 0.04);
        B.box(0.18, 0.25, 0.05, 0.2, 0.15, 0.2, "#a8743f", 0.03);
      }
      B.boxR(0.35, 0.5, 0.18, 0.02, 0.9, 0.02, "#6b4a33", 0, 0.5, 0, 0.6);
      B.pop();
    },
    scalestall: function (c) {                         // 과일 가게 저울 (1斤)
      var B = c.B;
      B.box(0, 0, 0, 0.9, 0.62, 0.66, "#a8743f", 0.03);
      B.box(0, 0.62, 0, 0.96, 0.05, 0.72, "#c99a64", 0.02);
      B.cyl(0, 0.67, 0, 0.025, 0.025, 0.72, "#6b4a33", 6);
      B.box(0, 1.37, 0, 0.7, 0.03, 0.03, "#6b4a33", 0.01);
      B.cyl(-0.3, 1.0, 0, 0.004, 0.004, 0.37, "#3b2f2a", 4);
      B.cyl(-0.3, 0.98, 0, 0.14, 0.11, 0.04, "#c9a227", 12);
      for (var k = 0; k < 3; k++) B.ball(-0.3 + (k - 1) * 0.07, 1.06, (k % 2) * 0.04, 0.055, 0.055, 0.055, "#e8323c", 8);
      B.cyl(0.25, 1.15, 0, 0.004, 0.004, 0.22, "#3b2f2a", 4);
      B.cyl(0.25, 1.06, 0, 0.05, 0.06, 0.09, "#4a4f5c", 8);
      for (var j = 0; j < 8; j++) B.ball(-0.32 + (j % 4) * 0.2, 0.74, -0.16 + Math.floor(j / 4) * 0.3, 0.08, 0.075, 0.08, j % 3 ? "#e8323c" : "#7cc56a", 9);
    },
    clothrack: function (c, x, y) {                    // 옷걸이 (치파오 · 비단옷)
      var B = c.B;
      for (var s = -1; s <= 1; s += 2) B.cyl(s * 0.42, 0, 0, 0.025, 0.025, 1.55, "#6b4a33", 6);
      B.box(0, 1.52, 0, 0.9, 0.03, 0.03, "#6b4a33", 0.01);
      var cols = ["#c8372d", "#e8a33a", "#3f9b6a", "#2f6fd6", "#ff8fb1", "#f4ead2"];
      for (var k = 0; k < 4; k++) {
        var col = pickc(cols, rnd(x + k, y, 3)), px = -0.3 + k * 0.2;
        B.box(px, 1.4, 0, 0.16, 0.12, 0.05, col, 0.03);
        B.box(px, 0.55, 0, 0.17, 0.86, 0.04, col, 0.04);
        B.box(px, 1.32, 0.025, 0.06, 0.06, 0.01, "#f2c14e", 0);
      }
    },
    mannequin: function (c, x, y) {                    // 치파오를 입힌 마네킹
      var B = c.B, col = pickc(["#c8372d", "#2f6fd6", "#e8a33a", "#3f9b6a"], rnd(x, y, 2));
      B.cyl(0, 0, 0, 0.2, 0.22, 0.05, "#6b4a33", 12);
      B.cyl(0, 0.05, 0, 0.02, 0.02, 0.35, "#6b4a33", 6);
      B.cyl(0, 0.4, 0, 0.15, 0.2, 0.7, col, 12);
      B.ball(0, 1.12, 0, 0.17, 0.12, 0.13, col, 10);
      B.cyl(0, 1.2, 0, 0.05, 0.05, 0.08, col, 8);
      B.ball(0, 1.36, 0, 0.09, 0.11, 0.09, "#e6d2b8", 8);
      for (var k = 0; k < 4; k++) B.ball(0, 0.6 + k * 0.15, 0.17 - k * 0.005, 0.03, 0.03, 0.01, "#f2c14e", 6);
    },
    shoeshelf: function (c, x, y) {                    // 신발 선반 (双)
      var B = c.B;
      B.box(0, 0, -0.18, 0.92, 1.5, 0.4, "#a8693f", 0.03);
      for (var r = 0; r < 4; r++) {
        B.box(0, 0.1 + r * 0.36, -0.12, 0.84, 0.03, 0.36, "#8a5530", 0);
        for (var k = 0; k < 2; k++) {
          var col = pickc(["#c8372d", "#2f2f38", "#f4ead2", "#3f9b6a", "#2f6fd6", "#e8a33a"], rnd(x + k, y + r, 5));
          for (var s = -1; s <= 1; s += 2) B.box(-0.2 + k * 0.4 + s * 0.065, 0.13 + r * 0.36, -0.05, 0.11, 0.09, 0.26, col, 0.04);
        }
      }
    },
    dyevat: function (c, x, y) {                       // 색깔 염색 항아리 (红黄绿蓝白黑)
      var B = c.B, cols = ["#e8323c", "#f2c14e", "#3fae5a", "#2f6fd6", "#fbfbf6", "#2f2f38"];
      var col = cols[Math.floor(x / 2) % cols.length];
      B.cyl(0, 0, 0, 0.36, 0.3, 0.62, "#8a5530", 14);
      B.cyl(0, 0.62, 0, 0.38, 0.38, 0.05, "#6b4a33", 14);
      B.cyl(0, 0.6, 0, 0.32, 0.32, 0.04, col, 14);
      B.boxR(0.12, 0.85, 0, 0.03, 0.6, 0.03, "#a8693f", 0.01, 0, 0, -0.5);
      B.cyl(-0.48, 0, 0.1, 0.02, 0.02, 1.6, "#6b4a33", 5);
      B.box(-0.48, 0.8, 0.1, 0.03, 0.8, 0.3, col, 0.01);
    },
    redpaper: function (c, x, y) {                     // 剪纸 빨간 종이 오리기 판
      var B = c.B;
      B.box(0, 0, -0.1, 0.9, 1.6, 0.2, "#6b4a33", 0.03);
      B.box(0, 0.12, 0.005, 0.8, 1.36, 0.02, "#f4ead2", 0.01);
      for (var k = 0; k < 4; k++) {
        var px = k % 2 ? 0.2 : -0.2, py = k < 2 ? 1.1 : 0.55;
        B.cylR(px, py, 0.03, 0.15, 0.15, 0.01, "#d42a24", 12, Math.PI / 2, 0, 0);
        B.cylR(px, py, 0.04, 0.07, 0.07, 0.01, "#f4ead2", 6, Math.PI / 2, 0, 0);
        B.boxR(px, py, 0.045, 0.2, 0.025, 0.005, "#d42a24", 0, 0, 0, 0.8);
      }
    },
    moneycounter: function (c, x, y) {                 // 钱庄 환전소 계산대 (엽전 꾸러미 · 주판)
      var B = c.B;
      B.box(0, 0, 0, 0.94, 0.78, 0.62, "#7a3b22", 0.04);
      B.box(0, 0.78, 0, 0.98, 0.05, 0.66, "#5a2a18", 0.02);
      for (var k = 0; k < 3; k++) {                    // 엽전 꾸러미
        for (var j = 0; j < 7; j++) B.cylR(-0.3 + k * 0.15, 0.86, -0.18 + j * 0.035, 0.035, 0.035, 0.012, "#c9a227", 8, Math.PI / 2, 0, 0);
      }
      B.box(0.25, 0.83, 0.05, 0.36, 0.03, 0.22, "#6b4a33", 0.01);   // 주판
      for (var r = 0; r < 5; r++) for (var b = 0; b < 4; b++) B.ball(0.12 + r * 0.065, 0.87, -0.03 + b * 0.05, 0.022, 0.018, 0.022, "#2f2a26", 6);
      B.box(-0.25, 0.83, 0.15, 0.22, 0.01, 0.12, "#ff8fa3", 0);       // 지폐(人民币) 한 장
    },
    qrstand: function (c) {                            // ⏱ 미래에서 온 QR 결제 팻말 (Qǐng sǎo yíxià)
      var B = c.B;
      B.box(0, 0, 0, 0.5, 0.7, 0.4, "#a8743f", 0.03);
      B.boxR(0, 0.95, 0, 0.4, 0.5, 0.04, "#ffffff", 0.03, -0.25, 0, 0);
      for (var i = 0; i < 5; i++) for (var j = 0; j < 5; j++) if ((i * 7 + j * 3) % 4 < 2 || (i < 2 && j < 2))
        B.boxR(-0.12 + i * 0.06, 0.88 + j * 0.055, 0.03 - j * 0.014, 0.05, 0.045, 0.01, "#1f1a17", 0, -0.25, 0, 0);
      B.glow(function () { B.boxR(0, 1.17, -0.04, 0.4, 0.06, 0.05, "#3fd0ff", 0.01, -0.25, 0, 0) });
    },
    crate: function (c, x, y) { crateHedge(c.B, 0, 0, x, y) },
    timemachine: function (c) {},
    hedge: function (c, x, y) { if (c.S.crates) crateHedge(c.B, 0, 0, x, y); else if (c.S.bamboo) bambooHedge(c.B, 0, 0, x, y); else hedge(c.B, 0, 0, 0.62, x, y) },
    entrance: function (c, x, y) { entrance(c, x, y) },
    exitgate: function (c) {                         // ⏱ 타임머신 (현재로 돌아가기)
      var B = c.B;
      B.cyl(0, 0, -0.1, 0.62, 0.68, 0.14, "#5d6875", 20);
      B.glow(function () { B.ring(0, 0.16, -0.1, 0.6, 0.035, "#3fd0ff", Math.PI / 2, 0, 0) });
      B.cyl(0, 0.14, -0.1, 0.42, 0.48, 0.5, "#c9d1d8", 18);
      B.glass(function () { B.ball(0, 0.85, -0.1, 0.46, 0.5, 0.46, "#bfe7ff", 16) });
      B.ball(0, 0.64, -0.1, 0.16, 0.12, 0.16, "#3d4350", 10);
      for (var k = 0; k < 6; k++) {
        var a = k / 6 * Math.PI * 2;
        B.glow(function () { B.ball(Math.cos(a) * 0.46, 0.4, -0.1 + Math.sin(a) * 0.46, 0.05, 0.05, 0.05, k % 2 ? "#ffd23f" : "#ff6b9d", 8) });
      }
      B.cyl(0, 1.32, -0.1, 0.03, 0.03, 0.35, "#8e9aa6", 6);
      B.glow(function () { B.ball(0, 1.7, -0.1, 0.08, 0.08, 0.08, "#4dff8a", 8) });
      B.boxR(0.5, 0.75, 0.1, 0.06, 0.6, 0.06, "#8e9aa6", 0.02, 0, 0, -0.3);
      B.glow(function () { B.box(0.62, 1.0, 0.12, 0.22, 0.14, 0.02, "#ffcf4a", 0.02) });
    },
    stairup: function (c, x, y) {
      var B = c.B;
      for (var k = 0; k < 5; k++) {                 // 5칸 : 한 칸 0.12 씩 뒤로 갈수록 높아짐
        var h = 0.12 * (k + 1), zc = 0.4 - k * 0.2;
        B.box(0, 0, zc, 0.84, h, 0.2, k % 2 ? "#e2d4b8" : "#d8c8aa", 0.01);
        B.box(0, h - 0.015, zc + 0.085, 0.84, 0.02, 0.03, "#b8946a", 0.005);
      }
      // 난간 : 계단 양쪽 끝에 서서, 계단 경사(앞 낮고 뒤 높음)를 그대로 따라 올라갑니다
      // 앞 기둥 꼭대기 0.62 (첫 칸 0.12 + 0.5) · 뒤 기둥 꼭대기 1.1 (마지막 칸 0.6 + 0.5)
      var RL = 0.44, zf = 0.4, zb = -0.4, yf = 0.62, yb = 1.1;
      var ang = Math.atan2(yb - yf, zf - zb), len = Math.hypot(yb - yf, zf - zb) + 0.1;
      for (var s = -1; s <= 1; s += 2) {
        B.box(s * RL, 0, zf, 0.05, yf, 0.05, "#c98b55", 0.02);
        B.box(s * RL, 0, 0, 0.04, (yf + yb) / 2, 0.04, "#d9a06a", 0.015);
        B.box(s * RL, 0, zb, 0.05, yb, 0.05, "#c98b55", 0.02);
        B.boxR(s * RL, (yf + yb) / 2 + 0.02, 0, 0.07, 0.05, len, "#b0703a", 0.02, ang, 0, 0);
        B.ball(s * RL, yf + 0.03, zf, 0.04, 0.04, 0.04, "#f2c14e", 6);
        B.ball(s * RL, yb + 0.03, zb, 0.04, 0.04, 0.04, "#f2c14e", 6);
      }
    },
    stairdown: function (c) {
      var B = c.B;
      B.box(0, -0.7, 0, 1, 0.02, 1, "#5d5244", 0);
      for (var k = 0; k < 4; k++) {
        var top = -0.1 - k * 0.12;
        B.box(0, -0.7, 0.375 - k * 0.25, 0.92, top + 0.7, 0.25, k % 2 ? "#cdbd9f" : "#c2b192", 0.005);
      }
      B.box(-0.49, -0.7, 0, 0.03, 0.7, 1, "#8c7b64", 0);
      B.box(0.49, -0.7, 0, 0.03, 0.7, 1, "#8c7b64", 0);
      B.box(0, -0.7, -0.49, 1, 0.7, 0.03, "#7c6c57", 0);
      B.box(0, -0.7, 0.49, 1, 0.6, 0.03, "#8c7b64", 0);            // 앞쪽 벽 (계단 구멍이 밖으로 비치지 않게)
      // 구멍 둘레의 안전 난간 (양옆과 뒤쪽 · 앞쪽은 내려가는 입구라 비워 둠)
      for (var s = -1; s <= 1; s += 2) {
        B.box(s * 0.46, 0, 0.44, 0.05, 0.55, 0.05, "#c98b55", 0.02);
        B.box(s * 0.46, 0, -0.44, 0.05, 0.55, 0.05, "#c98b55", 0.02);
        B.box(s * 0.46, 0.52, 0, 0.07, 0.05, 0.96, "#b0703a", 0.02);
        B.box(s * 0.46, 0.25, 0, 0.03, 0.03, 0.9, "#d9a06a", 0.01);
      }
      B.box(0, 0.52, -0.44, 0.96, 0.05, 0.07, "#b0703a", 0.02);
      B.box(0, 0.25, -0.44, 0.9, 0.03, 0.03, "#d9a06a", 0.01);
    }
  };

  // ---------- 6과 물건 도우미 ----------
  function atmBox(B, body, top) {                    // ATM · 키오스크 · 표 자판기
    B.box(0, 0, 0, 0.7, 1.4, 0.55, body, 0.05);
    B.box(0, 1.4, 0, 0.72, 0.18, 0.57, top, 0.04);
    B.box(0, 0.86, 0.26, 0.56, 0.46, 0.05, "#24364f", 0.03);
    B.glow(function () { B.box(0, 0.98, 0.29, 0.44, 0.28, 0.01, "#7fe0ff", 0) });
    B.boxR(0, 0.78, 0.33, 0.4, 0.04, 0.16, "#3d4350", 0.01, 0.4, 0, 0);
    for (var i = 0; i < 3; i++) for (var k = 0; k < 3; k++)
      B.boxR(-0.08 + i * 0.08, 0.8, 0.31 + k * 0.045, 0.05, 0.02, 0.03, "#e8ecf0", 0.005, 0.4, 0, 0);
    B.box(0, 0.6, 0.28, 0.3, 0.04, 0.02, "#111317", 0.005);
  }
  function bunk(B, levels, post, sheet, blanket) {   // 기차 침대칸 (2층 · 3층)
    var top = levels[levels.length - 1] + 0.55;
    for (var i = -1; i <= 1; i += 2) for (var k = -1; k <= 1; k += 2) B.box(i * 0.44, 0, k * 0.42, 0.05, top, 0.05, post, 0.01);
    levels.forEach(function (h) {
      B.box(0, h, 0, 0.9, 0.06, 0.86, shade(post, -0.1), 0.02);
      B.box(0, h + 0.06, 0, 0.84, 0.08, 0.8, sheet, 0.03);
      B.box(-0.28, h + 0.14, 0, 0.2, 0.07, 0.5, "#ffffff", 0.03);
      B.box(0.12, h + 0.14, 0, 0.56, 0.05, 0.78, blanket, 0.02);
    });
    for (var r = 0; r < 4; r++) B.box(0.44, 0.25 + r * 0.32, 0.43, 0.05, 0.03, 0.05, post, 0.01);
  }
  function signPole(B) {
    B.cyl(0, 0, 0, 0.16, 0.18, 0.05, "#8e9aa6", 12);
    B.cyl(0, 0.05, 0, 0.032, 0.032, 1.15, "#b8c1c8", 8);
  }
  function kids(B, y, z, s) {                        // 표지판 속 아이 두 명
    for (var k = -1; k <= 1; k += 2) {
      B.ball(k * 0.07 * s, y + 0.02 * s, z, 0.035 * s, 0.035 * s, 0.01, "#1f1a17", 6);
      B.box(k * 0.07 * s, y - 0.17 * s, z, 0.06 * s, 0.15 * s, 0.01, "#1f1a17", 0.005);
    }
  }

  // ---------- 7과 물건 도우미 ----------
  function stoveBase(B) {
    B.box(0, 0, 0, 0.86, 0.55, 0.66, "#8e9aa6", 0.04);
    B.box(0, 0.55, 0, 0.9, 0.06, 0.7, "#5d6875", 0.02);
    B.glow(function () { B.box(0, 0.2, 0.335, 0.3, 0.12, 0.01, "#ff7a2a", 0.02) });
  }
  function stovePot(B, soup, kind) {                 // 솥 + 국자 + 김
    stoveBase(B);
    B.cyl(0, 0.61, 0, 0.36, 0.32, 0.4, "#b8c1c8", 18);
    B.cyl(0, 0.97, 0, 0.33, 0.33, 0.02, soup, 18);
    if (kind === "wonton") for (var k = 0; k < 7; k++) B.ball(Math.cos(k * 0.9) * 0.18, 0.99, Math.sin(k * 0.9) * 0.18, 0.06, 0.03, 0.05, "#fffaf0", 7);
    else for (var j = 0; j < 4; j++) B.cyl(-0.3 + j * 0.2, 0.61, 0.42, 0.05, 0.04, 0.1, "#fffaf0", 8);
    for (var s = -1; s <= 1; s += 2) B.box(s * 0.38, 0.9, 0, 0.06, 0.04, 0.1, "#8e9aa6", 0.01);
    B.boxR(0.15, 1.15, 0.05, 0.03, 0.45, 0.03, "#a8693f", 0.01, 0, 0, -0.5);
    steam(B, 0, 1.05, 0, 4);
  }
  function steam(B, x, y, z, n, col) {               // 모락모락 김
    B.fade(function () {
      for (var k = 0; k < n; k++) B.ball(x + Math.sin(k * 2.1) * 0.12, y + k * 0.16, z + Math.cos(k * 1.7) * 0.08, 0.09 + k * 0.025, 0.07 + k * 0.02, 0.09 + k * 0.025, col || "#ffffff", 7);
    });
  }

  // ---------- 8과 도우미 : 짐 상자 미로 벽 ----------
  function crateHedge(B, cx, cz, x, y) {
    var w = pickc(["#a8743f", "#8a5c38", "#c99a64"], rnd(x, y, 1));
    B.box(cx, 0, cz, 0.94, 0.5, 0.94, w, 0.04);
    B.box(cx, 0.5, cz, 0.94, 0.03, 0.94, shade(w, -0.2), 0.01);
    B.box(cx - 0.18, 0.53, cz + 0.12, 0.5, 0.36, 0.5, shade(w, 0.08), 0.04);
    if (rnd(x, y, 2) < 0.5) B.ball(cx + 0.25, 0.68, cz - 0.2, 0.2, 0.17, 0.2, "#d9c49a", 8);   // 곡식 자루
    else B.cyl(cx + 0.24, 0.53, cz - 0.2, 0.15, 0.12, 0.34, "#8a5530", 10);                    // 항아리
  }
  function songWindow(B, x, y0, z) {                 // 나무 격자 창
    B.box(x, y0 - 0.05, z + 0.02, 0.74, 0.8, 0.05, "#5a2a18", 0.02);
    B.glow(function () { B.box(x, y0, z + 0.05, 0.62, 0.68, 0.02, "#f6e3b4", 0) });
    for (var k = -1; k <= 1; k++) {
      B.box(x + k * 0.16, y0, z + 0.07, 0.025, 0.68, 0.02, "#5a2a18", 0);
      B.box(x, y0 + 0.17 + k * 0.17, z + 0.07, 0.62, 0.025, 0.02, "#5a2a18", 0);
    }
  }

  // 의자 (x, z 위치 · ry 는 의자 등받이 방향)
  function chair(B, x, z, ry, seat) {
    B.push(x, 0, z, ry || 0);
    B.box(0, 0.25, 0, 0.36, 0.05, 0.34, seat || "#9fd3a4", 0.02);
    B.box(0, 0.3, -0.16, 0.36, 0.3, 0.04, seat || "#9fd3a4", 0.02);
    for (var i = -1; i <= 1; i += 2) for (var k = -1; k <= 1; k += 2)
      B.box(i * 0.15, 0, k * 0.13, 0.03, 0.25, 0.03, METAL, 0.01);
    B.pop();
  }
  // 벽에 거는 칠판
  function wallBoard(B, w) {
    B.box(0, 0.7, -0.4, w * 0.96, 0.9, 0.06, "#b07d4f", 0.02);
    B.box(0, 0.76, -0.365, w * 0.9, 0.78, 0.02, "#3f7a5a", 0.01);
    B.box(0, 0.7, -0.33, w * 0.9, 0.04, 0.08, "#b07d4f", 0.01);
  }
  // 현관 유리문 (건물 속으로 들어간 현관 · 벽에 붙은 현관)
  function entrance(c, x, y) {
    var B = c.B, S = c.S, wallish = c.wallish;
    var inLine = wallish(x - 1, y) && wallish(x + 1, y) && wallish(x, y - 1);
    var rot = 0;
    if (!inLine) rot = wallish(x, y - 1) ? 0 : wallish(x - 1, y) ? Math.PI / 2 : wallish(x + 1, y) ? -Math.PI / 2 : 0;
    B.push(0, 0, 0, rot);                            // 이미 칸 가운데로 옮겨진 상태에서 방향만 돌립니다
    if (!inLine && !c.outdoor && rot !== 0) { sideEntrance(c); B.pop(); return }
    var zd = -0.42;
    if (inLine) {
      var H = c.outdoor ? BUILD_H : WALL_H, wc = c.outdoor ? S.bWall : S.wall;
      B.box(0, 1.95, 0, 1, H - 1.95, 1, wc, 0);
      if (c.outdoor) {
        B.box(0, H, 0, 1.06, 0.2, 1.06, S.bRoof, 0.03);
        B.box(0, 0, 0, 1, 0.4, 0.2, S.bBase, 0);
        if (S.song) {                                                      // 천 차양 + 현판
          B.boxR(0, 2.0, 0.75, 1.5, 0.04, 0.7, S.awning || "#c9a46a", 0.02, 0.25, 0, 0);
          for (var a2 = -1; a2 <= 1; a2 += 2) B.cyl(a2 * 0.7, 0, 1.05, 0.03, 0.03, 1.95, "#6b4a33", 6);
          B.box(0, 2.45, 0.52, 0.9, 0.3, 0.06, "#2f2a26", 0.02);
          B.glow(function () { B.box(0, 2.49, 0.555, 0.78, 0.2, 0.01, "#e8c35a", 0) });
        } else {
        B.box(0, 1.9, 0.62, 1.4, 0.08, 0.5, "#ef7f6a", 0.03);             // 차양
        for (var k = 0; k < 4; k++) B.box(-0.525 + k * 0.35, 1.9, 0.875, 0.175, 0.1, 0.04, k % 2 ? "#ef7f6a" : "#fffaf0", 0.01);
        B.cylR(0, 2.72, 0.53, 0.3, 0.3, 0.07, "#ffffff", 22, Math.PI / 2, 0, 0);   // 건물 시계
        B.cylR(0, 2.72, 0.57, 0.25, 0.25, 0.02, "#fffaf0", 22, Math.PI / 2, 0, 0);
        B.boxR(0, 2.79, 0.59, 0.025, 0.15, 0.01, "#3b2f2a", 0, 0, 0, 0);
        B.boxR(0.05, 2.72, 0.59, 0.11, 0.025, 0.01, "#3b2f2a", 0, 0, 0, 0.5);
        }
      } else {
        B.box(0, H, 0, 1, 0.05, 1, S.cap, 0);
      }
      zd = -0.3;
    }
    if (S.song) {                                    // 활짝 열린 나무 문 + 어두운 가게 안
      B.box(-0.46, 0, zd, 0.08, 1.9, 0.12, "#5a2a18", 0.02);
      B.box(0.46, 0, zd, 0.08, 1.9, 0.12, "#5a2a18", 0.02);
      B.box(0, 1.84, zd, 1, 0.1, 0.14, "#5a2a18", 0.02);
      B.box(0, 0.02, zd - 0.06, 0.86, 1.8, 0.02, "#3a2a20", 0);
      B.glow(function () { B.box(0, 1.3, zd - 0.04, 0.5, 0.3, 0.01, "#f6c66a", 0) });
      for (var d2 = -1; d2 <= 1; d2 += 2) B.boxR(d2 * 0.5, 0.02, zd + 0.2, 0.04, 1.78, 0.4, "#7a3b22", 0.01, 0, d2 * 0.9, 0);
      B.box(0, 0, zd + 0.42, 0.9, 0.025, 0.5, "#8a7a66", 0.02);
      B.pop();
      return;
    }
    // 문틀
    B.box(-0.46, 0, zd, 0.08, 1.9, 0.12, "#f4f1ea", 0.02);
    B.box(0.46, 0, zd, 0.08, 1.9, 0.12, "#f4f1ea", 0.02);
    B.box(0, 1.84, zd, 1, 0.1, 0.14, "#f4f1ea", 0.02);
    B.box(0, 0.86, zd, 0.04, 0.96, 0.1, "#f4f1ea", 0.01);
    B.glow(function () { B.box(0, 0.02, zd - 0.06, 0.86, 1.8, 0.02, "#d6effa", 0) });
    B.glass(function () {
      B.box(-0.22, 0.02, zd, 0.4, 1.8, 0.04, "#aee0f7", 0);
      B.box(0.22, 0.02, zd, 0.4, 1.8, 0.04, "#aee0f7", 0);
    });
    B.box(-0.06, 0.7, zd + 0.05, 0.03, 0.4, 0.03, "#c9a227", 0.01);
    B.box(0.06, 0.7, zd + 0.05, 0.03, 0.4, 0.03, "#c9a227", 0.01);
    B.box(0, 0, zd + 0.42, 0.9, 0.025, 0.5, "#b26d4e", 0.02);           // 발판
    B.box(0, 0.025, zd + 0.42, 0.78, 0.005, 0.38, "#d9906e", 0.01);
    B.pop();
  }

  // 복도 끝 옆벽의 정문 출구 : 크고 밝은 유리 현관 + 초록 출구 표지 + 바닥 화살표
  // (이 함수 안에서 +z 가 복도 쪽, -z 쪽 0.5 에 벽이 있습니다)
  function sideEntrance(c) {
    var B = c.B, S = c.S, zw = -0.5, W2 = 0.74, HH = 2.08;
    // 밖에서 들어오는 햇살 (유리 너머로 하늘 · 잔디 · 나무가 보임)
    B.glow(function () {
      B.box(0, 0, zw + 0.012, W2 * 2 - 0.16, HH, 0.01, "#bfeaff", 0);
      B.box(0, 0, zw + 0.016, W2 * 2 - 0.16, 0.42, 0.01, "#8fd06a", 0);
      B.box(-0.34, 0.42, zw + 0.02, 0.36, 0.5, 0.01, "#6cbf5c", 0.1);
      B.box(0.38, 0.42, zw + 0.02, 0.3, 0.36, 0.01, "#79c966", 0.1);
      B.box(0.1, 1.55, zw + 0.02, 0.42, 0.14, 0.01, "#ffffff", 0.06);
    });
    // 두꺼운 흰 문틀과 윗부분 유리창
    B.box(-W2, 0, zw + 0.06, 0.14, HH + 0.12, 0.14, "#fdfaf2", 0.03);
    B.box(W2, 0, zw + 0.06, 0.14, HH + 0.12, 0.14, "#fdfaf2", 0.03);
    B.box(0, HH, zw + 0.06, W2 * 2 + 0.14, 0.16, 0.16, "#fdfaf2", 0.03);
    B.box(0, 1.62, zw + 0.06, W2 * 2, 0.07, 0.1, "#fdfaf2", 0.01);
    // 자동문은 양옆으로 열려 있고, 윗부분만 유리창
    B.glass(function () { B.box(0, 1.69, zw + 0.06, W2 * 2 - 0.1, 0.36, 0.03, "#cfeeff", 0) });
    B.box(-W2 + 0.12, 0, zw + 0.06, 0.1, 1.62, 0.08, "#dfe8ec", 0.01);    // 열린 문짝 가장자리
    B.box(W2 - 0.12, 0, zw + 0.06, 0.1, 1.62, 0.08, "#dfe8ec", 0.01);
    B.box(0, 0, zw + 0.06, W2 * 2, 0.03, 0.14, "#c9d3d8", 0.01);          // 문턱 레일
    // 문 위 초록 출구 표지 (빛남) : 흰 화살표가 밖(벽 쪽)을 가리킵니다
    B.box(0, HH + 0.2, zw + 0.1, 0.9, 0.36, 0.1, "#2f8a4a", 0.03);
    B.glow(function () {
      B.box(0, HH + 0.23, zw + 0.16, 0.82, 0.3, 0.02, "#46c26a", 0.02);
      // 흰 문 그림 + 걸어 나가는 사람
      B.box(-0.2, HH + 0.27, zw + 0.18, 0.04, 0.22, 0.01, "#ffffff", 0);
      B.box(0.02, HH + 0.27, zw + 0.18, 0.04, 0.22, 0.01, "#ffffff", 0);
      B.box(-0.09, HH + 0.47, zw + 0.18, 0.26, 0.04, 0.01, "#ffffff", 0);
      B.ball(0.2, HH + 0.45, zw + 0.18, 0.035, 0.035, 0.01, "#ffffff", 6);
      B.boxR(0.2, HH + 0.36, zw + 0.18, 0.04, 0.12, 0.01, "#ffffff", 0, 0, 0, -0.3);
      B.boxR(0.17, HH + 0.28, zw + 0.18, 0.035, 0.1, 0.01, "#ffffff", 0, 0, 0, 0.5);
      B.boxR(0.25, HH + 0.28, zw + 0.18, 0.035, 0.1, 0.01, "#ffffff", 0, 0, 0, -0.5);
    });
    // 바닥 : 현관 매트 + 밖을 가리키는 큰 화살표 + 햇살 자국
    B.box(0, 0, zw + 0.55, 1.3, 0.03, 0.8, "#b26d4e", 0.03);
    B.box(0, 0.03, zw + 0.55, 1.16, 0.006, 0.66, "#d9906e", 0.02);
    B.box(0, 0.037, zw + 0.62, 0.14, 0.006, 0.42, "#fffaf0", 0.01);
    B.boxR(-0.1, 0.04, zw + 0.36, 0.26, 0.008, 0.08, "#fffaf0", 0.01, 0, 0.8, 0);
    B.boxR(0.1, 0.04, zw + 0.36, 0.26, 0.008, 0.08, "#fffaf0", 0.01, 0, -0.8, 0);
    B.glass(function () { B.floor(0, 0.012, zw + 1.35, 1.4, 0.9, "#fff1a8") });
    // 양옆 화분 (벽에 바짝 붙여 길을 막지 않게)
    for (var k = -1; k <= 1; k += 2) {
      B.cyl(k * 1.02, 0, zw + 0.16, 0.12, 0.09, 0.26, "#e0845a", 10);
      B.ball(k * 1.02, 0.4, zw + 0.16, 0.17, 0.2, 0.17, "#5fbf6a", 8);
      B.ball(k * 1.02 + 0.06, 0.55, zw + 0.14, 0.1, 0.12, 0.1, "#72cf7a", 7);
    }
  }

  // ================================================================
  //  7. 여러 칸짜리 가구  — n = 칸 수, 가운데를 기준으로 좌우로 펼칩니다
  // ================================================================
  var RUN = {
    cboard: function (c, n) {                        // 바퀴 달린 칠판
      var B = c.B, w = n * 0.96;
      for (var s = -1; s <= 1; s += 2) {
        B.box(s * w / 2, 0.06, 0, 0.07, 1.34, 0.07, "#9aa6b0", 0.02);
        B.box(s * w / 2, 0.03, 0, 0.08, 0.04, 0.44, "#9aa6b0", 0.015);
        B.ball(s * w / 2, 0.035, 0.18, 0.035, 0.035, 0.035, DARK, 6);
        B.ball(s * w / 2, 0.035, -0.18, 0.035, 0.035, 0.035, DARK, 6);
      }
      B.box(0, 0.5, 0, w - 0.08, 0.86, 0.07, "#b07d4f", 0.02);
      B.box(0, 0.55, 0, w - 0.18, 0.76, 0.09, "#3f7a5a", 0.01);
      B.box(0, 0.48, 0.07, w - 0.16, 0.035, 0.08, "#b07d4f", 0.01);
      B.box(-0.2, 0.52, 0.09, 0.08, 0.02, 0.02, "#fffdf5", 0.005);
      B.box(0.1, 0.52, 0.09, 0.06, 0.02, 0.02, "#ffd1dc", 0.005);
      // 분필 글씨처럼 보이는 줄
      B.box(-w * 0.2, 1.08, 0.05, w * 0.34, 0.025, 0.005, "#e8f3ec", 0);
      B.box(-w * 0.24, 0.98, 0.05, w * 0.26, 0.025, 0.005, "#e8f3ec", 0);
      B.box(-w * 0.18, 0.88, 0.05, w * 0.3, 0.025, 0.005, "#e8f3ec", 0);
      B.box(w * 0.22, 1.0, 0.05, 0.28, 0.28, 0.005, "#e8f3ec", 0.02);
      B.box(w * 0.22, 1.0, 0.052, 0.22, 0.22, 0.005, "#3f7a5a", 0.02);
      B.box(0, 0.5, -0.05, w - 0.18, 0.86, 0.01, "#3a6f52", 0);
    },
    podium: function (c, n) {                        // 교탁
      var B = c.B, w = n * 0.82;
      B.box(0, 0, 0, w, 0.74, 0.5, "#c28d5c", 0.04);
      B.box(0, 0.74, 0, w + 0.08, 0.06, 0.58, "#dcaa76", 0.03);
      B.box(0, 0.1, 0.25, w - 0.16, 0.54, 0.02, "#b07d4f", 0.02);
      B.cylR(0, 0.42, 0.27, 0.1, 0.1, 0.02, "#ffcf4a", 18, Math.PI / 2, 0, 0);
      B.box(-w * 0.25, 0.8, 0.02, 0.3, 0.05, 0.22, "#5fa8d3", 0.01);
      B.cyl(w * 0.3, 0.8, -0.05, 0.05, 0.045, 0.1, "#ff8fa3", 10);
    },
    counter: function (c, n) {                       // 도서관 대출대
      var B = c.B, w = n * 0.98;
      B.box(0, 0, 0, w, 0.78, 0.6, "#c99a6c", 0.04);
      B.box(0, 0.78, 0, w + 0.06, 0.06, 0.66, "#e6c596", 0.03);
      B.box(0, 0.08, 0.3, w - 0.12, 0.6, 0.02, "#b3855a", 0.02);
      B.box(-w * 0.28, 0.84, -0.08, 0.36, 0.26, 0.05, "#3d4350", 0.02);
      B.glow(function () { B.box(-w * 0.28, 0.87, -0.05, 0.3, 0.19, 0.01, "#c9ecff", 0) });
      B.box(w * 0.05, 0.84, 0.06, 0.24, 0.1, 0.3, "#ef6f6c", 0.01);
      B.box(w * 0.05, 0.94, 0.06, 0.22, 0.08, 0.28, "#5fa8d3", 0.01);
      B.ball(w * 0.32, 0.87, 0.12, 0.07, 0.04, 0.07, "#f2c14e", 8);           // 호출 벨
      B.cyl(w * 0.32, 0.84, 0.12, 0.08, 0.08, 0.02, "#6b4a33", 10);
    },
    locker: function (c, n, x, y) {                  // 사물함
      var B = c.B, w = n * 0.96, col = c.S.locker, cnt = n * 2;
      B.box(0, 0, 0, w, 1.45, 0.46, col, 0.04);
      for (var k = 0; k < cnt; k++) {
        var lx = -w / 2 + (k + 0.5) * (w / cnt);
        for (var r = 0; r < 2; r++) {
          B.box(lx, 0.08 + r * 0.68, 0.23, w / cnt - 0.05, 0.62, 0.02, shade(col, 0.12), 0.02);
          B.box(lx + 0.08, 0.34 + r * 0.68, 0.25, 0.03, 0.1, 0.03, "#5b6b76", 0.01);
          B.box(lx, 0.6 + r * 0.68, 0.245, 0.12, 0.04, 0.005, "#fffaf0", 0);
        }
      }
      B.box(-w * 0.2, 1.45, 0, 0.3, 0.2, 0.3, "#f7c873", 0.03);
      B.ball(w * 0.25, 1.53, 0, 0.1, 0.08, 0.1, "#ff7f7f", 8);
    },
    stage: function (c, n) {                         // 운동장 구령대
      var B = c.B, w = n * 1.0;
      B.box(0, 0, -0.05, w, 0.46, 0.9, "#e3d2ae", 0.05);
      B.box(0, 0.46, -0.05, w + 0.06, 0.05, 0.96, "#c9a978", 0.03);
      B.box(0, 0, 0.5, 0.5, 0.15, 0.2, "#d6c29c", 0.03);
      B.box(0, 0.15, 0.45, 0.5, 0.15, 0.1, "#d6c29c", 0.03);
      B.box(0, 0.12, 0.41, w - 0.1, 0.22, 0.01, "#6fb3e0", 0.01);
      B.cyl(w / 2 - 0.2, 0.51, -0.3, 0.02, 0.02, 1.3, "#b8c1c8", 8);            // 깃대
      B.boxR(w / 2 - 0.02, 1.62, -0.3, 0.34, 0.22, 0.01, "#ff7f7f", 0.01, 0, 0, 0);
      B.cyl(-0.2, 0.51, -0.1, 0.012, 0.012, 0.5, DARK, 6);                      // 마이크
      B.ball(-0.2, 1.04, -0.1, 0.035, 0.05, 0.035, DARK, 6);
    },
    piano: function (c, n) {                         // 업라이트 피아노
      var B = c.B, w = n * 0.88;
      B.box(0, 0, -0.1, w, 1.08, 0.44, "#3a2e3b", 0.05);
      B.box(0, 1.08, -0.1, w + 0.04, 0.05, 0.48, "#2c222d", 0.03);
      B.box(0, 0.6, 0.14, w - 0.04, 0.08, 0.24, "#3a2e3b", 0.02);
      B.box(0, 0.68, 0.16, w - 0.14, 0.03, 0.18, "#fffdf8", 0.005);
      var keys = Math.floor((w - 0.16) / 0.07);
      for (var k = 0; k < keys; k++) {
        if (k % 7 === 2 || k % 7 === 6) continue;
        B.box(-w / 2 + 0.1 + k * 0.07 + 0.035, 0.705, 0.12, 0.035, 0.03, 0.1, "#2c222d", 0.004);
      }
      B.box(0, 0.8, -0.13, w - 0.2, 0.2, 0.39, "#4a3c4b", 0.02);
      B.box(0, 0.86, 0.1, 0.4, 0.2, 0.01, "#fffdf5", 0.005);
      B.box(0, 0, 0.14, 0.12, 0.06, 0.2, "#c9a227", 0.02);
      B.box(0, 0.34, 0.66, 0.7, 0.07, 0.3, "#3a2e3b", 0.03);                  // 의자
      B.box(0, 0.37, 0.66, 0.64, 0.05, 0.26, "#d9534f", 0.02);
      for (var i = -1; i <= 1; i += 2) for (var j = -1; j <= 1; j += 2)
        B.box(i * 0.3, 0, 0.66 + j * 0.11, 0.04, 0.34, 0.04, "#2c222d", 0.01);
    },
    labtable: function (c, n, x, y) {               // 실험대
      var B = c.B, w = n * 0.96;
      B.box(0, 0, 0, w - 0.06, 0.68, 0.74, "#5a6975", 0.04);
      B.box(0, 0.68, 0, w, 0.07, 0.82, "#f3f6f8", 0.03);
      B.box(-w * 0.28, 0.72, 0, 0.36, 0.04, 0.36, "#3d4a55", 0.02);           // 싱크대
      B.cyl(-w * 0.28, 0.75, -0.24, 0.02, 0.02, 0.24, "#c7cfd6", 8);
      B.boxR(-w * 0.28, 0.99, -0.17, 0.02, 0.02, 0.16, "#c7cfd6", 0.005, 0, 0, 0);
      B.glow(function () {
        B.cyl(w * 0.05, 0.75, 0.05, 0.02, 0.1, 0.16, "#7af0c1", 12);            // 삼각 플라스크
        B.cyl(w * 0.18, 0.75, -0.1, 0.05, 0.05, 0.18, "#ff9fcf", 12);           // 비커
        B.cyl(w * 0.32, 0.75, 0.12, 0.03, 0.03, 0.2, "#ffe066", 10);            // 시험관
        B.cyl(w * 0.38, 0.75, 0.12, 0.03, 0.03, 0.18, "#8fc9ff", 10);
      });
      B.cyl(w * 0.05, 0.91, 0.05, 0.022, 0.022, 0.06, "#e8f6fb", 8);
      B.box(w * 0.35, 0.75, 0.12, 0.18, 0.03, 0.08, "#b8946a", 0.01);
      for (var k = 0; k < n * 2; k++) B.box(-w / 2 + 0.26 + k * 0.46, 0.08, 0.375, 0.34, 0.5, 0.01, "#6b7b88", 0.02);
    },
    mixer: function (c, n, x, y) {                  // 방송 믹서 책상
      var B = c.B, w = n * 0.96;
      B.box(0, 0, 0, w, 0.7, 0.62, "#4b5160", 0.04);
      B.boxR(0, 0.78, 0.02, w - 0.02, 0.1, 0.6, "#394050", 0.03, 0.2, 0, 0);
      for (var k = 0; k < n * 6; k++) {
        var mx = -w / 2 + 0.16 + k * ((w - 0.32) / (n * 6 - 1));
        B.boxR(mx, 0.84, 0.05, 0.02, 0.02, 0.36, "#1f242d", 0, 0.2, 0, 0);
        B.boxR(mx, 0.855, 0.05 + (rnd(x + k, y, 1) - 0.5) * 0.28, 0.05, 0.04, 0.035, "#e8ecf0", 0.01, 0.2, 0, 0);
        B.glow(function () { B.boxR(mx, 0.87, -0.2, 0.025, 0.02, 0.02, k % 3 ? "#6bff9e" : "#ffd66b", 0, 0.2, 0, 0) });
      }
      B.cyl(w * 0.35, 0.85, -0.2, 0.012, 0.012, 0.36, "#9aa4ac", 6);           // 마이크
      B.ball(w * 0.35, 1.23, -0.2, 0.05, 0.07, 0.05, "#2c323c", 8);
      B.glow(function () { B.box(-w * 0.3, 1.1, -0.28, 0.4, 0.14, 0.03, "#ff4d5e", 0.02) });  // 방송 중 등
      B.box(-w * 0.3, 0.85, -0.28, 0.03, 0.25, 0.03, "#9aa4ac", 0.01);
    },
    bus: function (c, n) {                           // 公交车 버스 (초록 시내버스)
      var B = c.B, w = n * 0.98, col = "#3fae5a";
      B.box(0, 0.2, 0, w, 0.66, 0.92, col, 0.1);
      B.glass(function () { B.box(0, 0.86, 0, w - 0.06, 0.5, 0.9, "#cfeeff", 0.02) });
      var cnt = Math.max(3, Math.round(w / 0.8));
      for (var k = 0; k <= cnt; k++) B.box(-w / 2 + 0.04 + k * ((w - 0.08) / cnt), 0.86, 0, 0.07, 0.5, 0.92, col, 0.01);
      B.box(0, 1.36, 0, w, 0.16, 0.92, col, 0.08);
      B.box(0, 1.5, 0, w - 0.4, 0.06, 0.6, "#e8f6ee", 0.02);
      B.box(0, 0.5, 0.465, w, 0.07, 0.01, "#ffffff", 0);
      for (var i = -1; i <= 1; i += 2) for (var s = -1; s <= 1; s += 2) {
        B.cylR(i * (w / 2 - 0.85), 0.22, s * 0.42, 0.22, 0.22, 0.12, DARK, 14, Math.PI / 2, 0, 0);
        B.cylR(i * (w / 2 - 0.85), 0.22, s * 0.49, 0.1, 0.1, 0.02, "#c7cfd6", 10, Math.PI / 2, 0, 0);
      }
      var dx = w / 2 - 1.6;                            // 앞문 · 뒷문
      [dx, -dx + 0.3].forEach(function (d) {
        B.box(d, 0.22, 0.466, 0.56, 1.12, 0.02, "#2a4a3a", 0.02);
        B.glow(function () { B.box(d, 0.62, 0.478, 0.48, 0.66, 0.005, "#bfe7ff", 0) });
      });
      B.glass(function () { B.box(w / 2 + 0.005, 0.8, 0, 0.02, 0.56, 0.8, "#bfe7ff", 0) });
      B.glow(function () {
        B.box(w / 2 + 0.01, 1.38, 0, 0.02, 0.12, 0.6, "#ffcf4a", 0);
        for (var s2 = -1; s2 <= 1; s2 += 2) B.ball(w / 2 + 0.01, 0.42, s2 * 0.32, 0.06, 0.06, 0.03, "#fff6c2", 8);
      });
    },
    plane: function (c, n) {                         // 飞机 비행기
      var B = c.B, w = n * 0.98, wh = "#fbfcfe", st = "#2f6fb3";
      var f0 = -w / 2 + 0.8, f1 = w / 2 - 0.45, fc = (f0 + f1) / 2, fl = f1 - f0;
      B.cylR(fc, 0.95, 0, 0.42, 0.42, fl, wh, 16, 0, 0, Math.PI / 2);
      B.ball(f1, 0.95, 0, 0.45, 0.42, 0.42, wh, 14);
      B.cylR(-w / 2 + 0.4, 1.05, 0, 0.12, 0.42, 0.8, wh, 14, 0, 0, Math.PI / 2);
      B.glow(function () { B.boxR(f1 + 0.2, 1.12, 0, 0.12, 0.1, 0.5, "#3a5a7a", 0.02, 0, 0, -0.5) });
      B.cylR(fc, 0.78, 0, 0.425, 0.425, fl, st, 16, 0, 0, Math.PI / 2);
      B.cylR(fc, 1.0, 0, 0.428, 0.428, fl - 0.2, wh, 16, 0, 0, Math.PI / 2);
      for (var k = 0; k < Math.floor(fl / 0.32); k++) for (var s = -1; s <= 1; s += 2)
        B.box(f0 + 0.3 + k * 0.32, 1.02, s * 0.405, 0.12, 0.13, 0.03, "#3a5a7a", 0.02);
      B.boxR(-w / 2 + 0.35, 1.62, 0, 0.6, 0.8, 0.06, "#e8443a", 0.03, 0, 0, -0.4);
      B.box(-w / 2 + 0.35, 1.08, 0, 0.42, 0.05, 0.86, "#dfe6ec", 0.02);
      B.box(fc + 0.2, 0.68, 0, 1.1, 0.07, 2.9, "#dfe6ec", 0.03);
      for (var e = -1; e <= 1; e += 2) {
        B.cylR(fc + 0.45, 0.52, e * 0.95, 0.17, 0.15, 0.6, "#b8c1c8", 12, 0, 0, Math.PI / 2);
        B.cylR(fc + 0.76, 0.52, e * 0.95, 0.12, 0.12, 0.02, "#2f3540", 12, 0, 0, Math.PI / 2);
        B.cyl(fc, 0, e * 0.3, 0.03, 0.03, 0.55, METAL, 6);
        B.cylR(fc, 0.1, e * 0.3, 0.1, 0.1, 0.08, DARK, 10, Math.PI / 2, 0, 0);
      }
      B.cyl(f1 - 0.2, 0, 0, 0.03, 0.03, 0.55, METAL, 6);
      B.cylR(f1 - 0.2, 0.09, 0, 0.09, 0.09, 0.07, DARK, 10, Math.PI / 2, 0, 0);
    },
    seats: function (c, n) {                         // 대합실 · 대기 의자 줄
      var B = c.B, w = n * 0.96, col = c.S.sofa;
      B.box(0, 0.26, -0.02, w, 0.05, 0.1, "#8e9aa6", 0.01);
      for (var j = 0; j <= n; j++) B.box(-w / 2 + 0.05 + j * ((w - 0.1) / n), 0, -0.02, 0.05, 0.27, 0.3, "#8e9aa6", 0.01);
      for (var k = 0; k < n * 2; k++) {
        var sx = -w / 2 + (k + 0.5) * (w / (n * 2));
        B.box(sx, 0.31, 0.02, w / (n * 2) - 0.05, 0.06, 0.4, col, 0.02);
        B.boxR(sx, 0.6, -0.17, w / (n * 2) - 0.05, 0.42, 0.06, col, 0.02, -0.12, 0, 0);
      }
    },
    trophy: function (c, n, x, y) {                  // 상장 · 트로피 진열장
      var B = c.B, w = n * 0.96;
      hollow(B, w, 1.34, 0.46, -0.05, "#b07d4f", "#f7ecd6");
      for (var s = 0; s < 2; s++) {
        var y0 = 0.1 + s * 0.6;
        B.box(0, y0 - 0.03, -0.02, w - 0.1, 0.03, 0.38, "#d9b98a", 0);
        for (var k = 0; k < n * 2; k++) {
          var tx = -w / 2 + 0.25 + k * ((w - 0.5) / Math.max(1, n * 2 - 1));
          var gold = (k + s) % 3 === 2 ? "#cfd6dc" : "#f2c14e";
          B.box(tx, y0, 0.02, 0.12, 0.06, 0.1, "#6b4a33", 0.01);
          B.cyl(tx, y0 + 0.06, 0.02, 0.018, 0.018, 0.12, gold, 8);
          B.cyl(tx, y0 + 0.18, 0.02, 0.09, 0.04, 0.14, gold, 12);
          B.ring(tx - 0.09, y0 + 0.26, 0.02, 0.035, 0.01, gold, 0, 0, 0);
          B.ring(tx + 0.09, y0 + 0.26, 0.02, 0.035, 0.01, gold, 0, 0, 0);
        }
      }
      B.glass(function () { B.box(0, 0.06, 0.18, w - 0.1, 1.2, 0.02, "#e8f6ff", 0) });
    },
    sofa: function (c, n) {                          // 소파
      var B = c.B, w = n * 0.94, col = c.S.sofa;
      B.box(0, 0.06, 0, w, 0.26, 0.7, shade(col, -0.1), 0.08);
      B.box(0, 0.3, -0.25, w, 0.46, 0.22, col, 0.1);
      for (var s = -1; s <= 1; s += 2) B.box(s * (w / 2 - 0.08), 0.06, 0, 0.18, 0.46, 0.7, col, 0.08);
      for (var k = 0; k < n; k++) B.box(-w / 2 + 0.47 * 0 + (k + 0.5) * (w / n), 0.3, 0.06, w / n - 0.2, 0.12, 0.5, shade(col, 0.12), 0.06);
      B.box(-w * 0.25, 0.42, -0.1, 0.24, 0.24, 0.1, "#fff4dc", 0.08);
      for (var i = -1; i <= 1; i += 2) B.box(i * (w / 2 - 0.1), 0, 0.28, 0.05, 0.06, 0.05, "#6b4a33", 0.01);
    },
    notice: function (c, n, x, y) {                  // 게시판
      var B = c.B, w = n * 0.98;
      for (var s = -1; s <= 1; s += 2) B.box(s * (w / 2 - 0.08), 0, 0, 0.08, 1.3, 0.08, "#9a6a43", 0.02);
      B.box(0, 0.38, 0, w, 0.92, 0.07, "#9a6a43", 0.02);
      B.box(0, 0.44, 0.02, w - 0.12, 0.8, 0.05, "#d9a066", 0.01);
      B.boxR(0, 1.38, 0, w + 0.1, 0.07, 0.24, "#c96f5a", 0.02, 0, 0, 0);       // 작은 지붕
      var cols = ["#fffdf5", "#ffe3ec", "#fff4b0", "#dff2ff", "#e3ffe3"];
      for (var k = 0; k < n * 2; k++) {
        var px = -w / 2 + 0.3 + k * ((w - 0.6) / Math.max(1, n * 2 - 1));
        var py = 0.62 + rnd(x + k, y, 1) * 0.35;
        B.boxR(px, py + 0.12, 0.055, 0.26, 0.3, 0.01, pickc(cols, rnd(x + k, y, 2)), 0.005, 0, 0, (rnd(x + k, y, 3) - 0.5) * 0.25);
        B.ball(px, py + 0.25, 0.065, 0.025, 0.025, 0.015, pickc(["#ff6b6b", "#4dabf7", "#ffd23f"], rnd(x + k, y, 4)), 5);
      }
    }
  };

  // ================================================================
  //  8. 캐릭터 : 주인공은 머리 큰 아이, 학교 사람들은 귀여운 동물 친구들
  //     game.js 의 skin 이름마다 동물 · 옷 색 · 소품을 정합니다.
  // ================================================================
  var UNI = "#3f5687", UNI2 = "#fffaf0";
  var LOOKS = {
    player:    { kind: "human", skin: "#f7d3b1", hair: "#3b2a22", shirt: "#3f8fd6", pants: "#2f3f66", shoes: "#8a5a3c", tool: "syringe" },
    // 🧟 좀비 : 초록빛 피부 · 해진 옷 · 앞으로 내민 팔 (animChar 에서 zombie 옵션으로 자세를 잡습니다)
    zombie:    { kind: "human", zombie: true, skin: "#a3c98d", hair: "#3f4a30", shirt: "#7f8f6b", pants: "#4d4660", shoes: "#3b3333" },
    teacher:   { kind: "bear", fur: "#b98253", fur2: "#f0d6ad", ears: "round", snout: "muzzle", shirt: "#a9d2ee", pants: "#55607a", acc: ["tie"], tie: "#e0605a" },
    teacher2:  { kind: "cat", fur: "#f5deb6", fur2: "#fff6e6", ears: "pointy", snout: "cat", shirt: "#ef8fab", pants: "#6d5b7a", acc: ["collar"], tail: "thin" },
    teacher3:  { kind: "dog", fur: "#dba56d", fur2: "#fff0da", ears: "floppy", earCol: "#a8703a", snout: "muzzle", shirt: "#4cb56c", pants: "#2f4a3a", acc: ["cap", "whistle"], cap: "#e0605a" },
    teacher4:  { kind: "rabbit", fur: "#faf6f1", fur2: "#ffffff", ears: "long", snout: "cat", shirt: "#b8a2e0", pants: "#5a5070", acc: ["glasses"], tail: "ball" },
    student1:  { kind: "frog", fur: "#90d36b", fur2: "#d9f5b5", ears: "none", snout: "frog", shirt: UNI, pants: "#34466f", acc: ["collar", "tie"], tie: "#e0605a" },
    student2:  { kind: "penguin", fur: "#3d4556", fur2: "#ffffff", ears: "none", snout: "beak", shirt: UNI, pants: "#34466f", acc: ["collar", "tie"], tie: "#f2b134" },
    student3:  { kind: "hamster", fur: "#f3b56b", fur2: "#fff4e3", ears: "small", snout: "cat", shirt: UNI, pants: "#7a5a4a", acc: ["collar", "ribbon"], ribbon: "#ff6f8f" },
    student4:  { kind: "duck", fur: "#fffaf0", fur2: "#ffffff", ears: "none", snout: "bill", shirt: UNI, pants: "#34466f", acc: ["collar", "tie"], tie: "#4dabf7" },
    student5:  { kind: "koala", fur: "#aeb4bf", fur2: "#e8ebf0", ears: "fluffy", snout: "koala", shirt: UNI, pants: "#7a5a4a", acc: ["collar", "ribbon"], ribbon: "#ffcf4a" },
    student6:  { kind: "fox", fur: "#f08c3c", fur2: "#fff6ea", ears: "pointy", snout: "muzzle", shirt: UNI, pants: "#34466f", acc: ["collar", "tie"], tie: "#e0605a", tail: "bushy" },
    student7:  { kind: "panda", fur: "#ffffff", fur2: "#ffffff", ears: "round", earCol: "#2f2f38", snout: "muzzle", patch: "#2f2f38", shirt: UNI, pants: "#7a5a4a", acc: ["collar", "ribbon"], ribbon: "#8fd3f5" },
    janitor:   { kind: "hippo", fur: "#b3a4cf", fur2: "#d9cfee", ears: "small", snout: "hippo", shirt: "#6f93b0", pants: "#4a5f73", acc: ["cap"], cap: "#34466f" },
    principal: { kind: "elephant", fur: "#a9bcd2", fur2: "#c8d6e6", ears: "big", snout: "trunk", shirt: "#6b5a82", pants: "#3f3550", acc: ["tie", "glasses"], tie: "#ffcf4a" },
    nurse:     { kind: "sheep", fur: "#fff3e0", fur2: "#fffaf2", ears: "small", snout: "cat", shirt: "#ffffff", pants: "#f3a7b8", acc: ["nursecap", "wool"] },
    cook:      { kind: "pig", fur: "#f7b1bf", fur2: "#ffd2da", ears: "pointy", snout: "pig", shirt: "#ffffff", pants: "#8a8f99", acc: ["chef", "apron"] },
    // 🐼 대나무를 들고 재롱떠는 판다 (팔·다리는 검정 · 손에 대나무)
    panda1:    { kind: "panda", fur: "#ffffff", fur2: "#ffffff", ears: "round", earCol: "#2f2f38", snout: "muzzle", patch: "#2f2f38",
                 shirt: "#ffffff", sleeve: "#2f2f38", hand: "#2f2f38", pants: "#2f2f38", acc: ["bamboo"], fun: true },
    panda2:    { kind: "panda", fur: "#fffaf0", fur2: "#ffffff", ears: "round", earCol: "#2f2f38", snout: "muzzle", patch: "#2f2f38",
                 shirt: "#fffaf0", sleeve: "#2f2f38", hand: "#2f2f38", pants: "#2f2f38", acc: ["bamboo", "ribbon"], ribbon: "#ff8fb1", fun: true },
    panda3:    { kind: "panda", fur: "#ffffff", fur2: "#ffffff", ears: "round", earCol: "#2f2f38", snout: "muzzle", patch: "#2f2f38",
                 shirt: "#ffffff", sleeve: "#2f2f38", hand: "#2f2f38", pants: "#2f2f38", acc: ["bamboo", "chef"], fun: true },
    // 🏮 송나라 시장 사람들 (한푸 · 두건)
    // ⏱ 타임머신을 탄 교과서 친구들
    hanna:     { kind: "human", skin: "#f7d3b1", hair: "#3b2a22", shirt: "#7fc87a", pants: "#2f3f66", shoes: "#e8443a", acc: ["ribbon"], ribbon: "#ff8fb1" },
    dongmin:   { kind: "human", skin: "#f7d3b1", hair: "#2a1f1a", shirt: "#9fc8f0", pants: "#5a6b88", shoes: "#3b2f2a", acc: ["glasses"] },
    zhangpei:  { kind: "human", skin: "#f3cfa8", hair: "#2a1f1a", shirt: "#9b59b6", pants: "#2f3f66", shoes: "#3b2f2a" },
    wangjj:    { kind: "human", skin: "#f7d8b8", hair: "#1f1a17", shirt: "#ff9fcf", pants: "#6b5aa8", shoes: "#c8372d", acc: ["ribbon"], ribbon: "#ffd23f" },
    song1:     { kind: "human", skin: "#f3cfa8", hair: "#2a1f1a", shirt: "#c8372d", pants: "#5a2a18", shoes: "#2f2a26", acc: ["cap"], cap: "#2f2a26" },
    song2:     { kind: "human", skin: "#f7d8b8", hair: "#1f1a17", shirt: "#3f9b6a", pants: "#f4ead2", shoes: "#3b2f2a", acc: ["apron"], apron: "#f4ead2" },
    song3:     { kind: "human", skin: "#eec39a", hair: "#2a1f1a", shirt: "#2f6f9a", pants: "#3d2a1a", shoes: "#2f2a26", acc: ["cap"], cap: "#4a4f5c" },
    song4:     { kind: "human", skin: "#f7d8b8", hair: "#1f1a17", shirt: "#e8a33a", pants: "#7a3b22", shoes: "#3b2f2a", acc: ["strawhat"] },
    song5:     { kind: "human", skin: "#f3cfa8", hair: "#3b2a22", shirt: "#ff8fb1", pants: "#f4ead2", shoes: "#c8372d", acc: ["ribbon"], ribbon: "#c8372d" },
    gardener:  { kind: "squirrel", fur: "#c46e3e", fur2: "#fbe3c8", ears: "pointy", snout: "cat", shirt: "#8fbf6a", pants: "#6b5a3a", acc: ["strawhat", "apron"], apron: "#6f9a4f", tail: "bushy" }
  };
  var SPH = new T.SphereGeometry(1, 20, 14);
  var HALF = new T.SphereGeometry(1, 20, 10, 0, Math.PI * 2, 0, Math.PI * 0.5);
  var CYL = new T.CylinderGeometry(1, 1, 1, 16);
  var CONE = new T.ConeGeometry(1, 1, 14);
  var TOR = new T.TorusGeometry(1, 0.14, 8, 20);
  var BOXG = new T.BoxGeometry(1, 1, 1);
  function part(parent, geo, hex, x, y, z, sx, sy, sz, rx, ry, rz) {
    var m = new T.Mesh(geo, charMat(hex));
    m.position.set(x, y, z);
    m.scale.set(sx, sy === undefined ? sx : sy, sz === undefined ? sx : sz);
    m.rotation.set(rx || 0, ry || 0, rz || 0);
    m.frustumCulled = false;
    parent.add(m);
    return m;
  }
  var shadowMat = curved(new T.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.18, depthWrite: false }));
  var shadowGeo = new T.CircleGeometry(0.3, 22).rotateX(-Math.PI / 2);

  // 💉 주사기 (바늘이 아래 -y 쪽) : 주인공 손 · 바닥 아이템에 함께 씁니다
  function syringe(parent, x, y, z, sc) {
    var g = new T.Group();
    g.position.set(x, y, z); g.scale.setScalar(sc || 1);
    parent.add(g);
    part(g, CYL, "#eaf6ff", 0, 0, 0, 0.024, 0.13, 0.024);          // 몸통
    part(g, CYL, "#5fe39a", 0, -0.02, 0, 0.018, 0.085, 0.018);      // 약물
    part(g, BOXG, "#ffffff", 0, 0.066, 0, 0.075, 0.012, 0.024);     // 손가락 걸이
    part(g, CYL, "#cfd6de", 0, 0.1, 0, 0.007, 0.07, 0.007);         // 밀대
    part(g, CYL, "#ff6b8b", 0, 0.137, 0, 0.028, 0.01, 0.028);       // 누르는 곳
    part(g, CYL, "#c3cad3", 0, -0.075, 0, 0.012, 0.022, 0.012);     // 바늘 뿌리
    part(g, CYL, "#9aa3ad", 0, -0.118, 0, 0.0035, 0.07, 0.0035);    // 바늘
    return g;
  }

  function makeChar(skin) {
    var d = LOOKS[skin] || LOOKS.student1;
    var root = new T.Group(), model = new T.Group();
    root.add(model);
    var sh = new T.Mesh(shadowGeo, shadowMat);
    sh.position.y = 0.012; sh.renderOrder = 1; sh.frustumCulled = false;
    root.add(sh);
    var human = d.kind === "human";
    var face = human ? d.skin : d.fur;
    var hand = d.hand || (human ? d.skin : d.fur);
    var acc = d.acc || [];
    var has = function (a) { return acc.indexOf(a) >= 0 };

    // 다리
    var legs = [];
    for (var s = -1; s <= 1; s += 2) {
      var leg = new T.Group();
      leg.position.set(s * 0.075, 0.2, 0);
      model.add(leg);
      part(leg, SPH, d.pants, 0, -0.08, 0, 0.068, 0.11, 0.068);
      part(leg, SPH, human ? d.shoes : shade(d.fur, -0.12), 0, -0.175, 0.025, 0.072, 0.045, 0.09);
      legs.push(leg);
    }
    // 몸통
    var body = new T.Group();
    body.position.y = 0.2;
    model.add(body);
    part(body, SPH, d.shirt, 0, 0.14, 0, 0.175, 0.17, 0.145);
    if (has("apron")) part(body, SPH, d.apron || "#ffffff", 0, 0.12, 0.03, 0.15, 0.15, 0.125);
    if (has("collar")) {
      part(body, SPH, UNI2, -0.05, 0.28, 0.07, 0.07, 0.035, 0.06, 0, 0, 0.5);
      part(body, SPH, UNI2, 0.05, 0.28, 0.07, 0.07, 0.035, 0.06, 0, 0, -0.5);
    }
    if (has("tie")) {
      part(body, BOXG, d.tie || "#e0605a", 0, 0.19, 0.142, 0.045, 0.13, 0.02);
      part(body, SPH, d.tie || "#e0605a", 0, 0.27, 0.13, 0.03, 0.025, 0.02);
    }
    if (has("ribbon")) {
      part(body, SPH, d.ribbon, -0.04, 0.26, 0.13, 0.04, 0.03, 0.02, 0, 0, 0.3);
      part(body, SPH, d.ribbon, 0.04, 0.26, 0.13, 0.04, 0.03, 0.02, 0, 0, -0.3);
      part(body, SPH, shade(d.ribbon, -0.15), 0, 0.26, 0.14, 0.02, 0.02, 0.02);
    }
    if (has("whistle")) part(body, SPH, "#ffd23f", 0.05, 0.18, 0.14, 0.025, 0.025, 0.02);
    if (d.tail) {
      if (d.tail === "ball") part(body, SPH, "#ffffff", 0, 0.06, -0.15, 0.05);
      else if (d.tail === "thin") part(body, CYL, d.fur, 0, 0.12, -0.18, 0.02, 0.22, 0.02, -0.9, 0, 0);
      else {
        part(body, SPH, d.fur, 0, 0.2, -0.22, 0.09, 0.18, 0.09, -0.45, 0, 0);
        part(body, SPH, d.fur2, 0, 0.36, -0.3, 0.06, 0.07, 0.06, -0.45, 0, 0);
      }
    }
    // 팔
    var arms = [];
    for (s = -1; s <= 1; s += 2) {
      var arm = new T.Group();
      arm.position.set(s * 0.155, 0.24, 0);
      body.add(arm);
      part(arm, SPH, d.sleeve || d.shirt, s * 0.01, -0.06, 0, 0.052, 0.085, 0.052, 0, 0, s * 0.25);
      part(arm, SPH, hand, s * 0.03, -0.14, 0, 0.045);
      arms.push(arm);
    }
    // 머리
    var head = new T.Group();
    head.position.y = 0.3;
    body.add(head);
    part(head, SPH, face, 0, 0.21, 0, 0.3, 0.27, 0.27);
    var eyeY = 0.22, eyeX = 0.1, eyeZ = 0.245;
    // 동물 얼굴
    if (!human) animalFace(head, d);
    if (d.kind === "frog") { eyeY = 0.4; eyeX = 0.12; eyeZ = 0.15 }
    if (d.patch) {
      part(head, SPH, d.patch, -eyeX - 0.01, eyeY - 0.01, eyeZ - 0.02, 0.065, 0.075, 0.03, 0, 0, 0.5);
      part(head, SPH, d.patch, eyeX + 0.01, eyeY - 0.01, eyeZ - 0.02, 0.065, 0.075, 0.03, 0, 0, -0.5);
    }
    var eyes = [];
    for (s = -1; s <= 1; s += 2) {
      var eg = new T.Group();
      eg.position.set(s * eyeX, eyeY, eyeZ);
      head.add(eg);
      eyes.push(eg);
      if (d.zombie) {                                   // 좀비 : 퀭한 흰 눈 + 빨간 눈동자 + 다크서클
        part(eg, SPH, "#6f8a5e", 0, -0.012, -0.006, 0.062, 0.07, 0.02);
        part(eg, SPH, "#f4f1df", 0, 0, 0, 0.05, 0.055, 0.02);
        part(eg, SPH, "#d0302f", s * -0.008, -0.006, 0.014, 0.018, 0.02, 0.008);
        continue;
      }
      part(eg, SPH, "#2a1f24", 0, 0, 0, 0.04, 0.058, 0.02);
      part(eg, SPH, "#ffffff", 0.012, 0.022, 0.014, 0.013, 0.015, 0.006);
    }
    if (d.zombie) {
      // 꿰맨 자국 · 해진 옷 · 찢어진 바지
      part(head, BOXG, "#6b3b3b", 0.15, 0.3, 0.2, 0.09, 0.012, 0.01, 0, -0.45, 0.5);
      for (k = 0; k < 3; k++) part(head, BOXG, "#6b3b3b", 0.12 + k * 0.025, 0.31 - k * 0.015, 0.215, 0.006, 0.035, 0.01, 0, -0.45, 0.5);
      part(body, SPH, shade(d.shirt, -0.28), -0.07, 0.07, 0.12, 0.06, 0.045, 0.03, 0, 0, 0.6);
      part(body, SPH, shade(d.shirt, -0.28), 0.08, 0.18, 0.125, 0.045, 0.035, 0.03, 0, 0, -0.4);
      part(body, SPH, "#8e3a3a", 0.02, 0.12, 0.14, 0.03, 0.02, 0.012);
      part(legs[0], SPH, d.skin, 0, -0.12, 0.05, 0.035, 0.03, 0.02);
    }
    if (!d.zombie && d.kind !== "frog" && d.kind !== "penguin" && d.kind !== "duck") {
      part(head, SPH, "#ff9fae", -0.17, 0.12, 0.2, 0.05, 0.03, 0.02, 0, -0.5, 0);
      part(head, SPH, "#ff9fae", 0.17, 0.12, 0.2, 0.05, 0.03, 0.02, 0, 0.5, 0);
    }
    if (d.zombie) {                                     // 벌린 입 + 이빨 두 개
      part(head, SPH, "#3a1d1d", 0, 0.09, 0.255, 0.065, 0.03, 0.012);
      part(head, BOXG, "#f4f1df", -0.022, 0.108, 0.262, 0.018, 0.016, 0.008);
      part(head, BOXG, "#f4f1df", 0.024, 0.074, 0.262, 0.018, 0.016, 0.008);
    } else if (human) {
      part(head, SPH, "#b5574d", 0, 0.105, 0.262, 0.03, 0.013, 0.01);
    }
    if (human) {
      // 머리카락 : 정수리를 덮는 반구 + 뒷머리 + 앞머리
      part(head, HALF, d.hair, 0, 0.2, -0.01, 0.315, 0.3, 0.3, -0.38, 0, 0);
      part(head, SPH, d.hair, 0, 0.17, -0.07, 0.29, 0.22, 0.24);
      part(head, SPH, d.hair, -0.12, 0.36, 0.17, 0.12, 0.07, 0.09, 0.3, 0, 0.4);
      part(head, SPH, d.hair, 0.05, 0.38, 0.19, 0.13, 0.07, 0.09, 0.4, 0, -0.2);
      part(head, SPH, d.hair, 0.17, 0.33, 0.14, 0.09, 0.08, 0.08, 0.2, 0, -0.5);
    }
    // 머리 소품
    if (has("glasses")) {
      part(head, TOR, "#3b2f2a", -eyeX, eyeY, eyeZ + 0.03, 0.06, 0.06, 0.06);
      part(head, TOR, "#3b2f2a", eyeX, eyeY, eyeZ + 0.03, 0.06, 0.06, 0.06);
      part(head, BOXG, "#3b2f2a", 0, eyeY + 0.01, eyeZ + 0.035, 0.07, 0.012, 0.01);
    }
    if (has("cap")) {
      part(head, HALF, d.cap, 0, 0.3, 0, 0.29, 0.2, 0.27, -0.1, 0, 0);
      part(head, CYL, d.cap, 0, 0.32, 0.24, 0.17, 0.02, 0.13, 0.15, 0, 0);
    }
    if (has("chef")) {
      part(head, CYL, "#ffffff", 0, 0.47, 0, 0.2, 0.16, 0.2);
      part(head, SPH, "#ffffff", 0, 0.6, 0, 0.25, 0.14, 0.25);
    }
    if (has("nursecap")) {
      part(head, BOXG, "#ffffff", 0, 0.47, 0.02, 0.26, 0.09, 0.14, -0.2, 0, 0);
      part(head, BOXG, "#ff8fa3", 0, 0.47, 0.095, 0.08, 0.035, 0.005, -0.2, 0, 0);
    }
    if (has("strawhat")) {
      part(head, CYL, "#f2d27a", 0, 0.41, 0, 0.44, 0.025, 0.42, -0.08, 0, 0);
      part(head, HALF, "#f2d27a", 0, 0.41, 0, 0.23, 0.17, 0.22, -0.08, 0, 0);
      part(head, CYL, "#e0605a", 0, 0.44, 0, 0.232, 0.035, 0.222, -0.08, 0, 0);
    }
    if (has("wool")) {
      for (var k = 0; k < 7; k++) {
        var a = k / 7 * Math.PI * 2;
        part(head, SPH, "#ffffff", Math.cos(a) * 0.2, 0.42 + Math.sin(a * 2) * 0.02, Math.sin(a) * 0.14 - 0.03, 0.11);
      }
      part(head, SPH, "#ffffff", 0, 0.47, 0.03, 0.13);
    }
    // 기절했을 때 머리 위를 도는 별 (좀비만)
    var stars = null;
    if (d.zombie) {
      stars = new T.Group();
      stars.position.y = 0.58;
      head.add(stars);
      for (k = 0; k < 4; k++) {
        var sa = k / 4 * Math.PI * 2;
        part(stars, SPH, k % 2 ? "#ffe066" : "#ffffff", Math.cos(sa) * 0.24, 0, Math.sin(sa) * 0.24, 0.04, 0.04, 0.04);
      }
      stars.visible = false;
    }
    // 손에 든 주사기 (주인공)
    var tool = null;
    if (d.tool === "syringe") tool = syringe(arms[1], 0.035, -0.2, 0.02, 1);
    var bam = null;                                     // 🎋 판다가 든 대나무
    if (has("bamboo")) {
      bam = new T.Group(); bam.position.set(0.03, -0.15, 0.04); arms[1].add(bam);
      part(bam, CYL, "#7cc56a", 0, 0.05, 0, 0.022, 0.34, 0.022);
      for (var bk = 0; bk < 3; bk++) part(bam, CYL, "#5ea84f", 0, -0.08 + bk * 0.1, 0, 0.026, 0.012, 0.026);
      part(bam, SPH, "#8fd27a", 0.06, 0.2, 0, 0.09, 0.025, 0.04, 0, 0, -0.6);
      part(bam, SPH, "#6fbf5f", -0.05, 0.17, 0.02, 0.08, 0.022, 0.035, 0, 0, 0.7);
    }
    model.scale.setScalar(0.88);

    return {
      root: root, model: model, body: body, head: head, eyes: eyes, legs: legs, arms: arms,
      stars: stars, tool: tool, zombie: !!d.zombie, fun: !!d.fun, bam: bam,
      px: null, pz: null, face: 0, walk: 0, phase: 0, blinkT: 1 + Math.random() * 3, t: Math.random() * 10
    };
  }
  function animalFace(head, d) {
    var f = d.fur, f2 = d.fur2, ec = d.earCol || f, pink = "#ffb3c1";
    switch (d.ears) {
      case "round":
        for (var s = -1; s <= 1; s += 2) {
          part(head, SPH, ec, s * 0.2, 0.42, -0.03, 0.095, 0.095, 0.06);
          if (!d.earCol) part(head, SPH, f2, s * 0.2, 0.42, 0.0, 0.055, 0.055, 0.04);
        }
        break;
      case "pointy":
        for (s = -1; s <= 1; s += 2) {
          part(head, CONE, ec, s * 0.17, 0.46, -0.02, 0.095, 0.2, 0.07, 0, 0, -s * 0.28);
          part(head, CONE, pink, s * 0.165, 0.45, 0.02, 0.055, 0.13, 0.03, 0, 0, -s * 0.28);
        }
        break;
      case "long":
        for (s = -1; s <= 1; s += 2) {
          part(head, SPH, ec, s * 0.1, 0.6, -0.03, 0.065, 0.22, 0.05, 0, 0, -s * 0.12);
          part(head, SPH, pink, s * 0.1, 0.6, 0.0, 0.035, 0.17, 0.03, 0, 0, -s * 0.12);
        }
        break;
      case "floppy":
        for (s = -1; s <= 1; s += 2) part(head, SPH, ec, s * 0.28, 0.2, -0.02, 0.07, 0.16, 0.07, 0, 0, s * 0.3);
        break;
      case "big":
        for (s = -1; s <= 1; s += 2) part(head, SPH, ec, s * 0.3, 0.22, -0.06, 0.05, 0.2, 0.18, 0, s * 0.3, 0);
        break;
      case "small":
        for (s = -1; s <= 1; s += 2) {
          part(head, SPH, ec, s * 0.2, 0.41, -0.02, 0.065, 0.065, 0.045);
          part(head, SPH, pink, s * 0.2, 0.41, 0.01, 0.035, 0.035, 0.03);
        }
        break;
      case "fluffy":
        for (s = -1; s <= 1; s += 2) {
          part(head, SPH, f, s * 0.27, 0.36, -0.03, 0.13, 0.12, 0.07);
          part(head, SPH, "#ffffff", s * 0.27, 0.36, 0.01, 0.08, 0.07, 0.05);
        }
        break;
    }
    switch (d.snout) {
      case "muzzle":
        part(head, SPH, f2, 0, 0.12, 0.21, 0.12, 0.085, 0.08);
        part(head, SPH, "#3b2a2a", 0, 0.16, 0.285, 0.036, 0.026, 0.022);
        break;
      case "cat":
        part(head, SPH, f2, -0.045, 0.12, 0.23, 0.06, 0.045, 0.05);
        part(head, SPH, f2, 0.045, 0.12, 0.23, 0.06, 0.045, 0.05);
        part(head, SPH, "#ff8fa3", 0, 0.155, 0.265, 0.025, 0.018, 0.015);
        break;
      case "beak":
        part(head, SPH, f2, 0, 0.16, 0.1, 0.25, 0.21, 0.2);
        part(head, CONE, "#ffb347", 0, 0.12, 0.3, 0.05, 0.1, 0.04, Math.PI / 2, 0, 0);
        break;
      case "bill":
        part(head, SPH, "#ffb347", 0, 0.1, 0.25, 0.1, 0.035, 0.08);
        break;
      case "pig":
        part(head, CYL, "#f58fa3", 0, 0.12, 0.27, 0.075, 0.05, 0.06, Math.PI / 2, 0, 0);
        part(head, SPH, "#b5576d", -0.025, 0.12, 0.297, 0.013, 0.02, 0.006);
        part(head, SPH, "#b5576d", 0.025, 0.12, 0.297, 0.013, 0.02, 0.006);
        break;
      case "trunk":
        part(head, SPH, f, 0, 0.1, 0.25, 0.065, 0.065, 0.07);
        part(head, SPH, f, 0, 0.0, 0.3, 0.05, 0.08, 0.05, 0.4, 0, 0);
        part(head, SPH, shade(f, -0.15), 0, -0.07, 0.33, 0.04, 0.02, 0.04);
        break;
      case "hippo":
        part(head, SPH, f2, 0, 0.1, 0.18, 0.2, 0.12, 0.13);
        part(head, SPH, "#6f5f8a", -0.06, 0.15, 0.305, 0.018, 0.012, 0.01);
        part(head, SPH, "#6f5f8a", 0.06, 0.15, 0.305, 0.018, 0.012, 0.01);
        break;
      case "koala":
        part(head, SPH, "#3b3440", 0, 0.14, 0.265, 0.05, 0.07, 0.04);
        break;
      case "frog":
        for (var s2 = -1; s2 <= 1; s2 += 2) part(head, SPH, f, s2 * 0.12, 0.4, 0.1, 0.09);
        part(head, TOR, "#4f8a3a", 0, 0.12, 0.23, 0.08, 0.05, 0.04, 0, 0, 0);
        part(head, SPH, f2, 0, 0.08, 0.18, 0.2, 0.12, 0.1);
        break;
    }
  }
  var DIR_ANGLE = [0, -Math.PI / 2, Math.PI / 2, Math.PI];   // 아래 · 왼쪽 · 오른쪽 · 위
  function wrapA(a) { while (a > Math.PI) a -= Math.PI * 2; while (a < -Math.PI) a += Math.PI * 2; return a }
  // 한 프레임 움직이기 : 위치가 바뀌면 걷고, 멈추면 숨 쉬고 가끔 눈을 깜빡입니다
  function animChar(c, x, y, dt, o) {
    o = o || {};
    if (c.px === null) { c.px = x; c.pz = y }
    var dx = x - c.px, dz = y - c.pz, dist = Math.sqrt(dx * dx + dz * dz);
    c.px = x; c.pz = y;
    c.t += dt;
    var moving = dist > 0.0005 && dist < 1.5;
    var target = c.face;
    if (moving) { c.phase += dist * 8.5; target = Math.atan2(dx, dz) }
    else if (o.dir !== undefined && o.dir !== null) target = DIR_ANGLE[o.dir] || 0;
    if (o.face !== undefined) target = o.face;
    c.face += wrapA(target - c.face) * Math.min(1, dt * 14);
    c.walk += ((moving ? 1 : 0) - c.walk) * Math.min(1, dt * 12);
    var w = c.walk, sn = Math.sin(c.phase);
    c.legs[0].rotation.x = sn * 0.75 * w;
    c.legs[1].rotation.x = -sn * 0.75 * w;
    c.arms[0].rotation.x = -sn * 0.7 * w;
    c.arms[1].rotation.x = sn * 0.7 * w;
    c.arms[0].rotation.z = -0.1 - (1 - w) * 0.05;
    c.arms[1].rotation.z = 0.1 + (1 - w) * 0.05;
    c.model.position.y = Math.abs(Math.cos(c.phase)) * 0.045 * w;
    c.body.rotation.z = sn * 0.05 * w;
    c.body.scale.y = 1 + Math.sin(c.t * 2.4) * 0.018 * (1 - w);
    // 말할 때는 고개를 까딱까딱
    if (o.talk) {
      c.head.rotation.x = Math.sin(c.t * 11) * 0.07;
      c.head.rotation.z = Math.sin(c.t * 5.5) * 0.06;
      c.model.position.y += Math.abs(Math.sin(c.t * 7)) * 0.03;
    } else {
      c.head.rotation.x *= 0.85; c.head.rotation.z = Math.sin(c.t * 1.3) * 0.03 * (1 - w);
    }
    // 눈 깜빡임
    c.blinkT -= dt;
    var bl = 1;
    if (c.blinkT < 0) { bl = 0.12; if (c.blinkT < -0.12) c.blinkT = 2 + Math.random() * 3.5 }
    c.eyes[0].scale.y = bl; c.eyes[1].scale.y = bl;
    // 🧟 좀비 자세 : 두 팔을 앞으로 쭉 내밀고, 몸을 숙인 채 비틀비틀
    c.model.rotation.x = 0; c.model.rotation.z = 0;
    if (c.zombie) {
      if (o.stun) {                                   // 기절 : 팔을 늘어뜨리고 고개를 푹, 머리 위로 별이 빙글빙글
        c.arms[0].rotation.x = 0.15; c.arms[1].rotation.x = 0.15;
        c.arms[0].rotation.z = -0.35; c.arms[1].rotation.z = 0.35;
        c.head.rotation.x = 0.38; c.head.rotation.z = Math.sin(c.t * 2.2) * 0.22;
        c.model.rotation.z = Math.sin(c.t * 2.2) * 0.12;
        c.eyes[0].scale.y = 0.12; c.eyes[1].scale.y = 0.12;
      } else {
        var sway = Math.sin(c.t * 3.1);
        c.arms[0].rotation.x = -1.42 + sway * 0.1;
        c.arms[1].rotation.x = -1.42 - sway * 0.1;
        c.arms[0].rotation.z = -0.05; c.arms[1].rotation.z = 0.05;
        c.model.rotation.x = 0.13;
        c.head.rotation.z = 0.18 + sway * 0.06;
        c.head.rotation.x = -0.05;
      }
      if (c.stars) {
        c.stars.visible = !!o.stun;
        if (o.stun) c.stars.rotation.y = c.t * 5;
      }
      if (o.hit) c.model.rotation.x -= o.hit * 0.5;   // 주사기에 찔리면 뒤로 휘청
    }
    // 💉 주인공 : 주사기 찌르기 (o.attack 1 → 0)
    if (c.tool) {
      c.tool.visible = o.tool !== false;
      if (o.attack > 0) {
        var ak = Math.sin(Math.min(1, o.attack) * Math.PI);
        c.arms[1].rotation.x = -1.65 * ak + c.arms[1].rotation.x * (1 - ak);
        c.body.rotation.y = 0.35 * ak;
      } else c.body.rotation.y = 0;
    }
    // 🐼 판다 재롱 : 대나무 냠냠(입으로) → 엉덩이춤 → 데굴데굴 앞구르기 를 번갈아 합니다
    c.hop = 0;
    if (c.fun && c.walk < 0.3) {
      var ph = (c.t + (c.seed || (c.seed = Math.random() * 20))) % 13;
      if (ph < 7 || o.talk) {                         // 냠냠
        c.arms[1].rotation.x = -2.15 + Math.sin(c.t * 7) * 0.12;
        c.arms[1].rotation.z = -0.35;
        c.arms[0].rotation.x = -1.2 + Math.sin(c.t * 7 + 1) * 0.1;
        c.head.rotation.x = Math.sin(c.t * 14) * 0.06 - 0.05;
        c.body.rotation.z = Math.sin(c.t * 1.6) * 0.06;
      } else if (ph < 10) {                           // 엉덩이춤 + 깡총
        c.model.rotation.z = Math.sin(c.t * 9) * 0.22;
        c.arms[0].rotation.x = -2.6; c.arms[1].rotation.x = -2.6 + Math.sin(c.t * 9) * 0.3;
        c.hop = Math.abs(Math.sin(c.t * 4.5)) * 0.14;
      } else {                                        // 데굴데굴
        var rk = (ph - 10) / 3;
        c.model.rotation.x = rk * Math.PI * 2;
        c.hop = Math.sin(rk * Math.PI) * 0.22;
        c.arms[0].rotation.x = -1; c.arms[1].rotation.x = -1;
      }
    }
    c.root.visible = !o.hide;                         // 다쳤을 때 깜빡깜빡
    var hy = hAt(x, y);                               // ⛰ 계단을 오르내리면 부드럽게 따라 올라갑니다
    if (c.hy === undefined || Math.abs(hy - c.hy) > 1) c.hy = hy;
    else c.hy += (hy - c.hy) * Math.min(1, dt * 14);
    c.root.position.set(x, c.hy + (c.hop || 0), y);
    c.model.rotation.y = c.face + (o.spin || 0);
    var sc = o.scale === undefined ? 1 : o.scale;
    c.root.scale.setScalar(sc);
  }

  // ================================================================
  //  9. 움직이는 물건 : 보물상자 · 문제 자리 표시(바닥의 빛나는 동그라미)
  // ================================================================
  function makeChest() {
    var g = new T.Group();
    var B = new Builder();
    B.box(0, 0, 0, 0.84, 0.4, 0.58, "#9a5f2e", 0.05);
    B.box(0, 0.02, 0, 0.88, 0.06, 0.62, "#7a4a24", 0.03);
    B.box(-0.3, 0, 0, 0.07, 0.41, 0.6, "#f2c14e", 0.02);
    B.box(0.3, 0, 0, 0.07, 0.41, 0.6, "#f2c14e", 0.02);
    B.box(0, 0.36, 0, 0.8, 0.04, 0.54, "#5a3417", 0.01);
    var base = B.build(); g.add(base);
    var lid = new T.Group(); lid.position.set(0, 0.4, -0.29); g.add(lid);
    var L = new Builder();
    L.box(0, 0, 0.29, 0.86, 0.14, 0.6, "#b0703a", 0.06);
    L.box(0, 0.12, 0.29, 0.86, 0.1, 0.52, "#b0703a", 0.05);
    L.box(-0.3, 0, 0.29, 0.08, 0.23, 0.62, "#f2c14e", 0.03);
    L.box(0.3, 0, 0.29, 0.08, 0.23, 0.62, "#f2c14e", 0.03);
    L.box(0, -0.08, 0.6, 0.16, 0.18, 0.05, "#f2c14e", 0.03);    // 자물쇠
    L.box(0, -0.04, 0.625, 0.05, 0.07, 0.01, "#6b4a17", 0.005);
    lid.add(L.build());
    var N = new Builder();                                         // 열리면 보이는 쪽지
    N.boxR(0, 0.47, 0.02, 0.34, 0.26, 0.01, "#fff8e4", 0.01, -0.35, 0.15, 0.1);
    N.boxR(0, 0.49, 0.03, 0.22, 0.02, 0.005, "#b58a5a", 0, -0.35, 0.15, 0.1);
    N.boxR(0, 0.44, 0.04, 0.18, 0.02, 0.005, "#b58a5a", 0, -0.35, 0.15, 0.1);
    var note = N.build(); g.add(note);
    var glowM = curved(new T.MeshBasicMaterial({ color: 0xffd65c, transparent: true, opacity: 0.4, depthWrite: false }));
    var glow = new T.Mesh(new T.CircleGeometry(0.62, 30).rotateX(-Math.PI / 2), glowM);
    glow.position.y = 0.015; glow.renderOrder = 1; glow.frustumCulled = false;
    g.add(glow);
    var sh = new T.Mesh(shadowGeo, shadowMat); sh.scale.set(1.7, 1, 1.3); sh.position.y = 0.011; g.add(sh);
    return { group: g, lid: lid, note: note, glow: glow, glowM: glowM, open: 0 };
  }
  var RING_COL = { quiz: 0xffd23f, done: 0x5fd08a, lock: 0xff7a86, exit: 0xffd23f };
  var ringGeo = new T.RingGeometry(0.36, 0.47, 40).rotateX(-Math.PI / 2);
  var discGeo = new T.CircleGeometry(0.36, 32).rotateX(-Math.PI / 2);
  function makeRing() {
    var g = new T.Group();
    var m1 = curved(new T.MeshBasicMaterial({ color: 0xffd23f, transparent: true, opacity: 0.9, depthWrite: false }));
    var m2 = curved(new T.MeshBasicMaterial({ color: 0xffd23f, transparent: true, opacity: 0.18, depthWrite: false }));
    var r = new T.Mesh(ringGeo, m1), d = new T.Mesh(discGeo, m2);
    r.frustumCulled = d.frustumCulled = false;
    r.renderOrder = d.renderOrder = 1;
    g.add(r); g.add(d);
    return { group: g, m1: m1, m2: m2, ring: r };
  }

  // ---------- 바닥에 떨어진 아이템 : ❤ 회복약 · 💉 주사기 ----------
  var ITEM_COL = { potion: 0xff6b8b, syringe: 0x4fd88a };
  var itemGlowGeo = new T.CircleGeometry(0.34, 30).rotateX(-Math.PI / 2);
  function makeItem(kind) {
    var g = new T.Group(), spin = new T.Group();
    g.add(spin);
    if (kind === "potion") {                          // 빨간 둥근 물약병
      part(spin, SPH, "#ff4d6d", 0, 0.16, 0, 0.15, 0.14, 0.15);
      part(spin, SPH, "#ff8fa3", -0.05, 0.21, 0.09, 0.04, 0.035, 0.02);
      part(spin, CYL, "#ffd6de", 0, 0.32, 0, 0.055, 0.08, 0.055);
      part(spin, CYL, "#b07a42", 0, 0.38, 0, 0.065, 0.05, 0.065);
      part(spin, BOXG, "#ffffff", 0, 0.16, 0.148, 0.09, 0.03, 0.01);   // 하얀 십자
      part(spin, BOXG, "#ffffff", 0, 0.16, 0.148, 0.03, 0.09, 0.01);
    } else {                                          // 커다란 주사기 (살짝 기울여 위에서도 잘 보이게)
      var sy = syringe(spin, 0, 0.26, 0, 2.3);
      sy.rotation.z = 0.5;
    }
    var gm = curved(new T.MeshBasicMaterial({ color: ITEM_COL[kind] || 0xffd23f, transparent: true, opacity: 0.35, depthWrite: false }));
    var glow = new T.Mesh(itemGlowGeo, gm);
    glow.position.y = 0.014; glow.renderOrder = 1; glow.frustumCulled = false;
    g.add(glow);
    var sh = new T.Mesh(shadowGeo, shadowMat); sh.scale.setScalar(0.7); sh.position.y = 0.012; g.add(sh);
    return { group: g, spin: spin, glow: glow, gm: gm, kind: kind };
  }

  // ================================================================
  //  10. 화면 · 카메라 · 이름표
  // ================================================================
  var renderer = null, scene = null, camera = null, frameEl = null, labelsEl = null;
  var W = 1, H = 1, ready = false, roomGrp = null, room = null;
  var CAM_IN  = { pitch: 50 * Math.PI / 180, dist: 11.8, fov: 35, curve: 0.006, topPad: 2.3, botPad: 1.4 };
  var CAM_OUT = { pitch: 44 * Math.PI / 180, dist: 12.6, fov: 35, curve: 0.022, topPad: 3.2, botPad: 1.2 };
  var camCfg = CAM_IN, cam = { x: 12, z: 6, snap: true, D: 11.8 };
  var pools = { chars: {}, rings: {}, items: {}, chest: null, chestUsed: false };

  function init(canvas, frame, labels) {
    frameEl = frame; labelsEl = labels;
    try {
      renderer = new T.WebGLRenderer({ canvas: canvas, antialias: true, alpha: true, powerPreference: "high-performance" });
    } catch (e) { return false }
    if (!renderer || !renderer.getContext()) return false;
    renderer.outputEncoding = T.sRGBEncoding;
    renderer.setClearColor(0x000000, 0);
    scene = new T.Scene();
    camera = new T.PerspectiveCamera(35, 1.8, 0.1, 200);
    scene.add(new T.HemisphereLight(0xfffbf0, 0xc9b08e, 0.72));
    var sun = new T.DirectionalLight(0xfff0d8, 0.48);
    sun.position.set(-3.5, 10, 7);
    scene.add(sun);
    ready = true;
    return true;
  }
  function resize(w, h) {
    if (!ready) return;
    W = Math.max(1, w); H = Math.max(1, h);
    var touch = (typeof matchMedia === "function" && matchMedia("(pointer:coarse)").matches);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, touch ? 1.6 : 2));
    renderer.setSize(W, H, false);
    camera.aspect = W / H;
    camera.updateProjectionMatrix();
  }
  function disposeGroup(g) {
    g.traverse(function (o) { if (o.geometry && o.isMesh && o.parent && o.parent.userData.room) o.geometry.dispose() });
  }
  function loadRoom(id, M, opt) {
    if (!ready) return null;
    if (roomGrp) { scene.remove(roomGrp); disposeGroup(roomGrp) }
    curLift = M.lift || null;
    room = buildRoom(id, M, opt);
    roomGrp = room.group;
    roomGrp.userData.room = true;
    scene.add(roomGrp);
    camCfg = room.outdoor ? CAM_OUT : CAM_IN;
    cam.snap = true;
    if (frameEl) {
      frameEl.classList.remove("sky", "indoor", "high");
      frameEl.classList.add(room.outdoor ? "sky" : "indoor");
      if (M.ground === "rooftop" || M.wall === "parapet") frameEl.classList.add("high");
    }
    for (var k in pools.rings) { scene.remove(pools.rings[k].group); delete pools.rings[k] }
    for (k in pools.items) { scene.remove(pools.items[k].group); delete pools.items[k] }
    if (pools.chest) { scene.remove(pools.chest.group); pools.chest = null }
    return room;
  }
  function clamp(v, a, b) { return v < a ? a : v > b ? b : v }
  function follow(px, py, dt, warp) {
    if (!room) return;
    var c = camCfg, aspect = W / H;
    var zoom = aspect < 1.3 ? Math.min(2.1, 1.3 / aspect) : 1;
    var D = c.dist * zoom * (1 - 0.32 * (warp || 0));
    var p = c.pitch, f = c.fov * Math.PI / 360;
    var hgt = D * Math.sin(p), back = D * Math.cos(p);
    var near = back - hgt / Math.tan(p + f), far = hgt / Math.tan(p - f) - back;
    var halfW = D * Math.tan(f) * aspect;
    var b = room.bounds, tx, tz, lo, hi;
    var mX = room.outdoor ? 1.1 : 2.4;              // 실내는 양 끝 벽(현관 · 계단)이 잘 보이게 조금 더
    lo = b.minX - mX + halfW; hi = b.maxX + 1 + mX - halfW;
    tx = lo > hi ? (b.minX + b.maxX + 1) / 2 : clamp(px, lo, hi);
    lo = b.minY - c.topPad + far; hi = b.maxY + 1 + c.botPad - near;
    tz = lo > hi ? (lo + hi) / 2 : clamp(py, lo, hi);
    // 주인공은 언제나 화면 안에
    if (py < tz - far + 1.2) tz = py + far - 1.2;
    if (py > tz + near - 0.7) tz = py - near + 0.7;
    if (px < tx - halfW + 0.9) tx = px + halfW - 0.9;
    if (px > tx + halfW - 0.9) tx = px - halfW + 0.9;
    if (cam.snap) { cam.x = tx; cam.z = tz; cam.D = D; cam.snap = false }
    else {
      var k = 1 - Math.exp(-dt * 6.5);
      cam.x += (tx - cam.x) * k; cam.z += (tz - cam.z) * k; cam.D += (D - cam.D) * k;
    }
    var hh = cam.D * Math.sin(p), bb = cam.D * Math.cos(p);
    if (camera.fov !== c.fov) { camera.fov = c.fov; camera.updateProjectionMatrix() }
    camera.position.set(cam.x, hh, cam.z + bb);
    camera.lookAt(cam.x, 0, cam.z);
    camera.updateMatrixWorld();
    U.uCurve.value = c.curve;
    U.uCurveZ.value = cam.z;
  }
  // 3D 자리(x, 높이 h, y) → 화면 픽셀
  var _pv = new T.Vector3();
  function project(x, h, y) {
    var dz = y - U.uCurveZ.value;
    _pv.set(x, h - U.uCurve.value * dz * dz, y).project(camera);
    return { x: (_pv.x + 1) / 2 * W, y: (1 - _pv.y) / 2 * H, vis: _pv.z < 1 && _pv.z > -1 };
  }

  // ---------- 이름표 · 말풍선 · 표시 (HTML 을 3D 위치에 띄웁니다) ----------
  var OV = {}, OVused = {};
  function label(key, cls, content, x, h, y) {
    if (!labelsEl) return;
    var pt = project(x, h + hAt(x, y), y);
    if (!pt.vis || pt.x < -150 || pt.x > W + 150 || pt.y < -150 || pt.y > H + 200) return;
    var e = OV[key];
    if (!e) {
      e = document.createElement("div");
      labelsEl.appendChild(e);
      OV[key] = e; e._c = null; e._t = null;
    }
    if (e._c !== cls) { e.className = cls; e._c = cls }
    var sig = typeof content === "string" ? content : (content.who + "\n" + content.t);
    if (e._t !== sig) {
      e._t = sig;
      if (typeof content === "string") e.textContent = content;
      else {
        e.textContent = "";
        var wn = document.createElement("span"); wn.className = "who"; wn.textContent = content.who;
        var tn = document.createElement("span"); tn.className = "say"; tn.textContent = content.t;
        e.appendChild(wn); e.appendChild(tn);
      }
    }
    // 화면 가장자리에서 글자가 잘리지 않게 안쪽으로 당깁니다
    var hw = (e._w || (e._w = e.offsetWidth)) / 2 + 4;
    if (e._t !== e._wt) { e._wt = e._t; e._w = e.offsetWidth; hw = e._w / 2 + 4 }
    if (hw * 2 < W) pt.x = Math.max(hw, Math.min(W - hw, pt.x));
    e.style.transform = "translate(" + pt.x.toFixed(1) + "px," + pt.y.toFixed(1) + "px) translate(-50%,-100%)";
    e.style.zIndex = String(1000 + Math.round(pt.y));
    OVused[key] = 1;
  }

  // ---------- 한 프레임의 시작과 끝 ----------
  var clockT = 0;
  function begin(dt) {
    clockT += dt;
    for (var k in pools.chars) pools.chars[k].used = false;
    for (k in pools.rings) pools.rings[k].used = false;
    for (k in pools.items) pools.items[k].used = false;
    pools.chestUsed = false;
    OVused = {};
  }
  function char(key, skin) {
    var e = pools.chars[key];
    if (!e || e.skin !== skin) {
      if (e) scene.remove(e.c.root);
      e = pools.chars[key] = { c: makeChar(skin), skin: skin };
      scene.add(e.c.root);
    }
    e.used = true;
    return e.c;
  }
  function ring(key, x, y, kind) {
    var e = pools.rings[key];
    if (!e) { e = pools.rings[key] = makeRing(); scene.add(e.group) }
    e.used = true;
    var col = RING_COL[kind] || RING_COL.quiz;
    e.m1.color.setHex(col); e.m2.color.setHex(col);
    var pulse = kind === "done" ? 0 : Math.sin(clockT * 3.2 + x) * 0.5 + 0.5;
    e.group.position.set(x, 0.02 + hAt(x, y), y);
    e.group.scale.setScalar(1 + pulse * 0.12);
    e.m1.opacity = kind === "done" ? 0.55 : 0.65 + pulse * 0.3;
    e.m2.opacity = kind === "done" ? 0.1 : 0.12 + pulse * 0.12;
    e.ring.rotation.y = clockT * 0.8;
  }
  function item(key, kind, x, y) {
    var e = pools.items[key];
    if (!e || e.kind !== kind) {
      if (e) scene.remove(e.group);
      e = pools.items[key] = makeItem(kind);
      scene.add(e.group);
    }
    e.used = true;
    var p = Math.sin(clockT * 3 + x * 1.7) * 0.5 + 0.5;
    e.group.position.set(x, hAt(x, y), y);
    e.spin.position.y = 0.06 + p * 0.07;
    e.spin.rotation.y = clockT * 1.8 + x;
    e.gm.opacity = 0.22 + p * 0.25;
    e.glow.scale.setScalar(1 + p * 0.15);
  }
  function chest(x, y, isReady, opened) {
    if (!pools.chest) { pools.chest = makeChest(); scene.add(pools.chest.group) }
    var c = pools.chest;
    pools.chestUsed = true;
    c.group.position.set(x, hAt(x, y), y);
    c.open += ((opened ? 1 : 0) - c.open) * 0.08;
    c.lid.rotation.x = -1.95 * c.open;
    c.note.visible = c.open > 0.3;
    c.glow.visible = isReady && !opened;
    if (c.glow.visible) {
      var p = Math.sin(clockT * 3.1) * 0.5 + 0.5;
      c.glowM.opacity = 0.25 + p * 0.3;
      c.glow.scale.setScalar(1 + p * 0.1);
      c.group.position.y = hAt(x, y);
      c.group.rotation.z = Math.sin(clockT * 9) * 0.02;
    } else c.group.rotation.z = 0;
  }
  function end() {
    if (!ready) return;
    for (var k in pools.chars) if (!pools.chars[k].used) { scene.remove(pools.chars[k].c.root); delete pools.chars[k] }
    for (k in pools.rings) if (!pools.rings[k].used) { scene.remove(pools.rings[k].group); delete pools.rings[k] }
    for (k in pools.items) if (!pools.items[k].used) { scene.remove(pools.items[k].group); delete pools.items[k] }
    if (pools.chest && !pools.chestUsed) { scene.remove(pools.chest.group); pools.chest = null }
    for (k in OV) if (!OVused[k]) { if (OV[k].parentNode) OV[k].parentNode.removeChild(OV[k]); delete OV[k] }
    renderer.render(scene, camera);
  }
  function hideLabels() { OVused = {} }

  return {
    init: init, resize: resize, loadRoom: loadRoom, follow: follow, project: project,
    begin: begin, end: end, char: char, anim: animChar, ring: ring, chest: chest, item: item,
    label: label, hideLabels: hideLabels, heightAt: hAt,
    isReady: function () { return ready },
    looks: LOOKS
  };
})();
