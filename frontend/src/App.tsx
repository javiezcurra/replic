import { Routes, Route } from 'react-router-dom'
import Layout from './components/Layout'
import PrivateRoute from './components/PrivateRoute'
import Home from './pages/Home'
import Experiments from './pages/Experiments'
import NotFound from './pages/NotFound'
import Profile from './pages/Profile'
import MyDesigns from './pages/MyDesigns'
import MyLab from './pages/MyLab'
import CreateDesign from './pages/CreateDesign'
import EditDesign from './pages/EditDesign'
import DesignDetail from './pages/DesignDetail'
import Materials from './pages/Materials'
import CreateMaterial from './pages/CreateMaterial'
import Login from './pages/Login'
import Signup from './pages/Signup'
import Collaborators from './pages/Collaborators'

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<Layout />}>
        {/* Public */}
        <Route index element={<Home />} />
        <Route path="login" element={<Login />} />
        <Route path="signup" element={<Signup />} />
        <Route path="experiments" element={<Experiments />} />
        <Route path="designs/:id" element={<DesignDetail />} />

        {/* Protected (logged-in users) */}
        <Route element={<PrivateRoute />}>
          <Route path="profile" element={<Profile />} />
          <Route path="my-lab" element={<MyLab />} />
          <Route path="collaborators" element={<Collaborators />} />
          <Route path="designs/mine" element={<MyDesigns />} />
          <Route path="designs/new" element={<CreateDesign />} />
          <Route path="designs/:id/edit" element={<EditDesign />} />
          {/* Admin-only — access guard is in the Materials component */}
          <Route path="materials" element={<Materials />} />
          <Route path="materials/new" element={<CreateMaterial />} />
        </Route>

        <Route path="*" element={<NotFound />} />
      </Route>
    </Routes>
  )
}
