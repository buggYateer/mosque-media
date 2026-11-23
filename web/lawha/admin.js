"use strict";
/* لوحة التحكم — بتعدّل web/overrides.json على GitHub، والموقع بيتنشر لوحده بعد كل نشر */
const $ = s => document.querySelector(s), ad = $("#ad");
const esc = s => String(s ?? "").replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
const KINDS = { lesson: "درس", khutba: "خطبة", tilawa: "تلاوة", other: "متفرقات" };
const MONTHS = ["محرم", "صفر", "ربيع الأول", "ربيع الآخر", "جمادى الأولى", "جمادى الآخرة", "رجب", "شعبان", "رمضان", "شوال", "ذو القعدة", "ذو الحجة"];
const DEFAULT_IGNORE = []; // أرقام رسايل في القناة مش مقاطع (زي الفهارس والإعلانات) — بتتظبط من الداشبورد
let TOKEN = null, REPO = null, DB = null, OV = null, ORIG = "", UPLOADS = {}, TAB = "status", Q = "", KF = "", CHAN = null;

/* ---------- GitHub ---------- */
const gh = (path, opts = {}) => fetch(`https://api.github.com/repos/${REPO}/${path}`, {
  ...opts, headers: { Authorization: `Bearer ${TOKEN}`, Accept: "application/vnd.github+json", "Content-Type": "application/json", ...(opts.headers || {}) },
}).then(async r => { const j = await r.json().catch(() => ({})); if (!r.ok) throw new Error(j.message || r.status); return j; });
const b64utf8 = s => btoa(unescape(encodeURIComponent(s)));
const utf8b64 = s => decodeURIComponent(escape(atob(s.replace(/\n/g, ""))));
const putFile = (path, content, message, sha) => gh(`contents/${path}`, { method: "PUT", body: JSON.stringify({ message, content, branch: "main", ...(sha ? { sha } : {}) }) });

/* ---------- مساعدات ---------- */
const hijri = h => { const r = /^(\d+)-(\d+)-(14\d\d)$/.exec(h || ""); return r ? `${+r[1]} ${MONTHS[+r[2] - 1] || ""} ${r[3]}` : (h || ""); };
const shName = k => (DB.sheikhs.find(s => s.key === k) || {}).name || "";
const sheikhOpts = () => DB.sheikhs.map(s => [s.key, s.name]);
const seriesOpts = () => DB.sheikhs.flatMap(sh => (sh.series || []).flatMap(se => (se.sections.length > 1 ? se.sections : [{ t: "" }]).map(sec => [`${se.key}|${sec.t || ""}`, `${se.title}${sec.t ? " — " + sec.t : ""} (${sh.name})`])));
const seriesOf = id => { for (const sh of DB.sheikhs) for (const se of sh.series || []) for (const sec of se.sections) if (sec.ids.includes(+id)) return `${se.key}|${se.sections.length > 1 ? sec.t || "" : ""}`; return ""; };
const opt = (pairs, v) => pairs.map(([k, t]) => `<option value="${esc(k)}"${k === v ? " selected" : ""}>${esc(t)}</option>`).join("");
const norm = s => String(s).replace(/[ً-ْ]/g, "").replace(/[أإآ]/g, "ا").replace(/ة/g, "ه").replace(/ى/g, "ي");
const allIds = () => [...new Set([...Object.keys(DB.lessons), ...Object.keys(OV.add)])].map(Number).sort((a, b) => b - a);
function eff(id) {
  const base = DB.lessons[id] || OV.add[id] || {}, e = OV.edit[id] || {}, L = { ...base };
  for (const f of ["t", "s", "k", "h"]) if (e[f]) L[f] = e[f];
  L.series = e.series !== undefined ? `${e.series}|${e.sec || ""}` : OV.add[id] ? `${OV.add[id].series || ""}|${OV.add[id].sec || ""}` : seriesOf(id);
  if (L.series === "|") L.series = "";
  L.hidden = !!e.hidden; L.isNew = !!OV.add[id] && !DB.lessons[id]; L.edited = !!OV.edit[id];
  return L;
}
const pending = () => { const a = JSON.parse(ORIG), n = { ...OV }; let c = Object.keys(UPLOADS).length; for (const k of ["edit", "add"]) { const all = new Set([...Object.keys(a[k] || {}), ...Object.keys(n[k] || {})]); for (const i of all) if (JSON.stringify((a[k] || {})[i]) !== JSON.stringify((n[k] || {})[i])) c++; } if (JSON.stringify(a.featured) !== JSON.stringify(n.featured)) c++; if (JSON.stringify(a.ignore) !== JSON.stringify(n.ignore)) c++; return c; };
function toast(t, err) { const el = $("#toast"); el.textContent = t; el.className = "lw-toast on" + (err ? " err" : ""); clearTimeout(toast.t); toast.t = setTimeout(() => el.className = "lw-toast", 3200); }
function updatePub() { const n = pending(); $("#pubBtn").disabled = !n; $("#pubN").hidden = !n; $("#pubN").textContent = n; $("#pubTxt").textContent = n ? "نشر التعديلات" : "مفيش تعديلات"; }

