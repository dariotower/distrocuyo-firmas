
const ASSETS = window.__ASSETS__;
const canvas = document.getElementById('c');
const ctx = canvas.getContext('2d');

const elName = document.getElementById('name');
const elRole = document.getElementById('role');
const elArea = document.getElementById('area');
const elCountry = document.getElementById('country');
const elAreaCode = document.getElementById('areaCode');
const elNumber = document.getElementById('number');
const elMobile9 = document.getElementById('mobile9');

const btnDownload = document.getElementById('download');
const btnOpen = document.getElementById('open');
const btnClear = document.getElementById('clear');

const bg = document.getElementById('bg');

let baseImg = new Image();
baseImg.crossOrigin = 'anonymous';

// --- Retícula (basada en tu imagen 2048x776) ---
// Ajustes clave v5:
// - caja 3 sube unos px
// - separaciones 1/2/3 iguales (gap)
// - márgenes superior (nombre) e inferior (tel) se sienten equilibrados

const BOX = {
  // x, y, w, h dentro del canvas
  name:  { x: 650, y: 78,  w: 1320, h: 160 },  // caja 1
  role:  { x: 650, y: 262, w: 1320, h: 86  },  // caja 2
  phone: { x: 650, y: 392, w: 1320, h: 86  },  // caja 3 (subida)
};

// (Opcional) Si alguna vez querés debug, ponelo en true
const DEBUG = false;

const COLOR = "#1b5a92"; // azul tipográfico aproximado

// Tipos (Roboto) - se renderiza en canvas cuando la fuente carga
const FONT = "Roboto";

// Reglas editoriales:
// - Nombre: hasta 2 líneas, NO cortar palabras
// - Cargo|Área: 1 línea, puede ellipsis
// - Tel: 1 línea, puede ellipsis (pero normalmente no hace falta)
const LIMITS = {
  name: { maxLines: 2, maxSize: 86, minSize: 34, weight: 900, lineHeight: 1.06 },
  role: { maxLines: 1, maxSize: 42, minSize: 24, weight: 800, lineHeight: 1.15 },
  phone:{ maxLines: 1, maxSize: 42, minSize: 22, weight: 800, lineHeight: 1.15 },
};

function toUpperSmart(s){
  return (s || "").trim().toUpperCase();
}

function cleanDigits(s){
  return (s || "").replace(/[^\d]/g, "");
}

function formatPhone(){
  const c = elCountry.value || "+54";
  const ac = cleanDigits(elAreaCode.value);
  const num = cleanDigits(elNumber.value);
  if (!ac && !num) return "";

  const mobile = elMobile9.checked && c === "+54";
  // Formato: +54 9 261 5327691  (o +54 261 5327691)
  // Para num, agrupamos 3-4 (estilo local). Si tiene 7 digits -> 3 4. Si 8 -> 4 4, si 6 -> 3 3, etc.
  let grouped = num;
  if (num.length === 7) grouped = num.slice(0,3) + " " + num.slice(3);
  else if (num.length === 8) grouped = num.slice(0,4) + " " + num.slice(4);
  else if (num.length === 6) grouped = num.slice(0,3) + " " + num.slice(3);
  else if (num.length === 10) grouped = num.slice(0,3) + " " + num.slice(3,6) + " " + num.slice(6);
  // sino lo dejamos como viene (pero sin símbolos)

  return `TEL: ${c}${mobile ? " 9" : ""}${ac ? " " + ac : ""}${grouped ? " " + grouped : ""}`.trim();
}

function roleAreaLine(){
  const role = (elRole.value || "").trim();
  const area = (elArea.value || "").trim();
  if (!role && !area) return "";
  if (role && area) return `${role} | ${area}`;
  return role || area;
}

// --- Medición / wrap sin cortar palabras ---
function setFontPx(px, weight){
  ctx.font = `${weight} ${px}px ${FONT}, system-ui, -apple-system, Segoe UI, Arial, sans-serif`;
}

function measure(text){
  return ctx.measureText(text).width;
}

