import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import {
  Chart as ChartJS,
  CategoryScale, LinearScale,
  PointElement, LineElement,
  ArcElement, Filler,
  Title, Tooltip, Legend,
} from 'chart.js'
import './index.css'
import App from './App'

ChartJS.register(
  CategoryScale, LinearScale,
  PointElement, LineElement,
  ArcElement, Filler,
  Title, Tooltip, Legend,
)

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
