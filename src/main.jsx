import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.jsx'
import { FollowProvider } from './context/follow.jsx'
import { PathProvider } from './context/path.jsx'
import './index.css'

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <FollowProvider>
      <PathProvider>
        <App />
      </PathProvider>
    </FollowProvider>
  </React.StrictMode>,
)
