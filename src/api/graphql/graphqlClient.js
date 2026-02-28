
import {
  ApolloClient,
  InMemoryCache,
  HttpLink
} from '@apollo/client'

const API_URL = import.meta.env.VITE_API_URL || process.env.VITE_API_URL

console.log('[Apollo Client] Using API URL:', API_URL)

export const graphqlClient = new ApolloClient({
  link: new HttpLink({
    uri: API_URL,
    credentials: 'include'
  }),
  cache: new InMemoryCache(),
})

export default graphqlClient
