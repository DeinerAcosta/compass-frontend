/* ════════════════════════════════════════
   CONSTANTS & CONFIG
════════════════════════════════════════ */
// Debe tener la S después de http
const API_URL = "https://compass-backend-3f4z.onrender.com/api";
const BSC = [
  {code:"4.1",label:"Garantizar el crecimiento corporativo",axis:"Financiera",color:"#0F7A62",bg:"#E3F9F5"},
  {code:"4.2",label:"Generar valor a los accionistas",axis:"Financiera",color:"#0F7A62",bg:"#E3F9F5"},
  {code:"3.1",label:"Mantener altos niveles de satisfacción",axis:"Clientes",color:"#1252A3",bg:"#EFF6FF"},
  {code:"3.2",label:"Ser la opción de preferencia B2B y B2C",axis:"Clientes",color:"#1252A3",bg:"#EFF6FF"},
  {code:"3.3",label:"Fidelización de alto impacto B2B y B2C",axis:"Clientes",color:"#1252A3",bg:"#EFF6FF"},
  {code:"2.1",label:"Estandarización, automatización y transformación digital",axis:"Procesos",color:"#9A5C0A",bg:"#FFFBEB"},
  {code:"2.2",label:"Mantener altos estándares de calidad",axis:"Procesos",color:"#9A5C0A",bg:"#FFFBEB"},
  {code:"2.3",label:"Crear la Clínica de Casos Complejos",axis:"Procesos",color:"#9A5C0A",bg:"#FFFBEB"},
  {code:"1.1",label:"Dinamizar la gestión tecnológica",axis:"Aprendizaje",color:"#5B21B6",bg:"#F5F3FF"},
  {code:"1.2",label:"Mantener infraestructura física, tecnológica y biomédica",axis:"Aprendizaje",color:"#5B21B6",bg:"#F5F3FF"},
  {code:"1.3",label:"Garantizar perfil idóneo de colaboradores y clima",axis:"Aprendizaje",color:"#5B21B6",bg:"#F5F3FF"},
  {code:"1.4",label:"Diseñar modelo médico con excelencia operativa",axis:"Aprendizaje",color:"#5B21B6",bg:"#F5F3FF"},
  {code:"1.5",label:"Liderar la formación de nuevos talentos",axis:"Aprendizaje",color:"#5B21B6",bg:"#F5F3FF"},
];
const AXES = [
  {name:"Financiera",codes:["4.1","4.2"],color:"#0F7A62"},
  {name:"Clientes",codes:["3.1","3.2","3.3"],color:"#1252A3"},
  {name:"Procesos",codes:["2.1","2.2","2.3"],color:"#9A5C0A"},
  {name:"Aprendizaje",codes:["1.1","1.2","1.3","1.4","1.5"],color:"#5B21B6"},
];
const MKTS = ["COI Electivo — Particulares / Prepagadas","FOCA — EPS (planes obligatorios)","Ambos mercados (VIU + FOCA)"];
const PROCS = ["Gerencia","Dirección Científica","Comercial y Mercadeo","Facturación y Cartera","Logística",  "Compras","Servicio al Cliente (SIAU)","Cirugía","Seguridad del Paciente","Banco de Tejidos","Talento Humano","SST","TSI","Proyectos","Sala Azul","Investigación (CIRVO)","Glaucoma","Retina","Segmento Anterior","Oculoplástica","Pediatría","Cartagena","Santa Marta","Valledupar","Riohacha","Otro"];
const CY = new Date().getFullYear();

/* ════════════════════════════════════════
   STATE
════════════════════════════════════════ */
let CU = null; 
let DB = { users:{}, forms:{}, years:[CY, CY+1, CY+2, CY-1] }; // Temporal cache para vista local
let view = 'home';
let adminTab = 'sent';
let editId = null;
let selId = null;
let selYear = CY; 
let autoSaveTimer = null;
let formSelYears = [CY];
let yearDDOpen = false;
let mpaItems = []; 

/* ════════════════════════════════════════
   CARGA DE DATOS DESDE MYSQL (paralelo + cache)
════════════════════════════════════════ */
const CACHE_KEY = 'compass_db_cache_v1';

function loadCacheFromStorage(){
  try {
    const raw = localStorage.getItem(CACHE_KEY);
    if(!raw) return false;
    const cache = JSON.parse(raw);
    if(cache.forms) DB.forms = cache.forms;
    if(cache.users) DB.users = cache.users;
    if(cache.years && cache.years.length) DB.years = cache.years;
    DB.years.sort((a,b)=>b-a);
    return true;
  } catch(e) { return false; }
}

function saveCacheToStorage(){
  try {
    localStorage.setItem(CACHE_KEY, JSON.stringify({
      forms: DB.forms, users: DB.users, years: DB.years, ts: Date.now()
    }));
  } catch(e) { /* quota o private mode */ }
}

async function loadDB(silent = false){
  try {
    // 3 fetches en paralelo en lugar de secuenciales
    const [resForms, resUsers, resYears] = await Promise.all([
      fetch(`${API_URL}/forms`),
      fetch(`${API_URL}/users`),
      fetch(`${API_URL}/years`)
    ]);
    if(resForms.ok) DB.forms = await resForms.json();
    if(resUsers.ok) DB.users = await resUsers.json();
    if(resYears.ok) {
      const yearsData = await resYears.json();
      if(yearsData.length > 0) DB.years = yearsData;
    }
    DB.years.sort((a,b)=>b-a);
    saveCacheToStorage();
  } catch(e) {
    if(!silent) console.error("No se pudo cargar la base de datos", e);
  }
}

// Refresca datos del backend y vuelve a pintar la vista actual.
// Se usa después de mutaciones (guardar, eliminar, cambiar estado).
async function refreshDB(){
  await loadDB(true);
  render();
}

/* ════════════════════════════════════════
   AUTH (Conectado a FastAPI + LocalStorage)
════════════════════════════════════════ */
function switchAuthTab(t){
  document.getElementById('tab-login').classList.toggle('on',t==='login');
  document.getElementById('tab-reg').classList.toggle('on',t==='register');
  document.getElementById('login-form').style.display=t==='login'?'block':'none';
  document.getElementById('reg-form').style.display=t==='register'?'block':'none';
  document.getElementById('auth-err').style.display='none';
}

function showErr(msg){ 
    const e = document.getElementById('auth-err'); 
    e.textContent = msg; 
    e.style.display = 'block'; 
}

async function doLogin(){
  const email = document.getElementById('li-email').value.trim().toLowerCase();
  const pass = document.getElementById('li-pass').value;
  
  if(!email || !pass) {
      showErr('Ingresa correo y contraseña.'); return;
  }

  try {
    const res = await fetch(`${API_URL}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: email, password: pass })
    });
    
    if (!res.ok) {
        showErr('Correo o contraseña incorrectos.'); return;
    }
    
    const data = await res.json();
    loginUser(data.usuario);
    // Si la BD marca que debe cambiar la contraseña (vino de un reset), forzamos modal
    if (data.usuario && data.usuario.must_change_password) {
      openChangePasswordModal(true);
    }
  } catch(e) {
      showErr('Error al conectar con el servidor.');
  }
}

async function doRegister(){
  const name = document.getElementById('reg-name')?.value.trim();
  const email = document.getElementById('reg-email')?.value.trim().toLowerCase();
  const pass = document.getElementById('reg-pass')?.value;
  const proceso = document.getElementById('reg-proceso')?.value || "General"; 

  if(!name || !email || !pass) {
      showErr('Por favor llena todos los campos obligatorios.'); 
      return;
  }

  try {
    const res = await fetch(`${API_URL}/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ nombre: name, email: email, password: pass, proceso: proceso })
    });
    
    if (!res.ok) {
        const err = await res.json();
        showErr(err.detail || 'Error al registrar el usuario.'); return;
    }
    
    const errBox = document.getElementById('auth-err');
    errBox.textContent = '¡Registro exitoso! Ahora puedes iniciar sesión.';
    errBox.style.display = 'block';
    errBox.style.color = "#10B981"; 
    errBox.style.backgroundColor = "#D1FAE5"; 
    errBox.style.border = "1px solid #10B981";
    
    setTimeout(() => {
        errBox.style.color = "#DC2626"; 
        errBox.style.backgroundColor = "#FEF2F2";
        errBox.style.border = "1px solid #FECACA";
        errBox.style.display = 'none';
        switchAuthTab('login');
    }, 2000);
    
  } catch(e) {
      showErr('Error al conectar con el servidor.');
  }
}

function loginUser(u){
  CU = u;
  // Guardamos la sesión en el navegador
  localStorage.setItem('compass_user', JSON.stringify(u));
  document.getElementById('auth-screen').style.display='none';
  document.getElementById('app-wrap').classList.add('visible');
  setupSidebar();
  // Admin y Viewer arrancan en el panel; usuarios normales en "home"
  if (CU.role === 'admin' || CU.role === 'viewer') {
      adminTab = 'sent';
      setView('admin');
  } else {
      setView('home');
  }
  startNotifPolling();
}

function doLogout(){
  CU = null; editId = null; selId = null;
  stopNotifPolling();
  // Borramos sesión y cache al salir
  localStorage.removeItem('compass_user');
  localStorage.removeItem(CACHE_KEY);
  document.getElementById('auth-screen').style.display='flex';
  document.getElementById('app-wrap').classList.remove('visible');
  document.getElementById('li-pass').value = '';
}

/* ════════════════════════════════════════
   SIDEBAR
════════════════════════════════════════ */
function setupSidebar(){
  const av = document.getElementById('sb-avatar');
  av.textContent = CU.name[0].toUpperCase();
  // Color del avatar según rol
  av.style.background = CU.role === 'admin' ? '#182319'
                       : CU.role === 'viewer' ? '#1252A3'
                       : '#0F7A62';
  document.getElementById('sb-uname').textContent = CU.name;
  document.getElementById('sb-urole').textContent = CU.role === 'admin' ? 'Administrador'
                                                  : CU.role === 'viewer' ? 'Revisor'
                                                  : 'Líder de proceso';

  // Mi espacio: solo para usuarios normales (líderes). Admin y Viewer no lo necesitan.
  document.getElementById('nav-user-section').style.display = CU.role === 'user' ? 'block' : 'none';

  // Sección de Administración / Revisión: visible para admin y viewer
  const adminSection = document.getElementById('nav-admin-section');
  adminSection.style.display = (CU.role === 'admin' || CU.role === 'viewer') ? 'block' : 'none';

  // Para el viewer ocultamos las opciones de gestión (Usuarios y Años)
  document.querySelectorAll('#nav-admin-section [data-view="admin-users"], #nav-admin-section [data-view="admin-years"]').forEach(el => {
    el.style.display = CU.role === 'viewer' ? 'none' : '';
  });
  // El label "Administración" cambia a "Revisión" para viewer
  const adminLabel = adminSection.querySelector('.sb-nav-label');
  if (adminLabel) adminLabel.textContent = CU.role === 'viewer' ? 'Revisión' : 'Administración';

  renderYearSelector();
  updateSentCount();
}

