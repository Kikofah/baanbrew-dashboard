// Fixed choices used by the filters and the sales form (same values as the sales data)
export const BRANCHES = ['สยาม', 'สีลม', 'บางนา', 'มหาวิทยาลัย', 'อารีย์']
export const CHANNELS = ['หน้าร้าน', 'เดลิเวอรี']
export const PAYMENT_METHODS = {
  หน้าร้าน: ['QR พร้อมเพย์', 'เงินสด', 'บัตรเครดิต'],
  เดลิเวอรี: ['LINE MAN', 'Grab'],
}

/** 'YYYY-MM-DD' + n days (n may be negative), calendar math in UTC so the day never shifts */
export function addDays(dateKey, n) {
  const [y, m, d] = dateKey.split('-').map(Number)
  return new Date(Date.UTC(y, m - 1, d + n)).toISOString().slice(0, 10)
}

/** Current Bangkok time as 'YYYY-MM-DDTHH:mm' (the value format of <input type="datetime-local">) */
export function bangkokNowLocal() {
  // sv-SE formats as "YYYY-MM-DD HH:mm"
  return new Intl.DateTimeFormat('sv-SE', {
    timeZone: 'Asia/Bangkok',
    year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit',
  }).format(new Date()).replace(' ', 'T')
}
