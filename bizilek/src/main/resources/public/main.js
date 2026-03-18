/* ══════════════════════════════════════════════════════════
   inmo. — main.js
   Vanilla JS puro. Consume la API Java/Spark en /api
   ══════════════════════════════════════════════════════════ */

'use strict';

// ── Estado global ─────────────────────────────────────────────
const STATE = {
  operacion: 'venta',
  tipo:      '',
  ciudad:    '',
  q:         '',
  precioMin: '',
  precioMax: '',
  hasTeraza: false,
  hasGaraje: false,
  orden:     'created_at DESC',
  pagina:    1,
  limite:    9,
};

const FAVORITOS = new Set(JSON.parse(localStorage.getItem('inmo_favs') || '[]'));

// ── Paletas SVG de casas ──────────────────────────────────────
const HOUSE_PALETTES = [
  { bg:'#eeeae4', roof:'#8a7a62', wall:'#f4f0ea', door:'#6a5840', win:'#a4bcc8' },
  { bg:'#e4eae8', roof:'#4e6860', wall:'#f2f6f4', door:'#5a4830', win:'#98bcc8' },
  { bg:'#e8eee4', roof:'#6a7e68', wall:'#f0f4ee', door:'#6a5840', win:'#98bcc0' },
  { bg:'#eee4e4', roof:'#7a6868', wall:'#f8f2f0', door:'#6a5848', win:'#b8c8d0' },
  { bg:'#eae4ea', roof:'#786878', wall:'#f2eef2', door:'#6a5060', win:'#9ab4c8' },
  { bg:'#e4e8ee', roof:'#6878a0', wall:'#eef0f6', door:'#5a6048', win:'#a4b8cc' },
];

// ── House SVG builder ─────────────────────────────────────────
function buildHouseSVG(p, type = 'card') {
  const w = 320, h = 180;
  // Elige variante según tipo
  const variant = type === 'mini' ? 'mini' : ['piso','estudio'].includes(type) ? 'flat' : 'pitched';

  if (variant === 'flat') {
    // Edificio de pisos plano
    return `<svg viewBox="0 0 ${w} ${h}" width="100%" height="100%" xmlns="http://www.w3.org/2000/svg">
      <rect width="${w}" height="${h}" fill="${p.bg}"/>
      <rect x="0" y="${h-32}" width="${w}" height="32" fill="${p.roof}" opacity="0.35"/>
      <rect x="90" y="35" width="140" height="115" fill="${p.wall}"/>
      <rect x="80" y="28" width="160" height="14" rx="2" fill="${p.roof}"/>
      ${[56,92,114].map(y => [104,146,188].map(x =>
        `<rect x="${x}" y="${y}" width="30" height="22" rx="2" fill="${p.win}" opacity="0.85"/>`
      ).join('')).join('')}
      <rect x="134" y="120" width="52" height="30" rx="2" fill="${p.door}"/>
    </svg>`;
  }

  if (variant === 'mini') {
    return `<svg viewBox="0 0 64 64" width="64" height="64" xmlns="http://www.w3.org/2000/svg">
      <rect x="14" y="32" width="36" height="24" fill="${p.wall}"/>
      <polygon points="10,34 32,14 54,34" fill="${p.roof}"/>
      <rect x="26" y="42" width="12" height="14" fill="${p.door}"/>
      <rect x="16" y="36" width="10" height="9" fill="${p.win}" opacity="0.8"/>
      <rect x="38" y="36" width="10" height="9" fill="${p.win}" opacity="0.8"/>
    </svg>`;
  }

  // Pitched — casa con tejado
  return `<svg viewBox="0 0 ${w} ${h}" width="100%" height="100%" xmlns="http://www.w3.org/2000/svg">
    <rect width="${w}" height="${h}" fill="${p.bg}"/>
    <rect x="0" y="${h-32}" width="${w}" height="32" fill="${p.roof}" opacity="0.3"/>
    <rect x="80" y="70" width="160" height="82" fill="${p.wall}"/>
    <polygon points="60,74 160,24 260,74" fill="${p.roof}"/>
    <rect x="130" y="108" width="60" height="44" fill="${p.door}"/>
    <rect x="90" y="86" width="48" height="36" fill="${p.win}" opacity="0.85"/>
    <line x1="114" y1="86" x2="114" y2="122" stroke="${p.bg}" stroke-width="1.5"/>
    <line x1="90"  y1="104" x2="138" y2="104" stroke="${p.bg}" stroke-width="1.5"/>
    <rect x="182" y="86" width="48" height="36" fill="${p.win}" opacity="0.85"/>
    <line x1="206" y1="86" x2="206" y2="122" stroke="${p.bg}" stroke-width="1.5"/>
    <line x1="182" y1="104" x2="230" y2="104" stroke="${p.bg}" stroke-width="1.5"/>
  </svg>`;
}

