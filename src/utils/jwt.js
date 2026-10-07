// Client-side decoding is for UX only (expiry checks, showing the user name).
// The server must always verify the signature.
export function decodeJwt(token) {
  try {
    const payload = token.split('.')[1]
    const base64 = payload.replace(/-/g, '+').replace(/_/g, '/')
    const json = decodeURIComponent(
      atob(base64)
        .split('')
        .map((c) => '%' + c.charCodeAt(0).toString(16).padStart(2, '0'))
        .join(''),
    )
    return JSON.parse(json)
  } catch {
    return null
  }
}

/** true when the token is missing, malformed, or expires within `skewSeconds` */
export function isTokenExpired(token, skewSeconds = 0) {
  const payload = token ? decodeJwt(token) : null
  if (!payload?.exp) return true
  return payload.exp * 1000 - skewSeconds * 1000 <= Date.now()
}
