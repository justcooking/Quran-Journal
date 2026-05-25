const SUPABASE_URL = 'https://kmlmzfbplhifcfzcwgoe.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImttbG16ZmJwbGhpZmNmemN3Z29lIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzk3MDM0MDksImV4cCI6MjA5NTI3OTQwOX0.eOGNLOVzBOu9Aac2RbvQNIrjpSPscITh5LQHuJvc53I';
const sb = supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

let currentUser = null;
let currentProfile = null;
let currentRankTab = 'surahs';
let currentCommRankTab = 'surahs';
let selectedSurah = null;
let selectedCommunityId = null;
let allProgress = [];

// ─── AUTH ───────────────────────────────────────────────────
function switchAuth(mode) {
  document.querySelectorAll('.auth-tab').forEach((t,i) => t.classList.toggle('on', (mode==='login'&&i===0)||(mode==='signup'&&i===1)));
  document.getElementById('login-form').style.display = mode==='login' ? 'block' : 'none';
  document.getElementById('signup-form').style.display = mode==='signup' ? 'block' : 'none';
  setAuthMsg('');
}

function setAuthMsg(msg, isErr=true) {
  const el = document.getElementById('auth-msg');
  el.textContent = msg;
  el.className = 'auth-msg ' + (isErr ? 'err' : 'ok');
}

async function login() {
  const email = document.getElementById('login-email').value.trim();
  const pass = document.getElementById('login-password').value;
  if (!email || !pass) return setAuthMsg('Please fill in all fields.');
  setAuthMsg('Signing in...', false);
  const { error } = await sb.auth.signInWithPassword({ email, password: pass });
  if (error) setAuthMsg(error.message);
}

async function signup() {
  const email = document.getElementById('signup-email').value.trim();
  const username = document.getElementById('signup-username').value.trim().toLowerCase();
  const name = document.getElementById('signup-name').value.trim();
  const gender = document.getElementById('signup-gender').value;
  const pass = document.getElementById('signup-password').value;
  if (!email || !username || !name || !pass) return setAuthMsg('Please fill in all fields.');
  if (pass.length < 6) return setAuthMsg('Password must be at least 6 characters.');
  setAuthMsg('Creating account...', false);
  const { data, error } = await sb.auth.signUp({ email, password: pass });
  if (error) return setAuthMsg(error.message);
  if (data.user) {
    const { error: pe } = await sb.from('profiles').upsert({
      id: data.user.id, username, display_name: name, gender
    });
    if (pe) return setAuthMsg(pe.message);
    setAuthMsg('Account created! Signing you in...', false);
  }
}

async function signout() {
  await sb.auth.signOut();
  currentUser = null; currentProfile = null; allProgress = [];
  document.getElementById('app').style.display = 'none';
  document.getElementById('auth-screen').style.display = 'flex';
}

sb.auth.onAuthStateChange(async (event, session) => {
  if (session?.user) {
    currentUser = session.user;
    document.getElementById('auth-screen').style.display = 'none';
    document.getElementById('app').style.display = 'block';
    await loadProfile();
    await loadDashboard();
    populateSurahSelect();
    loadSurahsPage();
    loadRevisionPage();
    loadCommunityPage();
    loadProfilePage();
  }
});

// ─── NAVIGATION ─────────────────────────────────────────────
const pages = ['dash','log','surahs','revision','community','resources','profile'];
function go(id) {
  pages.forEach((p,i) => {
    document.getElementById('p-'+p).classList.toggle('on', p===id);
    document.querySelectorAll('.nl')[i].classList.toggle('on', p===id);
  });
  window.scrollTo(0,0);
  if (id==='log') loadRecentLogs();
  if (id==='revision') loadRevisionPage();
  if (id==='community') loadCommunityPage();
  if (id==='profile') loadProfilePage();
}

// ─── PROFILE ────────────────────────────────────────────────
async function loadProfile() {
  const { data } = await sb.from('profiles').select('*').eq('id', currentUser.id).single();
  if (data) currentProfile = data;
}

