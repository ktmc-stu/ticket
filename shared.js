// 1. 注入全域樣式
function injectStyles() {
  const style = document.createElement('style');
  style.innerHTML = `
    :root { --bg: #F0F4F8; --panel: #FFFFFF; --primary: #0052CC; --primary-dark: #003E99; --text-main: #1A202C; --text-sub: #718096; --line: #D7E1F0; --success: #157347; --danger: #DC3545; --warning: #FF8C00; }
    body { font-family: system-ui, -apple-system, "Segoe UI", Roboto, "Helvetica Neue", Arial, "PingFang TC", "Microsoft JhengHei", "Noto Sans TC", sans-serif; background: var(--bg); color: var(--text-main); margin: 0; padding: 20px; }
    .container { max-width: 1200px; margin: 0 auto; }
    .card { background: var(--panel); padding: 20px; border-radius: 8px; box-shadow: 0 2px 4px rgba(0,0,0,0.05); margin-bottom: 20px; }
    .btn { padding: 10px 20px; border: none; border-radius: 4px; cursor: pointer; font-size: 16px; margin: 5px; font-family: inherit; }
    .btn-primary { background: var(--primary); color: #fff; } .btn-primary:hover { background: var(--primary-dark); }
    .btn-success { background: var(--success); color: #fff; } .btn-danger { background: var(--danger); color: #fff; } .btn-warning { background: var(--warning); color: #fff; }
    .btn-large { padding: 40px; font-size: 24px; width: 100%; margin: 10px 0; }
    input, select { padding: 10px; border: 1px solid var(--line); border-radius: 4px; font-size: 16px; width: 100%; box-sizing: border-box; margin-bottom: 10px; font-family: inherit; }
    h1, h2, h3 { margin-top: 0; } small { color: var(--text-sub); font-weight: normal; }
    .text-center { text-align: center; } .hidden { display: none !important; }
    table { width: 100%; border-collapse: collapse; margin-top: 10px; }
    th, td { padding: 8px; border: 1px solid var(--line); text-align: left; font-size: 14px; }
    th { background: var(--bg); }
    .seat-map { display: grid; gap: 5px; margin: 20px auto; justify-content: center; }
    .seat { width: 35px; height: 35px; border: 2px solid var(--primary); background: #fff; cursor: pointer; display: flex; align-items: center; justify-content: center; font-size: 12px; border-radius: 4px; }
    .seat.selected { background: var(--warning); color: #fff; border-color: var(--warning); }
    .seat.reserved { background: #ccc; cursor: not-allowed; border-color: #999; color: #666; }
    .seat.sold { background: #555; color: #fff; cursor: not-allowed; border-color: #333; }
    .gate-result { padding: 40px; text-align: center; font-size: 32px; font-weight: bold; border-radius: 8px; margin: 20px 0; }
    .gate-success { background: var(--success); color: #fff; } .gate-error { background: var(--danger); color: #fff; }
    .modal-bg { position: fixed; top: 0; left: 0; width: 100%; height: 100%; background: rgba(0,0,0,0.5); display: flex; align-items: center; justify-content: center; z-index: 9999; }
    .modal-box { background: #fff; padding: 30px; border-radius: 8px; width: 350px; text-align: center; }
    #printArea { display: none; }
    @media print {
      @page { size: 80mm auto; margin: 0; }
      body > *:not(#printArea) { display: none !important; }
      body { background: #fff; padding: 0; margin: 0; }
      #printArea { display: block !important; width: 72mm; margin: 0 auto; color: #000; background: #fff; font-family: system-ui, -apple-system, "Segoe UI", Roboto, "Helvetica Neue", Arial, "PingFang TC", "Microsoft JhengHei", "Noto Sans TC", sans-serif; }
      .reprint-mark { text-align: center; font-weight: bold; font-size: 16px; margin-bottom: 6px; }
      .doc-title { text-align: center; font-weight: bold; font-size: 18px; margin-bottom: 6px; }
      .doc-line { font-size: 13px; margin: 2px 0; }
      .qr-wrap { text-align: center; margin: 8px 0; }
      .qr-wrap img { width: 110px; height: 110px; }
      .divider { border-top: 1px dashed #000; margin: 10px 0; }
    }
  `;
  document.head.appendChild(style);
}
injectStyles();

// 2. Firebase 初始化
firebase.initializeApp(FIREBASE_CONFIG);
const db = firebase.database();

// 3. 工具函式
async function sha256(text) {
  const encoded = new TextEncoder().encode(text);
  const digest = await crypto.subtle.digest("SHA-256", encoded);
  return Array.from(new Uint8Array(digest)).map(b => b.toString(16).padStart(2, "0")).join("");
}

function generateRandomOrderId(schoolCode) {
  let digits = "";
  for (let i = 0; i < 9; i++) digits += Math.floor(Math.random() * 10);
  return schoolCode + digits;
}