function renderYearSelector(){
  const sel = document.getElementById('year-selector');
  sel.innerHTML = DB.years.map(y => {
    const cnt = formsForYear(y).length;
    const isActive = y === selYear;
    return `<button class="year-btn ${isActive?'active':''}" onclick="selectYear(${y})">
      <div style="display:flex;align-items:center;gap:6px">
        <div class="year-dot"></div>${y}
      </div>
      <span class="year-count">${cnt}</span>
    </button>`;
  }).join('');
}
function selectYear(y){ selYear=y; renderYearSelector(); render(); }

function updateSentCount(){
  const el = document.getElementById('sent-count');
  if(el) el.textContent = sentForms().length;
}
function updateNavHighlight(){
  document.querySelectorAll('[data-view]').forEach(el=>el.classList.remove('active'));
  const key = view === 'admin' ? 'admin-' + adminTab : view;
  const el = document.querySelector(`[data-view="${key}"]`);
  if(el) el.classList.add('active');
}

/* ════════════════════════════════════════
   DATA HELPERS
════════════════════════════════════════ */
function formsForYear(y){ return Object.values(DB.forms).filter(f=>f.year===y); }
function myForms(){ return formsForYear(selYear).filter(f=>f.email===CU.email).sort((a,b)=>new Date(b.updatedAt||b.createdAt)-new Date(a.updatedAt||a.createdAt)); }
// Actualizado: Mostrar tanto enviados como los que solicitaron edición
function sentForms(){ return formsForYear(selYear).filter(f=>f.status==='enviado' || f.status==='Edicion Solicitada').sort((a,b)=>new Date(b.updatedAt||b.createdAt)-new Date(a.updatedAt||a.createdAt)); }
function allMyForms(){ return Object.values(DB.forms).filter(f=>f.email===CU.email).sort((a,b)=>b.year-a.year||new Date(b.updatedAt||b.createdAt)-new Date(a.updatedAt||a.createdAt)); }

function mktC(m){ if(!m)return''; if(m.includes('FOCA'))return'foca'; if(m.includes('Ambos'))return'both'; return'viu'; }
function mktL(m){ if(!m)return''; if(m.includes('FOCA'))return'FOCA'; if(m.includes('Ambos'))return'COI+FOCA'; return'COI'; }
function mktPill(m){ if(!m)return'pill-gray'; if(m.includes('FOCA'))return'pill-blue'; if(m.includes('Ambos'))return'pill-amber'; return'pill-teal'; }
function mktColor(m){ if(m&&m.includes('FOCA'))return'#1A6ACC'; if(m&&m.includes('Ambos'))return'#D08B1A'; return'#14957A'; }
function fmtD(iso){ if(!iso)return''; return new Date(iso).toLocaleDateString('es-CO',{day:'2-digit',month:'short',year:'numeric'}); }

function compl(f){
  const base=[f.proceso,f.lider,f.mercado,f.contexto,f.objetivo,f.supuesto];
  const mpa=(f.mpaItems||[{meta26:f.meta26,meta27:f.meta27}]);
  const mpaFilled=mpa.filter(i=>i.meta26&&i.meta26.trim()).length + mpa.filter(i=>i.meta27&&i.meta27.trim()).length;
  const total=base.filter(x=>x&&x.trim()).length + Math.min(mpaFilled,4) + (f.kpis||[]).filter(k=>k.ind&&k.base).length;
  return Math.round((total / (base.length + 4 + 3)) * 100);
}
function semI(v){ return v==='verde'?'🟢':v==='amarillo'?'🟡':v==='rojo'?'🔴':'—'; }
function newF(){ return{id:'f'+Date.now(),email:CU.email,year:selYear,years:[selYear],createdAt:new Date().toISOString(),proceso:CU.proceso||'',lider:CU.name,mercado:'',bsc:[],contexto:'',objetivo:'',meta26:'',accion26:'',meta27:'',accion27:'',kpis:[{ind:'',base:'',meta26:'',meta27:'',sem:''},{ind:'',base:'',meta26:'',meta27:'',sem:''},{ind:'',base:'',meta26:'',meta27:'',sem:''}],supuesto:'',recurso:'',status:'borrador'}; }

