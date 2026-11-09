// ═══════════════════════════════════════════════════════
//  EstudApp – app.js
//  Toda a lógica em JavaScript puro + localStorage
// ═══════════════════════════════════════════════════════

// ── ESTADO GLOBAL ──────────────────────────────────────
let currentMateriaId = null;
let currentFonteId   = null;
let currentSessaoId  = null;
let timerInterval    = null;
let sessionStartTime = null;

// Calendário
let calDate = new Date();
let calSelectedDateStr = null;

// Screens que mostram a barra de navegação inferior
const NAV_SCREENS = ['screen-home', 'screen-historico', 'screen-definicoes'];

// ── TEMA ESCURO / CLARO ────────────────────────────────
function initTheme() {
  const saved = localStorage.getItem('theme') ||
    (window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light');
  applyTheme(saved);
}

function applyTheme(theme) {
  document.documentElement.setAttribute('data-theme', theme);
  localStorage.setItem('theme', theme);

  const isDark = theme === 'dark';
  const iconHome = document.getElementById('btn-theme-home');
  if (iconHome) iconHome.textContent = isDark ? '☀️' : '🌙';

  const lbl = document.getElementById('theme-status-lbl');
  const iconStatus = document.getElementById('theme-status-icon');
  if (lbl) lbl.textContent = `Tema atual: ${isDark ? 'Escuro' : 'Claro'}`;
  if (iconStatus) iconStatus.textContent = isDark ? '🌙' : '☀️';
}

function toggleTheme() {
  const current = document.documentElement.getAttribute('data-theme') || 'light';
  const next = current === 'dark' ? 'light' : 'dark';
  applyTheme(next);
  toast(`Modo ${next === 'dark' ? 'Escuro' : 'Claro'} ativado!`);
}

// ── CONFIGURAÇÃO FIREBASE & NUVEM ────────────────────────
const firebaseConfig = {
  apiKey: "AIzaSyAgpNAVOxF-uzBXwf9Vtb-AjUShE1sT_x0",
  authDomain: "estudapp-bf8a1.firebaseapp.com",
  projectId: "estudapp-bf8a1",
  storageBucket: "estudapp-bf8a1.firebasestorage.app",
  messagingSenderId: "677838210187",
  appId: "1:677838210187:web:e5cb5105e16a03ac8f408e"
};

let auth = null;
let db = null;
let currentUserUid = null;
let cloudSyncTimeout = null;

function syncToCloud() {
  if (!db || !currentUserUid) return;
  clearTimeout(cloudSyncTimeout);
  cloudSyncTimeout = setTimeout(() => {
    const payload = {
      user: getUser(),
      subjects: getMaterias(),
      sources: getFontes(),
      sessions: getSessoes(),
      theme: localStorage.getItem('theme') || 'light',
      updated_at: firebase.firestore.FieldValue.serverTimestamp()
    };
    db.collection('users').doc(currentUserUid).set(payload, { merge: true })
      .catch(err => console.error("Erro sincronização nuvem:", err));
  }, 400);
}

// ── HELPERS – localStorage ──────────────────────────────
function getUser()     { return JSON.parse(localStorage.getItem('user') || 'null'); }
function getMaterias() { return JSON.parse(localStorage.getItem('subjects') || '[]'); }
function getFontes()   { return JSON.parse(localStorage.getItem('sources')  || '[]'); }
function getSessoes()  { return JSON.parse(localStorage.getItem('sessions') || '[]'); }

function saveUser(u) {
  localStorage.setItem('user', JSON.stringify(u));
  syncToCloud();
}
function saveMaterias(arr) {
  localStorage.setItem('subjects', JSON.stringify(arr));
  syncToCloud();
}
function saveFontes(arr) {
  localStorage.setItem('sources',  JSON.stringify(arr));
  syncToCloud();
}
function saveSessoes(arr) {
  localStorage.setItem('sessions', JSON.stringify(arr));
  syncToCloud();
}

function uid() { return Date.now().toString(36) + Math.random().toString(36).slice(2); }

// ── HELPERS – datas ────────────────────────────────────
function startOfToday() {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d.getTime();
}

function isToday(ts) {
  return ts >= startOfToday();
}

function formatDate(ts) {
  if (!ts) return '—';
  return new Date(ts).toLocaleString('pt-PT');
}

function formatMin(min) {
  if (!min && min !== 0) return '—';
  return Math.round(min * 10) / 10;
}

function calcMinutos(inicio, fim) {
  return Math.round((fim - inicio) / 60000 * 10) / 10;
}

function toDatetimeLocal(ts) {
  if (!ts) return '';
  const d = new Date(ts);
  const pad = n => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function diaTexto(ts) {
  const d = new Date(ts);
  return `${String(d.getDate()).padStart(2,'0')}/${String(d.getMonth()+1).padStart(2,'0')}/${d.getFullYear()}`;
}

// ── HELPERS – contadores (padrão NEW DAY / SAME DAY) ──
function atualizarContador(record, minutos) {
  const hoje = startOfToday();
  if (!record.dia_minutos || record.dia_minutos < hoje) {
    record.minutos_hoje = Math.round(minutos * 10) / 10;
  } else {
    record.minutos_hoje = Math.round((record.minutos_hoje + minutos) * 10) / 10;
  }
  record.dia_minutos = Date.now();
  return record;
}

function getMinutosHoje(record) {
  if (!record.dia_minutos || record.dia_minutos < startOfToday()) return 0;
  return record.minutos_hoje || 0;
}

// ── TOAST ──────────────────────────────────────────────
function toast(msg) {
  const el = document.createElement('div');
  el.className = 'toast';
  el.textContent = msg;
  document.body.appendChild(el);
  setTimeout(() => el.remove(), 2500);
}

// ── NAVEGAÇÃO ──────────────────────────────────────────
function goTo(screenId) {
  document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
  const target = document.getElementById(screenId);
  if (target) target.classList.add('active');

  // Barra de nav
  const nav = document.getElementById('bottom-nav');
  if (NAV_SCREENS.includes(screenId)) {
    nav.style.display = 'flex';
    document.querySelectorAll('.bottom-nav button').forEach(b => b.classList.remove('active'));
    if (screenId === 'screen-home')      document.getElementById('nav-home').classList.add('active');
    if (screenId === 'screen-historico') document.getElementById('nav-hist').classList.add('active');
    if (screenId === 'screen-definicoes') document.getElementById('nav-defs').classList.add('active');
  } else {
    nav.style.display = 'none';
  }
}

// ── INICIALIZAÇÃO ──────────────────────────────────────
window.addEventListener('DOMContentLoaded', () => {
  initTheme();
  inicializarFirebase();
});

let cloudUnsubscribe = null;

function inicializarFirebase() {
  if (typeof firebase !== 'undefined') {
    try {
      if (!firebase.apps.length) {
        firebase.initializeApp(firebaseConfig);
      }
      auth = firebase.auth();
      db = firebase.firestore();

      // Ativar persistência offline (opcional)
      db.enablePersistence({ synchronizeTabs: true }).catch(err => {
        console.warn("Persistência offline:", err.code);
      });

      auth.onAuthStateChanged(async (firebaseUser) => {
        if (firebaseUser) {
          currentUserUid = firebaseUser.uid;
          await carregarDadosDaNuvem(currentUserUid);
          iniciarEscutaNuvem(currentUserUid);
          goTo('screen-home');
          renderHome();
        } else {
          currentUserUid = null;
          if (cloudUnsubscribe) { cloudUnsubscribe(); cloudUnsubscribe = null; }
          const localUser = getUser();
          if (localUser) {
            goTo('screen-home');
            renderHome();
          } else {
            goTo('screen-inicio');
          }
        }
      });
    } catch (e) {
      console.error("Erro inicialização Firebase:", e);
      fallbackLocalInit();
    }
  } else {
    fallbackLocalInit();
  }
}

function fallbackLocalInit() {
  const user = getUser();
  if (user) {
    goTo('screen-home');
    renderHome();
  } else {
    goTo('screen-inicio');
  }
}

async function carregarDadosDaNuvem(uid) {
  if (!db || !uid) return;
  try {
    const doc = await db.collection('users').doc(uid).get();
    if (doc.exists) {
      const data = doc.data();
      if (data.user)     localStorage.setItem('user', JSON.stringify(data.user));
      if (data.subjects) localStorage.setItem('subjects', JSON.stringify(data.subjects));
      if (data.sources)  localStorage.setItem('sources', JSON.stringify(data.sources));
      if (data.sessions) localStorage.setItem('sessions', JSON.stringify(data.sessions));
      if (data.theme)    applyTheme(data.theme);
    } else {
      // Se ainda não tem doc na nuvem mas tem local, migra dados locais para a nuvem
      syncToCloud();
    }
  } catch (e) {
    console.error("Erro ao carregar dados da nuvem:", e);
  }
}

function iniciarEscutaNuvem(uid) {
  if (!db || !uid) return;
  if (cloudUnsubscribe) cloudUnsubscribe();

  cloudUnsubscribe = db.collection('users').doc(uid).onSnapshot(doc => {
    if (!doc.exists) return;
    if (doc.metadata.hasPendingWrites) return; // ignora alterações feitas neste dispositivo

    const data = doc.data();
    if (data.user)     localStorage.setItem('user', JSON.stringify(data.user));
    if (data.subjects) localStorage.setItem('subjects', JSON.stringify(data.subjects));
    if (data.sources)  localStorage.setItem('sources', JSON.stringify(data.sources));
    if (data.sessions) localStorage.setItem('sessions', JSON.stringify(data.sessions));
    if (data.theme)    applyTheme(data.theme);

    const activeScreen = document.querySelector('.screen.active');
    if (activeScreen?.id === 'screen-home') {
      renderHome();
    } else if (activeScreen?.id === 'screen-detalhe-materia') {
      renderDetalheMateria();
    } else if (activeScreen?.id === 'screen-historico') {
      renderHistorico();
    }
  }, err => {
    console.warn("Snapshot error:", err);
  });
}

// ══════════════════════════════════════════════════════
//  02 – CRIAR CONTA
// ══════════════════════════════════════════════════════
async function criarConta() {
  const nome     = document.getElementById('cc-nome').value.trim();
  const email    = document.getElementById('cc-email').value.trim();
  const password = document.getElementById('cc-password').value;

  if (!nome || !email || !password) { toast('Preenche todos os campos!'); return; }
  if (password.length < 6)          { toast('Password com mínimo 6 caracteres!'); return; }

  const btn = document.querySelector('#screen-criar-conta button.btn-primary');
  const txtOriginal = btn ? btn.textContent : '';
  if (btn) { btn.disabled = true; btn.textContent = 'A criar conta na nuvem...'; }

  if (auth) {
    try {
      const cred = await auth.createUserWithEmailAndPassword(email, password);
      currentUserUid = cred.user.uid;
      try { await cred.user.updateProfile({ displayName: nome }); } catch (e) {}

      const newUser = {
        name: nome,
        email: email,
        meta_total: 0,
        minutos_hoje: 0,
        dia_minutos: Date.now()
      };
      saveUser(newUser);

      if (db) {
        await db.collection('users').doc(currentUserUid).set({
          user: newUser,
          subjects: getMaterias(),
          sources: getFontes(),
          sessions: getSessoes(),
          theme: localStorage.getItem('theme') || 'light',
          created_at: firebase.firestore.FieldValue.serverTimestamp()
        }, { merge: true });
      }

      toast('Conta criada e sincronizada!');
      iniciarEscutaNuvem(currentUserUid);

      document.getElementById('cc-nome').value = '';
      document.getElementById('cc-email').value = '';
      document.getElementById('cc-password').value = '';

      goTo('screen-home');
      renderHome();
    } catch (err) {
      console.error(err);
      let msg = 'Erro ao criar conta!';
      if (err.code === 'auth/email-already-in-use') msg = 'Este email já está registado! Tenta entrar.';
      else if (err.code === 'auth/invalid-email')   msg = 'Formato de email inválido!';
      else if (err.code === 'auth/weak-password')   msg = 'A password é demasiado fraca (mín. 6 carateres)!';
      toast(msg);
    } finally {
      if (btn) { btn.disabled = false; btn.textContent = txtOriginal; }
    }
  } else {
    // Modo local (sem internet)
    const user = { name: nome, email, password, meta_total: 0, minutos_hoje: 0, dia_minutos: Date.now() };
    saveUser(user);
    goTo('screen-home');
    renderHome();
  }
}

// ══════════════════════════════════════════════════════
//  03 – ENTRAR
// ══════════════════════════════════════════════════════
async function entrar() {
  const email    = document.getElementById('en-email').value.trim();
  const password = document.getElementById('en-password').value;

  if (!email || !password) { toast('Preenche o email e password!'); return; }

  const btn = document.querySelector('#screen-entrar button.btn-primary');
  const txtOriginal = btn ? btn.textContent : '';
  if (btn) { btn.disabled = true; btn.textContent = 'A entrar...'; }

  if (auth) {
    try {
      const cred = await auth.signInWithEmailAndPassword(email, password);
      currentUserUid = cred.user.uid;
      toast('Sessão iniciada! A carregar os teus estudos...');

      await carregarDadosDaNuvem(currentUserUid);
      iniciarEscutaNuvem(currentUserUid);

      document.getElementById('en-email').value = '';
      document.getElementById('en-password').value = '';

      goTo('screen-home');
      renderHome();
    } catch (err) {
      console.error(err);
      let msg = 'Email ou password incorretos!';
      if (err.code === 'auth/user-not-found')    msg = 'Conta não encontrada! Verifica o email.';
      else if (err.code === 'auth/wrong-password') msg = 'Password incorreta!';
      else if (err.code === 'auth/invalid-email')  msg = 'Email inválido!';
      else if (err.code === 'auth/too-many-requests') msg = 'Muitas tentativas falhadas. Tenta daqui a pouco.';
      toast(msg);
    } finally {
      if (btn) { btn.disabled = false; btn.textContent = txtOriginal; }
    }
  } else {
    // Modo local
    const user = getUser();
    if (!user || user.email !== email || user.password !== password) {
      toast('Email ou password incorretos!');
      return;
    }
    document.getElementById('en-email').value = '';
    document.getElementById('en-password').value = '';
    goTo('screen-home');
    renderHome();
  }
}

function recuperarPassword() {
  const email = prompt('Escreve o teu email para receberes um link de recuperação de password:');
  if (!email || !email.trim()) return;

  if (!auth) {
    toast('Funcionalidade indisponível offline.');
    return;
  }

  auth.sendPasswordResetEmail(email.trim())
    .then(() => toast('Email de recuperação enviado! Verifica a tua caixa de correio.'))
    .catch(err => {
      console.error(err);
      toast('Não foi possível enviar o email. Verifica o endereço.');
    });
}

// ══════════════════════════════════════════════════════
//  04 – HOME
// ══════════════════════════════════════════════════════
function renderHome() {
  const user     = getUser();
  if (!user) return;

  const materias = getMaterias();
  const sessoes  = getSessoes();

  // Saudação
  const nome = user.name ? user.name.split(' ')[0] : 'Olá';
  document.getElementById('home-greeting').textContent = `Olá, ${nome}! 👋`;

  // Minutos hoje (user)
  const minHoje = getMinutosHoje(user);
  document.getElementById('home-min-hoje').textContent = formatMin(minHoje);

  // Meta total e cálculo de progresso
  const metaTotal = recalcMetaTotal();
  const pct = metaTotal > 0 ? Math.min(100, Math.round((minHoje / metaTotal) * 100)) : (minHoje > 0 ? 100 : 0);
  const isDone = minHoje >= metaTotal && metaTotal > 0;

  // Atualizar barra de progresso visual
  const progressBar = document.getElementById('home-progress-bar');
  const goalPill = document.getElementById('home-goal-pill');
  if (progressBar) {
    progressBar.style.width = `${pct}%`;
    if (isDone) {
      progressBar.classList.add('completed');
    } else {
      progressBar.classList.remove('completed');
    }
  }

  if (goalPill) {
    goalPill.textContent = isDone ? '🎉 100%' : `${pct}%`;
    if (isDone) {
      goalPill.classList.add('done');
    } else {
      goalPill.classList.remove('done');
    }
  }

  const metaInfo = document.getElementById('home-meta-info');
  if (metaInfo) {
    metaInfo.textContent = `Meta: ${metaTotal} min`;
  }

  const progressRemain = document.getElementById('home-progress-remain');
  if (progressRemain) {
    if (isDone) {
      progressRemain.textContent = '🎉 Meta cumprida!';
    } else {
      progressRemain.textContent = `Faltam: ${formatMin(Math.max(0, metaTotal - minHoje))} min`;
    }
  }

  // Contadores
  document.getElementById('home-num-materias').textContent = materias.length;
  const sessõesHoje = sessoes.filter(s => s.estado === 'Terminada' && isToday(s.hora_inicio)).length;
  document.getElementById('home-num-sessoes').textContent = sessõesHoje;

  // Banner de sessão em curso (se existir)
  const banner = document.getElementById('home-active-session-banner');
  if (banner) {
    const sessaoAtiva = sessoes.find(s => s.estado === 'Em curso');
    if (sessaoAtiva) {
      banner.innerHTML = `
        <div class="active-session-banner">
          <div class="active-session-badge">⚡ Sessão em curso (Pausada)</div>
          <div style="font-weight:700; color:#1e3a5f; font-size:15px; margin-bottom:2px">
            ${sessaoAtiva.nome_materia} · ${sessaoAtiva.nome_fonte}
          </div>
          <div style="font-size:12px; color:#64748b; margin-bottom:10px">
            Iniciada hoje às ${new Date(sessaoAtiva.hora_inicio).toLocaleTimeString('pt-PT', {hour:'2-digit', minute:'2-digit'})}
          </div>
          <div style="display:flex; gap:8px">
            <button class="btn btn-sm btn-primary" onclick="retomarSessao('${sessaoAtiva.id}')">▶ Voltar ao estudo</button>
            <button class="btn btn-sm btn-ghost" onclick="cancelarSessaoEmCurso('${sessaoAtiva.id}')">Descartar</button>
          </div>
        </div>`;
    } else {
      banner.innerHTML = '';
    }
  }

  // Lista de matérias
  const list = document.getElementById('home-materias-list');
  if (!materias.length) {
    list.innerHTML = `<div class="empty-state"><div class="empty-icon">📖</div><p>Ainda não tens matérias.<br>Adiciona a primeira!</p></div>`;
    return;
  }

  list.innerHTML = materias.map(m => {
    const minH = getMinutosHoje(m);
    const meta  = m.meta_diaria_min || 0;
    const pct = meta > 0 ? Math.min(100, Math.round((minH / meta) * 100)) : (minH > 0 ? 100 : 0);
    const isDone = minH >= meta && meta > 0;
    const dot   = meta > 0
      ? `<span class="goal-dot ${isDone ? 'green' : 'red'}"></span>`
      : '';

    // Mini barra de progresso individual da matéria
    const barraHtml = meta > 0 ? `
      <div class="materia-progress-wrap">
        <div class="materia-progress-track">
          <div class="materia-progress-fill ${isDone ? 'completed' : ''}" style="width: ${pct}%"></div>
        </div>
        <div class="materia-progress-labels">
          <span>Hoje: <strong>${formatMin(minH)}</strong> / ${meta} min</span>
          <span class="${isDone ? 'done-text' : ''}">${isDone ? '🎉 Cumprida' : pct + '%'}</span>
        </div>
      </div>
    ` : `
      <div class="materia-progress-wrap">
        <div class="materia-progress-labels">
          <span>Hoje: <strong>${formatMin(minH)}</strong> min</span>
          <span style="color:var(--text-muted)">Sem meta diária</span>
        </div>
      </div>
    `;

    return `
      <div class="card" onclick="abrirDetalheMateria('${m.id}')">
        <div style="display:flex;justify-content:space-between;align-items:flex-start">
          <div>
            <div class="card-title">${m.name}${dot}</div>
            <div class="card-sub">${m.conta_na_meta ? '🎯 Conta para a meta geral' : '⚪ Não conta para a meta'}</div>
          </div>
          <label class="toggle" onclick="event.stopPropagation()" title="Conta para a meta">
            <input type="checkbox" ${m.conta_na_meta ? 'checked' : ''}
              onchange="toggleContaMeta('${m.id}', this.checked)">
            <span class="toggle-slider"></span>
          </label>
        </div>

        ${barraHtml}

        <div class="card-actions">
          <button class="btn btn-sm btn-ghost" onclick="event.stopPropagation(); abrirEditarMateria('${m.id}')">✏️ Editar</button>
        </div>
      </div>`;
  }).join('');
}

function recalcMetaTotal() {
  const materias = getMaterias();
  const total = materias.reduce((s, m) => s + (m.conta_na_meta ? (m.meta_diaria_min || 0) : 0), 0);
  const user = getUser();
  if (user) { user.meta_total = total; saveUser(user); }
  return total;
}

function toggleContaMeta(id, val) {
  const materias = getMaterias();
  const m = materias.find(x => x.id === id);
  if (!m) return;
  m.conta_na_meta = val;
  m.meta_contada  = val ? (m.meta_diaria_min || 0) : 0;
  saveMaterias(materias);
  recalcMetaTotal();
  renderHome();
}

// ══════════════════════════════════════════════════════
//  05 – ADICIONAR MATÉRIA
// ══════════════════════════════════════════════════════
function adicionarMateria() {
  const nome  = document.getElementById('am-nome').value.trim();
  const meta  = parseFloat(document.getElementById('am-meta').value) || 0;
  const conta = document.getElementById('am-conta-meta').checked;

  if (!nome) { toast('Escreve o nome da matéria!'); return; }

  const materias = getMaterias();
  const novaMateria = {
    id: uid(), name: nome, meta_diaria_min: meta,
    conta_na_meta: conta, meta_contada: conta ? meta : 0,
    minutos_hoje: 0, dia_minutos: Date.now()
  };
  materias.push(novaMateria);
  saveMaterias(materias);
  recalcMetaTotal();

  document.getElementById('am-nome').value = '';
  document.getElementById('am-meta').value = '';
  document.getElementById('am-conta-meta').checked = false;

  toast('Matéria adicionada!');
  goTo('screen-home');
  renderHome();
}

// ══════════════════════════════════════════════════════
//  06 – DETALHE DA MATÉRIA
// ══════════════════════════════════════════════════════
function abrirDetalheMateria(id) {
  currentMateriaId = id;
  renderDetalheMateria();
  goTo('screen-detalhe-materia');
}

function renderDetalheMateria() {
  const materias = getMaterias();
  const m = materias.find(x => x.id === currentMateriaId);
  if (!m) return;

  const minHoje = getMinutosHoje(m);
  const meta = m.meta_diaria_min || 0;
  const pct = meta > 0 ? Math.min(100, Math.round((minHoje / meta) * 100)) : (minHoje > 0 ? 100 : 0);
  const isDone = minHoje >= meta && meta > 0;

  document.getElementById('dm-titulo').textContent = m.name;
  document.getElementById('dm-min-hoje').textContent = formatMin(minHoje);

  const dmGoalPill = document.getElementById('dm-goal-pill');
  if (dmGoalPill) {
    dmGoalPill.textContent = isDone ? '🎉 100%' : `${pct}%`;
    if (isDone) dmGoalPill.classList.add('done');
    else dmGoalPill.classList.remove('done');
  }

  const dmProgress = document.getElementById('dm-progress-bar');
  if (dmProgress) {
    dmProgress.style.width = `${pct}%`;
    if (isDone) dmProgress.classList.add('completed');
    else dmProgress.classList.remove('completed');
  }

  const dmMetaInfo = document.getElementById('dm-meta-info');
  if (dmMetaInfo) dmMetaInfo.textContent = `Meta: ${meta} min/dia`;

  const dmRemain = document.getElementById('dm-progress-remain');
  if (dmRemain) {
    if (isDone) dmRemain.textContent = '🎉 Meta cumprida!';
    else dmRemain.textContent = `Faltam: ${formatMin(Math.max(0, meta - minHoje))} min`;
  }

  const fontes = getFontes().filter(f => f.subject_id === currentMateriaId);
  const list = document.getElementById('dm-fontes-list');

  if (!fontes.length) {
    list.innerHTML = `<div class="empty-state"><div class="empty-icon">📄</div><p>Ainda não tens fontes.<br>Adiciona a primeira!</p></div>`;
    return;
  }

  const sessoes = getSessoes();
  list.innerHTML = fontes.map(f => {
    const minH = getMinutosHoje(f);
    const sessaoEmCurso = sessoes.find(s => s.source_id === f.id && s.estado === 'Em curso');
    const temSessaoHoje = sessoes.some(s =>
      s.source_id === f.id && s.estado === 'Terminada' && isToday(s.hora_inicio));

    let btnEstudo = '';
    if (sessaoEmCurso) {
      btnEstudo = `<button class="btn btn-sm btn-primary" style="background:#eab308; color:#fff" onclick="retomarSessao('${sessaoEmCurso.id}')">
        ⚡ Retomar estudo
      </button>`;
    } else {
      btnEstudo = `<button class="btn btn-sm btn-primary" onclick="iniciarEstudo('${f.id}')">
        ${temSessaoHoje ? '▶ Continuar' : '▶ Estudar'}
      </button>`;
    }

    return `
      <div class="card">
        <div class="card-title">${f.name} ${sessaoEmCurso ? '<span style="font-size:12px;color:#eab308">● em pausa</span>' : ''}</div>
        <div class="card-sub">📂 ${f.tipo}</div>
        ${f.ponto_paragem ? `<div class="card-sub">📍 ${f.ponto_paragem}</div>` : ''}
        <div class="card-sub">⏱ Hoje: ${formatMin(minH)} min</div>
        <div class="card-actions">
          ${btnEstudo}
          ${f.link ? `<button class="btn btn-sm btn-ghost" onclick="window.open('${f.link}','_blank')">🔗</button>` : ''}
          <button class="btn btn-sm btn-ghost" onclick="abrirEditarFonte('${f.id}')">✏️</button>
        </div>
      </div>`;
  }).join('');
}

// ══════════════════════════════════════════════════════
//  07 – EDITAR MATÉRIA
// ══════════════════════════════════════════════════════
function abrirEditarMateria(id) {
  const targetId = id || currentMateriaId;
  currentMateriaId = targetId;
  const materias = getMaterias();
  const m = materias.find(x => x.id === targetId);
  if (!m) return;

  document.getElementById('em-nome').value       = m.name || '';
  document.getElementById('em-meta').value       = (m.meta_diaria_min !== undefined && m.meta_diaria_min !== null) ? m.meta_diaria_min : '';
  document.getElementById('em-conta-meta').checked = m.conta_na_meta || false;

  goTo('screen-editar-materia');
}

function guardarEdicaoMateria() {
  const nome  = document.getElementById('em-nome').value.trim();
  const metaInput = document.getElementById('em-meta').value;
  const meta  = metaInput === '' ? 0 : (parseFloat(metaInput) || 0);
  const conta = document.getElementById('em-conta-meta').checked;

  if (!nome) { toast('Escreve o nome da matéria!'); return; }

  const materias = getMaterias();
  const idx = materias.findIndex(x => x.id === currentMateriaId);
  if (idx === -1) { toast('Matéria não encontrada!'); return; }

  materias[idx].name            = nome;
  materias[idx].meta_diaria_min = meta;
  materias[idx].conta_na_meta   = conta;
  materias[idx].meta_contada    = conta ? meta : 0;
  saveMaterias(materias);
  recalcMetaTotal();

  toast('Matéria atualizada!');
  renderDetalheMateria();
  renderHome();
  goTo('screen-detalhe-materia');
}

function confirmarApagarMateria() {
  goTo('screen-confirmar-apagar-materia');
}

function apagarMateria() {
  let materias = getMaterias();
  materias = materias.filter(x => x.id !== currentMateriaId);
  saveMaterias(materias);

  let fontes = getFontes();
  const fontesApagadas = fontes.filter(f => f.subject_id === currentMateriaId).map(f => f.id);
  fontes = fontes.filter(f => f.subject_id !== currentMateriaId);
  saveFontes(fontes);

  let sessoes = getSessoes();
  sessoes = sessoes.filter(s => !fontesApagadas.includes(s.source_id));
  saveSessoes(sessoes);

  recalcMetaTotal();
  currentMateriaId = null;
  toast('Matéria apagada!');
  goTo('screen-home');
  renderHome();
}

// ══════════════════════════════════════════════════════
//  08 – ADICIONAR FONTE
// ══════════════════════════════════════════════════════
function adicionarFonte() {
  const nome  = document.getElementById('af-nome').value.trim();
  const tipo  = document.getElementById('af-tipo').value;
  const link  = document.getElementById('af-link').value.trim();
  const ponto = document.getElementById('af-ponto').value.trim();

  if (!nome) { toast('Escreve o nome da fonte!'); return; }

  const fontes = getFontes();
  fontes.push({
    id: uid(), subject_id: currentMateriaId,
    name: nome, tipo, link, ponto_paragem: ponto,
    ultimo_estudo: null, minutos_hoje: 0, dia_minutos: Date.now()
  });
  saveFontes(fontes);

  document.getElementById('af-nome').value  = '';
  document.getElementById('af-link').value  = '';
  document.getElementById('af-ponto').value = '';

  toast('Fonte adicionada!');
  renderDetalheMateria();
  goTo('screen-detalhe-materia');
}

// ══════════════════════════════════════════════════════
//  09 – EDITAR FONTE
// ══════════════════════════════════════════════════════
function abrirEditarFonte(id) {
  currentFonteId = id;
  const f = getFontes().find(x => x.id === id);
  if (!f) return;

  document.getElementById('ef-nome').value  = f.name;
  document.getElementById('ef-tipo').value  = f.tipo;
  document.getElementById('ef-link').value  = f.link || '';
  document.getElementById('ef-ponto').value = f.ponto_paragem || '';

  goTo('screen-editar-fonte');
}

function guardarEdicaoFonte() {
  const nome  = document.getElementById('ef-nome').value.trim();
  const tipo  = document.getElementById('ef-tipo').value;
  const link  = document.getElementById('ef-link').value.trim();
  const ponto = document.getElementById('ef-ponto').value.trim();

  if (!nome) { toast('Escreve o nome da fonte!'); return; }

  const fontes = getFontes();
  const idx = fontes.findIndex(x => x.id === currentFonteId);
  if (idx === -1) return;

  fontes[idx].name         = nome;
  fontes[idx].tipo         = tipo;
  fontes[idx].link         = link;
  fontes[idx].ponto_paragem = ponto;
  saveFontes(fontes);

  toast('Fonte atualizada!');
  renderDetalheMateria();
  goTo('screen-detalhe-materia');
}

function confirmarApagarFonte() {
  goTo('screen-confirmar-apagar-fonte');
}

function apagarFonte() {
  let fontes = getFontes();
  fontes = fontes.filter(x => x.id !== currentFonteId);
  saveFontes(fontes);

  let sessoes = getSessoes();
  sessoes = sessoes.filter(s => s.source_id !== currentFonteId);
  saveSessoes(sessoes);

  currentFonteId = null;
  toast('Fonte apagada!');
  renderDetalheMateria();
  goTo('screen-detalhe-materia');
}

// ══════════════════════════════════════════════════════
//  10 – CRONÓMETRO / INICIAR ESTUDO
// ══════════════════════════════════════════════════════
function iniciarEstudo(fonteId) {
  // Se já existir uma sessão em curso para esta fonte, retoma
  const sessoes = getSessoes();
  const sessaoMesmaFonte = sessoes.find(s => s.source_id === fonteId && s.estado === 'Em curso');
  if (sessaoMesmaFonte) {
    retomarSessao(sessaoMesmaFonte.id);
    return;
  }

  // Se já existir outra sessão em curso de outra fonte
  const outraSessaoAtiva = sessoes.find(s => s.estado === 'Em curso');
  if (outraSessaoAtiva) {
    const querTrocar = confirm(`Já tens uma sessão em curso em "${outraSessaoAtiva.nome_materia} - ${outraSessaoAtiva.nome_fonte}".\nQueres retomar essa sessão em vez de iniciar uma nova?`);
    if (querTrocar) {
      retomarSessao(outraSessaoAtiva.id);
      return;
    }
  }

  currentFonteId = fonteId;
  const fonte    = getFontes().find(f => f.id === fonteId);
  const materia  = getMaterias().find(m => m.id === currentMateriaId);
  if (!fonte || !materia) return;

  // Criar sessão
  const novaSessao = {
    id: uid(),
    subject_id: currentMateriaId,
    source_id:  fonteId,
    hora_inicio: Date.now(),
    hora_fim:    null,
    minutos:     0,
    estado:      'Em curso',
    resumo: '', aprendi: '', duvidas: '',
    ponto_paragem: '',
    manual: false,
    dia: diaTexto(Date.now()),
    conta_na_meta: materia.conta_na_meta || false,
    minutos_contados: 0,
    nome_materia: materia.name,
    nome_fonte:   fonte.name,
    minutos_antes: 0, contados_antes: 0
  };

  sessoes.push(novaSessao);
  saveSessoes(sessoes);
  currentSessaoId = novaSessao.id;

  // Render cronómetro
  document.getElementById('cron-materia').textContent = materia.name;
  document.getElementById('cron-fonte').textContent   = fonte.name;
  document.getElementById('cron-ponto').textContent   = fonte.ponto_paragem || '—';
  document.getElementById('cron-aprendi').value = '';
  document.getElementById('cron-duvidas').value = '';

  const btnLink = document.getElementById('cron-btn-link');
  btnLink.style.display = fonte.link ? 'block' : 'none';

  sessionStartTime = novaSessao.hora_inicio;
  lastPomodoroAlertBlock = 0;
  metaAlertGiven = false;
  clearInterval(timerInterval);
  timerInterval = setInterval(updateTimer, 1000);
  updateTimer();

  goTo('screen-cronometro');
}

function retomarSessao(sessaoId) {
  const sessoes = getSessoes();
  const s = sessoes.find(x => x.id === sessaoId);
  if (!s) return;

  currentSessaoId  = s.id;
  currentMateriaId = s.subject_id;
  currentFonteId   = s.source_id;

  const fonte   = getFontes().find(f => f.id === s.source_id);
  const materia = getMaterias().find(m => m.id === s.subject_id);

  document.getElementById('cron-materia').textContent = s.nome_materia || (materia ? materia.name : '—');
  document.getElementById('cron-fonte').textContent   = s.nome_fonte || (fonte ? fonte.name : '—');
  document.getElementById('cron-ponto').textContent   = (fonte && fonte.ponto_paragem) ? fonte.ponto_paragem : '—';
  document.getElementById('cron-aprendi').value = s.aprendi || '';
  document.getElementById('cron-duvidas').value = s.duvidas || '';

  const btnLink = document.getElementById('cron-btn-link');
  btnLink.style.display = (fonte && fonte.link) ? 'block' : 'none';

  sessionStartTime = s.hora_inicio;
  lastPomodoroAlertBlock = Math.floor(Math.floor((Date.now() - s.hora_inicio) / 1000) / (25 * 60));
  metaAlertGiven = false;
  clearInterval(timerInterval);
  timerInterval = setInterval(updateTimer, 1000);
  updateTimer();

  toast('Sessão retomada!');
  goTo('screen-cronometro');
}

function cancelarSessaoEmCurso(sessaoId) {
  const id = sessaoId || currentSessaoId;
  if (!id) return;
  if (!confirm('Tens a certeza que queres cancelar e descartar esta sessão de estudo?')) return;

  clearInterval(timerInterval);
  let sessoes = getSessoes();
  sessoes = sessoes.filter(s => s.id !== id);
  saveSessoes(sessoes);

  if (currentSessaoId === id) {
    currentSessaoId = null;
    sessionStartTime = null;
  }

  toast('Sessão descartada.');
  goTo('screen-home');
  renderHome();
}

function updateTimer() {
  if (!sessionStartTime) return;
  const elapsed = Math.floor((Date.now() - sessionStartTime) / 1000);
  const h = Math.floor(elapsed / 3600);
  const m = Math.floor((elapsed % 3600) / 60);
  const s = elapsed % 60;
  document.getElementById('cron-timer').textContent =
    `${String(h).padStart(2,'0')}:${String(m).padStart(2,'0')}:${String(s).padStart(2,'0')}`;

  verificarAlertasEstudo(elapsed);
}

function verificarAlertasEstudo(elapsedSeconds) {
  const cfg = getNotifSettings();
  const minutosNaSessao = elapsedSeconds / 60;

  // 1. Alerta Pomodoro (a cada 25 minutos contínuos)
  if (cfg.pomodoro) {
    const bloco25 = Math.floor(minutosNaSessao / 25);
    if (bloco25 > 0 && bloco25 > lastPomodoroAlertBlock) {
      lastPomodoroAlertBlock = bloco25;
      dispararNotificacao(
        '🍅 Intervalo Pomodoro!',
        `Completaste ${bloco25 * 25} minutos de foco. Faz uma pausa de 5 minutos!`
      );
    }
  }

  // 2. Alerta de Meta Cumprida da Matéria
  if (cfg.metaAtingida && !metaAlertGiven && currentMateriaId) {
    const materias = getMaterias();
    const materia = materias.find(x => x.id === currentMateriaId);
    if (materia && materia.meta_diaria_min > 0) {
      const totalHojeEstimado = getMinutosHoje(materia) + minutosNaSessao;
      if (totalHojeEstimado >= materia.meta_diaria_min) {
        metaAlertGiven = true;
        dispararNotificacao(
          '🎉 Meta Diária Atingida!',
          `Parabéns! Atingiste a tua meta de ${materia.meta_diaria_min} min para ${materia.name}!`
        );
      }
    }
  }
}

function abrirFonte() {
  const fonte = getFontes().find(f => f.id === currentFonteId);
  if (fonte && fonte.link) window.open(fonte.link, '_blank');
}

function guardarNotasCron() {
  const sessoes = getSessoes();
  const idx = sessoes.findIndex(s => s.id === currentSessaoId);
  if (idx === -1) return;
  sessoes[idx].aprendi = document.getElementById('cron-aprendi').value;
  sessoes[idx].duvidas = document.getElementById('cron-duvidas').value;
  saveSessoes(sessoes);
  toast('Notas guardadas!');
}

function sairSemTerminar() {
  clearInterval(timerInterval);
  // Guardar notas na sessão em curso sem apagá-la
  if (currentSessaoId) {
    const sessoes = getSessoes();
    const idx = sessoes.findIndex(s => s.id === currentSessaoId);
    if (idx !== -1) {
      sessoes[idx].aprendi = document.getElementById('cron-aprendi').value;
      sessoes[idx].duvidas = document.getElementById('cron-duvidas').value;
      saveSessoes(sessoes);
    }
  }
  toast('Sessão em pausa. Podes voltar a qualquer momento!');
  goTo('screen-home');
  renderHome();
}

function terminarSessao() {
  clearInterval(timerInterval);
  const horaFim = Date.now();

  const sessoes = getSessoes();
  const idx = sessoes.findIndex(s => s.id === currentSessaoId);
  if (idx === -1) return;

  const s = sessoes[idx];
  s.hora_fim = horaFim;
  s.estado   = 'Terminada';
  s.minutos  = calcMinutos(s.hora_inicio, horaFim);
  s.minutos_contados = s.conta_na_meta ? s.minutos : 0;
  s.aprendi  = document.getElementById('cron-aprendi').value;
  s.duvidas  = document.getElementById('cron-duvidas').value;
  saveSessoes(sessoes);

  // Atualizar fonte
  const fontes = getFontes();
  const fIdx = fontes.findIndex(f => f.id === currentFonteId);
  if (fIdx !== -1) {
    fontes[fIdx].ultimo_estudo = horaFim;
    atualizarContador(fontes[fIdx], s.minutos);
    saveFontes(fontes);
  }

  // Atualizar matéria
  const materias = getMaterias();
  const mIdx = materias.findIndex(m => m.id === currentMateriaId);
  if (mIdx !== -1) {
    atualizarContador(materias[mIdx], s.minutos);
    saveMaterias(materias);
  }

  // Atualizar user
  const user = getUser();
  if (user) {
    atualizarContador(user, s.minutos_contados);
    saveUser(user);
  }

  // Ir para reflexão
  document.getElementById('ref-info').textContent = `${s.nome_materia} · ${s.nome_fonte}`;
  document.getElementById('ref-duracao').textContent = `${formatMin(s.minutos)} min`;
  document.getElementById('ref-resumo').value  = s.resumo || '';
  document.getElementById('ref-aprendi').value = s.aprendi || '';
  document.getElementById('ref-duvidas').value = s.duvidas || '';
  const fonte = getFontes().find(f => f.id === currentFonteId);
  document.getElementById('ref-ponto').value   = fonte ? (fonte.ponto_paragem || '') : '';

  goTo('screen-reflexao');
}

// ══════════════════════════════════════════════════════
//  11 – REFLEXÃO
// ══════════════════════════════════════════════════════
function guardarReflexao() {
  const sessoes = getSessoes();
  const idx = sessoes.findIndex(s => s.id === currentSessaoId);
  if (idx === -1) return;

  sessoes[idx].resumo  = document.getElementById('ref-resumo').value;
  sessoes[idx].aprendi = document.getElementById('ref-aprendi').value;
  sessoes[idx].duvidas = document.getElementById('ref-duvidas').value;
  sessoes[idx].ponto_paragem = document.getElementById('ref-ponto').value;
  saveSessoes(sessoes);

  // Atualizar ponto de paragem da fonte
  const fontes = getFontes();
  const fIdx = fontes.findIndex(f => f.id === currentFonteId);
  if (fIdx !== -1) {
    fontes[fIdx].ponto_paragem = document.getElementById('ref-ponto').value;
    saveFontes(fontes);
  }

  // Ecrã de conclusão
  const s = sessoes[idx];
  document.getElementById('sc-minutos').textContent = formatMin(s.minutos);
  document.getElementById('sc-info').textContent =
    `${s.nome_materia} · ${s.nome_fonte}`;

  goTo('screen-sessao-concluida');
}

// ══════════════════════════════════════════════════════
//  13 – HISTÓRICO & CALENDÁRIO
// ══════════════════════════════════════════════════════
function prevMonth() {
  calDate.setMonth(calDate.getMonth() - 1);
  renderHistorico();
}

function nextMonth() {
  calDate.setMonth(calDate.getMonth() + 1);
  renderHistorico();
}

function selectCalendarDate(dateStr) {
  if (calSelectedDateStr === dateStr) {
    calSelectedDateStr = null; // desmarca se clicar de novo
  } else {
    calSelectedDateStr = dateStr;
  }
  renderHistorico();
}

function clearCalendarFilter() {
  calSelectedDateStr = null;
  renderHistorico();
}

function renderCalendar() {
  const grid = document.getElementById('cal-days-grid');
  const title = document.getElementById('cal-month-title');
  if (!grid || !title) return;

  const year = calDate.getFullYear();
  const month = calDate.getMonth();

  // Ex: "Novembro 2026"
  const monthName = calDate.toLocaleDateString('pt-PT', { month: 'long', year: 'numeric' });
  title.textContent = monthName.charAt(0).toUpperCase() + monthName.slice(1);

  // Primeiro dia da semana (Segunda = 0 ... Domingo = 6)
  const firstDay = new Date(year, month, 1);
  let startDay = firstDay.getDay() - 1;
  if (startDay === -1) startDay = 6;

  const daysInMonth = new Date(year, month + 1, 0).getDate();

  // Dias com sessões terminadas neste mês
  const sessoes = getSessoes().filter(s => s.estado === 'Terminada');
  const sessionDaysSet = new Set();
  sessoes.forEach(s => {
    const d = new Date(s.hora_inicio);
    if (d.getFullYear() === year && d.getMonth() === month) {
      sessionDaysSet.add(d.getDate());
    }
  });

  const today = new Date();
  const isCurrentMonth = today.getFullYear() === year && today.getMonth() === month;

  let html = '';
  for (let i = 0; i < startDay; i++) {
    html += '<div class="cal-day empty"></div>';
  }

  for (let day = 1; day <= daysInMonth; day++) {
    const isTodayDay = isCurrentMonth && today.getDate() === day;
    const hasSession = sessionDaysSet.has(day);
    const dateObj = new Date(year, month, day);
    const dateStr = diaTexto(dateObj.getTime());
    const isSelected = calSelectedDateStr === dateStr;

    let classes = ['cal-day'];
    if (isTodayDay) classes.push('today');
    if (hasSession) classes.push('has-session');
    if (isSelected) classes.push('selected');

    html += `<div class="${classes.join(' ')}" onclick="selectCalendarDate('${dateStr}')">${day}</div>`;
  }

  grid.innerHTML = html;
}

function renderHistorico() {
  renderCalendar();

  const query = (document.getElementById('hist-search')?.value || '').toLowerCase();
  let sessoes = getSessoes()
    .filter(s => s.estado === 'Terminada')
    .sort((a, b) => b.hora_inicio - a.hora_inicio);

  // Filtro por dia do calendário
  const banner = document.getElementById('cal-selected-banner');
  if (banner) {
    if (calSelectedDateStr) {
      sessoes = sessoes.filter(s => (s.dia || diaTexto(s.hora_inicio)) === calSelectedDateStr);
      const totalMinDia = sessoes.reduce((acc, s) => acc + (s.minutos || 0), 0);
      banner.style.display = 'flex';
      banner.className = 'cal-filter-banner';
      banner.innerHTML = `
        <span>📅 ${calSelectedDateStr} · ⏱ ${formatMin(totalMinDia)} min (${sessoes.length} ${sessoes.length === 1 ? 'sessão' : 'sessões'})</span>
        <button class="btn btn-sm btn-ghost" style="padding:4px 10px;font-size:12px" onclick="clearCalendarFilter()">✕ Ver todos</button>
      `;
    } else {
      banner.style.display = 'none';
    }
  }

  if (query) {
    sessoes = sessoes.filter(s => {
      return [s.resumo, s.nome_materia, s.nome_fonte, s.dia].some(
        v => v && v.toLowerCase().includes(query)
      );
    });
  }

  const list = document.getElementById('historico-list');
  if (!sessoes.length) {
    list.innerHTML = `<div class="empty-state"><div class="empty-icon">📋</div><p>${calSelectedDateStr ? 'Nenhuma sessão neste dia.' : 'Nenhuma sessão encontrada.'}</p></div>`;
    return;
  }

  list.innerHTML = sessoes.map(s => `
    <div class="card" onclick="abrirDetalheSessao('${s.id}')">
      <div class="card-title">${s.nome_materia}</div>
      <div class="card-sub">📄 ${s.nome_fonte}</div>
      <div class="card-sub">⏱ ${formatMin(s.minutos)} min · 📅 ${s.dia || formatDate(s.hora_inicio)}</div>
      ${s.resumo ? `<div class="card-sub mt-8">${s.resumo.slice(0, 80)}${s.resumo.length > 80 ? '…' : ''}</div>` : ''}
    </div>`).join('');
}

// ══════════════════════════════════════════════════════
//  14 – DETALHE DA SESSÃO
// ══════════════════════════════════════════════════════
function abrirDetalheSessao(id) {
  currentSessaoId = id;
  renderDetalheSessao();
  goTo('screen-detalhe-sessao');
}

function renderDetalheSessao() {
  const s = getSessoes().find(x => x.id === currentSessaoId);
  if (!s) return;

  const rows = [
    ['Matéria',          s.nome_materia],
    ['Fonte',            s.nome_fonte],
    ['Data',             s.dia || formatDate(s.hora_inicio)],
    ['Início',           formatDate(s.hora_inicio)],
    ['Duração',          `${formatMin(s.minutos)} min`],
    ['Ponto de paragem', s.ponto_paragem || '—'],
    ['Resumo',           s.resumo || '—'],
    ['O que aprendi',    s.aprendi || '—'],
    ['Dúvidas',          s.duvidas || '—'],
  ];

  document.getElementById('detalhe-sessao-content').innerHTML =
    rows.map(([l, v]) => `
      <div class="detail-row">
        <div class="detail-label">${l}</div>
        <div class="detail-value">${v}</div>
      </div>`).join('');
}

// ══════════════════════════════════════════════════════
//  22 – EDITAR SESSÃO
// ══════════════════════════════════════════════════════
function prepararEdicaoSessao() {
  const s = getSessoes().find(x => x.id === currentSessaoId);
  if (!s) return;

  // Guardar valores anteriores
  const sessoes = getSessoes();
  const idx = sessoes.findIndex(x => x.id === currentSessaoId);
  sessoes[idx].minutos_antes  = s.minutos;
  sessoes[idx].contados_antes = s.minutos_contados;
  saveSessoes(sessoes);

  document.getElementById('es-inicio').value = toDatetimeLocal(s.hora_inicio);
  document.getElementById('es-fim').value    = toDatetimeLocal(s.hora_fim);
  document.getElementById('es-resumo').value  = s.resumo || '';
  document.getElementById('es-aprendi').value = s.aprendi || '';
  document.getElementById('es-duvidas').value = s.duvidas || '';

  goTo('screen-editar-sessao');
}

function guardarEdicaoSessao() {
  const inicio = new Date(document.getElementById('es-inicio').value).getTime();
  const fim    = new Date(document.getElementById('es-fim').value).getTime();

  if (!inicio || !fim || fim <= inicio) {
    toast('Verifica as horas de início e fim!');
    return;
  }

  const sessoes = getSessoes();
  const idx = sessoes.findIndex(s => s.id === currentSessaoId);
  if (idx === -1) return;

  const s = sessoes[idx];
  const minutosAntigos     = s.minutos_antes || 0;
  const contadosAntigos    = s.contados_antes || 0;

  s.hora_inicio = inicio;
  s.hora_fim    = fim;
  s.resumo      = document.getElementById('es-resumo').value;
  s.aprendi     = document.getElementById('es-aprendi').value;
  s.duvidas     = document.getElementById('es-duvidas').value;
  s.minutos     = calcMinutos(inicio, fim);
  s.minutos_contados = s.conta_na_meta ? s.minutos : 0;
  saveSessoes(sessoes);

  // Atualizar contadores se sessão for de hoje
  if (isToday(inicio)) {
    const diff         = s.minutos - minutosAntigos;
    const diffContados = s.minutos_contados - contadosAntigos;

    const materias = getMaterias();
    const mIdx = materias.findIndex(m => m.id === s.subject_id);
    if (mIdx !== -1) {
      materias[mIdx].minutos_hoje = Math.round((materias[mIdx].minutos_hoje + diff) * 10) / 10;
      saveMaterias(materias);
    }

    const fontes = getFontes();
    const fIdx = fontes.findIndex(f => f.id === s.source_id);
    if (fIdx !== -1) {
      fontes[fIdx].minutos_hoje = Math.round((fontes[fIdx].minutos_hoje + diff) * 10) / 10;
      saveFontes(fontes);
    }

    const user = getUser();
    if (user) {
      user.minutos_hoje = Math.round((user.minutos_hoje + diffContados) * 10) / 10;
      saveUser(user);
    }
  }

  toast('Sessão atualizada!');
  renderDetalheSessao();
  goTo('screen-detalhe-sessao');
}

function confirmarApagarSessao() {
  goTo('screen-confirmar-apagar-sessao');
}

function apagarSessao() {
  let sessoes = getSessoes();
  sessoes = sessoes.filter(s => s.id !== currentSessaoId);
  saveSessoes(sessoes);
  currentSessaoId = null;
  toast('Sessão apagada!');
  renderHistorico();
  goTo('screen-historico');
}

// ══════════════════════════════════════════════════════
//  23 – COPIAR SESSÃO
// ══════════════════════════════════════════════════════
function prepararCopiarSessao() {
  const s = getSessoes().find(x => x.id === currentSessaoId);
  if (!s) return;

  const texto = `## ${s.nome_materia} · ${s.nome_fonte}
- Data: ${s.dia || formatDate(s.hora_inicio)}
- Tempo: ${formatMin(s.minutos)} min
- Resumo: ${s.resumo || '—'}
- Aprendi: ${s.aprendi || '—'}
- Dúvidas: ${s.duvidas || '—'}
- Ponto de paragem: ${s.ponto_paragem || '—'}`;

  document.getElementById('copiar-texto').value = texto;
  goTo('screen-copiar-sessao');
}

function copiarTexto() {
  const textarea = document.getElementById('copiar-texto');
  textarea.select();
  navigator.clipboard.writeText(textarea.value)
    .then(() => toast('Copiado para a área de transferência!'))
    .catch(() => toast('Seleciona e copia manualmente!'));
}

// ══════════════════════════════════════════════════════
//  16 – SESSÃO MANUAL
// ══════════════════════════════════════════════════════
function renderFontesManual() {
  const id = document.getElementById('sm-materia').value;
  const fontes = getFontes().filter(f => f.subject_id === id);
  const sel = document.getElementById('sm-fonte');
  sel.innerHTML = '<option value="">Seleciona uma fonte</option>' +
    fontes.map(f => `<option value="${f.id}">${f.name}</option>`).join('');
}

function prepararSessaoManual() {
  const materias = getMaterias();
  const sel = document.getElementById('sm-materia');
  sel.innerHTML = '<option value="">Seleciona uma matéria</option>' +
    materias.map(m => `<option value="${m.id}">${m.name}</option>`).join('');
  document.getElementById('sm-fonte').innerHTML = '<option value="">Seleciona uma fonte</option>';
  goTo('screen-sessao-manual');
}

function guardarSessaoManual() {
  const inicio    = new Date(document.getElementById('sm-inicio').value).getTime();
  const fim       = new Date(document.getElementById('sm-fim').value).getTime();
  const materiaId = document.getElementById('sm-materia').value;
  const fonteId   = document.getElementById('sm-fonte').value;

  if (!inicio || !fim || fim <= inicio) { toast('Verifica as horas!'); return; }
  if (!materiaId) { toast('Seleciona uma matéria!'); return; }

  const materia = getMaterias().find(m => m.id === materiaId);
  const fonte   = getFontes().find(f => f.id === fonteId);
  const minutos = calcMinutos(inicio, fim);

  const sessao = {
    id: uid(), subject_id: materiaId, source_id: fonteId || null,
    hora_inicio: inicio, hora_fim: fim,
    minutos, estado: 'Terminada',
    resumo:   document.getElementById('sm-resumo').value,
    aprendi:  document.getElementById('sm-aprendi').value,
    duvidas:  document.getElementById('sm-duvidas').value,
    ponto_paragem: '',
    manual: true,
    dia: diaTexto(inicio),
    conta_na_meta: materia ? materia.conta_na_meta : false,
    minutos_contados: (materia && materia.conta_na_meta) ? minutos : 0,
    nome_materia: materia ? materia.name : '—',
    nome_fonte:   fonte ? fonte.name : '—',
    minutos_antes: 0, contados_antes: 0
  };

  const sessoes = getSessoes();
  sessoes.push(sessao);
  saveSessoes(sessoes);

  if (isToday(inicio)) {
    const materias = getMaterias();
    const mIdx = materias.findIndex(m => m.id === materiaId);
    if (mIdx !== -1) { atualizarContador(materias[mIdx], minutos); saveMaterias(materias); }

    if (fonteId) {
      const fontes = getFontes();
      const fIdx = fontes.findIndex(f => f.id === fonteId);
      if (fIdx !== -1) { atualizarContador(fontes[fIdx], minutos); saveFontes(fontes); }
    }

    const user = getUser();
    if (user) { atualizarContador(user, sessao.minutos_contados); saveUser(user); }
  }

  toast('Sessão guardada!');
  goTo('screen-home');
  renderHome();
}

// ══════════════════════════════════════════════════════
//  17 – DEFINIÇÕES / PERFIL / METAS / CONTA
// ══════════════════════════════════════════════════════
function prepararPerfil() {
  const user = getUser();
  if (!user) return;
  document.getElementById('pf-nome').value  = user.name  || '';
  document.getElementById('pf-email').value = user.email || '';
  goTo('screen-perfil');
}

function guardarPerfil() {
  const user = getUser();
  if (!user) return;
  user.name  = document.getElementById('pf-nome').value.trim();
  user.email = document.getElementById('pf-email').value.trim();
  saveUser(user);
  toast('Perfil atualizado!');
  goTo('screen-definicoes');
}

function renderMetas() {
  const user     = getUser();
  const materias = getMaterias();
  document.getElementById('metas-total').textContent = user ? user.meta_total || 0 : 0;

  const list = document.getElementById('metas-list');
  if (!materias.length) {
    list.innerHTML = `<div class="empty-state"><div class="empty-icon">🎯</div><p>Sem matérias.</p></div>`;
    return;
  }

  list.innerHTML = materias.map(m => `
    <div class="card">
      <div class="card-title">${m.name}</div>
      <div class="form-group mb-8">
        <label>Meta (min)</label>
        <input type="number" id="meta-min-${m.id}" value="${m.meta_diaria_min || 0}" min="0"
          onchange="updateMetaMateria('${m.id}')">
      </div>
      <div class="toggle-wrap">
        <label class="toggle">
          <input type="checkbox" ${m.conta_na_meta ? 'checked' : ''}
            onchange="toggleContaMeta('${m.id}', this.checked); renderMetas()">
          <span class="toggle-slider"></span>
        </label>
        <span style="font-size:14px;color:#374151">Conta para a meta</span>
      </div>
    </div>`).join('');
}

function updateMetaMateria(id) {
  const val = parseFloat(document.getElementById(`meta-min-${id}`).value) || 0;
  const materias = getMaterias();
  const idx = materias.findIndex(m => m.id === id);
  if (idx === -1) return;
  materias[idx].meta_diaria_min = val;
  materias[idx].meta_contada   = materias[idx].conta_na_meta ? val : 0;
  saveMaterias(materias);
  recalcMetaTotal();
  document.getElementById('metas-total').textContent = getUser()?.meta_total || 0;
  toast('Meta diária atualizada!');
}

function terminarSessaoUser() {
  if (!confirm('Tens a certeza que queres terminar a sessão neste aparelho?')) return;
  if (cloudUnsubscribe) { cloudUnsubscribe(); cloudUnsubscribe = null; }
  currentUserUid = null;
  localStorage.removeItem('user');
  localStorage.removeItem('subjects');
  localStorage.removeItem('sources');
  localStorage.removeItem('sessions');
  if (auth) {
    auth.signOut().finally(() => {
      goTo('screen-inicio');
      toast('Sessão terminada.');
    });
  } else {
    goTo('screen-inicio');
  }
}

function confirmarApagarConta() {
  if (!confirm('Tens a certeza? Todos os dados serão apagados permanentemente!')) return;
  localStorage.clear();
  goTo('screen-inicio');
}

// ══════════════════════════════════════════════════════
//  BACKUP E RESTAURO DE DADOS (JSON)
// ══════════════════════════════════════════════════════
function descarregarBackup() {
  const backup = {
    user: getUser(),
    subjects: getMaterias(),
    sources: getFontes(),
    sessions: getSessoes(),
    theme: localStorage.getItem('theme') || 'light',
    exported_at: new Date().toISOString()
  };

  const jsonStr = JSON.stringify(backup, null, 2);
  const blob = new Blob([jsonStr], { type: 'application/json' });
  const url = URL.createObjectURL(blob);

  const a = document.createElement('a');
  const d = new Date();
  const pad = n => String(n).padStart(2, '0');
  const dataHoje = `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;

  a.href = url;
  a.download = `estudapp-backup-${dataHoje}.json`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);

  toast('Backup descarregado com sucesso!');
}

function restaurarBackup(event) {
  const file = event.target.files[0];
  if (!file) return;

  const reader = new FileReader();
  reader.onload = function(e) {
    try {
      const data = JSON.parse(e.target.result);

      if (!data.user && !data.subjects && !data.sessions) {
        toast('Ficheiro inválido! Não contém dados do EstudApp.');
        return;
      }

      if (!confirm('Atenção: Ao restaurar este backup, os teus dados atuais serão substituídos pelos do ficheiro. Queres continuar?')) {
        event.target.value = '';
        return;
      }

      if (data.user)     saveUser(data.user);
      if (data.subjects) saveMaterias(data.subjects);
      if (data.sources)  saveFontes(data.sources);
      if (data.sessions) saveSessoes(data.sessions);
      if (data.theme)    applyTheme(data.theme);

      event.target.value = '';
      toast('Dados restaurados com sucesso!');
      recalcMetaTotal();
      renderHome();
      goTo('screen-home');
    } catch (err) {
      toast('Erro ao ler o ficheiro JSON!');
      console.error(err);
    }
  };
  reader.readAsText(file);
}

// ══════════════════════════════════════════════════════
//  NOTIFICAÇÕES & SONS
// ══════════════════════════════════════════════════════
let lastPomodoroAlertBlock = 0;
let metaAlertGiven = false;

function getNotifSettings() {
  const def = {
    som: true,
    vibrar: true,
    pomodoro: true,
    metaAtingida: true
  };
  return Object.assign(def, JSON.parse(localStorage.getItem('notif_settings') || '{}'));
}

function saveNotifSettings(cfg) {
  localStorage.setItem('notif_settings', JSON.stringify(cfg));
}

function toggleNotifConfig(key, val) {
  const cfg = getNotifSettings();
  cfg[key] = val;
  saveNotifSettings(cfg);
}

function renderNotificacoes() {
  const cfg = getNotifSettings();
  const toggleSom = document.getElementById('notif-toggle-som');
  const toggleVib = document.getElementById('notif-toggle-vibrar');
  const togglePomo = document.getElementById('notif-toggle-pomodoro');
  const toggleMeta = document.getElementById('notif-toggle-meta');

  if (toggleSom)  toggleSom.checked  = !!cfg.som;
  if (toggleVib)  toggleVib.checked  = !!cfg.vibrar;
  if (togglePomo) togglePomo.checked = !!cfg.pomodoro;
  if (toggleMeta) toggleMeta.checked = !!cfg.metaAtingida;

  // Atualizar estado de permissão do browser
  const permStatus = document.getElementById('notif-perm-status');
  const btnReq = document.getElementById('btn-request-notif');

  if (!('Notification' in window)) {
    if (permStatus) permStatus.textContent = 'Não suportado neste navegador';
    if (btnReq) btnReq.style.display = 'none';
  } else if (Notification.permission === 'granted') {
    if (permStatus) permStatus.textContent = '✅ Ativadas com sucesso';
    if (btnReq) {
      btnReq.textContent = 'Ativo';
      btnReq.className = 'btn btn-sm btn-ghost';
      btnReq.disabled = true;
    }
  } else if (Notification.permission === 'denied') {
    if (permStatus) permStatus.textContent = '❌ Bloqueadas nas definições';
    if (btnReq) {
      btnReq.textContent = 'Bloqueado';
      btnReq.className = 'btn btn-sm btn-danger';
      btnReq.disabled = true;
    }
  } else {
    if (permStatus) permStatus.textContent = 'Por autorizar';
    if (btnReq) {
      btnReq.textContent = 'Ativar';
      btnReq.className = 'btn btn-sm btn-primary';
      btnReq.disabled = false;
    }
  }
}

function pedirPermissaoNotificacao() {
  if (!('Notification' in window)) {
    toast('O teu navegador não suporta notificações de sistema.');
    return;
  }

  Notification.requestPermission().then(permission => {
    renderNotificacoes();
    if (permission === 'granted') {
      toast('Notificações autorizadas com sucesso!');
      tocarSomNotificacao();
    } else {
      toast('Permissão de notificações recusada.');
    }
  });
}

function tocarSomNotificacao() {
  try {
    const AudioContext = window.AudioContext || window.webkitAudioContext;
    if (!AudioContext) return;
    const ctx = new AudioContext();

    const tocarNota = (frequencia, inicio, duracao) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(frequencia, ctx.currentTime + inicio);

      gain.gain.setValueAtTime(0.001, ctx.currentTime + inicio);
      gain.gain.exponentialRampToValueAtTime(0.25, ctx.currentTime + inicio + 0.04);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + inicio + duracao);

      osc.connect(gain);
      gain.connect(ctx.destination);

      osc.start(ctx.currentTime + inicio);
      osc.stop(ctx.currentTime + inicio + duracao);
    };

    // Sino agradável de dois tons (estilo notificação moderna)
    tocarNota(659.25, 0, 0.35);    // E5
    tocarNota(880.00, 0.18, 0.55);  // A5
  } catch (e) {
    console.warn('Áudio não permitido ou erro:', e);
  }
}

function dispararNotificacao(titulo, corpo) {
  const cfg = getNotifSettings();

  // 1. Som
  if (cfg.som) {
    tocarSomNotificacao();
  }

  // 2. Vibração (se no telemóvel)
  if (cfg.vibrar && 'vibrate' in navigator) {
    try { navigator.vibrate([200, 100, 200]); } catch (e) {}
  }

  // 3. Notificação no ecrã (Browser Notification ou Toast)
  if ('Notification' in window && Notification.permission === 'granted') {
    try {
      new Notification(titulo, {
        body: corpo,
        icon: '📚'
      });
    } catch (e) {
      toast(`${titulo} — ${corpo}`);
    }
  } else {
    toast(`${titulo} — ${corpo}`);
  }
}

function testarNotificacaoCompleta() {
  dispararNotificacao(
    'Teste de Notificação 📚',
    'Excelente! O som e o alerta do EstudApp estão a funcionar perfeitamente!'
  );
}

// ── Sobrescrever links de definições para preencher forms ──
document.addEventListener('DOMContentLoaded', () => {
  document.querySelector('.card[onclick="goTo(\'screen-perfil\')"]')
    ?.setAttribute('onclick', 'prepararPerfil()');
  document.querySelector('.card[onclick="goTo(\'screen-metas\')"]')
    ?.setAttribute('onclick', 'goTo(\'screen-metas\'); renderMetas()');
  document.querySelector('.card[onclick*="screen-notificacoes"]')
    ?.setAttribute('onclick', 'goTo(\'screen-notificacoes\'); renderNotificacoes()');
});