/* ---------- الدخول ---------- */
function loginView(err) {
  $("#tabs").hidden = true;
  ad.innerHTML = `<div class="lw-card lw-login"><h2>لوحة التحكم</h2><p>ادخل الباسورد علشان تتحكم في الموقع.</p>
    <form id="lf"><div class="fld"><span>الباسورد</span><input type="password" id="pw" autocomplete="current-password" required></div>
    <button class="btn" style="width:100%">دخول</button></form>${err ? `<div class="msg err">${esc(err)}</div>` : ""}</div>`;
  $("#lf").onsubmit = async e => {
    e.preventDefault();
    const r = await fetch("/api/admin", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ password: $("#pw").value }) });
    const j = await r.json().catch(() => ({}));
    if (!r.ok) return loginView(j.error || "حصلت مشكلة في الدخول");
    TOKEN = j.token; REPO = j.repo; try { sessionStorage.setItem("adm", JSON.stringify(j)); } catch {}
    start();
  };
}
async function start() {
  ad.innerHTML = `<p class="lw-empty"><span class="ms spin">refresh</span><br>جاري التحميل…</p>`;
  try {
    DB = await fetch("/lessons.json", { cache: "no-cache" }).then(r => r.json());
    const f = await gh("contents/web/overrides.json?ref=main");
    OV = JSON.parse(utf8b64(f.content));
  } catch (e) {
    if (/Bad credentials/.test(e.message)) { try { sessionStorage.removeItem("adm"); } catch {} return loginView("مفتاح GitHub مش شغال — راجع GITHUB_TOKEN في Vercel"); }
    ad.innerHTML = `<div class="msg err">مقدرتش أحمّل البيانات: ${esc(e.message)}</div>`; return;
  }
  OV.edit ||= {}; OV.add ||= {}; OV.featured ||= []; if (!Array.isArray(OV.ignore)) OV.ignore = DEFAULT_IGNORE.slice();
  ORIG = JSON.stringify(OV); UPLOADS = {};
  $("#pubBtn").hidden = false; $("#outBtn").hidden = false; $("#tabs").hidden = false;
  render();
}

/* ---------- التبويبات ---------- */
const TABS = [["status", "dashboard", "حالة الموقع"], ["list", "library_music", "المقاطع"], ["add", "add_circle", "إضافة مقطع"], ["feat", "star", "المختارات"]];
function render() {
  updatePub();
  $("#tabs .lw-wrap").innerHTML = TABS.map(([k, ic, t]) => `<button data-tab="${k}" class="${TAB === k ? "on" : ""}"><span class="ms">${ic}</span>${t}</button>`).join("");
  ({ status: statusView, list: listView, add: () => addView(), feat: featView })[TAB]();
}
$("#tabs").addEventListener("click", e => { const b = e.target.closest("[data-tab]"); if (b) { TAB = b.dataset.tab; render(); window.scrollTo(0, 0); } });