/* ════════════════════════════════════════
   TOAST & UTILS
════════════════════════════════════════ */
let toastTimer = null;
function showToast(msg){
  const el = document.getElementById('toast');
  document.getElementById('toast-msg').textContent=msg;
  el.classList.add('visible');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(()=>el.classList.remove('visible'),3000);
}
function esc(s){ if(!s)return''; return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;'); }

/* ════════════════════════════════════════
   NAVIGATION & RENDER ROUTER
════════════════════════════════════════ */
function setView(v){
  // Viewer/Revisor solo puede entrar a 'admin' (enviados/bsc) y 'detail'
  if (CU && CU.role === 'viewer' && !['admin','detail'].includes(v)) {
    adminTab = 'sent'; v = 'admin';
  }
  view=v; editId=null; updateNavHighlight(); render();
}
function startNew(){
  if (CU && CU.role === 'viewer') { showToast('Solo lectura: no puedes crear formatos'); return; }
  view='form'; editId=null; updateNavHighlight(); render();
}
function openDetail(id){ selId=id; view='detail'; updateNavHighlight(); render(); }
function startEdit(id){
  if (CU && CU.role === 'viewer') { showToast('Solo lectura: no puedes editar'); return; }
  editId=id; view='form'; updateNavHighlight(); render();
}
function setAdminTab(t){
  // Viewer solo puede ver 'sent' y 'bsc'
  if (CU && CU.role === 'viewer' && !['sent','bsc'].includes(t)) t = 'sent';
  adminTab=t; view='admin'; updateNavHighlight(); render();
}

function render(){
  const content = document.getElementById('content');
  if(view==='home') content.innerHTML=renderHome();
  else if(view==='form') content.innerHTML=renderForm(editId?DB.forms[editId]:newF());
  else if(view==='detail') content.innerHTML=renderDetail(DB.forms[selId]);
  else if(view==='history') content.innerHTML=renderHistory();
  else if(view==='admin') content.innerHTML=renderAdmin();
  content.scrollTop=0;
  if(view === 'form') attachListeners();
}

/* ════════════════════════════════════════
   EXPORTACIÓN PDF (cliente, html2pdf.js)
════════════════════════════════════════ */
function buildPDFHTML(f){
  const yr1 = (f.years && f.years[0]) || f.year || selYear;
  const yr2 = (f.years && f.years[1]) || (yr1 + 1);
  const items = (f.mpaItems && f.mpaItems.length) ? f.mpaItems :
                [{meta26:f.meta26, accion26:f.accion26, meta27:f.meta27, accion27:f.accion27}];
  const kpis = (f.kpis || []).filter(k => k.ind);
  const bscList = (f.bsc || []).map(c => {
    const obj = BSC.find(b => b.code === c);
    return obj ? `<span style="display:inline-block;background:${obj.bg};color:${obj.color};border:1px solid ${obj.color}33;padding:3px 9px;border-radius:4px;font-size:10px;font-weight:600;margin:2px 4px 2px 0">${obj.code} · ${obj.label}</span>` : '';
  }).join('');

  const semColor = s => s === 'verde' ? '#10B981' : s === 'amarillo' ? '#F59E0B' : s === 'rojo' ? '#DC2626' : '#9CA3AF';
  const semText  = s => s === 'verde' ? 'Verde' : s === 'amarillo' ? 'Amarillo' : s === 'rojo' ? 'Rojo' : '—';
  const statusLabel = f.status === 'enviado' ? 'Enviado'
                    : f.status === 'Edicion Solicitada' ? 'Edición solicitada'
                    : 'Borrador';
  const statusColor = f.status === 'enviado' ? '#0F7A62'
                    : f.status === 'Edicion Solicitada' ? '#D97706'
                    : '#6B7280';
  const today = new Date().toLocaleDateString('es-CO', {day:'2-digit',month:'long',year:'numeric'});

  // Estilos INLINE — html2pdf no hereda estilos del CSS principal de forma confiable
  return `
  <div style="font-family: 'Helvetica', 'Arial', sans-serif; color: #1A1A17; padding: 0; max-width: 760px; margin: 0 auto; background: #fff;">

    <!-- HEADER -->
    <div style="background: linear-gradient(135deg, #0F7A62 0%, #14957A 100%); color: #fff; padding: 22px 28px; border-radius: 6px 6px 0 0;">
      <div style="display: flex; align-items: center; justify-content: space-between;">
        <div>
          <div style="font-size: 11px; letter-spacing: 2px; text-transform: uppercase; opacity: .85; margin-bottom: 4px;">Clínica Oftalmológica Internacional</div>
          <div style="font-family: Georgia, serif; font-size: 26px; font-weight: 600; letter-spacing: -.5px;">COMPASS</div>
          <div style="font-size: 12px; opacity: .85; margin-top: 2px;">Formato de Planeación Operativa</div>
        </div>
        <div style="text-align: right; font-size: 11px; opacity: .9;">
          <div style="background: rgba(255,255,255,.18); padding: 6px 12px; border-radius: 4px; font-weight: 600; margin-bottom: 4px;">Período ${yr1}${yr2 && yr2 !== yr1 ? ' — ' + yr2 : ''}</div>
          <div>Generado: ${today}</div>
        </div>
      </div>
    </div>

    <!-- BLOQUE DE IDENTIFICACIÓN -->
    <table style="width: 100%; border-collapse: collapse; margin-top: 0; font-size: 11px;">
      <tr>
        <td style="padding: 10px 14px; background: #F4F3F0; border-bottom: 1px solid #E5E3DC; width: 28%; font-weight: 600; color: #4A4841;">Proceso</td>
        <td style="padding: 10px 14px; background: #FAFAF9; border-bottom: 1px solid #E5E3DC;">${esc(f.proceso) || '—'}</td>
      </tr>
      <tr>
        <td style="padding: 10px 14px; background: #F4F3F0; border-bottom: 1px solid #E5E3DC; font-weight: 600; color: #4A4841;">Líder responsable</td>
        <td style="padding: 10px 14px; background: #FAFAF9; border-bottom: 1px solid #E5E3DC;">${esc(f.lider) || '—'}</td>
      </tr>
      <tr>
        <td style="padding: 10px 14px; background: #F4F3F0; border-bottom: 1px solid #E5E3DC; font-weight: 600; color: #4A4841;">Mercado</td>
        <td style="padding: 10px 14px; background: #FAFAF9; border-bottom: 1px solid #E5E3DC;">${esc(f.mercado) || '—'}</td>
      </tr>
      <tr>
        <td style="padding: 10px 14px; background: #F4F3F0; font-weight: 600; color: #4A4841;">Estado</td>
        <td style="padding: 10px 14px; background: #FAFAF9;"><span style="display:inline-block;background:${statusColor}1A;color:${statusColor};padding:3px 10px;border-radius:4px;font-size:10px;font-weight:600">${statusLabel}</span></td>
      </tr>
    </table>

    <!-- C — CONTEXTO -->
    <div style="margin-top: 22px;">
      <div style="font-family: Georgia, serif; font-size: 14px; font-weight: 600; color: #0F7A62; border-bottom: 2px solid #0F7A62; padding-bottom: 4px; margin-bottom: 8px;">C · Contexto actual</div>
      <div style="font-size: 11px; line-height: 1.55; color: #2A2A27; padding: 4px 0;">${esc(f.contexto) || '<em style="color:#8A8780">Sin contexto definido.</em>'}</div>
    </div>

    <!-- O — OBJETIVO -->
    <div style="margin-top: 18px;">
      <div style="font-family: Georgia, serif; font-size: 14px; font-weight: 600; color: #1252A3; border-bottom: 2px solid #1252A3; padding-bottom: 4px; margin-bottom: 8px;">O · Objetivo estratégico (BSC)</div>
      <div style="margin-bottom: 8px;">${bscList || '<em style="font-size:11px;color:#8A8780">Sin objetivos BSC seleccionados.</em>'}</div>
      <div style="font-size: 11px; line-height: 1.55; color: #2A2A27;">${esc(f.objetivo) || '<em style="color:#8A8780">Sin descripción del objetivo.</em>'}</div>
    </div>

    <!-- M+P+A — COMPROMISOS -->
    <div style="margin-top: 18px; page-break-inside: avoid;">
      <div style="font-family: Georgia, serif; font-size: 14px; font-weight: 600; color: #2A3D2D; border-bottom: 2px solid #2A3D2D; padding-bottom: 4px; margin-bottom: 10px;">M · P · A · Compromisos y proyección</div>
      ${items.map((it, idx) => `
        <div style="background: #FAFAF9; border: 1px solid #E5E3DC; border-radius: 6px; padding: 12px 14px; margin-bottom: 10px; page-break-inside: avoid;">
          ${items.length > 1 ? `<div style="font-size:10px;font-weight:700;color:#8A8780;text-transform:uppercase;letter-spacing:1px;margin-bottom:8px">Compromiso ${idx+1}</div>` : ''}
          <table style="width: 100%; border-collapse: collapse;">
            <tr>
              <td style="vertical-align: top; width: 50%; padding-right: 8px; border-right: 1px solid #E5E3DC;">
                <div style="background:#0F7A62;color:#fff;display:inline-block;padding:2px 8px;border-radius:3px;font-size:9px;font-weight:700;letter-spacing:.5px;margin-bottom:6px">◆ ${yr1}</div>
                <div style="margin-bottom: 8px;">
                  <div style="font-size: 9px; font-weight: 700; color: #4A4841; text-transform: uppercase; letter-spacing: .5px; margin-bottom: 2px;">M — Meta</div>
                  <div style="font-size: 11px; line-height: 1.5;">${esc(it.meta26) || '—'}</div>
                </div>
                ${it.accion26 ? `<div>
                  <div style="font-size: 9px; font-weight: 700; color: #4A4841; text-transform: uppercase; letter-spacing: .5px; margin-bottom: 2px;">A — Acción palanca</div>
                  <div style="font-size: 11px; line-height: 1.5;">${esc(it.accion26)}</div>
                </div>` : ''}
              </td>
              <td style="vertical-align: top; width: 50%; padding-left: 12px;">
                <div style="background:#1252A3;color:#fff;display:inline-block;padding:2px 8px;border-radius:3px;font-size:9px;font-weight:700;letter-spacing:.5px;margin-bottom:6px">◇ ${yr2}</div>
                <div style="margin-bottom: 8px;">
                  <div style="font-size: 9px; font-weight: 700; color: #4A4841; text-transform: uppercase; letter-spacing: .5px; margin-bottom: 2px;">P — Meta proyectada</div>
                  <div style="font-size: 11px; line-height: 1.5;">${esc(it.meta27) || '—'}</div>
                </div>
                ${it.accion27 ? `<div>
                  <div style="font-size: 9px; font-weight: 700; color: #4A4841; text-transform: uppercase; letter-spacing: .5px; margin-bottom: 2px;">A — Acción palanca</div>
                  <div style="font-size: 11px; line-height: 1.5;">${esc(it.accion27)}</div>
                </div>` : ''}
              </td>
            </tr>
          </table>
        </div>
      `).join('')}
    </div>

    <!-- S — KPIs -->
    <div style="margin-top: 18px; page-break-inside: avoid;">
      <div style="font-family: Georgia, serif; font-size: 14px; font-weight: 600; color: #9A5C0A; border-bottom: 2px solid #9A5C0A; padding-bottom: 4px; margin-bottom: 8px;">S · Semáforo de KPIs</div>
      <table style="width: 100%; border-collapse: collapse; font-size: 10px;">
        <thead>
          <tr style="background: #F4F3F0;">
            <th style="padding: 8px 10px; text-align: left; border: 1px solid #E5E3DC; font-weight: 700; color: #4A4841; font-size: 10px; text-transform: uppercase; letter-spacing: .5px;">Indicador</th>
            <th style="padding: 8px 10px; text-align: left; border: 1px solid #E5E3DC; font-weight: 700; color: #4A4841; font-size: 10px; text-transform: uppercase; letter-spacing: .5px;">Línea base</th>
            <th style="padding: 8px 10px; text-align: left; border: 1px solid #E5E3DC; font-weight: 700; color: #4A4841; font-size: 10px; text-transform: uppercase; letter-spacing: .5px;">Meta ${yr1}</th>
            <th style="padding: 8px 10px; text-align: left; border: 1px solid #E5E3DC; font-weight: 700; color: #4A4841; font-size: 10px; text-transform: uppercase; letter-spacing: .5px;">Meta ${yr2}</th>
            <th style="padding: 8px 10px; text-align: center; border: 1px solid #E5E3DC; font-weight: 700; color: #4A4841; font-size: 10px; text-transform: uppercase; letter-spacing: .5px;">Semáforo</th>
          </tr>
        </thead>
        <tbody>
          ${kpis.length ? kpis.map(k => `
            <tr>
              <td style="padding: 8px 10px; border: 1px solid #E5E3DC; font-weight: 600;">${esc(k.ind)}</td>
              <td style="padding: 8px 10px; border: 1px solid #E5E3DC;">${esc(k.base) || '—'}</td>
              <td style="padding: 8px 10px; border: 1px solid #E5E3DC; color: #0F7A62; font-weight: 600;">${esc(k.meta26) || '—'}</td>
              <td style="padding: 8px 10px; border: 1px solid #E5E3DC; color: #1252A3; font-weight: 600;">${esc(k.meta27) || '—'}</td>
              <td style="padding: 8px 10px; border: 1px solid #E5E3DC; text-align: center;">
                <span style="display:inline-block;width:10px;height:10px;border-radius:50%;background:${semColor(k.sem)};margin-right:4px;vertical-align:middle"></span>
                <span style="font-weight:600;color:${semColor(k.sem)};vertical-align:middle">${semText(k.sem)}</span>
              </td>
            </tr>
          `).join('') : `<tr><td colspan="5" style="padding: 14px; text-align: center; border: 1px solid #E5E3DC; color: #8A8780; font-style: italic;">Sin KPIs definidos</td></tr>`}
        </tbody>
      </table>
    </div>

    <!-- S — SUPUESTO + APOYO -->
    <div style="margin-top: 18px; page-break-inside: avoid;">
      <div style="font-family: Georgia, serif; font-size: 14px; font-weight: 600; color: #9F1239; border-bottom: 2px solid #9F1239; padding-bottom: 4px; margin-bottom: 8px;">S · Supuesto crítico y apoyo requerido</div>
      <table style="width: 100%; border-collapse: collapse; font-size: 11px;">
        <tr>
          <td style="width: 50%; vertical-align: top; padding: 10px 12px; border: 1px solid #E5E3DC; background: #FFF1F2;">
            <div style="font-size: 9px; font-weight: 700; color: #9F1239; text-transform: uppercase; letter-spacing: .5px; margin-bottom: 4px;">Supuesto crítico</div>
            <div style="line-height: 1.5;">${esc(f.supuesto) || '<em style="color:#8A8780">Sin supuesto definido.</em>'}</div>
          </td>
          <td style="width: 50%; vertical-align: top; padding: 10px 12px; border: 1px solid #E5E3DC; background: #FAFAF9;">
            <div style="font-size: 9px; font-weight: 700; color: #4A4841; text-transform: uppercase; letter-spacing: .5px; margin-bottom: 4px;">Apoyo requerido de Gerencia</div>
            <div style="line-height: 1.5;">${esc(f.recurso) || '<em style="color:#8A8780">No se requiere apoyo específico.</em>'}</div>
          </td>
        </tr>
      </table>
    </div>

    <!-- FOOTER -->
    <div style="margin-top: 26px; padding-top: 10px; border-top: 1px solid #E5E3DC; display: flex; justify-content: space-between; font-size: 9px; color: #8A8780;">
      <div>COMPASS · Clínica Oftalmológica Internacional</div>
      <div>Documento generado automáticamente · ${today}</div>
    </div>

  </div>
  `;
}

function downloadFormPDF(formId){
  const f = DB.forms[formId];
  if (!f) { showToast('❌ Formato no encontrado'); return; }

  const procStr = (f.proceso || 'formato').replace(/[^a-zA-Z0-9_\-áéíóúñÁÉÍÓÚÑ ]+/g, '').replace(/\s+/g, '_');
  const yr = f.year || ((f.years && f.years[0]) || selYear);
  const title = `COMPASS_${procStr}_${yr}`;
  const inner = buildPDFHTML(f);

  // Estrategia nativa: ventana nueva con el HTML + window.print()
  // El usuario elige "Guardar como PDF" en el diálogo del navegador.
  // 100% confiable, sin depender de html2canvas.
  const docHTML = `<!DOCTYPE html>
<html lang="es">
<head>
<meta charset="UTF-8">
<title>${title}</title>
<style>
  @page { size: A4 portrait; margin: 10mm 10mm 12mm 10mm; }
  html, body { margin: 0; padding: 0; background: #ffffff; }
  body { font-family: 'Helvetica', 'Arial', sans-serif; color: #1A1A17; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
  @media print {
    .no-print { display: none !important; }
  }
  .toolbar {
    position: sticky; top: 0; z-index: 10;
    background: #0A120E; color: #fff;
    padding: 14px 24px; display: flex; align-items: center; justify-content: space-between;
    box-shadow: 0 4px 12px rgba(0,0,0,.2);
  }
  .toolbar-title { font-weight: 600; font-size: 14px; }
  .toolbar-actions { display: flex; gap: 8px; }
  .tb-btn {
    background: #0F7A62; color: #fff; border: none;
    padding: 8px 18px; border-radius: 6px; font-weight: 600; font-size: 13px;
    cursor: pointer; transition: background .15s;
  }
  .tb-btn:hover { background: #14957A; }
  .tb-btn.alt { background: transparent; border: 1px solid rgba(255,255,255,.3); }
  .tb-btn.alt:hover { background: rgba(255,255,255,.1); }
  .doc-pad { padding: 24px; max-width: 794px; margin: 0 auto; }
</style>
</head>
<body>
  <div class="toolbar no-print">
    <div class="toolbar-title">📄 ${title}.pdf</div>
    <div class="toolbar-actions">
      <button class="tb-btn alt" onclick="window.close()">Cerrar</button>
      <button class="tb-btn" onclick="window.print()">📥 Descargar / Imprimir PDF</button>
    </div>
  </div>
  <div class="doc-pad">${inner}</div>
  <script>
    // Auto-disparar el diálogo de impresión apenas carga la página
    window.addEventListener('load', () => {
      setTimeout(() => { window.focus(); window.print(); }, 350);
    });
  <\/script>
</body>
</html>`;

  const w = window.open('', '_blank', 'width=900,height=900');
  if (!w) {
    showToast('❌ Tu navegador bloqueó la ventana — permite popups para este sitio');
    return;
  }
  w.document.open();
  w.document.write(docHTML);
  w.document.close();
  showToast('📄 Abriendo vista previa de PDF…');
}

/* ════════════════════════════════════════
   API ACTIONS (Admin Delete & Status)
════════════════════════════════════════ */
async function deleteFormComplete(formId) {
  if(!confirm('⚠️ ¿Estás seguro de eliminar este formato por completo? Esta acción NO se puede deshacer.')) return;
  try {
      const res = await fetch(`${API_URL}/forms/${formId}`, { method: 'DELETE' });
      if(res.ok) {
          showToast('✓ Formato y KPIs eliminados completamente');
          view = CU.role === 'admin' ? 'admin' : 'home';
          await loadDB();
          render();
      } else {
          showToast('❌ Error al eliminar');
      }
  } catch(e) { console.error(e); }
}

async function updateFormStatus(formId, newStatus) {
  if(!confirm(`¿Deseas cambiar el estado a: ${newStatus}?`)) return;
  try {
      const res = await fetch(`${API_URL}/forms/${formId}/status`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ status: newStatus })
      });
      if(res.ok) {
          showToast('✓ Estado actualizado');
          await loadDB();
          render();
      } else {
          showToast('❌ Error al actualizar estado');
      }
  } catch(e) { console.error(e); }
}

