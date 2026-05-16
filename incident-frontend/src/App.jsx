import { useAuth } from "react-oidc-context";
import Login from "./pages/Login";
import UserDashboard from "./pages/UserDashboard";
import AdminDashboard from "./pages/AdminDashboard";

function App() {
  const auth = useAuth();

  if (auth.isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <p className="text-lg">Loading...</p>
      </div>
    );
  }

  if (auth.error) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <p className="text-red-500">Auth error: {auth.error.message}</p>
      </div>
    );
  }

  if (!auth.isAuthenticated) {
    return <Login />;
  }

  const groups = auth.user?.profile["cognito:groups"] || [];
  const isAdmin = groups.includes("admin");

  return isAdmin ? <AdminDashboard /> : <UserDashboard />;
}

export default App;