/* ---------- حالة الموقع ---------- */
function statusView() {
  const ids = allIds(), lastSite = ids[0] || 0;
  const missing = ids.filter(i => { const L = eff(i); return !L.hidden && !(DB.lessons[i] || OV.add[i] || {}).p; });
  const newOnes = CHAN ? CHAN.found.filter(x => x.id > lastSite && !OV.ignore.includes(x.id) && !OV.add[x.id]) : null;
  ad.innerHTML = `<div class="lw-stats">
      <div class="lw-stat"><small>آخر مقطع على الموقع</small><b>${lastSite}</b><i>${esc(eff(lastSite).t || "").slice(0, 40)}</i></div>
      <div class="lw-stat"><small>آخر رسالة على القناة</small><b>${CHAN ? CHAN.last : "…"}</b><i>${CHAN ? (CHAN.found.length ? new Date(CHAN.found.at(-1).date).toLocaleDateString("ar-EG") : "مفيش جديد") : "بيدوّر…"}</i></div>
      <div class="lw-stat${newOnes && newOnes.length ? " warn" : ""}"><small>على القناة ومش على الموقع</small><b>${newOnes ? newOnes.length : "…"}</b><i>رسايل جديدة</i></div>
      <div class="lw-stat${missing.length ? " warn" : ""}"><small>مقاطع من غير صوت</small><b>${missing.length}</b><i>بتظهر بزرار تليجرام بس</i></div>
    </div>
    <div class="lw-h"><h2>على القناة ومش على الموقع</h2><span class="lw-sp"></span><button class="btn ghost sm" id="rescan"><span class="ms">refresh</span>تحديث</button></div>
    <p class="hint">رسايل اتنشرت على القناة بعد آخر مقطع على الموقع. لو الرسالة مقطع صوتي دوس «أضفه»، ولو كلام أو صورة دوس «تجاهل».</p>
    <div class="lw-card">${newOnes === null ? `<p class="lw-empty"><span class="ms spin">refresh</span> بيدوّر على القناة…</p>`
      : newOnes.length ? newOnes.map(x => `<div class="lw-row"><span class="lw-id">${x.id}</span><div class="lw-tt"><b>رسالة ${x.id}</b><small>${new Date(x.date).toLocaleString("ar-EG", { dateStyle: "medium", timeStyle: "short" })}</small></div>
        <div class="lw-acts"><a class="btn ghost sm" href="https://t.me/${(window.SITE || {}).channel}/${x.id}" target="_blank" rel="noopener"><span class="ms">open_in_new</span>افتح</a><button class="btn sm" data-addid="${x.id}"><span class="ms">add_circle</span>أضفه</button><button class="btn danger sm" data-ign="${x.id}"><span class="ms">visibility_off</span>تجاهل</button></div></div>`).join("")
      : `<p class="lw-empty">✓ كل اللي على القناة موجود على الموقع</p>`}</div>
    <div class="lw-h"><h2>مقاطع من غير صوت على الموقع</h2><small>${missing.length}</small></div>
    <p class="hint">ملفها مش مرفوع. افتح المقطع من «المقاطع» وارفع الملف، أو سيبه بزرار تليجرام.</p>
    <div class="lw-card">${missing.length ? missing.map(i => { const L = eff(i); return `<div class="lw-row"><span class="lw-id">${i}</span><div class="lw-tt"><b>${esc(L.t)}</b><small>${esc(shName(L.s))}</small></div><div class="lw-acts"><a class="btn ghost sm" href="https://t.me/${(window.SITE || {}).channel}/${i}" target="_blank" rel="noopener"><span class="ms">open_in_new</span>افتح</a><button class="btn sm" data-upid="${i}"><span class="ms">cloud_upload</span>ارفع الصوت</button></div></div>`; }).join("") : `<p class="lw-empty">✓ كل المقاطع ليها صوت</p>`}</div>
    ${OV.ignore.length ? `<div class="lw-h"><h2>متجاهَل</h2><small>${OV.ignore.length}</small></div><div class="lw-card">${OV.ignore.slice().sort((a, b) => b - a).map(i => `<div class="lw-row"><span class="lw-id">${i}</span><div class="lw-tt"><small>مش هتظهر في «على القناة ومش على الموقع»</small></div><div class="lw-acts"><button class="btn ghost sm" data-unign="${i}"><span class="ms">undo</span>رجّعها</button></div></div>`).join("")}</div>` : ""}`;
  $("#rescan").onclick = () => { CHAN = null; statusView(); scan(lastSite); };
  ad.querySelectorAll("[data-ign]").forEach(b => b.onclick = () => { OV.ignore.push(+b.dataset.ign); updatePub(); statusView(); });
  ad.querySelectorAll("[data-unign]").forEach(b => b.onclick = () => { OV.ignore = OV.ignore.filter(x => x !== +b.dataset.unign); updatePub(); statusView(); });
  ad.querySelectorAll("[data-addid]").forEach(b => b.onclick = () => { TAB = "add"; render(); addView(+b.dataset.addid); });
  ad.querySelectorAll("[data-upid]").forEach(b => b.onclick = () => uploadSheet(+b.dataset.upid));
  if (!CHAN) scan(lastSite);
}
async function scan(from) {
  try { CHAN = await fetch(`/api/channel?from=${Math.max(0, Math.min(from, ...DEFAULT_IGNORE) - 1)}`).then(r => r.json()); }
  catch { CHAN = { last: "؟", found: [] }; toast("مقدرتش أوصل للقناة دلوقتي", true); }
  if (TAB === "status") statusView();
}