/* ════════════════════════════════════════
   VIEWS (HOME & CARDS)
════════════════════════════════════════ */
function renderHome(){
  const forms=myForms();
  // Incluimos ambos estados para no ocultarle su formato al usuario
  const sent=forms.filter(f=>f.status==='enviado' || f.status==='Edicion Solicitada');
  const drafts=forms.filter(f=>f.status==='borrador');
  const formatWord=(n,s='formato',p='formatos')=>n===1?s:p;
  return`
  <div class="page-header anim-up">
    <div>
      <div class="page-title">Hola, <em>${CU.name.split(' ')[0]}</em></div>
      <div class="page-sub">Período ${selYear} · ${forms.length} ${formatWord(forms.length)}</div>
    </div>
    <button class="btn btn-teal" onclick="startNew()">+ Nuevo formato</button>
  </div>
  <div class="content-pad">
    <div class="year-banner anim-up anim-up-1" data-year="${selYear}">
      <div class="yb-eyebrow">Período activo</div>
      <div class="yb-title">Planeación <em>${selYear}</em></div>
      <div class="yb-sub">Registra tus compromisos, acciones palanca e indicadores usando la metodología COMPASS.</div>
      <div class="yb-stats">
        <div><div class="ybs-n">${sent.length}</div><div class="ybs-l">Enviados</div></div>
        <div><div class="ybs-n">${drafts.length}</div><div class="ybs-l">Borradores</div></div>
      </div>
    </div>
    ${sent.length>0?`<div class="sec-head anim-up anim-up-2"><div><div class="sec-title">Formatos <em>enviados</em></div><div class="sec-sub">Compromisos finales — ${selYear}</div></div></div><div class="cards-grid anim-up anim-up-2" style="margin-bottom:24px">${sent.map(f=>rcCard(f)).join('')}</div>`:''}
    ${drafts.length>0?`<div class="sec-head anim-up anim-up-3"><div><div class="sec-title">En <em>borrador</em></div><div class="sec-sub">Puedes editar y enviar cuando estén listos</div></div></div><div class="cards-grid anim-up anim-up-3">${drafts.map(f=>rcCard(f)).join('')}</div>`:''}
    ${forms.length===0?`<div class="empty anim-up anim-up-2"><div class="empty-icon">📋</div><div class="empty-title">Sin formatos en ${selYear}</div><div class="empty-sub">Crea tu primer formato COMPASS para registrar tus compromisos.</div><button class="btn btn-teal" onclick="startNew()">Crear formato ${selYear}</button></div>`:''}
  </div>`;
}

function rcCard(f){
  const p=compl(f);
  const statusColor = f.status === 'Edicion Solicitada' ? '#D97706' : (f.status === 'enviado' ? 'var(--teal-600)' : 'var(--text-3)');
  const statusBg = f.status === 'Edicion Solicitada' ? '#FEF3C7' : (f.status === 'enviado' ? 'rgba(16,185,129,.15)' : 'rgba(0,0,0,.05)');

  return`<div class="rc ${mktC(f.mercado)}" onclick="openDetail('${f.id}')">
    <div style="display:flex;align-items:start;justify-content:space-between;margin-bottom:5px">
      <div><div class="rc-proc">${esc(f.proceso)||'Sin nombre'}</div><div class="rc-lider">${esc(f.lider)}</div></div>
      <div style="display:flex;gap:4px;flex-wrap:wrap;justify-content:flex-end">
        <span class="pill ${mktPill(f.mercado)}">${mktL(f.mercado)}</span>
      </div>
    </div>
    <div class="rc-meta">${esc(f.meta26||f.contexto||'Sin contenido aún...')}</div>
    <div class="rc-foot">
      <span class="rc-date">${fmtD(f.updatedAt||f.createdAt)}</span>
      <div class="compl-inline">
        <div class="compl-bar-sm"><div class="compl-bar-sm-fill" style="width:${p}%"></div></div>
        <span style="font-size:10px;color:var(--text-3)">${p}%</span>
        <span class="pill" style="padding:2px 7px;font-size:10px;color:${statusColor};background:${statusBg}">${f.status}</span>
      </div>
    </div>
  </div>`;
}

