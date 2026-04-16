
import {
  ApolloClient,
  InMemoryCache,
  HttpLink
} from '@apollo/client'

const LOOPBACK_HOSTS = new Set(['localhost', '127.0.0.1', '::1'])

const isLoopbackHost = (hostname) => LOOPBACK_HOSTS.has((hostname || '').toLowerCase())

const resolveApiUrl = (rawUrl) => {
  if (!rawUrl) return rawUrl

  try {
    const parsed = new URL(rawUrl)

    // When opening the web app from a mobile browser, "localhost" points to the phone.
    // Remap loopback API hosts to the current page host so LAN testing works.
    if (
      typeof window !== 'undefined' &&
      isLoopbackHost(parsed.hostname) &&
      !isLoopbackHost(window.location.hostname)
    ) {
      parsed.hostname = window.location.hostname
      return parsed.toString()
    }

    return parsed.toString()
  } catch {
    return rawUrl
  }
}

const API_URL = resolveApiUrl(import.meta.env.VITE_API_URL)

console.log('[Apollo Client] Using API URL:', API_URL)

if (!API_URL) {
  console.error('[Apollo Client] ERROR: No API URL configured! Set VITE_API_URL environment variable.')
}

export const graphqlClient = new ApolloClient({
  link: new HttpLink({
    uri: API_URL,
    credentials: 'include'
  }),
  cache: new InMemoryCache(),
  connectToDevTools: false,
})

export default graphqlClient