// ── Format helpers ────────────────────────────────────────────
function fmtPrice(precio, operacion) {
  const n = new Intl.NumberFormat('es-ES').format(precio);
  return operacion === 'alquiler' ? `€${n}<small>/mes</small>` : `€${n}`;
}
function fmtNum(n) {
  if (!n && n !== 0) return '—';
  return new Intl.NumberFormat('es-ES').format(Math.round(n));
}

// ── API client ────────────────────────────────────────────────
const API = 'http://localhost:4567/api';

async function apiFetch(path, opts = {}) {
  const res  = await fetch(`${API}${path}`, opts);
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Error en la petición');
  return data;
}

// ══════════════════════════════════════════════
//  INIT
// ══════════════════════════════════════════════
document.addEventListener('DOMContentLoaded', async () => {
  initCursor();
  await Promise.all([
    loadCities(),
    loadStats(),
    loadFeatured(),
    loadListings(),
  ]);
});

// ── Custom cursor ─────────────────────────────────────────────
function initCursor() {
  const cursor = document.getElementById('cursor');
  document.addEventListener('mousemove', e => {
    cursor.style.left = e.clientX + 'px';
    cursor.style.top  = e.clientY + 'px';
  });
  document.addEventListener('mouseover', e => {
    if (e.target.closest('button,a,input,select,textarea,[data-hover]')) cursor.classList.add('big');
  });
  document.addEventListener('mouseout', e => {
    if (e.target.closest('button,a,input,select,textarea,[data-hover]')) cursor.classList.remove('big');
  });
}

// ── Load cities ───────────────────────────────────────────────
async function loadCities() {
  try {
    const ciudades = await apiFetch('/ciudades');
    const addOptions = (sel) => {
      ciudades.forEach(c => {
        const opt = document.createElement('option');
        opt.value = c.nombre; opt.textContent = c.nombre;
        sel.appendChild(opt);
      });
    };
    addOptions(document.getElementById('searchCiudad'));
    addOptions(document.getElementById('valCiudad'));
  } catch (e) {
    console.warn('No se pudieron cargar ciudades:', e.message);
  }
}

// ── Load stats ────────────────────────────────────────────────
async function loadStats() {
  try {
    const s = await apiFetch('/estadisticas');
    document.getElementById('statTotal').textContent    = fmtNum(s.totalPropiedades);
    document.getElementById('statVenta').textContent    = fmtNum(s.enVenta);
    document.getElementById('statAlquiler').textContent = fmtNum(s.enAlquiler);
    document.getElementById('statPrecioMedio').textContent = `€${Math.round(s.precioMedioVenta/1000)}k`;
    document.getElementById('stat-total').textContent   = fmtNum(s.totalPropiedades);
  } catch (e) {
    document.getElementById('statTotal').textContent    = '182.000';
    document.getElementById('statVenta').textContent    = '95.000';
    document.getElementById('statAlquiler').textContent = '65.000';
    document.getElementById('statPrecioMedio').textContent = '€487k';
  }
}

