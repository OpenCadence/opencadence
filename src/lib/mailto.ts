export function mailtoHref(address: string): string {
  return `mailto:${encodeURIComponent(address).replaceAll("%40", "@")}`;
}
