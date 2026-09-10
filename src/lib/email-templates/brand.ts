// Identidade visual MCB aplicada aos e-mails transacionais.
// Vinho profundo, dourado e creme — as mesmas cores do app.

export const brand = {
  wine: '#5C1F2E',
  plum: '#2E1524',
  gold: '#C6A15B',
  cream: '#F6F1E7',
  muted: '#7a6a70',
} as const

export const main = {
  backgroundColor: '#ffffff',
  fontFamily: 'Georgia, "Times New Roman", serif',
}

export const container = {
  padding: '32px 28px',
  backgroundColor: brand.cream,
  borderTop: `4px solid ${brand.gold}`,
}

export const brandName = {
  fontSize: '13px',
  letterSpacing: '3px',
  color: brand.gold,
  textTransform: 'uppercase' as const,
  margin: '0 0 16px',
  fontFamily: 'Arial, sans-serif',
}

export const h1 = {
  fontSize: '24px',
  fontWeight: 'bold' as const,
  color: brand.wine,
  margin: '0 0 20px',
}

export const text = {
  fontSize: '14px',
  color: brand.plum,
  lineHeight: '1.6',
  margin: '0 0 24px',
  fontFamily: 'Arial, sans-serif',
}

export const link = { color: brand.wine, textDecoration: 'underline' }

export const button = {
  backgroundColor: brand.wine,
  color: brand.cream,
  fontSize: '14px',
  borderRadius: '999px',
  padding: '13px 28px',
  textDecoration: 'none',
  fontFamily: 'Arial, sans-serif',
}

export const codeStyle = {
  fontSize: '28px',
  letterSpacing: '6px',
  fontWeight: 'bold' as const,
  color: brand.wine,
  fontFamily: 'Arial, sans-serif',
}

export const footer = {
  fontSize: '12px',
  color: brand.muted,
  margin: '30px 0 0',
  fontFamily: 'Arial, sans-serif',
}

// Rendered as a text child, which React may HTML-escape: keep this CSS free of >, &, and quotes.
export const darkModeCss = `
  @media (prefers-color-scheme: dark) {
    .dm-btn { background-color: #F6F1E7 !important; color: #5C1F2E !important; }
  }
  [data-ogsc] .dm-btn { background-color: #F6F1E7 !important; color: #5C1F2E !important; }
  [data-ogsb] .dm-btn { background-color: #F6F1E7 !important; color: #5C1F2E !important; }
`