async function loadProfilePage() {
  if (!currentProfile) await loadProfile();
  const p = currentProfile;
  if (!p) return;
  document.getElementById('prof-initials').textContent = (p.display_name||'?').charAt(0).toUpperCase();
  document.getElementById('prof-name').textContent = p.display_name || p.username;
  document.getElementById('prof-since').textContent = 'Member since ' + new Date(p.created_at).toLocaleDateString('en-GB',{month:'long',year:'numeric'});
  document.getElementById('prof-email').textContent = currentUser.email;
  document.getElementById('prof-username').textContent = '@' + p.username;
  document.getElementById('prof-gender').textContent = p.gender ? (p.gender.charAt(0).toUpperCase()+p.gender.slice(1)) : '–';
  document.getElementById('pf-name').value = p.display_name || '';
  document.getElementById('pf-reciter').value = p.preferred_reciter || 'Mishary Rashid Alafasy';
  const [logs, days, revs] = await Promise.all([
    sb.from('memorization_logs').select('id',{count:'exact'}).eq('user_id', currentUser.id),
    sb.from('memorization_logs').select('logged_at').eq('user_id', currentUser.id),
    sb.from('revision_logs').select('id',{count:'exact'}).eq('user_id', currentUser.id)
  ]);
  document.getElementById('ps-sessions').textContent = logs.count || 0;
  document.getElementById('ps-revisions').textContent = revs.count || 0;
  const uniqueDays = new Set((days.data||[]).map(l => l.logged_at?.slice(0,10))).size;
  document.getElementById('ps-days').textContent = uniqueDays;
  const { count: sc } = await sb.from('surah_progress').select('id',{count:'exact'}).eq('user_id',currentUser.id).eq('status','memorized');
  document.getElementById('ps-surahs').textContent = sc || 0;
}

async function saveProfile() {
  const name = document.getElementById('pf-name').value.trim();
  const reciter = document.getElementById('pf-reciter').value;
  const { error } = await sb.from('profiles').update({ display_name: name, preferred_reciter: reciter }).eq('id', currentUser.id);
  const msg = document.getElementById('pf-msg');
  if (error) { msg.textContent = error.message; msg.className='msg err'; }
  else { msg.textContent = 'Saved!'; msg.className='msg ok'; await loadProfile(); document.getElementById('dash-name').textContent = name; }
}

// ─── DASHBOARD ──────────────────────────────────────────────
async function loadDashboard() {
  if (!currentProfile) await loadProfile();
  document.getElementById('dash-name').textContent = currentProfile?.display_name || currentProfile?.username || '...';

  const today = new Date().toISOString().slice(0,10);
  const { data: prog } = await sb.from('surah_progress').select('*').eq('user_id', currentUser.id);
  allProgress = prog || [];

  const memorized = allProgress.filter(p => p.status==='memorized').length;
  const totalAyahs = allProgress.reduce((s,p) => s + (p.ayahs_memorized||0), 0);
  document.getElementById('d-surahs').textContent = memorized;
  document.getElementById('d-ayahs').textContent = totalAyahs.toLocaleString();

  const { data: logs } = await sb.from('memorization_logs').select('logged_at').eq('user_id', currentUser.id).order('logged_at', {ascending:false});
  const streak = calcStreak(logs||[]);
  document.getElementById('d-streak').textContent = streak;

  const { data: revs } = await sb.from('revision_logs').select('revised_at').eq('user_id', currentUser.id).gte('revised_at', new Date(Date.now()-30*86400000).toISOString());
  const daysWithRevision = new Set((revs||[]).map(r=>r.revised_at?.slice(0,10))).size;
  const revScore = Math.min(100, Math.round(daysWithRevision/30*100));
  document.getElementById('d-revscore').textContent = revScore + '%';
  document.getElementById('dash-sub').textContent = `Day ${streak > 0 ? streak : 1} of your journey — keep going.`;

  renderDashSurahs();
  renderReviseQueue('dash-revise-list', 4);
  buildHeatmap(logs||[]);
  loadDashRanking();
  updateGoalCalc(24);
  document.getElementById('dslider').addEventListener('input', function(){ updateGoalCalc(parseInt(this.value)); });
}