// ── Load featured (hero sidebar) ──────────────────────────────
async function loadFeatured() {
  const sidebar = document.getElementById('heroSidebar');
  try {
    const resp = await apiFetch('/propiedades?destacados=true&limite=3&pagina=1');
    const props = resp.datos || [];
    sidebar.innerHTML = '';

    if (props.length === 0) {
      sidebar.innerHTML = '<p style="color:var(--mid);font-size:12px;text-align:center;padding:20px">Sin destacados</p>';
      return;
    }

    props.forEach((p, i) => {
      const pal = HOUSE_PALETTES[i % HOUSE_PALETTES.length];
      const div = document.createElement('div');
      div.className = 'mini-card';
      div.setAttribute('data-hover','');
      div.onclick = () => openDetail(p.id, i);
      div.innerHTML = `
        <div class="mini-card-inner">
          <div class="mini-thumb" style="background:${pal.bg}">
            ${buildHouseSVG(pal, 'mini')}
          </div>
          <div class="mini-info">
            <div class="mini-price">${fmtPrice(p.precio, p.operacion)}</div>
            <div class="mini-loc">${[p.barrio, p.ciudad].filter(Boolean).join(', ')}</div>
            <div class="mini-tags">
              ${p.areaTotalM2 ? `<span class="mini-tag">${p.areaTotalM2} m²</span>` : ''}
              ${p.habitaciones ? `<span class="mini-tag">${p.habitaciones} hab</span>` : ''}
            </div>
          </div>
          <span class="mini-arrow">→</span>
        </div>`;
      sidebar.appendChild(div);
    });
  } catch (e) {
    sidebar.innerHTML = '';
    // Mini cards de fallback
    const mocks = [
      { precio:485000, operacion:'venta',    barrio:'Eixample',  ciudad:'Barcelona', areaTotalM2:142, habitaciones:4 },
      { precio:2100,   operacion:'alquiler', barrio:'Sarrià',    ciudad:'Barcelona', areaTotalM2:115, habitaciones:3 },
      { precio:325000, operacion:'nueva',    barrio:'Gràcia',    ciudad:'Barcelona', areaTotalM2:78,  habitaciones:2 },
    ];
    mocks.forEach((p, i) => {
      const pal = HOUSE_PALETTES[i];
      const div = document.createElement('div');
      div.className = 'mini-card';
      div.innerHTML = `
        <div class="mini-card-inner">
          <div class="mini-thumb" style="background:${pal.bg}">${buildHouseSVG(pal,'mini')}</div>
          <div class="mini-info">
            <div class="mini-price">${fmtPrice(p.precio,p.operacion)}</div>
            <div class="mini-loc">${p.barrio}, ${p.ciudad}</div>
            <div class="mini-tags">
              <span class="mini-tag">${p.areaTotalM2} m²</span>
              <span class="mini-tag">${p.habitaciones} hab</span>
            </div>
          </div>
          <span class="mini-arrow">→</span>
        </div>`;
      sidebar.appendChild(div);
    });
  }
}