/* ════════════════════════════════════════
   VIEW: FORM
════════════════════════════════════════ */
function renderForm(f){
  const mc=mktC(f.mercado);
  const p=compl(f);
  const step=(()=>{ if(!f.proceso||!f.lider)return 0; if(!f.contexto)return 1; if(!f.meta26)return 2; if(!f.meta27)return 3; if(!f.kpis[0].ind)return 4; if(!f.supuesto)return 5; return 6; })();
  const steps=['C','O','M','P','A','S','S'];
  
  return`
  <div class="page-header">
    <div>
      <div class="page-title">${f.proceso||'Nuevo formato'} <em>${(f.years&&f.years.length?f.years:[selYear]).join(' – ')}</em></div>
      <div class="page-sub">Metodología COMPASS</div>
    </div>
    <button class="btn btn-outline" onclick="setView('home')">← Cancelar</button>
  </div>
  <div class="content-pad">
  <div class="form-shell">
    <div class="form-cap ${mc}">
      <div>
        <div class="form-cap-title">${esc(f.proceso)||'Nuevo formato COMPASS'}</div>
        <div class="form-cap-sub">Planeación ${(f.years&&f.years.length?f.years:[selYear]).join(' — ')} · ${mktL(f.mercado)||'Mercado no definido'}</div>
        <div class="compass-track mt8">
          ${steps.map((l,i)=>`${i>0?`<div class="ct-sep ${i<=step?'done':''}"></div>`:''}<div class="ct-letter ${i<=step?'done':''}">${l}</div>`).join('')}
        </div>
      </div>
      <div style="text-align:right;color:rgba(255,255,255,.5);font-size:12px">
        <div style="font-family:var(--display);font-size:22px;font-weight:600;color:rgba(255,255,255,.9)">${p}%</div>completado
      </div>
    </div>
    <div class="progress-track"><div class="progress-fill" id="prog-fill" style="width:${p}%"></div></div>

    <div class="form-body">
      <!-- C — CONTEXTO -->
      <div class="fsec">
        <div class="fsec-head">
          <div class="fsec-chip" style="background:#0F7A62">C</div>
          <div><div class="fsec-title">Identificación y contexto actual</div></div>
        </div>
        <div class="grid-2">
          <div class="field col-span-2">
            <label>Años de planeación</label>
            <div style="position:relative" id="year-dropdown-wrap">
              <button type="button" id="year-dd-trigger" onclick="toggleYearDropdown()" style="width:100%;text-align:left;font-family:var(--body);font-size:13px;padding:9px 36px 9px 12px;border:1.5px solid var(--border);border-radius:8px;background:var(--white);cursor:pointer;display:flex;align-items:center;justify-content:space-between">
                <span id="year-dd-label">Cargando...</span>
                <svg id="year-dd-arrow" width="16" height="16" viewBox="0 0 16 16" fill="none"><path d="M4 6l4 4 4-4" stroke="var(--text-3)" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg>
              </button>
              <div id="year-dd-menu" style="display:none;position:absolute;top:100%;left:0;right:0;z-index:200;background:var(--white);border:1.5px solid var(--border);border-radius:10px;box-shadow:var(--sh-md);max-height:240px;overflow-y:auto">
                <div id="year-dd-list"></div>
                <div style="padding:8px;border-top:1px solid var(--border);display:flex;gap:8px">
                  <input type="number" id="year-dd-custom" placeholder="Otro año..." style="flex:1">
                  <button type="button" onclick="addCustomYear()" style="padding:6px 12px;border-radius:6px;border:none;background:var(--teal-600);color:white;cursor:pointer">Agregar</button>
                </div>
              </div>
            </div>
          </div>
          <div class="field"><label>Proceso *</label><select id="f-proceso"><option value="">Seleccionar...</option>${PROCS.map(p=>`<option ${f.proceso===p?'selected':''}>${p}</option>`).join('')}</select></div>
          <div class="field"><label>Líder responsable *</label><input id="f-lider" value="${esc(f.lider)}" placeholder="Nombre del líder"></div>
          <div class="field col-span-2"><label>Mercado *</label><select id="f-mercado"><option value="">Seleccionar...</option>${MKTS.map(m=>`<option ${f.mercado===m?'selected':''}>${m}</option>`).join('')}</select></div>
          <div class="field col-span-2"><label>C — Contexto actual *</label><textarea id="f-contexto" rows="3">${esc(f.contexto)}</textarea></div>
        </div>
      </div>

      <!-- O — OBJETIVO -->
      <div class="fsec">
        <div class="fsec-head"><div class="fsec-chip" style="background:#1252A3">O</div><div><div class="fsec-title">O — Objetivo BSC</div></div></div>
        <div class="bsc-grid" id="bsc-grid" style="margin-bottom:12px">
          ${BSC.map(o=>`<label class="bsc-item${f.bsc.includes(o.code)?' sel':''}" data-code="${o.code}">
            <input type="checkbox" data-bsc="${o.code}" ${f.bsc.includes(o.code)?'checked':''}>
            <span class="bsc-code" style="color:${o.color}">${o.code}</span><span class="bsc-label">${o.label}</span>
          </label>`).join('')}
        </div>
        <div class="field"><label>O — En tus propias palabras *</label><textarea id="f-objetivo" rows="2">${esc(f.objetivo)}</textarea></div>
      </div>

      <!-- M+P+A — COMPROMISOS -->
      <div class="fsec">
        <div class="fsec-head"><div class="fsec-chip" style="background:#2A3D2D">M</div><div><div class="fsec-title">Compromisos</div></div></div>
        <div id="mpa-list"></div>
        <button type="button" onclick="addMPA()" style="padding:10px;width:100%;border-radius:8px;border:1px dashed var(--border-2);background:transparent;cursor:pointer;margin-top:10px">+ Agregar otro compromiso</button>
      </div>

      <!-- S — KPIs -->
      <div class="fsec">
        <div class="fsec-head"><div class="fsec-chip" style="background:#9A5C0A">S</div><div><div class="fsec-title">Semáforo de KPIs</div></div></div>
        <table class="kpi-table">
          <thead><tr><th>Indicador</th><th>Línea base</th><th>Meta 1</th><th>Meta 2</th><th>Semáforo</th></tr></thead>
          <tbody>${f.kpis.map((k,i)=>`<tr>
            <td><input class="ki" data-i="${i}" data-f="ind" value="${esc(k.ind)}"></td>
            <td><input class="ki" data-i="${i}" data-f="base" value="${esc(k.base)}"></td>
            <td><input class="ki" data-i="${i}" data-f="meta26" value="${esc(k.meta26)}"></td>
            <td><input class="ki" data-i="${i}" data-f="meta27" value="${esc(k.meta27)}"></td>
            <td><select class="sem-sel ki" data-i="${i}" data-f="sem">
              <option value="">—</option><option value="verde" ${k.sem==='verde'?'selected':''}>🟢 Verde</option>
              <option value="amarillo" ${k.sem==='amarillo'?'selected':''}>🟡 Amarillo</option><option value="rojo" ${k.sem==='rojo'?'selected':''}>🔴 Rojo</option>
            </select></td>
          </tr>`).join('')}</tbody>
        </table>
      </div>

      <!-- S — SUPUESTO -->
      <div class="fsec">
        <div class="fsec-head"><div class="fsec-chip" style="background:#9F1239">S</div><div><div class="fsec-title">Supuesto y Apoyo</div></div></div>
        <div class="grid-2">
          <div class="field"><label>Supuesto crítico *</label><textarea id="f-supuesto" rows="3">${esc(f.supuesto)}</textarea></div>
          <div class="field"><label>Apoyo requerido</label><textarea id="f-recurso" rows="3">${esc(f.recurso)}</textarea></div>
        </div>
      </div>
    </div>

    <div class="form-footer">
      <div class="form-footer-left"><span class="compl-pct" id="f-pct">${p}%</span> completado</div>
      <div style="display:flex;gap:8px">
        <button class="btn btn-outline" onclick="setView('home')">Cancelar</button>
        <button class="btn btn-outline" onclick="collectSave('borrador')">Guardar borrador</button>
        <button class="btn btn-teal" onclick="collectSave('enviado')">Enviar formato ✓</button>
      </div>
    </div>
  </div>
  </div>`;
}

function attachListeners(){
  const autoSave=()=>{
    clearTimeout(autoSaveTimer);
    autoSaveTimer=setTimeout(()=>{ if(view==='form') collectSave('borrador',false); }, 1500);
  };
  document.querySelectorAll('#f-proceso,#f-lider,#f-mercado,#f-contexto,#f-objetivo,#f-supuesto,#f-recurso').forEach(el=>{
    el.addEventListener('input',autoSave); el.addEventListener('change',autoSave);
  });
  document.querySelectorAll('.ki').forEach(el=>{ el.addEventListener('change',autoSave); el.addEventListener('input',autoSave); });
  document.querySelectorAll('[data-bsc]').forEach(cb=>cb.addEventListener('change',autoSave));
  
  const formYearData = editId && DB.forms[editId] ? (DB.forms[editId].years && DB.forms[editId].years.length ? DB.forms[editId].years : [DB.forms[editId].year || selYear]) : [selYear];
  initFormYearChips(formYearData);

  const mpaData = editId && DB.forms[editId] ? (DB.forms[editId].mpaItems || null) : null;
  initMPA(mpaData);
}

/* ════════════════════════════════════════
   MPA LOGIC
════════════════════════════════════════ */
function initMPA(existingItems){
  mpaItems = (existingItems && existingItems.length) ? existingItems.map(i=>({...i})) : [{meta26:'', accion26:'', meta27:'', accion27:''}];
  renderMPAList();
}

function addMPA(){
  mpaItems.push({meta26:'', accion26:'', meta27:'', accion27:''});
  renderMPAList();
}

function removeMPA(idx){
  if(mpaItems.length <= 1) return;
  mpaItems.splice(idx, 1);
  renderMPAList();
}

function mpaChange(idx, field, value){
  mpaItems[idx][field] = value;
  clearTimeout(autoSaveTimer);
  autoSaveTimer = setTimeout(()=>{ if(view==='form') collectSave('borrador',false); }, 1500);
}

function renderMPAList(){
  const wrap = document.getElementById('mpa-list');
  if(!wrap) return;
  const yr1 = (formSelYears[0] || selYear);
  const yr2 = (formSelYears[1] || yr1+1);
  wrap.innerHTML = mpaItems.map((item, idx) => `
    <div class="mpa-card">
      <div class="mpa-card-header">
        <div class="mpa-card-num"><div class="mpa-num-badge">${idx+1}</div> Compromiso ${idx+1}</div>
        ${mpaItems.length > 1 ? `<button type="button" class="mpa-del-btn" onclick="removeMPA(${idx})">✕ Eliminar</button>` : ''}
      </div>
      <div class="mpa-body">
        <div class="mpa-col mpa-col-26">
          <div class="mpa-col-label">◆ ${yr1}</div>
          <div class="field" style="margin-bottom:10px"><textarea rows="3" placeholder="Meta..." oninput="mpaChange(${idx},'meta26',this.value)">${esc(item.meta26)}</textarea></div>
          <div class="field"><textarea rows="2" placeholder="Acción palanca..." oninput="mpaChange(${idx},'accion26',this.value)">${esc(item.accion26)}</textarea></div>
        </div>
        <div class="mpa-col mpa-col-27">
          <div class="mpa-col-label">◇ ${yr2}</div>
          <div class="field" style="margin-bottom:10px"><textarea rows="3" placeholder="Meta..." oninput="mpaChange(${idx},'meta27',this.value)">${esc(item.meta27)}</textarea></div>
          <div class="field"><textarea rows="2" placeholder="Acción palanca..." oninput="mpaChange(${idx},'accion27',this.value)">${esc(item.accion27)}</textarea></div>
        </div>
      </div>
    </div>`).join('');
}

/* ════════════════════════════════════════
   YEAR LOGIC
════════════════════════════════════════ */
function getAvailableYears(){
  const set = new Set([...DB.years]);
  for(let y = selYear - 2; y <= selYear + 3; y++) set.add(y);
  return [...set].sort((a,b) => b - a);
}

function initFormYearChips(existingYears){
  formSelYears = (existingYears && existingYears.length) ? [...existingYears] : [selYear];
  yearDDOpen = false;
  renderYearDropdown();
}

function toggleYearDropdown(){
  yearDDOpen = !yearDDOpen;
  const menu = document.getElementById('year-dd-menu');
  if(!menu) return;
  if(yearDDOpen){ menu.style.display = 'block'; renderYearDDList(); } 
  else { menu.style.display = 'none'; }
}

function renderYearDDList(){
  const list = document.getElementById('year-dd-list');
  if(!list) return;
  const years = getAvailableYears();
  list.innerHTML = years.map(y => {
    const isOn = formSelYears.includes(y);
    return `<div onclick="toggleFormYear(${y})" style="padding:10px;cursor:pointer;background:${isOn ? '#F0FDF9' : 'transparent'};border-bottom:1px solid var(--surface-2)">
      <span style="font-weight:600;color:${isOn?'var(--teal-600)':'var(--text-1)'}">${y}</span>
    </div>`;
  }).join('');
}

function toggleFormYear(y){
  if(formSelYears.includes(y)){
    if(formSelYears.length > 1) formSelYears = formSelYears.filter(x => x !== y);
  } else {
    if(formSelYears.length >= 2) formSelYears = [formSelYears[1], y];
    else formSelYears = [...formSelYears, y];
    formSelYears.sort((a,b) => b - a);
  }
  if(!DB.years.includes(y)){ DB.years.push(y); DB.years.sort((a,b)=>b-a); }
  renderYearDropdown();
  if(yearDDOpen) renderYearDDList();
  renderMPAList();
}

