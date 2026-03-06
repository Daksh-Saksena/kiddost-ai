export function avatarDataUrl(name: string, bg = '#0D8ABC', color = '#ffffff') {
  const initials = String(name || '')
    .replace(/[^\p{L}\p{N} ]/gu, '')
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((s) => s[0]?.toUpperCase() || '')
    .join('') || name.slice(0, 2);

  const size = 128;
  const fontSize = 54;
  const svg = `<?xml version='1.0' encoding='UTF-8'?>
  <svg xmlns='http://www.w3.org/2000/svg' width='${size}' height='${size}'>
    <rect width='100%' height='100%' fill='${bg}' rx='20' />
    <text x='50%' y='50%' dy='.35em' text-anchor='middle' fill='${color}' font-family='Helvetica, Arial, sans-serif' font-size='${fontSize}'>${initials}</text>
  </svg>`;

  return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
}
