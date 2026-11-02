import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.jsx'

// App instalable (PWA): manifiesto, iconos y service worker.
function prepararInstalable() {
  const head = document.head
  const poner = (tag, attrs) => {
    if (head.querySelector(tag + '[rel="' + attrs.rel + '"]')) return
    const el = document.createElement(tag)
    Object.entries(attrs).forEach(([k, v]) => el.setAttribute(k, v))
    head.appendChild(el)
  }
  poner('link', { rel: 'manifest', href: '/manifest.webmanifest' })
  poner('link', { rel: 'apple-touch-icon', href: '/apple-touch-icon.png' })
  const metas = { 'theme-color': '#120f1c', 'apple-mobile-web-app-capable': 'yes', 'mobile-web-app-capable': 'yes', 'apple-mobile-web-app-title': 'Club Cervecero', 'apple-mobile-web-app-status-bar-style': 'black-translucent' }
  Object.entries(metas).forEach(([name, content]) => {
    if (head.querySelector('meta[name="' + name + '"]')) return
    const m = document.createElement('meta')
    m.setAttribute('name', name)
    m.setAttribute('content', content)
    head.appendChild(m)
  })
  if ('serviceWorker' in navigator && import.meta.env.PROD) {
    window.addEventListener('load', () => { navigator.serviceWorker.register('/sw.js').catch(() => {}) })
  }
}
prepararInstalable()

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
