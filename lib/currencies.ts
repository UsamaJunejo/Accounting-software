// Currencies most used by Pakistani businesses first, then others.
export const CURRENCIES: [string, string][] = [
  ["PKR", "Pakistani Rupee"],
  ["USD", "US Dollar"],
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
