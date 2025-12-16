import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter, Routes, Route } from 'react-router-dom'
import './index.css'
import App from './App.jsx'
import Dashboard from './Dashboard.jsx'
import DroneProfileEditor from './DroneProfileEditor.jsx'

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Dashboard />} />
        <Route path="/drone/:droneId" element={<App />} />
        <Route path="/profiles" element={<DroneProfileEditor />} />
      </Routes>
    </BrowserRouter>
  </StrictMode>,
)
