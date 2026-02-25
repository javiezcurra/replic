import { Routes, Route } from 'react-router-dom'
import Layout from './components/Layout'
import Home from './pages/Home'
import Experiments from './pages/Experiments'
import NotFound from './pages/NotFound'

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<Layout />}>
        <Route index element={<Home />} />
        <Route path="experiments" element={<Experiments />} />
        <Route path="*" element={<NotFound />} />
      </Route>
    </Routes>
  )
}
