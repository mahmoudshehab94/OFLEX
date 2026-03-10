import { Users, LogOut } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';

export function SupervisorDashboard() {
  const { user, logout } = useAuth();

  if (!user || user.role !== 'supervisor') {
    window.history.pushState({}, '', '/');
    window.location.reload();
    return null;
  }

  const handleLogout = async () => {
    await logout();
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100">
      <header className="bg-white border-b border-slate-200 shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-gradient-to-br from-green-500 to-green-600 rounded-lg flex items-center justify-center">
                <Users className="w-6 h-6 text-white" />
              </div>
              <div>
                <h1 className="text-xl font-bold text-slate-900">Supervisor Dashboard</h1>
                <p className="text-sm text-slate-600">{user?.username}</p>
              </div>
            </div>
            <button
              onClick={handleLogout}
              className="flex items-center gap-2 px-4 py-2 text-slate-700 hover:text-slate-900 hover:bg-slate-100 rounded-lg transition-colors"
            >
              <LogOut className="w-5 h-5" />
              <span>Logout</span>
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-8">
          <div className="text-center">
            <div className="w-16 h-16 bg-gradient-to-br from-green-100 to-green-200 rounded-full flex items-center justify-center mx-auto mb-4">
              <Users className="w-8 h-8 text-green-600" />
            </div>
            <h2 className="text-2xl font-bold text-slate-900 mb-2">Supervisor Dashboard</h2>
            <p className="text-slate-600 mb-6">Welcome to your supervisor dashboard</p>
            <div className="inline-flex items-center gap-2 px-4 py-2 bg-green-50 text-green-700 rounded-lg">
              <span className="w-2 h-2 bg-green-500 rounded-full"></span>
              <span className="text-sm font-medium">Supervisor features coming soon</span>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
