export function formatPrice(price: number): string {
  return 'PKR ' + price.toLocaleString('en-PK');
}