async function createUniqueOrderId(schoolCode) {
  while (true) {
    const orderId = generateRandomOrderId(schoolCode);
    const snap = await db.ref("orders/" + orderId).once("value");
    if (!snap.exists()) return orderId;
  }
}

function generateQRCodeDataURL(text) {
  const qr = qrcode(0, "M");
  qr.addData(text);
  qr.make();
  const moduleCount = qr.getModuleCount();
  const size = 240;
  const canvas = document.createElement("canvas");
  canvas.width = size; canvas.height = size;
  const ctx = canvas.getContext("2d");
  const cellSize = size / moduleCount;
  ctx.fillStyle = "#ffffff"; ctx.fillRect(0, 0, size, size);
  ctx.fillStyle = "#000000";
  for (let row = 0; row < moduleCount; row++) {
    for (let col = 0; col < moduleCount; col++) {
      if (qr.isDark(row, col)) ctx.fillRect(col * cellSize, row * cellSize, cellSize, cellSize);
    }
  }
  return canvas.toDataURL("image/png");
}

function formatDateForFile(date) {
  const y = date.getFullYear(), m = String(date.getMonth() + 1).padStart(2, "0"), d = String(date.getDate()).padStart(2, "0");
  const h = String(date.getHours()).padStart(2, "0"), min = String(date.getMinutes()).padStart(2, "0");
  return `${y}${m}${d}-${h}${min}`;
}

// 4. 列印函式
function printReceipt(order, reprintNth = 0) {
  const printArea = document.getElementById("printArea");
  const qr = generateQRCodeDataURL(order.orderId);
  const reprintHtml = reprintNth > 0 ? `<div class="reprint-mark">重新列印 Reprint #${reprintNth}</div>` : "";
  printArea.innerHTML = `
    ${reprintHtml}
    <div class="doc-title">收據<br><small>Receipt</small></div>
    <div class="doc-line">發售方 / Issuer: ${order.issuerSchool}</div>
    <div class="doc-line">訂單編號 / Order No.: ${order.orderId}</div>
    <div class="doc-line">活動 / Event: ${order.eventName_zh}</div>
    <div class="doc-line">身份 / Category: ${order.buyerType}</div>
    ${order.buyerName ? `<div class="doc-line">姓名 / Name: ${order.buyerName}</div>` : ""}
    ${order.buyerCard ? `<div class="doc-line">學生證 / Student Card: ${order.buyerCard}</div>` : ""}
    <div class="doc-line">金額 / Amount: $${order.amount || 0}</div>
    <div class="qr-wrap"><img src="${qr}" alt="QR Code"></div>
    <div class="doc-line" style="text-align:center;">請保留此收據 / Please keep this receipt</div>
  `;
  setTimeout(() => window.print(), 300);
}

function printVoucher(order, reprintNth = 0, isSelection = false) {
  const printArea = document.getElementById("printArea");
  const qr = generateQRCodeDataURL(order.orderId);
  const reprintHtml = reprintNth > 0 ? `<div class="reprint-mark">重新列印 Reprint #${reprintNth}</div>` : "";
  const title = isSelection ? "座位選擇憑條<br><small>Seat Selection Voucher</small>" : "座位預留憑條<br><small>Seat Reservation Voucher</small>";
  printArea.innerHTML = `
    ${reprintHtml}
    <div class="doc-title">${title}</div>
    <div class="doc-line">訂單編號 / Order No.: ${order.orderId}</div>
    <div class="doc-line">活動 / Event: ${order.eventName_zh}</div>
    <div class="doc-line" style="font-size:18px; font-weight:bold; text-align:center;">座位 / Seat: ${order.seatId}</div>
    <div class="qr-wrap"><img src="${qr}" alt="QR Code"></div>
    <div class="doc-line" style="text-align:center;">請憑此憑條入場 / Please present this voucher for admission</div>
  `;
  setTimeout(() => window.print(), 300);
}

// 5. 重新列印授權
function promptPassword() {
  return new Promise((resolve) => {
    const modal = document.createElement('div');
    modal.className = 'modal-bg';
    modal.innerHTML = `<div class="modal-box">
      <h3>重新列印授權<br><small>Reprint Authorization</small></h3>
      <p>請輸入管理員密碼<br><small>Please enter administrator password</small></p>
      <input type="password" id="adminPassInput">
      <button id="cancelBtn" class="btn btn-danger">取消<br><small>Cancel</small></button>
      <button id="confirmBtn" class="btn btn-primary">確認<br><small>Confirm</small></button>
    </div>`;
    document.body.appendChild(modal);
    const input = modal.querySelector('#adminPassInput');
    input.focus();
    const close = (val) => { document.body.removeChild(modal); resolve(val); };
    modal.querySelector('#cancelBtn').onclick = () => close(null);
    modal.querySelector('#confirmBtn').onclick = () => close(input.value);
    input.onkeydown = (e) => { if(e.key === 'Enter') close(input.value); };
  });
}

