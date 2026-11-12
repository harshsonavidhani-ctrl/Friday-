// IMEI / serial number checks — client-safe.

/** IMEI check digit (Luhn). */
export function luhnOk(digits: string): boolean {
  let sum = 0;
  for (let i = 0; i < digits.length; i++) {
    let d = digits.charCodeAt(digits.length - 1 - i) - 48;
    if (i % 2 === 1) {
      d *= 2;
      if (d > 9) d -= 9;
    }
    sum += d;
  }
  return sum % 10 === 0;
}

/** "IMEI: 35-209900-176148-1" → "352099001761481". Returns an English error key on failure. */
export function cleanSerial(raw: string): { serial: string; error?: undefined } | { error: string; serial?: undefined } {
  let s = raw.trim().toUpperCase();
  s = s.replace(/^(IMEI\s*[12]?|S\/?N|SERIAL(\s*NO\.?)?)\s*[:#-]?\s*/, "");
  s = s.replace(/[\s\-./]/g, "");
  if (!s) return { error: "Enter the IMEI / serial number" };
  if (!/^[A-Z0-9]{5,30}$/.test(s)) return { error: "Use only letters and numbers (5 to 30)" };
  if (/^\d{15}$/.test(s) && !luhnOk(s)) return { error: "This IMEI looks wrong — please check the 15 digits" };
  return { serial: s };
}
