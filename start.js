// ===================================================================
//  시작 화면 모듈  (이름 + 모둠 인원 + 내 역할)
//
//  쓰는 법 :  StartScreen.open({
//               title:    "우리학교 탈출",
//               subtitle: "학교에 갇혔습니다! ...",
//               example:  "과학사랑",   // 입력칸에 흐리게 보이는 예시 이름
//               max:      12,           // 이름 최대 글자 수
//               team:     true,         // 모둠 활동인가? (설정 시트의 Y / N)
//               minGroup: 2,            // 모둠 최소 인원
//               baseMax:  5,            // 처음 보여 줄 최대 인원 (그 위는 [추가] 를 눌러야 나옵니다)
//               maxGroup: 10,           // 모둠 최대 인원
//               onAdmin:  function (name) { ... }   // 이름 대신 관리자 비밀번호를 넣었을 때
//               resume:   { name, group, role, ago }  // 튕겨 나갔다가 5분 안에 다시 들어왔을 때
//                         // 이름 · 인원 · 역할을 미리 골라 두어 [시작하기] 만 누르면 이어집니다
//                         // 0 을 돌려주면 평소대로 진행, 1·2 면 시작하지 않고 안내만 합니다
//             }, function (info) {
//               info.name   // "이서준"
//               info.group  // 1 (혼자) 또는 2 ~ 10
//               info.role   // 1 ~ group (혼자면 1)
//             });
//
//  * 이름을 넣지 않으면 시작되지 않습니다.
//  * team 이 false 면 인원·역할을 묻지 않고 바로 시작합니다.
//  * team 이 true 면 인원과 역할을 고른 뒤, 한 번 더 확인하고 시작합니다.
//  * 이 파일만 지우면 시작 화면 없이 혼자 하기로 바로 시작됩니다.
// ===================================================================
window.StartScreen = (function () {
  "use strict";

  var box = null, onStart = null, opt = {};
  var team = false, group = 1, role = 1;   // group·role 0 = 아직 고르지 않음

  function el(tag, cls, text){
    var d = document.createElement(tag);
    if (cls) d.className = cls;
    if (text !== undefined) d.textContent = text;
    return d;
  }
  function $(id){ return document.getElementById(id) }
  function esc(s){
    return String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  }

  // ---------- 라디오 버튼 (인원 · 역할) ----------
  function addChips(box2, nameAttr, from, to, label, onPick){
    for (var i = from; i <= to; i++) {
      (function (n) {
        var id = nameAttr + "_" + n;
        var inp = el("input"); inp.type = "radio"; inp.name = nameAttr;
        inp.id = id; inp.value = String(n); inp.className = "sradio";
        var lab = el("label", "schip"); lab.setAttribute("for", id);
        lab.textContent = label(n);
        inp.onchange = function(){ if (inp.checked) onPick(n) };
        box2.appendChild(inp); box2.appendChild(lab);
      })(i);
    }
  }

  function build(){
    box = el("div"); box.id = "startScreen";
    var card = el("div", "scard");

    // 오른쪽 위 전체화면 버튼
    var fs = el("button", "sfs", "⛶ 전체화면");
    fs.id = "startFs"; fs.type = "button"; fs.title = "전체화면으로 보기";
    fs.onclick = toggleFull;
    card.appendChild(fs);

    card.appendChild(el("div", "sicon", "⏱"));
    card.appendChild(el("div", "stitle", opt.title || "多少钱? 타임머신 송나라 시장 탈출"));
    card.appendChild(el("div", "ssub", opt.subtitle || "이름을 적고 모험을 시작하세요."));

    // 🔄 이어하기 안내 (튕겨 나갔다가 5분 안에 다시 들어온 경우)
    if (opt.resume && opt.resume.name) {
      var rb = el("div", "sresume"); rb.id = "startResume";
      card.appendChild(rb);
    }

    // 이름
    var l1 = el("label", "slabel", "이름"); l1.setAttribute("for", "startName");
    card.appendChild(l1);
    var inp = el("input", "sinput");
    inp.id = "startName"; inp.type = "text"; inp.maxLength = opt.max || 12;
    inp.placeholder = opt.example ? ("예: " + opt.example) : "이름을 입력하세요";
    inp.setAttribute("autocomplete", "off"); inp.setAttribute("autocorrect", "off");
    inp.setAttribute("autocapitalize", "off"); inp.spellcheck = false;
    card.appendChild(inp);

    if (team) {
      var lo = opt.minGroup || 2, mid = opt.baseMax || 5, hi = opt.maxGroup || 10;

      // 함께하는 사람 수 : 2~5명 + [추가]
      card.appendChild(el("label", "slabel", "함께하는 사람 수"));
      var row1 = el("div", "srow"); row1.id = "startGroupRow1";
      addChips(row1, "sgroup", lo, mid, function (n){ return n + "명" }, pickGroup);
      var more = el("button", "smore", "＋ 추가"); more.id = "startMore"; more.type = "button";
      row1.appendChild(more);
      card.appendChild(row1);

      // [추가] 를 누르면 그 아래로 6~10명이 나옵니다
      var row2 = el("div", "srow more"); row2.id = "startGroupRow2";
      addChips(row2, "sgroup", mid + 1, hi, function (n){ return n + "명" }, pickGroup);
      card.appendChild(row2);
      more.onclick = function(){
        row2.classList.add("on");
        more.style.display = "none";
      };

      // 내 역할 (인원을 고르면 나타납니다)
      var rl = el("label", "slabel", "내 역할"); rl.id = "startRoleLabel";
      card.appendChild(rl);
      var help = el("div", "shelp", "친구들과 겹치지 않게 서로 다른 번호를 고르세요.");
      help.id = "startRoleHelp"; card.appendChild(help);
      var rbox = el("div", "srolebox"); rbox.id = "startRoleBox"; card.appendChild(rbox);
      showRole(false);
    }

    var msg = el("div", "smsg"); msg.id = "startMsg"; card.appendChild(msg);
    var go = el("button", "sgo", "시작하기"); go.id = "startGo"; card.appendChild(go);

    var tip = el("div", "stip");
    tip.innerHTML = "이동 : 방향키 또는 W A S D · 말 걸기 / 문제 풀기 : <b>E</b>" +
                    "<br>스마트폰은 화면 아래 버튼으로 움직입니다.";
    card.appendChild(tip);
    if (opt.version) card.appendChild(el("div", "sver", (opt.team ? "👥 모둠 활동 · " : "👤 혼자 하기 · ") + opt.version));
    box.appendChild(card);

    // 한 번 더 확인하는 창
    var ask = el("div", "sask"); ask.id = "startAsk";
    var abox = el("div", "sabox");
    abox.appendChild(el("div", "satitle", "이대로 시작할까요?"));
    var atext = el("div", "satext"); atext.id = "startAskText"; abox.appendChild(atext);
    var arow = el("div", "sabtns");
    var no = el("button", "sno", "다시 고를래요"); no.id = "startNo";
    var yes = el("button", "syes", "네, 시작합니다"); yes.id = "startYes";
    arow.appendChild(no); arow.appendChild(yes);
    abox.appendChild(arow); ask.appendChild(abox); box.appendChild(ask);

    document.body.appendChild(box);

    go.onclick = submit;
    no.onclick = function(){ $("startAsk").classList.remove("on") };
    yes.onclick = begin;
    inp.oninput = function(){ clearMsg(); check(); showResume() };
    inp.onkeydown = function (e) {
      if (e.key === "Enter") { e.preventDefault(); submit() }
      e.stopPropagation();                   // 글자가 게임 조작으로 새지 않게
    };
    if (opt.resume && opt.resume.name) prefill(opt.resume);
    check();
  }

  // ---------- 🔄 이어하기 : 아까 쓰던 이름 · 인원 · 역할을 미리 골라 둡니다 ----------
  function prefill(rs){
    $("startName").value = String(rs.name).slice(0, opt.max || 12);
    var lo = opt.minGroup || 2, mid = opt.baseMax || 5, hi = opt.maxGroup || 10;
    if (team && rs.group >= lo && rs.group <= hi) {
      if (rs.group > mid) {                            // 6명 이상이면 [추가] 줄을 펼쳐 둡니다
        $("startGroupRow2").classList.add("on");
        $("startMore").style.display = "none";
      }
      var g = $("sgroup_" + rs.group);
      if (g) { g.checked = true; pickGroup(rs.group) }
      var r = $("srole_" + rs.role);
      if (r && rs.role >= 1 && rs.role <= rs.group) { r.checked = true; role = rs.role }
    }
    showResume();
  }
  function sameName(){
    var rs = opt.resume;
    return !!(rs && rs.name) && cleanName().toLowerCase() === String(rs.name).trim().toLowerCase();
  }
  // 이름 · 인원 · 역할이 아까 그대로인가? (그렇다면 확인 창 없이 바로 이어 시작)
  function sameAll(){
    var rs = opt.resume;
    return sameName() && (!team || (group === rs.group && role === rs.role));
  }
  function showResume(){
    var rb = $("startResume"), rs = opt.resume;
    if (!rb || !rs) return;
    var ago = rs.ago ? " (" + rs.ago + "분 전)" : "";
    if (sameName()) {
      rb.className = "sresume";
      rb.innerHTML = "🔄 <b>" + esc(rs.name) + "</b> 님, 아까 하던 게임이 있어요" + ago + "<br>" +
        (team ? "이름 · 인원 · 역할이 그대로 골라져 있으니 " : "") + "<b>시작하기</b>만 누르면 이어집니다." +
        "<small>다른 이름을 적으면 처음부터 새로 시작합니다.</small>";
    } else {
      rb.className = "sresume new";
      rb.innerHTML = "✏️ 다른 이름이에요 — <b>처음부터 새로</b> 시작합니다." +
        "<small>아까 게임을 이어 하려면 이름을 <b>" + esc(rs.name) + "</b> 그대로 적으세요.</small>";
    }
  }

  // ---------- 전체화면 ----------
  function fullNow(){
    return document.fullscreenElement || document.webkitFullscreenElement || null;
  }
  function toggleFull(){
    try {
      if (!fullNow()) {
        var r = document.documentElement;
        var go = r.requestFullscreen || r.webkitRequestFullscreen || r.msRequestFullscreen;
        if (go) go.call(r);
      } else {
        var out = document.exitFullscreen || document.webkitExitFullscreen || document.msExitFullscreen;
        if (out) out.call(document);
      }
    } catch (e) {}
  }
  function syncFull(){
    var b = $("startFs");
    if (b) b.textContent = fullNow() ? "⛶ 창 모드" : "⛶ 전체화면";
  }
  addEventListener("fullscreenchange", syncFull);
  addEventListener("webkitfullscreenchange", syncFull);

  function showRole(on){
    var rbox = $("startRoleBox"), lab = $("startRoleLabel"), help = $("startRoleHelp");
    if (!rbox) return;
    lab.style.display  = on ? "block" : "none";
    help.style.display = on ? "block" : "none";
    rbox.style.display = on ? "block" : "none";
  }

  function pickGroup(n){
    group = n; role = 0;
    var rbox = $("startRoleBox");
    rbox.innerHTML = "";
    var row = el("div", "srow");
    addChips(row, "srole", 1, n, function (k){ return k + "번" },
      function (k){ role = k; clearMsg(); check() });
    rbox.appendChild(row);
    showRole(true);
    clearMsg(); check();
  }

  function check(){
    var ok = String($("startName").value || "").trim() !== "" &&
             (!team || (group >= (opt.minGroup || 2) && role >= 1));
    $("startGo").disabled = !ok;
    return ok;
  }
  function clearMsg(){
    $("startMsg").textContent = "";
    $("startMsg").style.color = "";
    $("startName").classList.remove("bad");
  }
  function shake(node){
    if (!node) return;
    node.classList.remove("shake"); void node.offsetWidth; node.classList.add("shake");
  }
  function cleanName(){
    return String($("startName").value || "").replace(/\s+/g, " ").trim().slice(0, opt.max || 12);
  }

  function submit(){
    var name = cleanName();
    if (!name) {
      $("startMsg").textContent = "이름을 입력해야 시작할 수 있어요.";
      $("startName").classList.add("bad"); shake($("startName"));
      try { $("startName").focus() } catch (e) {}
      return;
    }
    // 이름 대신 관리자 비밀번호를 넣으면 게임을 시작하지 않고 문제 시트를 엽니다
    if (opt.onAdmin) {
      var r = opt.onAdmin(name);
      if (r) {
        var msg = $("startMsg");
        msg.style.color = r === 2 ? "#ffa0ae" : "#7ee0a0";
        msg.textContent = r === 2
          ? "팝업이 막혔습니다. 주소창 오른쪽에서 팝업을 허용해 주세요."
          : "관리자 확인 — 문제 시트를 새 탭에서 열었습니다.";
        $("startName").value = "";
        check();
        return;
      }
    }
    if (!team) { begin(); return }                 // 혼자 하기 : 그대로 시작
    if (sameAll()) { begin(); return }             // 이어하기 : 아까와 같으면 확인 창 없이 바로
    if (!group || group < (opt.minGroup || 2)) {
      $("startMsg").textContent = "함께하는 사람 수를 골라 주세요.";
      shake($("startGroupRow1"));
      return;
    }
    if (!role) {
      $("startMsg").textContent = "내 역할을 하나 골라 주세요.";
      shake($("startRoleBox"));
      return;
    }
    $("startAskText").innerHTML =
      "<b>" + esc(name) + "</b> 님 · <b>" + group + "명</b>이 함께 · 나는 <b>" + role + "번 역할</b>" +
      "<br><br>역할마다 보물상자에서 보이는 <b>쪽지 조각이 다릅니다.</b>" +
      "<br>친구들과 겹치지 않는 번호인지 확인하세요.";
    $("startAsk").classList.add("on");
  }

  function begin(){
    var info = {
      name: cleanName(),
      group: team ? group : 1,
      role: team ? (role || 1) : 1
    };
    if (!info.name) return;
    box.classList.add("out");
    setTimeout(function () {
      if (box) {
        box.style.display = "none";
        if (box.parentNode) box.parentNode.removeChild(box);
      }
      box = null;
      if (onStart) onStart(info);
    }, 320);
  }

  return {
    open: function (options, cb) {
      opt = options || {};
      onStart = cb;
      team = !!opt.team;
      group = team ? 0 : 1;
      role = team ? 0 : 1;
      if (!box) build();
      syncFull();
      // 이어하기면 [시작하기] 버튼에, 아니면 이름 칸에 커서를 둡니다 (Enter 만 눌러도 시작)
      setTimeout(function(){ try { $(opt.resume && opt.resume.name && check() ? "startGo" : "startName").focus({ preventScroll: true }) } catch (e) {} }, 60);
    },
    isOpen: function () { return !!box }
  };
})();