/* ---------- المقاطع ---------- */
function listView() {
  const ids = allIds().filter(i => { const L = eff(i); return (!KF || L.k === KF || (KF === "hid" && L.hidden) || (KF === "ed" && (L.edited || L.isNew))) && (!Q || norm(`${i} ${L.t} ${shName(L.s)}`).includes(norm(Q))); });
  const chips = [["", "الكل"], ["tilawa", "التلاوات"], ["lesson", "الدروس"], ["khutba", "الخطب"], ["ed", "متعدّل"], ["hid", "مخفي"]];
  ad.innerHTML = `<div class="lw-search"><label class="box"><span class="ms">search</span><input id="q" value="${esc(Q)}" placeholder="ابحث بالعنوان أو الشيخ أو رقم الرسالة"></label>
    <div class="chips">${chips.map(([k, t]) => `<button data-kf="${k}" class="${KF === k ? "on" : ""}">${t}</button>`).join("")}</div></div>
    <div class="lw-card">${ids.slice(0, 100).map(i => { const L = eff(i); return `<div class="lw-row click" data-id="${i}"><span class="lw-id">${i}</span><div class="lw-tt"><b>${esc(L.t)}${L.isNew ? '<span class="tag new">جديد</span>' : ""}${L.hidden ? '<span class="tag hid">مخفي</span>' : L.edited ? '<span class="tag ed">متعدّل</span>' : ""}</b><small>${esc(shName(L.s))} · ${KINDS[L.k] || ""}${L.h ? " · " + esc(hijri(L.h)) : ""}</small></div><span class="ms" style="color:var(--muted)">edit</span></div>`; }).join("") || `<p class="lw-empty">مفيش نتايج</p>`}</div>
    ${ids.length > 100 ? `<p class="hint" style="margin-top:10px">بيظهر أول 100 من ${ids.length} — استعمل البحث.</p>` : ""}`;
  const q = $("#q"); q.oninput = () => { Q = q.value; const p = q.selectionStart; listView(); const n = $("#q"); n.focus(); n.setSelectionRange(p, p); };
  ad.querySelectorAll("[data-kf]").forEach(b => b.onclick = () => { KF = b.dataset.kf; listView(); });
  ad.querySelectorAll("[data-id]").forEach(r => r.onclick = () => editSheet(+r.dataset.id));
}
function openSheet(html) { $("#sheet").innerHTML = html; $("#modal").hidden = false; document.body.style.overflow = "hidden"; }
function closeSheet() { $("#modal").hidden = true; document.body.style.overflow = ""; }
$("#modal").addEventListener("click", e => { if (e.target.id === "modal" || e.target.closest("[data-close]")) closeSheet(); });
document.addEventListener("keydown", e => { if (e.key === "Escape") closeSheet(); });