function calcStreak(logs) {
  if (!logs.length) return 0;
  const days = [...new Set(logs.map(l=>l.logged_at?.slice(0,10)))].sort().reverse();
  const today = new Date().toISOString().slice(0,10);
  let streak = 0, check = today;
  for (const d of days) {
    if (d === check) { streak++; const dt = new Date(check); dt.setDate(dt.getDate()-1); check = dt.toISOString().slice(0,10); }
    else if (d < check) break;
  }
  return streak;
}

function renderDashSurahs() {
  const el = document.getElementById('dash-surah-list');
  const recent = allProgress.filter(p=>p.status!=='not_started').sort((a,b)=>new Date(b.updated_at)-new Date(a.updated_at)).slice(0,6);
  if (!recent.length) { el.innerHTML='<div class="empty">No surahs tracked yet. Start in the Log page.</div>'; return; }
  el.innerHTML = recent.map(p => {
    const s = SURAHS.find(x=>x.n===p.surah_number)||{name:'Surah '+p.surah_number};
    const dot = p.status==='memorized'?'s-done':p.status==='in_progress'?'s-act':'s-new';
    return `<div class="sr"><div class="sn">${p.surah_number}</div><div class="snm">${s.name}</div><div class="pb"><div class="pf" style="width:${p.percent_complete||0}%"></div></div><div class="pp">${p.percent_complete||0}%</div><div class="sd2 ${dot}"></div></div>`;
  }).join('');
}

async function renderReviseQueue(containerId, limit=999) {
  const { data } = await sb.from('surah_progress').select('*').eq('user_id', currentUser.id).in('status',['memorized','in_progress']).order('last_revised_at', {ascending:true, nullsFirst:true});
  const el = document.getElementById(containerId);
  if (!data||!data.length) { el.innerHTML='<div class="empty">No surahs memorized yet.</div>'; return; }
  const items = (limit<data.length?data.slice(0,limit):data);
  el.innerHTML = items.map(p => {
    const s = SURAHS.find(x=>x.n===p.surah_number)||{name:'Surah '+p.surah_number,ayahs:0};
    const daysAgo = p.last_revised_at ? Math.floor((Date.now()-new Date(p.last_revised_at))/(86400000)) : 999;
    const cls = daysAgo>14?'urg':daysAgo>7?'mod2':'frs';
    const label = daysAgo===999?'Never':daysAgo===0?'Today':daysAgo===1?'Yesterday':daysAgo+'d ago';
    return `<div class="ri"><div><div class="rn">${s.name}</div><div style="font-size:10px;color:var(--cm)">${s.ayahs} ayahs</div></div><div style="display:flex;align-items:center;gap:6px"><span class="rd ${cls}">${label}</span><button class="rev-btn" onclick="markRevised(${p.surah_number},'${s.name}')">Revised</button></div></div>`;
  }).join('');
}

function buildHeatmap(logs) {
  const el = document.getElementById('heatmap');
  if (!el) return;
  const counts = {};
  (logs||[]).forEach(l => { const d=l.logged_at?.slice(0,10); if(d) counts[d]=(counts[d]||0)+1; });
  el.innerHTML='';
  for (let i=181;i>=0;i--) {
    const dt = new Date(); dt.setDate(dt.getDate()-i);
    const key = dt.toISOString().slice(0,10);
    const c = counts[key]||0;
    const lvl = c===0?0:c===1?1:c<=3?2:c<=5?3:4;
    const div = document.createElement('div');
    div.className='hc h'+lvl;
    div.title=key+': '+c+' sessions';
    el.appendChild(div);
  }
}

function updateGoalCalc(m) {
  const d=m*30,pp=(604/d).toFixed(1),lp=Math.ceil(6236/15/d),ap=Math.ceil(6236/d),jp=(30/d).toFixed(2);
  document.getElementById('dpg').textContent=pp;
  document.getElementById('dln').textContent='~'+lp;
  document.getElementById('day2').textContent='~'+ap;
  document.getElementById('djz').textContent=jp;
  const lbl=m<12?m+' months':m%12===0?(m/12)+' year'+(m/12>1?'s':''):Math.floor(m/12)+'y '+(m%12)+'m';
  document.getElementById('dlbl').textContent=lbl;
  document.getElementById('dctx').textContent='to complete in '+lbl;
}

