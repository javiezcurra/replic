import { Routes, Route } from 'react-router-dom'
import Layout from './components/Layout'
import PrivateRoute from './components/PrivateRoute'
import Home from './pages/Home'
import Experiments from './pages/Experiments'
import NotFound from './pages/NotFound'
import Profile from './pages/Profile'
import MyDesigns from './pages/MyDesigns'
import MyLab from './pages/MyLab'
import LabInventory from './pages/LabInventory'
import CreateDesign from './pages/CreateDesign'
import EditDesign from './pages/EditDesign'
import DesignDetail from './pages/DesignDetail'
import Materials from './pages/Materials'
import CreateMaterial from './pages/CreateMaterial'
import AdminUsers from './pages/AdminUsers'
import AdminExperiments from './pages/AdminExperiments'
import Login from './pages/Login'
import Signup from './pages/Signup'
import Collaborators from './pages/Collaborators'
import NotificationsPage from './pages/Notifications'
import ExecutionForm from './pages/ExecutionForm'

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
          <Route path="lab-inventory" element={<LabInventory />} />
          <Route path="collaborators" element={<Collaborators />} />
          <Route path="designs/mine" element={<MyDesigns />} />
          <Route path="designs/new" element={<CreateDesign />} />
          <Route path="designs/:id/edit" element={<EditDesign />} />
          <Route path="executions/:id" element={<ExecutionForm />} />
          <Route path="notifications" element={<NotificationsPage />} />
          {/* Admin-only — access guard is in each component */}
          <Route path="materials" element={<Materials />} />
          <Route path="materials/new" element={<CreateMaterial />} />
          <Route path="admin/users" element={<AdminUsers />} />
          <Route path="admin/experiments" element={<AdminExperiments />} />
        </Route>

        <Route path="*" element={<NotFound />} />
      </Route>
    </Routes>
  )
}
