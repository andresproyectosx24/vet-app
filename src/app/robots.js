export default function robots() {
  return {
    rules: {
      userAgent: '*',
      disallow: '/', // Bloquea todo el sitio para todos los robots (Google, Bing, etc.)
    },
  }
}