async function loadDashRanking() {
  const el = document.getElementById('dash-ranking');
  const { data: myComms } = await sb.from('community_members').select('community_id').eq('user_id', currentUser.id).limit(1);
  if (!myComms||!myComms.length) { el.innerHTML='<div class="empty">Join a community to see rankings.</div>'; return; }
  await renderLeaderboard(el, myComms[0].community_id, currentRankTab);
}

function switchRankTab(el, tab) {
  currentRankTab = tab;
  el.closest('.tabs').querySelectorAll('.tab').forEach(t=>t.classList.remove('on'));
  el.classList.add('on');
  loadDashRanking();
}

async function renderLeaderboard(el, commId, tab) {
  const { data: members } = await sb.from('community_members').select('user_id').eq('community_id', commId);
  if (!members||!members.length) { el.innerHTML='<div class="empty">No members yet.</div>'; return; }
  const uids = members.map(m=>m.user_id);
  let scores = [];
  if (tab==='surahs') {
    const { data } = await sb.from('surah_progress').select('user_id').eq('status','memorized').in('user_id',uids);
    const cnt = {}; (data||[]).forEach(r=>cnt[r.user_id]=(cnt[r.user_id]||0)+1);
    const { data: profs } = await sb.from('profiles').select('id,display_name,username').in('id',uids);
    scores = (profs||[]).map(p=>({id:p.id,name:p.display_name||p.username,val:(cnt[p.id]||0)+' surahs'})).sort((a,b)=>parseInt(b.val)-parseInt(a.val));
  } else if (tab==='revision') {
    const since = new Date(Date.now()-30*86400000).toISOString();
    const { data } = await sb.from('revision_logs').select('user_id,revised_at').in('user_id',uids).gte('revised_at',since);
    const cnt = {}; (data||[]).forEach(r=>cnt[r.user_id]=(cnt[r.user_id]||0)+1);
    const { data: profs } = await sb.from('profiles').select('id,display_name,username').in('id',uids);
    scores = (profs||[]).map(p=>({id:p.id,name:p.display_name||p.username,val:(cnt[p.id]||0)+' revisions'})).sort((a,b)=>parseInt(b.val)-parseInt(a.val));
  } else {
    const { data } = await sb.from('memorization_logs').select('user_id,logged_at').in('user_id',uids).order('logged_at',{ascending:false});
    const { data: profs } = await sb.from('profiles').select('id,display_name,username').in('id',uids);
    const streaks = {};
    uids.forEach(uid => { const userLogs=(data||[]).filter(l=>l.user_id===uid); streaks[uid]=calcStreak(userLogs); });
    scores = (profs||[]).map(p=>({id:p.id,name:p.display_name||p.username,val:streaks[p.id]+' days'})).sort((a,b)=>parseInt(b.val)-parseInt(a.val));
  }
  el.innerHTML = scores.slice(0,5).map((s,i) => {
    const isYou = s.id===currentUser.id;
    return `<div class="rnk ${isYou?'you-row':''}"><div class="rp ${isYou?'y':''}">${i+1}</div><div class="rav ${isYou?'y':''}">${s.name.charAt(0).toUpperCase()}</div><div class="rnm ${isYou?'y':''}">${isYou?'You':s.name}</div><div class="rsco ${isYou?'':''}' style="${isYou?'color:var(--sl)':''}">${s.val}</div></div>`;
  }).join('');
}

// ─── LOG ────────────────────────────────────────────────────
function populateSurahSelect() {
  const sel = document.getElementById('log-surah');
  sel.innerHTML = SURAHS.map(s=>`<option value="${s.n}">${s.name} (${s.n}) — ${s.ayahs} ayahs</option>`).join('');
}

function selConf(el) {
  document.querySelectorAll('.conf-btn').forEach(b=>b.classList.remove('on'));
  el.classList.add('on');
}

