const PALETTE = [
  '#0D8ABC', '#7C3AED', '#059669', '#D97706',
  '#DB2777', '#0891B2', '#DC2626', '#65A30D',
];

function hashColor(seed: string): string {
  let h = 0;
  for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) & 0xffffffff;
  return PALETTE[Math.abs(h) % PALETTE.length];
}

export function avatarDataUrl(displayName: string, phone = '', color = '#ffffff') {
  const seed = phone || displayName;
  const bg = hashColor(seed);

  // Check if displayName looks like a phone number (mostly digits/+)
  const isPhoneOnly = /^[+\d\s()-]{6,}$/.test(displayName.trim());

  let initials: string;
  if (isPhoneOnly) {
    // Show last 4 digits of the phone
    const digits = (phone || displayName).replace(/\D/g, '');
    initials = digits.slice(-4);
  } else {
    initials = String(displayName || '')
      .replace(/[^\p{L}\p{N} ]/gu, '')
      .trim()
      .split(/\s+/)
      .slice(0, 2)
      .map((s) => s[0]?.toUpperCase() || '')
      .join('') || displayName.slice(0, 2).toUpperCase();
  }

  const size = 128;
  const fontSize = isPhoneOnly ? 30 : 54;
  const svg = `<?xml version='1.0' encoding='UTF-8'?>
  <svg xmlns='http://www.w3.org/2000/svg' width='${size}' height='${size}'>
    <rect width='100%' height='100%' fill='${bg}' rx='20' />
    <text x='50%' y='50%' dy='.35em' text-anchor='middle' fill='${color}' font-family='Helvetica, Arial, sans-serif' font-size='${fontSize}'>${initials}</text>
  </svg>`;

  return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
}
