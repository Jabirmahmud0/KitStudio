import { BrowserRouter, Route, Routes } from 'react-router-dom'
import Toast from './components/Toast'
import Approval from './pages/Approval'
import Gallery from './pages/Gallery'
import Landing from './pages/Landing'
import Studio from './pages/Studio'

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Landing />} />
        <Route path="/studio" element={<Studio />} />
        <Route path="/gallery" element={<Gallery />} />
        <Route path="/approval" element={<Approval />} />
      </Routes>
      <Toast />
    </BrowserRouter>
  )
}