async function saveLog() {
  const surahNum = parseInt(document.getElementById('log-surah').value);
  const from = parseInt(document.getElementById('log-from').value);
  const to = parseInt(document.getElementById('log-to').value);
  const conf = document.querySelector('.conf-btn.on')?.dataset.val || 'okay';
  const notes = document.getElementById('log-notes').value.trim();
  const msg = document.getElementById('log-msg');
  const surah = SURAHS.find(s=>s.n===surahNum);
  if (!surah) return;
  if (from > to) { msg.textContent='From ayah must be ≤ To ayah'; msg.className='msg err'; return; }
  if (to > surah.ayahs) { msg.textContent=`${surah.name} only has ${surah.ayahs} ayahs`; msg.className='msg err'; return; }
  const { error } = await sb.from('memorization_logs').insert({ user_id: currentUser.id, surah_number: surahNum, surah_name: surah.name, ayah_from: from, ayah_to: to, confidence: conf, notes });
  if (error) { msg.textContent=error.message; msg.className='msg err'; return; }
  const existing = allProgress.find(p=>p.surah_number===surahNum);
  const newAyahs = Math.max(existing?.ayahs_memorized||0, to);
  const pct = Math.round(newAyahs/surah.ayahs*100);
  const status = pct>=100?'memorized':newAyahs>0?'in_progress':'not_started';
  await sb.from('surah_progress').upsert({ user_id: currentUser.id, surah_number: surahNum, total_ayahs: surah.ayahs, ayahs_memorized: newAyahs, percent_complete: Math.min(100,pct), status, updated_at: new Date().toISOString() }, { onConflict: 'user_id,surah_number' });
  msg.textContent='Session saved!'; msg.className='msg ok';
  document.getElementById('log-notes').value='';
  loadRecentLogs();
  await loadDashboard();
  loadSurahsPage();
  setTimeout(()=>{ msg.textContent=''; },3000);
}

async function loadRecentLogs() {
  const today = new Date().toISOString().slice(0,10);
  const { data } = await sb.from('memorization_logs').select('*').eq('user_id', currentUser.id).order('logged_at',{ascending:false}).limit(10);
  const todayLogs = (data||[]).filter(l=>l.logged_at?.slice(0,10)===today);
  const totalToday = todayLogs.reduce((s,l)=>s+(l.ayah_to-l.ayah_from+1),0);
  document.getElementById('today-count').textContent = totalToday;
  document.getElementById('today-sessions').innerHTML = todayLogs.map(l=>`<div style="display:flex;justify-content:space-between;margin-bottom:5px"><span style="font-size:11px;color:var(--cm)">${l.surah_name} ${l.ayah_from}–${l.ayah_to}</span><span class="sc sc-${l.confidence}">${l.confidence}</span></div>`).join('');
  const recent = document.getElementById('recent-logs');
  const prev = (data||[]).filter(l=>l.logged_at?.slice(0,10)!==today).slice(0,6);
  if (!prev.length) { recent.innerHTML='<div class="empty">No previous sessions yet.</div>'; return; }
  recent.innerHTML = prev.map(l=>{
    const dt = new Date(l.logged_at); const dstr = dt.toLocaleDateString('en-GB',{day:'numeric',month:'short'});
    return `<div class="rev-hist-row"><div class="rh-date">${dstr}</div><div class="rh-name">${l.surah_name} ${l.ayah_from}–${l.ayah_to}</div><span class="sc sc-${l.confidence}">${l.confidence}</span></div>`;
  }).join('');
}

// ─── SURAHS PAGE ─────────────────────────────────────────────
let surahFilter = 'all';
async function loadSurahsPage() {
  const { data } = await sb.from('surah_progress').select('*').eq('user_id', currentUser.id);
  allProgress = data || [];
  renderSurahsList();
}

function filterSurahs(filter, el) {
  surahFilter = filter;
  document.querySelectorAll('#p-surahs .tab').forEach(t=>t.classList.remove('on'));
  el.classList.add('on');
  renderSurahsList();
}

