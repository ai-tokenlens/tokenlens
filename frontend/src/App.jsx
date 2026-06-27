import { BrowserRouter, Routes, Route } from 'react-router-dom'
import Sidebar from './components/layout/Sidebar.jsx'
import Header from './components/layout/Header.jsx'
import Dashboard from './pages/Dashboard.jsx'
import UserDetail from './pages/UserDetail.jsx'
import SkillBrowser from './pages/SkillBrowser.jsx'
import SkillDetail from './pages/SkillDetail.jsx'
import SkillEditor from './pages/SkillEditor.jsx'

export default function App() {
  return (
    <BrowserRouter>
      <div className="flex h-screen bg-gray-50">
        <Sidebar />
        <div className="flex flex-col flex-1 overflow-hidden">
          <Header />
          <main className="flex-1 overflow-auto p-6">
            <Routes>
              <Route path="/" element={<Dashboard />} />
              <Route path="/users/:id" element={<UserDetail />} />
              <Route path="/skills" element={<SkillBrowser />} />
              <Route path="/skills/new" element={<SkillEditor />} />
              <Route path="/skills/:id" element={<SkillDetail />} />
            </Routes>
          </main>
        </div>
      </div>
    </BrowserRouter>
  )
}