function editSheet(id) {
  const L = eff(id);
  openSheet(`<header><h3>تعديل المقطع ${id}</h3><button class="lw-ic" data-close style="color:var(--ink)"><span class="ms">undo</span></button></header>
    <div class="lw-form">
      <div class="fld"><span>العنوان</span><input id="e_t" value="${esc(L.t)}"></div>
      <div class="grid2">
        <div class="fld"><span>الشيخ</span><select id="e_s">${opt(sheikhOpts(), L.s)}</select></div>
        <div class="fld"><span>النوع</span><select id="e_k">${opt(Object.entries(KINDS), L.k)}</select></div>
        <div class="fld"><span>التاريخ الهجري (يوم-شهر-سنة)</span><input id="e_h" value="${esc(L.h)}" placeholder="7-6-1448" inputmode="numeric"></div>
        <div class="fld"><span>السلسلة</span><select id="e_se"><option value="">— من غير سلسلة —</option>${opt(seriesOpts(), L.series)}</select></div>
      </div>
      <label class="switch">مخفي من الموقع<input type="checkbox" id="e_hid"${L.hidden ? " checked" : ""}></label>
      <label class="switch">في المختارات (الرئيسية)<input type="checkbox" id="e_fe"${OV.featured.includes(id) ? " checked" : ""}></label>
    </div>
    <footer><button class="btn" id="e_save">حفظ</button>${OV.edit[id] ? '<button class="btn ghost" id="e_reset"><span class="ms">undo</span>رجّعه للأصل</button>' : ""}
      <span class="lw-sp"></span><a class="btn ghost" href="https://t.me/${(window.SITE || {}).channel}/${id}" target="_blank" rel="noopener"><span class="ms">open_in_new</span>تليجرام</a></footer>`);
  $("#sheet header [data-close] .ms").textContent = "close";
  if ($("#e_reset")) $("#e_reset").onclick = () => { delete OV.edit[id]; closeSheet(); updatePub(); listView(); toast("رجع للأصل — دوس «نشر التعديلات»"); };
  $("#e_save").onclick = () => {
    const v = { t: $("#e_t").value.trim(), s: $("#e_s").value, k: $("#e_k").value, h: $("#e_h").value.trim() }, se = $("#e_se").value;
    if (OV.add[id] && !DB.lessons[id]) Object.assign(OV.add[id], v, { series: se.split("|")[0] || "", sec: se.split("|")[1] || "" });
    else {
      const o = { ...DB.lessons[id], series: seriesOf(id) }, e = {};
      for (const f of ["t", "s", "k", "h"]) if (v[f] && v[f] !== o[f]) e[f] = v[f];
      if (se !== o.series) { e.series = se.split("|")[0] || ""; e.sec = se.split("|")[1] || ""; }
      if ($("#e_hid").checked) e.hidden = true;
      if (Object.keys(e).length) OV.edit[id] = e; else delete OV.edit[id];
    }
    OV.featured = OV.featured.filter(x => x !== id); if ($("#e_fe").checked) OV.featured.unshift(id);
    closeSheet(); updatePub(); if (TAB === "list") listView(); else render();
    toast("اتحفظ — دوس «نشر التعديلات» فوق");
  };
}
function uploadSheet(id) {
  const L = eff(id);
  openSheet(`<header><h3>رفع صوت المقطع ${id}</h3><button class="lw-ic" data-close style="color:var(--ink)"><span class="ms">close</span></button></header>
    <div class="lw-form"><p class="hint">${esc(L.t)} — ${esc(shName(L.s))}</p>
    <label class="drop" id="u_drop"><span class="ms">cloud_upload</span><b id="u_name">اختار ملف الصوت (mp3)</b><small>لحد 90 ميجا</small><input type="file" id="u_f" accept="audio/mpeg,.mp3"></label></div>
    <footer><button class="btn" id="u_go" disabled>تمام</button></footer>`);
  $("#u_f").onchange = () => { const f = $("#u_f").files[0]; if (!f) return; $("#u_name").textContent = `${f.name} — ${(f.size / 1e6).toFixed(1)} ميجا`; $("#u_drop").classList.add("has"); $("#u_go").disabled = f.size > 90e6; };
  $("#u_go").onclick = () => { UPLOADS[id] = $("#u_f").files[0]; (OV.edit[id] ||= {}).p = 1; closeSheet(); updatePub(); toast("جاهز — دوس «نشر التعديلات» علشان يترفع"); };
}