function renderSurahsList() {
  const el = document.getElementById('slist');
  const filtered = SURAHS.filter(s => {
    const p = allProgress.find(x=>x.surah_number===s.n);
    const st = p?.status||'not_started';
    return surahFilter==='all'||st===surahFilter;
  });
  if (!filtered.length) { el.innerHTML='<div class="empty">No surahs in this category yet.</div>'; return; }
  el.innerHTML = filtered.map(s => {
    const p = allProgress.find(x=>x.surah_number===s.n);
    const pct = p?.percent_complete||0;
    const st = p?.status||'not_started';
    const badge = st==='memorized'?'<span style="font-size:9px;padding:1px 6px;border-radius:10px;background:rgba(58,138,106,0.15);color:#5ab898;border:0.5px solid rgba(58,138,106,0.3)">Memorized</span>':st==='in_progress'?'<span style="font-size:9px;padding:1px 6px;border-radius:10px;background:rgba(184,191,201,0.1);color:var(--sl);border:0.5px solid var(--gb)">In progress</span>':'';
    return `<div class="sitem" onclick="openSurahModal(${s.n})"><div style="display:flex;justify-content:space-between;align-items:center"><div class="sinum">Surah ${s.n}</div>${badge}</div><div class="sinm">${s.name}</div><div class="siay">${s.ayahs} ayahs</div><div class="sipb"><div class="sipf" style="width:${pct}%"></div></div></div>`;
  }).join('');
}

function openSurahModal(num) {
  const s = SURAHS.find(x=>x.n===num);
  const p = allProgress.find(x=>x.surah_number===num);
  selectedSurah = num;
  document.getElementById('modal-title').innerHTML = `<div class="cdot"></div>${s.name} (${s.n})`;
  document.getElementById('modal-info').textContent = `${s.ayahs} ayahs · ${p?.percent_complete||0}% memorized`;
  document.getElementById('modal-ayahs').value = p?.ayahs_memorized||0;
  document.getElementById('modal-ayahs').max = s.ayahs;
  document.getElementById('modal-status').value = p?.status||'not_started';
  document.getElementById('modal-msg').textContent='';
  document.getElementById('surah-modal').style.display='flex';
}

function closeModal() { document.getElementById('surah-modal').style.display='none'; }

async function saveProgress() {
  const s = SURAHS.find(x=>x.n===selectedSurah);
  const ayahs = parseInt(document.getElementById('modal-ayahs').value)||0;
  const status = document.getElementById('modal-status').value;
  const pct = Math.min(100, Math.round(ayahs/s.ayahs*100));
  const { error } = await sb.from('surah_progress').upsert({
    user_id: currentUser.id, surah_number: selectedSurah, total_ayahs: s.ayahs,
    ayahs_memorized: ayahs, percent_complete: pct, status, updated_at: new Date().toISOString()
  }, { onConflict: 'user_id,surah_number' });
  const msg = document.getElementById('modal-msg');
  if (error) { msg.textContent=error.message; msg.className='msg err'; }
  else { msg.textContent='Saved!'; msg.className='msg ok'; await loadSurahsPage(); setTimeout(closeModal, 800); }
}

// ─── REVISION ────────────────────────────────────────────────
async function loadRevisionPage() {
  await renderReviseQueue('rev-queue');
  const { data: hist } = await sb.from('revision_logs').select('*').eq('user_id', currentUser.id).order('revised_at',{ascending:false}).limit(8);
  const el = document.getElementById('rev-history');
  if (!hist||!hist.length) { el.innerHTML='<div class="empty">No revisions logged yet.</div>'; }
  else el.innerHTML = hist.map(r=>{ const dt=new Date(r.revised_at).toLocaleDateString('en-GB',{day:'numeric',month:'short'}); return `<div class="rev-hist-row"><div class="rh-date">${dt}</div><div class="rh-name">${r.surah_name}</div><span class="sc sc-${r.confidence}">${r.confidence}</span></div>`; }).join('');
  const week = new Date(Date.now()-7*86400000).toISOString();
  const { count: wk } = await sb.from('revision_logs').select('id',{count:'exact'}).eq('user_id',currentUser.id).gte('revised_at',week);
  const { data: queue } = await sb.from('surah_progress').select('last_revised_at').eq('user_id',currentUser.id).in('status',['memorized','in_progress']);
  const overdue = (queue||[]).filter(p=>{ const d=p.last_revised_at?Math.floor((Date.now()-new Date(p.last_revised_at))/(86400000)):999; return d>14; }).length;
  const gaps = (queue||[]).filter(p=>p.last_revised_at).map(p=>Math.floor((Date.now()-new Date(p.last_revised_at))/(86400000)));
  const avg = gaps.length ? Math.round(gaps.reduce((a,b)=>a+b,0)/gaps.length) : 0;
  const cons = queue?.length ? Math.round(((queue.length-overdue)/queue.length)*100) : 0;
  document.getElementById('rv-week').textContent = wk||0;
  document.getElementById('rv-overdue').textContent = overdue;
  document.getElementById('rv-avg').textContent = avg;
  document.getElementById('rv-cons').textContent = cons+'%';
}

