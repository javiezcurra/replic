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
import Materials1 from './pages/Materials1'
import Materials2 from './pages/Materials2'
import Materials3 from './pages/Materials3'
import MaterialDetail from './pages/MaterialDetail'
import CreateMaterial from './pages/CreateMaterial'

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<Layout />}>
        {/* Public */}
        <Route index element={<Home />} />
        <Route path="experiments" element={<Experiments />} />
        <Route path="designs/:id" element={<DesignDetail />} />
        <Route path="materials" element={<Materials />} />
        <Route path="materials-1" element={<Materials1 />} />
        <Route path="materials-2" element={<Materials2 />} />
        <Route path="materials-3" element={<Materials3 />} />
        <Route path="materials/:id" element={<MaterialDetail />} />

        {/* Protected */}
        <Route element={<PrivateRoute />}>
          <Route path="profile" element={<Profile />} />
          <Route path="designs/mine" element={<MyDesigns />} />
          <Route path="designs/new" element={<CreateDesign />} />
          <Route path="designs/:id/edit" element={<EditDesign />} />
          <Route path="materials/new" element={<CreateMaterial />} />
        </Route>

        <Route path="*" element={<NotFound />} />
      </Route>
    </Routes>
  )
}
