import { useAuth } from "react-oidc-context";

export default function Login() {
  const auth = useAuth();

  return (
    <div className="flex items-center justify-center min-h-screen bg-gray-100">
      <div className="bg-white p-8 rounded-lg shadow-md w-full max-w-md">
        <h2 className="text-2xl font-bold text-center mb-6">Incident Reporting System</h2>
        <button
          onClick={() => auth.signinRedirect()}
          className="w-full bg-blue-500 hover:bg-blue-600 text-white font-bold py-2 px-4 rounded"
        >
          Sign in
        </button>
      </div>
    </div>
  );
}