function wrapWords(text, maxWidth){
  // Devuelve el mejor wrap sin cortar palabras. Respeta espacios.
  const words = text.split(/\s+/).filter(Boolean);
  if (words.length === 0) return [""];
  let lines = [];
  let cur = words[0];
  for (let i=1;i<words.length;i++){
    const test = cur + " " + words[i];
    if (measure(test) <= maxWidth){
      cur = test;
    } else {
      lines.push(cur);
      cur = words[i];
    }
  }
  lines.push(cur);
  return lines;
}

function ellipsize(text, maxWidth){
  if (measure(text) <= maxWidth) return text;
  const ell = "…";
  let t = text;
  while (t.length > 0 && measure(t + ell) > maxWidth){
    t = t.slice(0, -1);
  }
  return (t.length ? t + ell : ell);
}

function fitMultiline(text, box, cfg){
  // Busca tamaño que cumpla: líneas<=maxLines, ancho<=box.w, alto<=box.h
  // sin cortar palabras: si wrap excede maxLines, reducimos tamaño; si aun así excede, forzamos ellipsis en última línea
  const maxLines = cfg.maxLines;
  for (let px = cfg.maxSize; px >= cfg.minSize; px--){
    setFontPx(px, cfg.weight);
    let lines = wrapWords(text, box.w);
    if (lines.length > maxLines) continue;

    const lh = px * cfg.lineHeight;
    const totalH = lines.length * lh;
    if (totalH > box.h) continue;

    // OK por alto y cantidad. Chequear ancho (wrap ya lo hace) y devolver
    return { px, lines, lh, overflow: false };
  }

  // Si no encontró, usamos minSize y truncamos a maxLines con ellipsis en la última (sin cortar palabras si se puede)
  const px = cfg.minSize;
  setFontPx(px, cfg.weight);
  const lh = px * cfg.lineHeight;

  let lines = wrapWords(text, box.w);
  if (lines.length > maxLines){
    lines = lines.slice(0, maxLines);
  }
  // Ellipsis en la última si excede ancho
  lines[lines.length-1] = ellipsize(lines[lines.length-1], box.w);

  return { px, lines, lh, overflow: true };
}

function fitSingleLine(text, box, cfg){
  for (let px = cfg.maxSize; px >= cfg.minSize; px--){
    setFontPx(px, cfg.weight);
    const w = measure(text);
    if (w <= box.w && px * cfg.lineHeight <= box.h){
      return { px, text, overflow:false };
    }
  }
  // minSize + ellipsis
  const px = cfg.minSize;
  setFontPx(px, cfg.weight);
  return { px, text: ellipsize(text, box.w), overflow:true };
}

function drawBoxDebug(box, color){
  ctx.save();
  ctx.strokeStyle = color;
  ctx.lineWidth = 2;
  ctx.strokeRect(box.x, box.y, box.w, box.h);
  ctx.restore();
}

function drawTextBlock(box, lines, px, lh, align="left"){
  ctx.save();
  ctx.fillStyle = COLOR;
  ctx.textBaseline = "top";
  ctx.textAlign = align;

  // Centramos verticalmente dentro de la caja (editorial: aire arriba/abajo equivalente)
  const totalH = lines.length * lh;
  const y0 = box.y + Math.max(0, (box.h - totalH) / 2);

  let x = box.x;
  if (align === "center") x = box.x + box.w/2;
  if (align === "right") x = box.x + box.w;

  let y = y0;
  for (const line of lines){
    ctx.fillText(line, x, y);
    y += lh;
  }

  ctx.restore();
}