/* ---------- إضافة مقطع ---------- */
function addView(prefill) {
  ad.innerHTML = `<div class="lw-card"><div class="lw-form">
    <div class="lw-h" style="margin-top:0"><h2>إضافة مقطع جديد</h2></div>
    <p class="hint">للمقاطع اللي على القناة ومش على الموقع. رقم الرسالة هو آخر رقم في لينكها على تليجرام.</p>
    <div class="grid2">
      <div class="fld"><span>رقم الرسالة على تليجرام</span><input id="a_id" inputmode="numeric" placeholder="مثلًا 650" value="${prefill || ""}"></div>
      <div class="fld"><span>النوع</span><select id="a_k">${opt(Object.entries(KINDS), "lesson")}</select></div>
    </div>
    <label class="drop" id="a_drop"><span class="ms">cloud_upload</span><b id="a_name">اختار ملف الصوت (mp3)</b><small>لحد 90 ميجا — المدة بتتحسب لوحدها</small><input type="file" id="a_f" accept="audio/mpeg,.mp3"></label>
    <div class="fld"><span>العنوان</span><input id="a_t" placeholder="زي ما هو مكتوب في القناة"></div>
    <div class="grid2">
      <div class="fld"><span>الشيخ</span><select id="a_s">${opt(sheikhOpts(), "")}</select></div>
      <div class="fld"><span>التاريخ الهجري (يوم-شهر-سنة)</span><input id="a_h" placeholder="7-6-1448" inputmode="numeric"></div>
    </div>
    <div class="fld"><span>السلسلة</span><select id="a_se"><option value="">— من غير سلسلة —</option>${opt(seriesOpts(), "")}</select></div>
    <button class="btn" id="a_go"><span class="ms">add_circle</span>إضافة</button><div id="a_msg"></div>
  </div></div>
  ${Object.keys(UPLOADS).length ? `<div class="lw-h"><h2>مستني النشر</h2></div><div class="lw-card">${Object.keys(UPLOADS).map(i => `<div class="lw-row"><span class="lw-id">${i}</span><div class="lw-tt"><b>${esc(eff(i).t)}</b><small>${esc(UPLOADS[i].name)} · ${(UPLOADS[i].size / 1e6).toFixed(1)} ميجا</small></div><button class="btn danger sm" data-rmu="${i}"><span class="ms">delete</span></button></div>`).join("")}</div>` : ""}`;
  $("#a_f").onchange = () => { const f = $("#a_f").files[0]; if (f) { $("#a_name").textContent = `${f.name} — ${(f.size / 1e6).toFixed(1)} ميجا`; $("#a_drop").classList.add("has"); } };
  ad.querySelectorAll("[data-rmu]").forEach(b => b.onclick = () => { const i = b.dataset.rmu; delete UPLOADS[i]; if (OV.add[i] && !DB.lessons[i]) delete OV.add[i]; updatePub(); addView(); });
  $("#a_go").onclick = async () => {
    const id = $("#a_id").value.trim(), file = $("#a_f").files[0], t = $("#a_t").value.trim(), err = x => $("#a_msg").innerHTML = `<div class="msg err">${x}</div>`;
    if (!/^\d+$/.test(id)) return err("رقم الرسالة لازم يكون أرقام بس");
    if (DB.lessons[id] || OV.add[id]) return err("الرقم ده موجود على الموقع أصلًا — عدّله من «المقاطع»");
    if (!file) return err("اختار ملف الصوت"); if (file.size > 90e6) return err("الملف أكبر من 90 ميجا"); if (!t) return err("اكتب العنوان");
    const d = await new Promise(res => { const a = new Audio(); a.preload = "metadata"; a.onloadedmetadata = () => { const s = Math.round(a.duration); res(s >= 3600 ? `${Math.floor(s / 3600)}:${String(Math.floor(s % 3600 / 60)).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}` : `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`); }; a.onerror = () => res(""); a.src = URL.createObjectURL(file); });
    const se = $("#a_se").value;
    OV.add[id] = { t, s: $("#a_s").value, k: $("#a_k").value, h: $("#a_h").value.trim(), d, p: 1, series: se.split("|")[0] || "", sec: se.split("|")[1] || "" };
    UPLOADS[id] = file; updatePub(); addView(); toast("اتضاف — دوس «نشر التعديلات» علشان يترفع");
  };
}

