const MARKETPLACE_HOSTNAME_PATTERNS = [
  "shopee.",
  "mercadolivre.",
  "mercadolibre.",
  "amazon.",
  "aliexpress.",
  "magazineluiza.",
  "americanas.",
  "casasbahia.",
  "shein.",
  "kabum.",
  "submarino.",
];

export function isMarketplaceProductUrl(url: string): boolean {
  try {
    const hostname = new URL(url).hostname.replace(/^www\./, "").toLowerCase();
    return MARKETPLACE_HOSTNAME_PATTERNS.some((pattern) => hostname.includes(pattern));
  } catch {
    return false;
  }
}