// ══════════════════════════════════════════════
//  LISTINGS
// ══════════════════════════════════════════════
async function loadListings() {
  const grid  = document.getElementById('propertyGrid');
  const title = document.getElementById('resultsTitle');
  const pag   = document.getElementById('pagination');

  // Mostrar skeletons
  grid.innerHTML = Array.from({length:6}).map(() =>
    `<div class="prop-card grid-skeleton"></div>`
  ).join('');

  const params = new URLSearchParams();
  if (STATE.operacion) params.set('operacion', STATE.operacion);
  if (STATE.tipo && !['terraza','garaje'].includes(STATE.tipo)) params.set('tipo', STATE.tipo);
  if (STATE.tipo === 'terraza') params.set('hasTeraza', 'true');
  if (STATE.tipo === 'garaje')  params.set('hasGaraje', 'true');
  if (STATE.ciudad)    params.set('ciudad',    STATE.ciudad);
  if (STATE.q)         params.set('q',         STATE.q);
  if (STATE.precioMin) params.set('precioMin', STATE.precioMin);
  if (STATE.precioMax) params.set('precioMax', STATE.precioMax);
  params.set('orden',  STATE.orden);
  params.set('pagina', STATE.pagina);
  params.set('limite', STATE.limite);

  try {
    const resp = await apiFetch('/propiedades?' + params.toString());
    const { datos = [], total = 0, paginas = 1 } = resp;

    // Update title
    title.textContent = `${fmtNum(total)} inmueble${total !== 1 ? 's' : ''}`;

    if (datos.length === 0) {
      grid.innerHTML = `<div class="grid-empty">Sin resultados para estos filtros.<br>
        <button class="btn-outline" style="margin-top:12px" onclick="resetFilters()">Limpiar filtros</button></div>`;
      pag.innerHTML = '';
      return;
    }

    grid.innerHTML = '';
    datos.forEach((p, i) => renderCard(p, i));
    renderPagination(STATE.pagina, paginas);

  } catch (e) {
    grid.innerHTML = `<div class="grid-error">
      No se pudo conectar al servidor.<br>
      <small style="opacity:0.5">${e.message}</small><br>
      <button class="btn-outline" style="margin-top:12px" onclick="loadListings()">Reintentar</button>
    </div>`;
    pag.innerHTML = '';
  }
}

// ── Render a single card ──────────────────────────────────────
function renderCard(p, index) {
  const grid = document.getElementById('propertyGrid');
  const pal  = HOUSE_PALETTES[index % HOUSE_PALETTES.length];
  const isFav = FAVORITOS.has(p.id);
  const badgeClass = `badge-${p.operacion}`;
  const badgeLabel = { venta:'Venta', alquiler:'Alquiler', nueva:'Nuevo' }[p.operacion] || p.operacion;

  const specs = [
    p.habitaciones != null ? { v: p.habitaciones,  l: 'hab' }   : null,
    p.banos        != null ? { v: p.banos,          l: 'baños' } : null,
    p.areaTotalM2  != null ? { v: p.areaTotalM2,    l: 'm²' }    : null,
    p.planta       != null ? { v: `${p.planta}ª`,   l: 'planta'} : { v: p.certificadoEnergetico || '—', l:'cert' },
  ].filter(Boolean);

  const card = document.createElement('div');
  card.className = 'prop-card';
  card.innerHTML = `
    <div class="card-img">
      <div class="card-img-inner house-wrap" style="background:${pal.bg}">
        ${buildHouseSVG(pal, p.tipo)}
      </div>
      <span class="card-badge ${badgeClass}">${badgeLabel}</span>
      <button class="card-heart ${isFav ? 'active' : ''}"
              onclick="toggleFav(event,${p.id})" title="Guardar">
        ${isFav ? '♥' : '♡'}
      </button>
    </div>
    <div class="card-body">
      <div class="card-price">${fmtPrice(p.precio, p.operacion)}</div>
      <div class="card-loc">${[p.barrio, p.ciudad].filter(Boolean).join(', ')}</div>
      <div class="card-specs">
        ${specs.map((s,i) => `
          <div class="spec" style="${i < specs.length-1 ? '' : ''}">
            <strong>${s.v}</strong>${s.l}
          </div>`).join('')}
      </div>
    </div>`;

  card.onclick = (e) => {
    if (e.target.closest('.card-heart')) return;
    openDetail(p.id, index);
  };

  grid.appendChild(card);
}

// ── Render pagination ─────────────────────────────────────────
function renderPagination(current, total) {
  const pag = document.getElementById('pagination');
  if (total <= 1) { pag.innerHTML = ''; return; }

  let html = `<button class="page-btn" onclick="goPage(${current-1})" ${current<=1?'disabled':''}>‹</button>`;

  for (let i = 1; i <= total; i++) {
    if (i === 1 || i === total || Math.abs(i - current) <= 1) {
      html += `<button class="page-btn ${i===current?'active':''}" onclick="goPage(${i})">${i}</button>`;
    } else if (Math.abs(i - current) === 2) {
      html += `<span class="page-dots">…</span>`;
    }
  }
  html += `<button class="page-btn" onclick="goPage(${current+1})" ${current>=total?'disabled':''}>›</button>`;
  pag.innerHTML = html;
}