async function markRevised(surahNum, surahName) {
  const { error } = await sb.from('revision_logs').insert({ user_id: currentUser.id, surah_number: surahNum, surah_name: surahName, confidence: 'okay' });
  if (!error) {
    await sb.from('surah_progress').update({ last_revised_at: new Date().toISOString() }).eq('user_id', currentUser.id).eq('surah_number', surahNum);
    await renderReviseQueue('rev-queue');
    await renderReviseQueue('dash-revise-list', 4);
    await loadRevisionPage();
  }
}

// ─── COMMUNITY ───────────────────────────────────────────────
async function loadCommunityPage() {
  const { data } = await sb.from('community_members').select('community_id, role, communities(id,name,is_private,gender_filter,invite_code,created_by)').eq('user_id', currentUser.id);
  const el = document.getElementById('my-communities');
  if (!data||!data.length) { el.innerHTML='<div class="empty">You haven\'t joined any communities yet.</div>'; return; }
  el.innerHTML = data.map(m => {
    const c = m.communities;
    const initials = c.name.split(' ').map(w=>w[0]).join('').slice(0,2).toUpperCase();
    return `<div class="comm-card ${selectedCommunityId===c.id?'selected':''}" onclick="selectCommunity('${c.id}','${c.name.replace(/'/g,"\\'")}')">
      <div class="comm-av">${initials}</div>
      <div>
        <div class="comm-name">${c.name}</div>
        <div class="comm-sub">${c.gender_filter==='mixed'?'Mixed':c.gender_filter==='brothers'?'Brothers only':'Sisters only'}</div>
        ${m.role==='admin'?`<div class="invite-code">Code: ${c.invite_code}</div>`:''}
      </div>
      <span class="comm-badge ${c.is_private?'prv':'pub'}">${c.is_private?'Private':'Public'}</span>
    </div>`;
  }).join('');
  if (selectedCommunityId) loadCommLeaderboard(selectedCommunityId);
  loadCommActivity();
}

async function selectCommunity(id, name) {
  selectedCommunityId = id;
  document.getElementById('comm-lb-name').textContent = name;
  loadCommLeaderboard(id);
  document.querySelectorAll('.comm-card').forEach(c=>c.classList.remove('selected'));
  event.currentTarget.classList.add('selected');
}

async function loadCommLeaderboard(commId) {
  const el = document.getElementById('comm-leaderboard');
  el.innerHTML='<div class="loading">Loading...</div>';
  await renderLeaderboard(el, commId, currentCommRankTab);
}

function switchCommTab(el, tab) {
  currentCommRankTab = tab;
  el.closest('.tabs').querySelectorAll('.tab').forEach(t=>t.classList.remove('on'));
  el.classList.add('on');
  if (selectedCommunityId) loadCommLeaderboard(selectedCommunityId);
}

