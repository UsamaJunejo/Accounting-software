// Currencies most used by Pakistani businesses first, then others.
export const CURRENCIES: [string, string][] = [
  ["PKR", "Pakistani Rupee"],
  ["USD", "US Dollar"],
  ["USDT", "Tether (USDT)"],
  ["AED", "UAE Dirham"],
  ["SAR", "Saudi Riyal"],
  ["GBP", "British Pound"],
  ["EUR", "Euro"],
  ["CNY", "Chinese Yuan"],
  ["QAR", "Qatari Riyal"],
  ["OMR", "Omani Rial"],
  ["KWD", "Kuwaiti Dinar"],
  ["BHD", "Bahraini Dinar"],
  ["CAD", "Canadian Dollar"],
  ["AUD", "Australian Dollar"],
  ["MYR", "Malaysian Ringgit"],
  ["TRY", "Turkish Lira"],
  ["JPY", "Japanese Yen"],
  ["INR", "Indian Rupee"],
  ["AFN", "Afghan Afghani"],
];
export const CURRENCY_CODES = new Set(CURRENCIES.map(([c]) => c));

const SYMBOLS: Record<string, string> = { PKR: "Rs", USD: "$", USDT: "USDT", GBP: "£", EUR: "€", INR: "₹", JPY: "¥", CNY: "¥", TRY: "₺" };

/** Short sign shown before amounts: Rs, $, AED… */
export function currencySymbol(code: string) {
  return SYMBOLS[code] ?? code;
}

export function currencyName(code: string) {
  return CURRENCIES.find(([c]) => c === code)?.[1] ?? code;
}

/** USDT is a digital dollar: for exchange rates it is treated as 1 USD. */
export function rateCode(code: string) {
  return code === "USDT" ? "USD" : code;
}
