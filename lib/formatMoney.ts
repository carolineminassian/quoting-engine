/**
 * Format cents into a localized currency string with proper thousands separators.
 *
 * US locale → $1,234.56  ·  $10,000.00
 * FR locale → €1 234,56  ·  €10 000,00 (non-breaking space + comma decimal)
 *
 * @param cents - Amount in cents (integer or float — will be divided by 100)
 * @param currency - 'EUR' or 'USD' (defaults to USD)
 * @param country - 'FR' or 'US' (defaults to US)
 */
export function formatMoney(
  cents: number,
  currency?: string | null,
  country?: string | null
): string {
  const symbol = currency === 'EUR' ? '€' : '$';
  const locale = country === 'FR' ? 'fr-FR' : 'en-US';
  const formatted = (cents / 100).toLocaleString(locale, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  });
  return `${symbol}${formatted}`;
}

/**
 * Same as formatMoney but accepts dollars/euros directly (not cents).
 * Useful when working with values that are already in major units.
 */
export function formatMoneyMajor(
  major: number,
  currency?: string | null,
  country?: string | null
): string {
  return formatMoney(major * 100, currency, country);
}