async function loadCommActivity() {
  const { data: myComms } = await sb.from('community_members').select('community_id').eq('user_id', currentUser.id);
  if (!myComms||!myComms.length) return;
  const commIds = myComms.map(m=>m.community_id);
  const { data: members } = await sb.from('community_members').select('user_id').in('community_id', commIds);
  const uids = [...new Set((members||[]).map(m=>m.user_id))];
  const { data: logs } = await sb.from('memorization_logs').select('user_id,surah_name,ayah_from,ayah_to,logged_at').in('user_id',uids).order('logged_at',{ascending:false}).limit(10);
  const { data: profs } = await sb.from('profiles').select('id,display_name,username').in('id',uids);
  const profMap = {}; (profs||[]).forEach(p=>profMap[p.id]=p.display_name||p.username);
  const el = document.getElementById('comm-activity');
  if (!logs||!logs.length) { el.innerHTML='<div class="empty">No activity yet.</div>'; return; }
  el.innerHTML = logs.map(l=>{
    const name = l.user_id===currentUser.id?'You':profMap[l.user_id]||'Member';
    const dt = new Date(l.logged_at); const now = new Date();
    const diff = Math.floor((now-dt)/3600000);
    const timeStr = diff<1?'Just now':diff<24?diff+'h ago':Math.floor(diff/24)+'d ago';
    return `<div class="rev-hist-row"><div class="rh-date" style="width:60px;font-weight:500;color:${l.user_id===currentUser.id?'var(--sl)':'var(--cr)'}">${name}</div><div class="rh-name">Logged ${l.surah_name} ${l.ayah_from}–${l.ayah_to}</div><span style="font-size:10px;color:var(--cm);white-space:nowrap">${timeStr}</span></div>`;
  }).join('');
}

function showCreateComm() { document.getElementById('create-comm-card').style.display='block'; document.getElementById('join-comm-card').style.display='none'; }
function hideCreateComm() { document.getElementById('create-comm-card').style.display='none'; }
function showJoinComm() { document.getElementById('join-comm-card').style.display='block'; document.getElementById('create-comm-card').style.display='none'; }
function hideJoinComm() { document.getElementById('join-comm-card').style.display='none'; }

async function createCommunity() {
  const name = document.getElementById('cc-name').value.trim();
  const desc = document.getElementById('cc-desc').value.trim();
  const isPrivate = document.getElementById('cc-private').value==='true';
  const gender = document.getElementById('cc-gender').value;
  const msg = document.getElementById('cc-msg');
  if (!name) { msg.textContent='Please enter a name.'; msg.className='msg err'; return; }
  const { data, error } = await sb.from('communities').insert({ name, description: desc, created_by: currentUser.id, is_private: isPrivate, gender_filter: gender }).select().single();
  if (error) { msg.textContent=error.message; msg.className='msg err'; return; }
  await sb.from('community_members').insert({ community_id: data.id, user_id: currentUser.id, role: 'admin' });
  msg.textContent='Community created!'; msg.className='msg ok';
  selectedCommunityId = data.id;
  setTimeout(()=>{ hideCreateComm(); loadCommunityPage(); }, 800);
}

async function joinCommunity() {
  const code = document.getElementById('jc-code').value.trim();
  const msg = document.getElementById('jc-msg');
  if (!code) { msg.textContent='Please enter a code.'; msg.className='msg err'; return; }
  const { data: comm } = await sb.from('communities').select('id,name').eq('invite_code', code).single();
  if (!comm) { msg.textContent='Invalid invite code.'; msg.className='msg err'; return; }
  const { error } = await sb.from('community_members').insert({ community_id: comm.id, user_id: currentUser.id, role: 'member' });
  if (error&&error.code==='23505') { msg.textContent="You're already in this community."; msg.className='msg err'; return; }
  if (error) { msg.textContent=error.message; msg.className='msg err'; return; }
  msg.textContent='Joined '+comm.name+'!'; msg.className='msg ok';
  selectedCommunityId = comm.id;
  setTimeout(()=>{ hideJoinComm(); loadCommunityPage(); }, 800);
}

// ─── TABS ────────────────────────────────────────────────────
document.querySelectorAll('.tabs').forEach(tb=>{
  tb.querySelectorAll('.tab').forEach(t=>{
    if (!t.getAttribute('onclick')) {
      t.addEventListener('click',function(){ tb.querySelectorAll('.tab').forEach(x=>x.classList.remove('on')); this.classList.add('on'); });
    }
  });
});