async function authorizeReprint(orderId, docType) {
  const inputPassword = await promptPassword();
  if (!inputPassword) return null;
  if (inputPassword !== ADMIN_PASSWORD) { alert("管理員密碼錯誤 / Incorrect administrator password"); return null; }
  const field = docType === "receipt" ? "receiptReprintCount" : "voucherReprintCount";
  const ref = db.ref(`orders/${orderId}/${field}`);
  const result = await ref.transaction(current => (current || 0) + 1);
  const nth = result.snapshot.val();
  await db.ref("reprintLogs").push({
    orderId, docType, nth, staffId: sessionStorage.getItem("posStaffId") || "kiosk", authorizedBy: "admin", at: Date.now()
  });
  return nth;
}

// 6. 訂單與座位操作
async function createOrder(data) {
  const orderId = await createUniqueOrderId(CURRENT_SCHOOL_CODE);
  const order = {
    orderId, issuerSchool: CURRENT_SCHOOL_CODE, eventId: data.eventId, eventName_zh: data.eventName_zh, eventName_en: data.eventName_en,
    buyerType: data.buyerType, buyerName: data.buyerName || "", buyerCard: data.buyerCard || "", status: "paid",
    hasSelectedSeat: !!data.seatId, seatId: data.seatId || "", amount: data.amount || 0,
    soldBy: sessionStorage.getItem("posStaffId") || "", createdAt: Date.now(), updatedAt: Date.now(),
    receiptReprintCount: 0, voucherReprintCount: 0, checkinAt: null, checkinMethod: null
  };
  const updates = {};
  updates["orders/" + orderId] = order;
  if (data.seatId) updates["seats/" + data.eventId + "/" + data.seatId] = { status: "sold", orderId };
  if (data.buyerCard) updates["cards/" + data.buyerCard + "/" + orderId] = true;
  await db.ref().update(updates);
  return order;
}

async function confirmSeatSelection(order, seatId) {
  const updates = {};
  updates[`orders/${order.orderId}/hasSelectedSeat`] = true;
  updates[`orders/${order.orderId}/seatId`] = seatId;
  updates[`orders/${order.orderId}/updatedAt`] = Date.now();
  updates[`seats/${order.eventId}/${seatId}`] = { status: "sold", orderId: order.orderId };
  await db.ref().update(updates);
}

async function renderSeatMap(eventId, selectedSeat, onSelect) {
  const container = document.getElementById("seatMapContainer");
  container.innerHTML = "載入中... / Loading...";
  const eventSnap = await db.ref("events/" + eventId).once("value");
  const event = eventSnap.val();
  if (!event) { container.innerHTML = "找不到活動 / Event not found"; return; }
  const seatsSnap = await db.ref("seats/" + eventId).once("value");
  const seats = seatsSnap.val() || {};
  const { rows, cols, aisles } = event.seatLayout || { rows: 10, cols: 10, aisles: [] };
  let html = `<div class="seat-map" style="grid-template-columns: repeat(${cols + (aisles?aisles.length:0)}, 35px);">`;
  for (let r = 1; r <= rows; r++) {
    for (let c = 1; c <= cols; c++) {
      if (aisles && aisles.includes(c)) html += `<div style="width:35px;"></div>`;
      const seatId = `R${String(r).padStart(2, '0')}-C${String(c).padStart(2, '0')}`;
      const seatData = seats[seatId] || { status: "available" };
      let cls = "seat";
      if (seatId === selectedSeat) cls += " selected";
      else if (seatData.status === "reserved" || seatData.status === "sold") cls += " " + seatData.status;
      const clickable = (seatData.status === "available" || seatId === selectedSeat);
      html += `<div class="${cls}" data-seat="${seatId}" ${clickable ? `onclick="${onSelect}('${seatId}')"` : ''}>${c}</div>`;
    }
  }
  html += `</div>`;
  container.innerHTML = html;
}

// 7. HID 監聽
let hidBuffer = "", hidLastTime = 0;
function setupHIDListener(callback) {
  document.addEventListener("keydown", e => {
    if (e.target.tagName === "INPUT" || e.target.tagName === "TEXTAREA") return;
    const now = Date.now();
    if (now - hidLastTime > 200) hidBuffer = "";
    hidLastTime = now;
    if (e.key === "Enter") {
      if (hidBuffer.length >= 4) callback(hidBuffer.trim());
      hidBuffer = "";
    } else if (e.key.length === 1) hidBuffer += e.key;
  });
}

// 8. Excel 匯出輔助
function flattenObject(obj) { return !obj ? [] : Object.keys(obj).map(key => obj[key]); }
function flattenSeats(seats) {
  if (!seats) return [];
  const rows = [];
  Object.keys(seats).forEach(eventId => {
    Object.keys(seats[eventId]).forEach(seatId => {
      rows.push({ eventId, seatId, status: seats[eventId][seatId].status || "", orderId: seats[eventId][seatId].orderId || "" });
    });
  });
  return rows;
}
function downloadExcel(wb, filename) { XLSX.writeFile(wb, filename); }
