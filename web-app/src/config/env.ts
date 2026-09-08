function resolveApiBaseUrl(value: string | undefined): string {
  if (!value) {
    throw new Error(
      'VITE_API_BASE_URL is required. Copy .env.example to .env and set the API base URL.',
    )
  }

  try {
    const url = new URL(value)
    if (!['http:', 'https:'].includes(url.protocol)) {
      throw new Error('Unsupported protocol')
    }

    return url.toString().replace(/\/$/, '')
  } catch {
    throw new Error('VITE_API_BASE_URL must be a valid HTTP or HTTPS URL.')
  }
}

export const env = {
  apiBaseUrl: resolveApiBaseUrl(import.meta.env.VITE_API_BASE_URL),
}
