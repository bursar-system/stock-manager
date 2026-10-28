import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import './index.css'
import { initTheme } from './utils/theme'
import App from './App.jsx'

// Ask the browser not to delete our offline data when storage is low
initTheme() // set the theme before the first screen shows, so there is no flash
navigator.storage?.persist?.()

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <BrowserRouter>
      <App />
    </BrowserRouter>
  </StrictMode>
)