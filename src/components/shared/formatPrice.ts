export function formatPrice(price: number | null | undefined): string {
  const value = Number(price);
  if (!Number.isFinite(value) || value <= 0) return 'Price unavailable';
  return 'PKR ' + value.toLocaleString('en-PK');
}
