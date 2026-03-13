
import {
  ApolloClient,
  InMemoryCache,
  HttpLink
} from '@apollo/client'
const API_URL = import.meta.env.VITE_API_URL

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
  connectToDevTools: true,
})

export default graphqlClient