// ══════════════════════════════════════════════
//  CONTROLS
// ══════════════════════════════════════════════
function setMode(btn, mode) {
  document.querySelectorAll('.mode-btn').forEach(b => b.classList.remove('active'));
  btn.classList.add('active');
  STATE.operacion = mode;
  STATE.pagina = 1;
  loadListings();
  document.getElementById('listings').scrollIntoView({ behavior:'smooth' });
}

function setChip(btn, tipo) {
  document.querySelectorAll('.chip').forEach(c => c.classList.remove('active'));
  btn.classList.add('active');
  STATE.tipo = tipo;
  STATE.pagina = 1;
  loadListings();
}

function applySort() {
  STATE.orden = document.getElementById('sortSelect').value;
  STATE.pagina = 1;
  loadListings();
}

function goPage(p) {
  STATE.pagina = p;
  loadListings();
  document.getElementById('listings').scrollIntoView({ behavior:'smooth' });
}

function resetFilters() {
  STATE.operacion = ''; STATE.tipo = ''; STATE.ciudad = '';
  STATE.q = ''; STATE.precioMin = ''; STATE.precioMax = '';
  STATE.pagina = 1;
  document.querySelectorAll('.chip').forEach(c => c.classList.remove('active'));
  document.querySelector('.chip').classList.add('active');
  document.getElementById('searchQ').value = '';
  loadListings();
}

// Search form
function handleSearch(e) {
  e.preventDefault();
  STATE.q        = document.getElementById('searchQ').value.trim();
  STATE.ciudad   = document.getElementById('searchCiudad').value;
  const pv       = document.getElementById('searchPrecio').value;
  if (pv) { const [min,max] = pv.split(','); STATE.precioMin=min; STATE.precioMax=max; }
  else    { STATE.precioMin=''; STATE.precioMax=''; }
  STATE.pagina   = 1;
  loadListings();
  document.getElementById('listings').scrollIntoView({ behavior:'smooth' });
}

// Favorites
function toggleFav(e, id) {
  e.stopPropagation();
  const btn = e.currentTarget;
  if (FAVORITOS.has(id)) {
    FAVORITOS.delete(id);
    btn.classList.remove('active');
    btn.textContent = '♡';
  } else {
    FAVORITOS.add(id);
    btn.classList.add('active');
    btn.textContent = '♥';
    btn.style.transform = 'scale(1.3)';
    setTimeout(() => btn.style.transform = '', 250);
  }
  localStorage.setItem('inmo_favs', JSON.stringify([...FAVORITOS]));
}