function addCustomYear(){
  const inp = document.getElementById('year-dd-custom');
  const y = parseInt(inp.value);
  if(isNaN(y)||y<2020||y>2040){ showToast('Año inválido'); return; }
  inp.value = '';
  toggleFormYear(y);
}

function renderYearDropdown(){
  const trigger = document.getElementById('year-dd-label');
  if(!trigger) return;
  if(formSelYears.length === 1) trigger.textContent = formSelYears[0] + '  (principal)';
  else trigger.innerHTML = `<span>${formSelYears[0]} y ${formSelYears[1]}</span>`;
}

/* ════════════════════════════════════════
   SAVE LOGIC (FASTAPI)
════════════════════════════════════════ */
async function collectSave(status, navigate=true){
  if(view!=='form')return;
  const g=id=>document.getElementById(id)?.value||'';
  
  const payload = {
    id: editId || 'f' + Date.now(),
    email: CU.email,
    year: formSelYears[0] || selYear,
    years: formSelYears,
    proceso: g('f-proceso'),
    lider: g('f-lider'),
    mercado: g('f-mercado'),
    contexto: g('f-contexto'),
    objetivo: g('f-objetivo'),
    meta26: mpaItems[0]?.meta26 || '',
    accion26: mpaItems[0]?.accion26 || '',
    meta27: mpaItems[0]?.meta27 || '',
    accion27: mpaItems[0]?.accion27 || '',
    mpaItems: mpaItems,
    kpis: [{ind:'',base:'',meta26:'',meta27:'',sem:''},{ind:'',base:'',meta26:'',meta27:'',sem:''},{ind:'',base:'',meta26:'',meta27:'',sem:''}],
    supuesto: g('f-supuesto'),
    recurso: g('f-recurso'),
    status: status,
    bsc: []
  };

  document.querySelectorAll('[data-bsc]:checked').forEach(cb=>payload.bsc.push(cb.dataset.bsc));
  document.querySelectorAll('.ki').forEach(el=>{ const i=+el.dataset.i,ff=el.dataset.f; if(i<3)payload.kpis[i][ff]=el.value; });

  try {
    const response = await fetch(`${API_URL}/forms/save`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });

    if (!response.ok) throw new Error('Error al guardar en BD');

    editId = payload.id;
    DB.forms[payload.id] = payload; // Temporal update for UI local
    saveCacheToStorage();           // sync cache para próximas recargas

    if(navigate){
      showToast(status==='enviado'?'✓ Formato enviado':'Borrador guardado'); setView('home');
    } else {
      document.getElementById('f-pct').textContent = compl(payload) + '%';
      document.getElementById('prog-fill').style.width = compl(payload) + '%';
    }
    // Refresca desde backend en background (no bloquea UI)
    loadDB(true);
  } catch (error) {
    showToast('❌ Error de conexión con MySQL');
  }
}

/* ════════════════════════════════════════
   VIEW: DETAIL (CON BOTONES ADMIN Y AUTORIZACIÓN)
════════════════════════════════════════ */
function renderDetail(f){
  if(!f)return`<div class="page-header"><div class="page-title">No encontrado</div></div>`;
  const mc=mktC(f.mercado);
  const isOwner=CU.email===f.email;
  const kpiRows=(f.kpis||[]).filter(k=>k.ind).map(k=>`<tr>
    <td><strong>${esc(k.ind)}</strong></td>
    <td>${esc(k.base)||'—'}</td>
    <td style="color:var(--teal-600);font-weight:600">${esc(k.meta26)||'—'}</td>
    <td style="color:var(--blue-600);font-weight:600">${esc(k.meta27)||'—'}</td>
    <td>${semI(k.sem)}</td>
  </tr>`).join('');
  const yr=f.year||selYear;

  // Renderizar la botonera inteligente según el ROL y el ESTADO
  // El botón Descargar PDF está disponible para TODOS los roles (owner, admin, viewer)
  const canDownload = (CU.role === 'admin' || CU.role === 'viewer' || isOwner);
  let actionBtns = '';
  if (canDownload) {
      actionBtns += `<button class="btn btn-outline btn-sm" onclick="downloadFormPDF('${f.id}')" title="Descargar formato en PDF">📥 Descargar PDF</button>`;
  }
  if (CU.role === 'viewer') {
      // Revisor: solo lectura, sin botones de acción (excepto descargar PDF arriba)
      actionBtns += `<span style="font-size:12px;color:#1252A3;font-weight:bold;background:#EFF6FF;padding:6px 12px;border-radius:6px">👁️ Modo revisión (solo lectura)</span>`;
  } else if (CU.role === 'admin') {
      actionBtns += `<button class="btn btn-outline btn-sm" onclick="startEdit('${f.id}')">✏️ Editar como Admin</button>`;
      actionBtns += `<button class="btn btn-outline btn-sm" style="color:#DC2626;border-color:#FECACA" onclick="deleteFormComplete('${f.id}')">🗑️ Eliminar</button>`;
      if (f.status === 'Edicion Solicitada') {
          actionBtns += `<button class="btn btn-teal btn-sm" onclick="updateFormStatus('${f.id}', 'borrador')" style="background:#D97706;border-color:#D97706">⚠️ Aprobar Edición</button>`;
      }
  } else if (isOwner) {
      if (f.status === 'enviado') {
          actionBtns += `<button class="btn btn-outline btn-sm" onclick="updateFormStatus('${f.id}', 'Edicion Solicitada')">🔓 Solicitar permiso para editar</button>`;
      } else if (f.status === 'Edicion Solicitada') {
          actionBtns += `<span style="font-size:12px;color:#D97706;font-weight:bold;background:#FEF3C7;padding:6px 12px;border-radius:6px">⏳ Esperando aprobación de gerencia...</span>`;
      } else {
          actionBtns += `<button class="btn btn-outline btn-sm" onclick="startEdit('${f.id}')">Continuar Editando</button>`;
      }
  }

  const statusColor = f.status === 'Edicion Solicitada' ? '#D97706' : (f.status === 'enviado' ? 'var(--teal-600)' : 'var(--text-3)');
  const statusBg = f.status === 'Edicion Solicitada' ? '#FEF3C7' : (f.status === 'enviado' ? 'rgba(16,185,129,.25)' : 'rgba(251,191,36,.2)');

  return`
  <div class="page-header">
    <div>
      <div class="page-title">${esc(f.proceso)} <em>${yr}</em></div>
      <div class="page-sub">${esc(f.lider)}</div>
    </div>
    <div style="display:flex;gap:8px;align-items:center">
      ${actionBtns}
      <button class="btn btn-ghost btn-sm" onclick="setView('${(CU.role==='admin'||CU.role==='viewer')?'admin':'home'}')">← Volver</button>
    </div>
  </div>
  <div class="content-pad">
  <div class="detail-shell anim-up">
    <div class="dv-cap ${mc}">
      <h2>${esc(f.proceso)}</h2>
      <p>${esc(f.lider)} · Planeación ${yr}</p>
      <div class="dv-badges">
        <span class="dv-b">${mktL(f.mercado)}</span>
        ${(f.bsc||[]).map(c=>`<span class="dv-b">${c}</span>`).join('')}
        <span class="dv-b" style="background:${statusBg};color:${statusColor};font-weight:bold">
          ${f.status==='enviado'?'✓ Enviado':(f.status==='Edicion Solicitada'?'⚠️ Solicitud de edición':'⏳ Borrador')}
        </span>
      </div>
    </div>
    <div class="dv-body">
      <div class="dv-section">
        <div class="dv-sec-t">Contexto y objetivo</div>
        <div class="dv-grid">
          <div class="dv-f"><div class="dv-fl">C — Contexto actual</div><div class="dv-fv">${esc(f.contexto)||'—'}</div></div>
          <div class="dv-f"><div class="dv-fl">O — Objetivo estratégico</div><div class="dv-fv">${esc(f.objetivo)||'—'}</div></div>
        </div>
      </div>
      <div class="dv-section">
        <div class="dv-sec-t">Compromisos y proyección</div>
        ${(()=>{
          const items = f.mpaItems && f.mpaItems.length ? f.mpaItems : [{meta26:f.meta26,accion26:f.accion26,meta27:f.meta27,accion27:f.accion27}];
          const yrs = f.years && f.years.length ? f.years : [yr, yr+1];
          const yr1 = yrs[0]||yr; const yr2 = yrs[1]||(yr+1);
          return items.map((item,idx)=>`
            ${items.length>1?`<div style="font-family:var(--display);font-size:10px;font-weight:700;color:var(--text-3);text-transform:uppercase;letter-spacing:.8px;margin:${idx>0?'14px':0} 0 8px">Compromiso ${idx+1}</div>`:''}
            <div class="dv-years" style="margin-bottom:4px">
              <div class="dvy dvy26">
                <div class="dvy-label">◆ ${yr1}</div>
                <div class="dvy-block"><div class="dvy-t">M — Meta concreta</div><div class="dvy-v">${esc(item.meta26)||'—'}</div></div>
                ${item.accion26?`<div class="dvy-block" style="margin-top:8px"><div class="dvy-t">A — Acción palanca</div><div class="dvy-v">${esc(item.accion26)}</div></div>`:''}
              </div>
              <div class="dvy dvy27">
                <div class="dvy-label">◇ ${yr2}</div>
                <div class="dvy-block"><div class="dvy-t">P — Meta proyectada</div><div class="dvy-v">${esc(item.meta27)||'—'}</div></div>
                ${item.accion27?`<div class="dvy-block" style="margin-top:8px"><div class="dvy-t">A — Acción palanca</div><div class="dvy-v">${esc(item.accion27)}</div></div>`:''}
              </div>
            </div>`).join('');
        })()}
      </div>
      <div class="dv-section">
        <div class="dv-sec-t">KPIs — Semáforo</div>
        <table class="kpi-display">
          <thead><tr><th>Indicador</th><th>Línea base</th><th>Meta ${yr}</th><th>Meta ${yr+1}</th><th>Semáforo</th></tr></thead>
          <tbody>${kpiRows||`<tr><td colspan="5" style="text-align:center;color:var(--text-3);padding:16px;font-style:italic">Sin KPIs definidos</td></tr>`}</tbody>
        </table>
      </div>
      <div class="dv-bot">
        <div class="dv-sup"><div class="dv-fl">S — Supuesto crítico</div><div class="dv-fv">${esc(f.supuesto)||'—'}</div></div>
        <div class="dv-rec"><div class="dv-fl">Apoyo requerido de Gerencia</div><div class="dv-fv">${esc(f.recurso)||'—'}</div></div>
      </div>
    </div>
  </div>
  </div>`;
}

