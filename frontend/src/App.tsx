import { Routes, Route } from 'react-router-dom'
import Layout from './components/Layout'
import PrivateRoute from './components/PrivateRoute'
import Home from './pages/Home'
import Experiments from './pages/Experiments'
import NotFound from './pages/NotFound'
import Profile from './pages/Profile'
import MyDesigns from './pages/MyDesigns'
import CreateDesign from './pages/CreateDesign'
import EditDesign from './pages/EditDesign'
import DesignDetail from './pages/DesignDetail'
import Materials from './pages/Materials'
import MaterialDetail from './pages/MaterialDetail'

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<Layout />}>
        {/* Public */}
        <Route index element={<Home />} />
        <Route path="experiments" element={<Experiments />} />
        <Route path="designs/:id" element={<DesignDetail />} />
        <Route path="materials" element={<Materials />} />
        <Route path="materials/:id" element={<MaterialDetail />} />

        {/* Protected */}
        <Route element={<PrivateRoute />}>
          <Route path="profile" element={<Profile />} />
          <Route path="designs/mine" element={<MyDesigns />} />
          <Route path="designs/new" element={<CreateDesign />} />
          <Route path="designs/:id/edit" element={<EditDesign />} />
        </Route>

        <Route path="*" element={<NotFound />} />
      </Route>
    </Routes>
  )
}
