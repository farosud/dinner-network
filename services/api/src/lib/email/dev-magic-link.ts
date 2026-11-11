let latestMagicLink: { email: string; url: string; expiresAt: number } | null = null;

export function rememberDevMagicLink(email: string, url: string, expiresInSeconds: number) {
  latestMagicLink = { email: email.toLowerCase(), url, expiresAt: Date.now() + expiresInSeconds * 1000 };
}

export function getDevMagicLink(email: string) {
  if (!latestMagicLink || latestMagicLink.expiresAt <= Date.now() || latestMagicLink.email !== email.toLowerCase()) return null;
  return latestMagicLink.url;
}