/* ════════════════════════════════════════
   VIEW: HISTORY
════════════════════════════════════════ */
function renderHistory(){
  const all=allMyForms();
  const byYear=DB.years.reduce((a,y)=>{ a[y]=all.filter(f=>f.year===y); return a; },{});
  return`
  <div class="page-header anim-up">
    <div>
      <div class="page-title">Mi <em>historial</em></div>
      <div class="page-sub">Todos tus formatos por año de planeación</div>
    </div>
  </div>
  <div class="content-pad">
  <div class="history-bar anim-up anim-up-1">
    <div class="hb-title">Años de planeación</div>
    <div class="year-timeline">
      ${DB.years.map(y=>{
        const cnt=byYear[y]?.length||0;
        const cls=y===selYear?'active':cnt>0?'has-data':'empty';
        return`<div class="yt-item">
          <div class="yt-bubble ${cls}" onclick="selectYear(${y});setView('home')">${y}</div>
          <div class="yt-count">${cnt} ${cnt===1?'formato':'formatos'}</div>
        </div>`;
      }).join('')}
    </div>
  </div>
  ${DB.years.filter(y=>byYear[y]?.length>0).map(y=>`
    <div class="sec-head anim-up anim-up-2" style="margin-top:20px">
      <div><div class="sec-title">${y}</div><div class="sec-sub">${byYear[y].length} formato${byYear[y].length!==1?'s':''}</div></div>
    </div>
    <div class="cards-grid" style="margin-bottom:8px">${byYear[y].map(f=>rcCard(f)).join('')}</div>
  `).join('')}
  ${all.length===0?`<div class="empty"><div class="empty-icon">📅</div><div class="empty-title">Sin historial aún</div><div class="empty-sub">Tus formatos de planeación aparecerán aquí organizados por año.</div></div>`:''}
  </div>`;
}

/* ════════════════════════════════════════
   VIEW: ADMIN DASHBOARD
════════════════════════════════════════ */
function renderAdmin(){
  const sent = sentForms();
  const isViewer = CU.role === 'viewer';
  const title = isViewer ? 'Panel de <em>revisión</em>' : 'Panel <em>administrativo</em>';
  const subtitle = isViewer
    ? `Planeación ${selYear} · Formatos enviados (solo lectura)`
    : `Planeación ${selYear} · Gestión global`;

  // Tabs extra solo para admin
  const extraTabs = isViewer ? '' : `
      <button class="tab-item ${adminTab==='users'?'on':''}" onclick="setAdminTab('users')">Usuarios</button>
      <button class="tab-item ${adminTab==='years'?'on':''}" onclick="setAdminTab('years')">Gestión de años</button>`;

  // Cuerpo según tab
  let body;
  if (adminTab === 'sent') body = renderSent(sent);
  else if (adminTab === 'bsc') body = renderBSC(sent);
  else if (isViewer) body = renderSent(sent); // viewer: cualquier otro tab cae a 'sent'
  else if (adminTab === 'users') body = renderUsers();
  else body = renderAdminYears();

  return `
  <div class="page-header anim-up">
    <div>
      <div class="page-title">${title}</div>
      <div class="page-sub">${subtitle}</div>
    </div>
  </div>
  <div class="content-pad">
    <div class="tab-bar anim-up">
      <button class="tab-item ${adminTab==='sent'?'on':''}" onclick="setAdminTab('sent')">Formatos enviados (${sent.length})</button>
      <button class="tab-item ${adminTab==='bsc'?'on':''}" onclick="setAdminTab('bsc')">Dashboard BSC</button>
      ${extraTabs}
    </div>
    <div id="admin-body" class="anim-up anim-up-1">
      ${body}
    </div>
  </div>`;
}

function renderSent(sent){
  if(!sent.length)return`<div class="empty"><div class="empty-icon">📬</div><div class="empty-title">Sin formatos activos</div><div class="empty-sub">Cuando los líderes envíen sus formatos aparecerán aquí.</div></div>`;
  return`<div class="sent-grid">${sent.map(f=>{
    const col=mktColor(f.mercado);
    const bscBadges=(f.bsc||[]).map(c=>{ const o=BSC.find(b=>b.code===c); return`<span class="pill" style="background:${o?.bg};color:${o?.color};border:none;padding:2px 7px;font-size:10px">${c}</span>`; }).join('');
    const kpiChips=(f.kpis||[]).filter(k=>k.ind).map(k=>`<span class="kpi-chip">${semI(k.sem)} ${esc(k.ind.length>20?k.ind.slice(0,20)+'…':k.ind)}</span>`).join('');
    
    // Alerta visual para el admin si se pidió edición
    const editionAlert = f.status === 'Edicion Solicitada' ? `<div style="background:#FEF3C7;color:#D97706;padding:4px 8px;font-size:11px;font-weight:bold;margin-bottom:8px;border-radius:4px;border:1px solid #FDE68A">⚠️ El líder solicitó permiso para editar este formato</div>` : '';

    return`<div class="sc" onclick="openDetail('${f.id}')" style="${f.status === 'Edicion Solicitada' ? 'border:1px solid #FCD34D' : ''}">
      <div class="sc-stripe" style="background:${f.status === 'Edicion Solicitada' ? '#F59E0B' : col}"></div>
      <div class="sc-top">
        <div style="display:flex;align-items:start;justify-content:space-between">
          <div><div class="sc-proc">${esc(f.proceso)}</div><div class="sc-lider">${esc(f.lider)}</div></div>
          <span class="pill ${mktPill(f.mercado)}">${mktL(f.mercado)}</span>
        </div>
        <div class="sc-bsc-row">${bscBadges}</div>
      </div>
      <div class="sc-body">
        ${editionAlert}
        ${(()=>{
          const items=(f.mpaItems&&f.mpaItems.length)?f.mpaItems:[{meta26:f.meta26,meta27:f.meta27}];
          const yr1=(f.years&&f.years[0])||f.year||selYear;
          const yr2=(f.years&&f.years[1])||(yr1+1);
          return items.slice(0,2).map((it,i)=>
            `<div class="sc-field"><div class="sc-lbl">${i===0?'Meta '+yr1:'↳ Meta '+yr2}</div><div class="sc-val">${esc(it.meta26||it.meta27)||'—'}</div></div>`
          ).join('');
        })()}
        ${kpiChips?`<div class="kpi-chips" style="margin-top:6px">${kpiChips}</div>`:''}
      </div>
    </div>`;
  }).join('')}</div>`;
}

function renderBSC(sent){
  const axisCount=codes=>new Set(sent.filter(f=>(f.bsc||[]).some(c=>codes.includes(c))).map(f=>f.id)).size;
  const statsHTML=[
    {n:sent.length,l:'Formatos activos',cls:'ds-teal'},
    {n:axisCount(['4.1','4.2']),l:'Impactan Financiera',cls:'ds-teal'},
    {n:axisCount(['3.1','3.2','3.3']),l:'Impactan Clientes',cls:'ds-blue'},
    {n:axisCount(['2.1','2.2','2.3','1.1','1.2','1.3','1.4','1.5']),l:'Impactan Procesos',cls:'ds-sage'},
  ].map(s=>`<div class="dash-stat ${s.cls}"><div class="ds-num">${s.n}</div><div class="ds-label">${s.l}</div></div>`).join('');

  const axisBlocks=AXES.map(ax=>{
    const linked=sent.filter(f=>(f.bsc||[]).some(c=>ax.codes.includes(c)));
    const objBlocks=ax.codes.map(code=>{
      const obj=BSC.find(b=>b.code===code);
      const procs=sent.filter(f=>(f.bsc||[]).includes(code));
      return`<div class="obj-block">
        <div class="obj-hdr">
          <div class="obj-hdr-left">
            <div class="obj-code-box" style="background:${obj.color}">${code}</div>
            <div class="obj-name">${obj.label}</div>
          </div>
          <span class="pill ${procs.length?'pill-sage':'pill-gray'}" style="font-size:10px">${procs.length} procesos</span>
        </div>
        <div class="obj-rows">
          ${procs.length?procs.map(f=>{
            const p=compl(f); const col=mktColor(f.mercado);
            return`<div class="obj-proc-row" onclick="openDetail('${f.id}')">
              <div class="opr-dot" style="background:${col}"></div>
              <div class="opr-proc">${esc(f.proceso)}</div>
              <div class="opr-lider">${esc(f.lider)}</div>
              <div class="opr-bar-w"><div class="opr-bar" style="width:${p}%;background:${obj.color}"></div></div>
              <div class="opr-pct" style="color:${obj.color}">${p}%</div>
            </div>`;
          }).join(''):`<div class="no-commitment">Sin compromisos</div>`}
        </div>
      </div>`;
    }).join('');
    return`<div class="axis-section">
      <div class="axis-header"><div class="axis-name">${ax.name}</div><div class="axis-count">${linked.length} procesos</div></div>
      ${objBlocks}
    </div>`;
  }).join('');

  return`<div class="dash-stats">${statsHTML}</div>${axisBlocks}`;
}

function renderUsers(){
  const users = Object.values(DB.users).sort((a,b)=>a.name.localeCompare(b.name));
  
  if(users.length === 0) {
      return `<div class="empty"><div class="empty-icon">👥</div><div class="empty-title">Sin usuarios</div></div>`;
  }

  return `<div class="table-shell">
    <table class="ut">
      <thead><tr><th>Nombre</th><th>Correo</th><th>Proceso</th><th>Rol</th><th>Formatos</th><th>Registrado</th></tr></thead>
      <tbody>${users.map(u=>{
        const all = Object.values(DB.forms).filter(f=>f.email===u.email);
        const sent = all.filter(f=>f.status==='enviado').length;
        
        return `<tr>
          <td><strong>${esc(u.name)}</strong></td>
          <td style="color:var(--text-3)">${esc(u.email)}</td>
          <td>${esc(u.proceso||'—')}</td>
          <td><span class="role-pill ${u.role==='admin'?'role-admin':'role-user'}">${u.role}</span></td>
          <td style="font-size:12px">${all.length} total · <strong>${sent}</strong> enviados</td>
          <td style="font-size:11px;color:var(--text-3)">${fmtD(u.createdAt)}</td>
        </tr>`;
      }).join('')}</tbody>
    </table>
  </div>`;
}