// ══════════════════════════════════════════════
//  DETAIL MODAL
// ══════════════════════════════════════════════
async function openDetail(id, index) {
  const overlay = document.getElementById('detailOverlay');
  const content = document.getElementById('detailContent');
  overlay.classList.add('open');
  document.body.style.overflow = 'hidden';

  content.innerHTML = `<div style="padding:80px;text-align:center;color:var(--mid);font-family:'DM Mono',monospace">Cargando…</div>`;

  try {
    const p   = await apiFetch(`/propiedades/${id}`);
    const pal = HOUSE_PALETTES[index % HOUSE_PALETTES.length];
    const badgeClass = `badge-${p.operacion}`;
    const badgeLabel = { venta:'Venta', alquiler:'Alquiler', nueva:'Obra nueva' }[p.operacion] || p.operacion;

    const feats = [
      p.tieneAscensor && 'Ascensor', p.tieneGaraje && 'Garaje',
      p.tieneTeraza && 'Terraza', p.tieneJardin && 'Jardín',
      p.tienePiscina && 'Piscina', p.tieneAc && 'A/C',
      p.tieneCalefaccion && 'Calefacción', p.amueblado && 'Amueblado',
      p.admiteMascotas && 'Mascotas',
    ].filter(Boolean);

    content.innerHTML = `
      <div class="detail-hero" style="background:${pal.bg}">
        ${buildHouseSVG(pal, p.tipo)}
        <span class="card-badge ${badgeClass}" style="position:absolute;bottom:16px;left:16px">${badgeLabel}</span>
      </div>
      <div class="detail-body">
        <div>
          <div class="detail-price">${fmtPrice(p.precio, p.operacion)}</div>
          <div class="detail-loc">📍 ${[p.direccion, p.barrio, p.ciudad].filter(Boolean).join(', ')}</div>

          <div class="detail-stats">
            ${[
              { icon:'🛏', v: p.habitaciones ?? '—', l:'Habitaciones' },
              { icon:'🚿', v: p.banos        ?? '—', l:'Baños' },
              { icon:'📐', v: p.areaTotalM2 ? `${p.areaTotalM2} m²` : '—', l:'Superficie' },
              { icon:'⚡', v: p.certificadoEnergetico?.toUpperCase() ?? '—', l:'Energía' },
            ].map(s => `
              <div class="dstat">
                <div class="dstat-icon">${s.icon}</div>
                <div class="dstat-val">${s.v}</div>
                <div class="dstat-lbl">${s.l}</div>
              </div>`).join('')}
          </div>

          ${p.descripcion ? `<p class="detail-desc">${p.descripcion}</p>` : ''}

          ${feats.length ? `
            <div class="detail-feats">
              ${feats.map(f => `<span class="feat-tag">${f}</span>`).join('')}
              ${p.anoConstruccion ? `<span class="feat-tag">Año ${p.anoConstruccion}</span>` : ''}
            </div>` : ''}
        </div>

        <!-- Formulario de contacto -->
        <div class="contact-form">
          <h3>Contactar</h3>
          <p>Respuesta media en menos de 2h</p>
          <div id="contactFormWrap">
            <input type="text"  id="cNombre" class="form-input" placeholder="Tu nombre" />
            <input type="email" id="cEmail"  class="form-input" placeholder="Email" required />
            <input type="tel"   id="cTel"    class="form-input" placeholder="Teléfono (opcional)" />
            <textarea id="cMsg" class="form-input" rows="3" placeholder="Me interesa este inmueble…"></textarea>
            <button class="btn-black w100" onclick="submitInquiry(${p.id})">Enviar mensaje</button>
          </div>
          <p class="form-views">${p.vistas} visitas</p>
        </div>
      </div>`;

  } catch (e) {
    content.innerHTML = `<div style="padding:60px;text-align:center;color:var(--mid)">No se pudo cargar la propiedad.</div>`;
  }
}

async function submitInquiry(propId) {
  const nombre = document.getElementById('cNombre').value;
  const email  = document.getElementById('cEmail').value;
  const tel    = document.getElementById('cTel').value;
  const msg    = document.getElementById('cMsg').value;

  if (!email || !msg) { alert('Email y mensaje son obligatorios.'); return; }

  try {
    await apiFetch('/consultas', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ propiedadId: propId, nombre, email, telefono: tel, mensaje: msg }),
    });
    document.getElementById('contactFormWrap').innerHTML = `
      <div class="form-sent">
        <div class="form-sent-icon">✓</div>
        <strong>Mensaje enviado</strong>
        <p style="font-size:12px;color:var(--mid);margin-top:4px">Te responderemos pronto.</p>
      </div>`;
  } catch (e) {
    alert('Error al enviar: ' + e.message);
  }
}