function render(){
  // Inputs
  const name = toUpperSmart(elName.value);
  const roleArea = toUpperSmart(roleAreaLine());
  const phone = toUpperSmart(formatPhone());

  // Base
  ctx.clearRect(0,0,canvas.width,canvas.height);
  ctx.drawImage(baseImg, 0, 0, canvas.width, canvas.height);

  // Clip boxes to guarantee no overlap
  function clipAndDraw(box, drawFn){
    ctx.save();
    ctx.beginPath();
    ctx.rect(box.x, box.y, box.w, box.h);
    ctx.clip();
    drawFn();
    ctx.restore();
  }

  // NAME (2 líneas máx, sin cortar palabras)
  if (name){
    clipAndDraw(BOX.name, () => {
      const fit = fitMultiline(name, BOX.name, LIMITS.name);
      setFontPx(fit.px, LIMITS.name.weight);
      drawTextBlock(BOX.name, fit.lines, fit.px, fit.lh, "left");
    });
  }

  // ROLE|AREA (1 línea, ellipsis si hace falta)
  if (roleArea){
    clipAndDraw(BOX.role, () => {
      const fit = fitSingleLine(roleArea, BOX.role, LIMITS.role);
      setFontPx(fit.px, LIMITS.role.weight);
      drawTextBlock(BOX.role, [fit.text], fit.px, fit.px*LIMITS.role.lineHeight, "left");
    });
  }

  // PHONE (1 línea, ellipsis si hace falta)
  if (phone){
    clipAndDraw(BOX.phone, () => {
      const fit = fitSingleLine(phone, BOX.phone, LIMITS.phone);
      setFontPx(fit.px, LIMITS.phone.weight);
      drawTextBlock(BOX.phone, [fit.text], fit.px, fit.px*LIMITS.phone.lineHeight, "left");
    });
  }

  if (DEBUG){
    drawBoxDebug(BOX.name, "red");
    drawBoxDebug(BOX.role, "orange");
    drawBoxDebug(BOX.phone, "blue");
  }
}

function downloadBlob(blob, filename){
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(()=>URL.revokeObjectURL(a.href), 1500);
}

function safeFileName(s){
  return (s || "")
    .trim()
    .toLowerCase()
    .normalize('NFD').replace(/[\u0300-\u036f]/g,'') // sin tildes
    .replace(/[^a-z0-9]+/g,'-')
    .replace(/-+/g,'-')
    .replace(/(^-|-$)/g,'');
}

async function exportPng(){
  // aseguramos font cargada
  try { await document.fonts.ready; } catch(e){}
  render();
  return new Promise((resolve)=>{
    canvas.toBlob((blob)=>resolve(blob), "image/png", 1.0);
  });
}

btnDownload.addEventListener('click', async ()=>{
  const blob = await exportPng();
  const nm = safeFileName(elName.value);
  const filename = `${ASSETS.exportNamePrefix}${nm ? "-" + nm : ""}.png`;
  downloadBlob(blob, filename);
});

btnOpen.addEventListener('click', async ()=>{
  const blob = await exportPng();
  const url = URL.createObjectURL(blob);
  window.open(url, "_blank", "noopener,noreferrer");
  setTimeout(()=>URL.revokeObjectURL(url), 5000);
});

btnClear.addEventListener('click', ()=>{
  elName.value = "";
  elRole.value = "";
  elArea.value = "";
  elAreaCode.value = "";
  elNumber.value = "";
  elCountry.value = "+54";
  elMobile9.checked = true;
  render();
});

// live render
['input','change'].forEach(evt=>{
  document.querySelectorAll('input,select').forEach(el=>{
    el.addEventListener(evt, ()=>render());
  });
});

// Mouse-follow background highlight (azul claro sigue puntero)
window.addEventListener('pointermove', (e)=>{
  const x = (e.clientX / window.innerWidth) * 100;
  const y = (e.clientY / window.innerHeight) * 100;
  bg.style.background = `radial-gradient(650px 420px at ${x}% ${y}%, rgba(120,210,255,.26), transparent 55%)`;
}, {passive:true});

// Hide móvil 9 if not Argentina
function syncMobileToggle(){
  const show = elCountry.value === "+54";
  elMobile9.closest('.check').style.opacity = show ? "1" : ".35";
  elMobile9.disabled = !show;
  if (!show) elMobile9.checked = false;
}
elCountry.addEventListener('change', ()=>{ syncMobileToggle(); render(); });

async function boot(){
  baseImg.onload = async ()=>{
    try { await document.fonts.ready; } catch(e){}
    syncMobileToggle();
    render();
  };
  baseImg.src = ASSETS.baseDataUri;
}
boot();
