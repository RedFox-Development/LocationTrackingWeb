import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import { ApolloProvider } from '@apollo/client/react'
import { graphqlClient } from './api/graphql/graphqlClient.js'

import App from './App.jsx'

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <ApolloProvider client={graphqlClient}>
      <BrowserRouter basename={import.meta.env.BASE_URL}>
        <App />
      </BrowserRouter>
    </ApolloProvider>
  </StrictMode>,
)
