import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { HashRouter } from 'react-router-dom'
import { ApolloProvider } from '@apollo/client/react'
import { graphqlClient } from './api/graphql/graphqlClient.js'
import ErrorBoundary from './components/ErrorBoundary.jsx'

import App from './App.jsx'

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <ErrorBoundary>
      <ApolloProvider client={graphqlClient}>
        <HashRouter>
          <App />
        </HashRouter>
      </ApolloProvider>
    </ErrorBoundary>
  </StrictMode>,
)