/* ---------- المختارات ---------- */
function featView() {
  const ids = OV.featured.filter(i => DB.lessons[i] || OV.add[i]);
  ad.innerHTML = `<div class="lw-h"><h2>المختارات</h2><small>بتظهر في الرئيسية</small></div>
    <p class="hint">تضيف مقطع من «المقاطع» ← افتحه ← علّم «في المختارات».</p>
    <div class="lw-card">${ids.length ? ids.map((i, n) => `<div class="lw-row"><span class="lw-id">${n + 1}</span><div class="lw-tt"><b>${esc(eff(i).t)}</b><small>${esc(shName(eff(i).s))}</small></div><div class="lw-acts"><button class="btn ghost sm" data-up="${n}" ${n ? "" : "disabled"}><span class="ms">arrow_upward</span></button><button class="btn danger sm" data-rm="${i}"><span class="ms">delete</span></button></div></div>`).join("") : `<p class="lw-empty">لسه مفيش مختارات</p>`}</div>`;
  ad.querySelectorAll("[data-rm]").forEach(b => b.onclick = () => { OV.featured = OV.featured.filter(x => x !== +b.dataset.rm); updatePub(); featView(); });
  ad.querySelectorAll("[data-up]").forEach(b => b.onclick = () => { const n = +b.dataset.up; [OV.featured[n - 1], OV.featured[n]] = [OV.featured[n], OV.featured[n - 1]]; updatePub(); featView(); });
}

/* ---------- النشر ---------- */
$("#pubBtn").onclick = async () => {
  const b = $("#pubBtn"); b.disabled = true;
  try {
    for (const [id, file] of Object.entries(UPLOADS)) {
      $("#pubTxt").textContent = `بيرفع ${id}.mp3…`;
      const b64 = await new Promise((res, rej) => { const r = new FileReader(); r.onload = () => res(String(r.result).split(",")[1]); r.onerror = rej; r.readAsDataURL(file); });
      let sha; try { sha = (await gh(`contents/incoming/${id}.mp3?ref=main`)).sha; } catch {}
      await putFile(`incoming/${id}.mp3`, b64, `لوحة التحكم: صوت ${id}`, sha);
      delete UPLOADS[id];
    }
    $("#pubTxt").textContent = "بيحفظ…";
    const latest = await gh("contents/web/overrides.json?ref=main");
    await putFile("web/overrides.json", b64utf8(JSON.stringify(OV, null, 1) + "\n"), "لوحة التحكم: تعديلات الموقع", latest.sha);
    ORIG = JSON.stringify(OV);
    toast("✓ اتنشر — الموقع هيتحدث خلال دقيقة");
  } catch (e) { toast("مشكلة في النشر: " + e.message, true); }
  updatePub();
};
$("#outBtn").onclick = () => { try { sessionStorage.removeItem("adm"); } catch {} location.reload(); };
window.addEventListener("beforeunload", e => { if (OV && pending()) { e.preventDefault(); e.returnValue = ""; } });

try { const s = JSON.parse(sessionStorage.getItem("adm") || "null"); if (s) { TOKEN = s.token; REPO = s.repo; start(); } else loginView(); } catch { loginView(); }