function renderAdminYears(){
  const sortedYears = [...DB.years].sort((a,b)=>b-a);
  
  return `<div class="table-shell">
    <div style="padding:16px; border-bottom:1px solid var(--border); display:flex; gap:10px; align-items:center;">
        <input type="number" id="new-year-input" placeholder="Ej. 2027" style="padding:8px; border:1px solid var(--border); border-radius:8px; width:120px">
        <button class="btn btn-teal" onclick="saveNewYear()">+ Agregar Año</button>
    </div>
    <table class="ut">
      <thead><tr><th>Año Activo</th><th>Acción</th></tr></thead>
      <tbody>${sortedYears.map(y=>`
        <tr>
          <td><strong style="color:var(--teal-700); font-size:15px">${y}</strong></td>
          <td>
            <button class="btn btn-outline btn-sm" style="color:#DC2626; border-color:#FECACA" onclick="deleteYear(${y})">Eliminar</button>
          </td>
        </tr>`).join('')}
      </tbody>
    </table>
  </div>`;
}

/* INIT CON PERSISTENCIA DE SESIÓN — cache-first
   1. Lee cache local (síncrono) → muestra la app YA
   2. Refresca datos del backend en background (despierta Render)
   3. Si llegan datos frescos, re-pinta la vista actual */
window.onload = () => {
  // 1) Cache local primero (instantáneo)
  loadCacheFromStorage();

  // 2) ¿Hay sesión guardada? Si sí, muestra la app sin esperar al backend
  const savedUser = localStorage.getItem('compass_user');
  if (savedUser) {
      try {
          CU = JSON.parse(savedUser);
          document.getElementById('auth-screen').style.display = 'none';
          document.getElementById('app-wrap').classList.add('visible');
          setupSidebar();
          if (CU.role === 'admin' || CU.role === 'viewer') {
              adminTab = 'sent';
              setView('admin');
          } else {
              setView('home');
          }
          startNotifPolling();
          if (CU.must_change_password) {
              openChangePasswordModal(true);
          }
      } catch(e) {
          localStorage.removeItem('compass_user');
      }
  }

  // 3) Refresca datos del backend en background (también despierta Render
  //    si estaba dormido). Cuando lleguen los datos frescos, re-pintamos.
  loadDB(true).then(() => {
      if (CU) {
          setupSidebar();
          render();
      }
  });

  // Cerrar el panel de notificaciones si haces clic fuera
  document.addEventListener('click', (e) => {
      const panel = document.getElementById('notif-panel');
      const bell = document.getElementById('notif-bell');
      if (panel && panel.style.display === 'block' &&
          !panel.contains(e.target) && !bell.contains(e.target)) {
          panel.style.display = 'none';
      }
  });
};

/* ════════════════════════════════════════
   RECUPERACIÓN / CAMBIO DE CONTRASEÑA
════════════════════════════════════════ */
function openForgotModal() {
    document.getElementById('forgot-email').value =
        document.getElementById('li-email').value || '';
    document.getElementById('forgot-msg').style.display = 'none';
    document.getElementById('forgot-modal').style.display = 'flex';
    setTimeout(() => document.getElementById('forgot-email').focus(), 50);
}

function closeForgotModal() {
    document.getElementById('forgot-modal').style.display = 'none';
}

function showForgotMsg(text, ok) {
    const el = document.getElementById('forgot-msg');
    el.textContent = text;
    el.className = 'cmp-modal-msg ' + (ok ? 'ok' : 'err');
    el.style.display = 'block';
}

async function doForgotPassword() {
    const email = document.getElementById('forgot-email').value.trim().toLowerCase();
    if (!email) { showForgotMsg('Ingresa tu correo institucional.', false); return; }

    const btn = document.getElementById('forgot-submit-btn');
    btn.disabled = true;
    btn.textContent = 'Enviando...';

    try {
        const res = await fetch(`${API_URL}/auth/forgot-password`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email })
        });
        const data = await res.json().catch(() => ({}));
        if (res.ok) {
            showForgotMsg('✓ Si el correo está registrado, recibirás un mensaje con tu contraseña provisional. Revisa también la bandeja de spam.', true);
            setTimeout(closeForgotModal, 4000);
        } else {
            showForgotMsg(data.detail || 'No se pudo enviar el correo. Intenta más tarde.', false);
        }
    } catch (e) {
        showForgotMsg('Error de conexión con el servidor.', false);
    } finally {
        btn.disabled = false;
        btn.textContent = 'Enviar correo';
    }
}

let _forceChangePassword = false;
function openChangePasswordModal(forced) {
    _forceChangePassword = !!forced;
    document.getElementById('cp-current').value = '';
    document.getElementById('cp-new').value = '';
    document.getElementById('cp-confirm').value = '';
    document.getElementById('change-pass-msg').style.display = 'none';
    document.getElementById('change-pass-modal').style.display = 'flex';
    setTimeout(() => document.getElementById('cp-current').focus(), 50);
}

function showChangePassMsg(text, ok) {
    const el = document.getElementById('change-pass-msg');
    el.textContent = text;
    el.className = 'cmp-modal-msg ' + (ok ? 'ok' : 'err');
    el.style.display = 'block';
}

async function doChangePassword() {
    const cur = document.getElementById('cp-current').value;
    const np = document.getElementById('cp-new').value;
    const cf = document.getElementById('cp-confirm').value;

    if (!cur || !np || !cf) { showChangePassMsg('Llena todos los campos.', false); return; }
    if (np.length < 6) { showChangePassMsg('La nueva contraseña debe tener al menos 6 caracteres.', false); return; }
    if (np !== cf) { showChangePassMsg('Las contraseñas nuevas no coinciden.', false); return; }
    if (np === cur) { showChangePassMsg('La nueva contraseña debe ser distinta a la provisional.', false); return; }

    const btn = document.getElementById('cp-submit-btn');
    btn.disabled = true;
    const txtOriginal = btn.textContent;
    btn.textContent = 'Actualizando...';

    try {
        const res = await fetch(`${API_URL}/auth/change-password`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                email: CU.email,
                current_password: cur,
                new_password: np
            })
        });
        const data = await res.json().catch(() => ({}));
        if (res.ok) {
            CU.must_change_password = false;
            localStorage.setItem('compass_user', JSON.stringify(CU));
            showChangePassMsg('✓ Contraseña actualizada correctamente.', true);
            setTimeout(() => {
                document.getElementById('change-pass-modal').style.display = 'none';
                showToast('Contraseña actualizada');
            }, 1200);
        } else {
            showChangePassMsg(data.detail || 'No se pudo actualizar la contraseña.', false);
        }
    } catch (e) {
        showChangePassMsg('Error de conexión con el servidor.', false);
    } finally {
        btn.disabled = false;
        btn.textContent = txtOriginal;
    }
}

/* ════════════════════════════════════════
   NOTIFICACIONES (campana + polling)
════════════════════════════════════════ */
let notifPollTimer = null;
let _notifCache = [];

function startNotifPolling() {
    stopNotifPolling();
    fetchNotifs();
    notifPollTimer = setInterval(fetchNotifs, 30000); // cada 30s
}

function stopNotifPolling() {
    if (notifPollTimer) { clearInterval(notifPollTimer); notifPollTimer = null; }
    const badge = document.getElementById('notif-badge');
    if (badge) badge.style.display = 'none';
}

async function fetchNotifs() {
    if (!CU || !CU.email) return;
    try {
        const res = await fetch(`${API_URL}/notifications/${encodeURIComponent(CU.email)}`);
        if (!res.ok) return;
        const data = await res.json();
        _notifCache = data.items || [];
        updateNotifBadge(data.unread_count || 0);
        // Si el panel está abierto, lo re-renderizamos
        const panel = document.getElementById('notif-panel');
        if (panel && panel.style.display === 'block') renderNotifPanel();
    } catch (e) {
        // silencioso
    }
}

function updateNotifBadge(count) {
    const badge = document.getElementById('notif-badge');
    if (!badge) return;
    if (count > 0) {
        badge.textContent = count > 9 ? '9+' : String(count);
        badge.style.display = 'flex';
    } else {
        badge.style.display = 'none';
    }
}

function toggleNotifPanel(ev) {
    if (ev) ev.stopPropagation();
    const panel = document.getElementById('notif-panel');
    if (!panel) return;
    if (panel.style.display === 'block') {
        panel.style.display = 'none';
    } else {
        renderNotifPanel();
        panel.style.display = 'block';
    }
}

function renderNotifPanel() {
    const list = document.getElementById('notif-panel-list');
    if (!list) return;
    if (!_notifCache.length) {
        list.innerHTML = `<div class="notif-empty">No tienes notificaciones por ahora.</div>`;
        return;
    }
    list.innerHTML = _notifCache.map(n => {
        const icon = n.tipo === 'edicion_solicitada' ? '⚠️' :
                     n.tipo === 'edicion_aprobada' ? '✓' : '🔔';
        const dt = n.created_at ? fmtNotifDate(n.created_at) : '';
        const clickAttr = n.formulario_id
            ? `onclick="onNotifClick(${n.id}, '${n.formulario_id}')"`
            : `onclick="onNotifClick(${n.id}, null)"`;
        return `<div class="notif-item ${n.leida ? 'read' : 'unread'}" ${clickAttr}>
            <div class="notif-icon">${icon}</div>
            <div class="notif-body">
                <div class="notif-title">${esc(n.titulo)}</div>
                <div class="notif-msg">${esc(n.mensaje || '')}</div>
                <div class="notif-date">${dt}</div>
            </div>
            ${n.leida ? '' : '<div class="notif-dot"></div>'}
        </div>`;
    }).join('');
}

function fmtNotifDate(iso) {
    try {
        const d = new Date(iso);
        const diff = (Date.now() - d.getTime()) / 1000;
        if (diff < 60) return 'hace instantes';
        if (diff < 3600) return `hace ${Math.floor(diff/60)} min`;
        if (diff < 86400) return `hace ${Math.floor(diff/3600)} h`;
        return d.toLocaleDateString('es-CO', { day: '2-digit', month: 'short' });
    } catch(e) { return ''; }
}

async function onNotifClick(notifId, formId) {
    // marca como leída
    try { await fetch(`${API_URL}/notifications/${notifId}/read`, { method: 'PUT' }); } catch(e) {}
    // cierra panel
    document.getElementById('notif-panel').style.display = 'none';
    // abre el formato si aplica
    if (formId && DB.forms[formId]) {
        openDetail(formId);
    } else if (formId) {
        await loadDB();
        if (DB.forms[formId]) openDetail(formId);
    }
    fetchNotifs();
}

async function markAllNotifsRead() {
    if (!CU || !CU.email) return;
    try {
        await fetch(`${API_URL}/notifications/read-all/${encodeURIComponent(CU.email)}`, { method: 'PUT' });
        fetchNotifs();
        showToast('Todas las notificaciones marcadas como leídas');
    } catch(e) { /* silencioso */ }
}