// ══════════════════════════════════════════════
//  VALORACIÓN
// ══════════════════════════════════════════════
async function submitValuation(e) {
  e.preventDefault();
  const btn  = e.target.querySelector('button[type=submit]');
  btn.textContent = 'Calculando…'; btn.disabled = true;

  try {
    const res = await apiFetch('/valoracion', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        ciudad:         document.getElementById('valCiudad').value,
        tipo:           document.getElementById('valTipo').value,
        metrosCuadrados: parseFloat(document.getElementById('valMetros').value),
      }),
    });

    const resultDiv = document.getElementById('valuationResult');
    resultDiv.style.display = 'block';
    resultDiv.innerHTML = `
      <div class="section-label">Valoración estimada</div>
      <div class="val-result-range">
        €${fmtNum(res.estimadoMin)} – €${fmtNum(res.estimadoMax)}
      </div>
      <div class="val-result-ppm">~€${fmtNum(res.precioPorMetro)}/m² en la zona</div>
      <button class="btn-outline" style="margin-top:12px;font-size:12px"
              onclick="document.getElementById('valuationResult').style.display='none';
                       document.getElementById('valuationForm').reset();">
        Nueva valoración
      </button>`;

    document.getElementById('valuationForm').style.display = 'none';

  } catch (err) {
    alert('Error: ' + err.message);
    btn.textContent = 'Valorar ahora →'; btn.disabled = false;
  }
}

// ══════════════════════════════════════════════
//  MODALS HELPERS
// ══════════════════════════════════════════════
function closeModal(type) {
  const id = type === 'detail' ? 'detailOverlay' : 'authOverlay';
  document.getElementById(id).classList.remove('open');
  document.body.style.overflow = '';
}

function openModal(type) {
  const overlay = document.getElementById('authOverlay');
  const content = document.getElementById('authContent');
  overlay.classList.add('open');
  document.body.style.overflow = 'hidden';

  if (type === 'login') {
    content.innerHTML = `
      <div class="auth-box">
        <h2>Bienvenido de nuevo</h2>
        <p>Entra con tu cuenta de inmo.</p>
        <div class="auth-form">
          <input type="email"    class="form-input" placeholder="Email" id="aEmail" />
          <input type="password" class="form-input" placeholder="Contraseña" id="aPwd" />
          <button class="btn-black w100" onclick="handleLogin()">Entrar →</button>
        </div>
        <div class="auth-switch">¿Sin cuenta? <button onclick="openModal('register')">Regístrate</button></div>
        <div class="auth-demo">Demo: demo@inmo.es / demo1234</div>
      </div>`;
  } else {
    content.innerHTML = `
      <div class="auth-box">
        <h2>Crear cuenta</h2>
        <p>Guarda favoritos y contacta con propietarios.</p>
        <div class="auth-form">
          <input type="text"     class="form-input" placeholder="Nombre completo" id="rName" />
          <input type="email"    class="form-input" placeholder="Email" id="rEmail" />
          <input type="password" class="form-input" placeholder="Contraseña (mín. 8)" id="rPwd" />
          <input type="tel"      class="form-input" placeholder="Teléfono (opcional)" id="rTel" />
          <button class="btn-black w100" onclick="handleRegister()">Crear cuenta →</button>
        </div>
        <div class="auth-switch">¿Ya tienes cuenta? <button onclick="openModal('login')">Entrar</button></div>
      </div>`;
  }
}

function handleLogin() {
  const email = document.getElementById('aEmail').value;
  const pwd   = document.getElementById('aPwd').value;
  if (!email || !pwd) { alert('Rellena email y contraseña.'); return; }
  // En producción llamaría a /api/auth/login
  alert('✓ Login funcional — conecta tu endpoint /api/auth/login en Main.java');
  closeModal('auth');
}

function handleRegister() {
  const name  = document.getElementById('rName').value;
  const email = document.getElementById('rEmail').value;
  const pwd   = document.getElementById('rPwd').value;
  if (!name || !email || !pwd) { alert('Rellena los campos obligatorios.'); return; }
  alert('✓ Registro funcional — conecta tu endpoint /api/auth/register en Main.java');
  closeModal('auth');
}

// Escape key closes modals
document.addEventListener('keydown', e => {
  if (e.key === 'Escape') {
    closeModal('detail'); closeModal('auth');
  }
});
