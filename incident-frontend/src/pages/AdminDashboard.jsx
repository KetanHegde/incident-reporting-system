import { useEffect, useState } from "react";
import { useAuth } from "react-oidc-context";
import { getAllIncidents, resolveIncident } from "../services/api";
import LogoutButton from "../components/LogoutButton";

export default function AdminDashboard() {
  const auth = useAuth();
  const [incidents, setIncidents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("");
  const [showModal, setShowModal] = useState(false);
  const [selectedImage, setSelectedImage] = useState(null);

  const formatDateTime = iso => {
    const date = new Date(iso);
    const month = date.toLocaleString("en-GB", { month: "long" });
    const day = date.getDate();
    const year = date.getFullYear();
    const hour = date.getHours().toString().padStart(2, "0");
    const minute = date.getMinutes().toString().padStart(2, "0");
    return `${hour}:${minute} ${day} ${month}, ${year}`;
  };

  useEffect(() => {
    if (!auth.isAuthenticated) return;

    getAllIncidents(auth.user.access_token)
      .then(data => {
        const sorted = data.sort((a, b) => {
          if (a.status === 'OPEN' && b.status !== 'OPEN') return -1;
          if (a.status !== 'OPEN' && b.status === 'OPEN') return 1;
          const priorities = { HIGH: 3, MEDIUM: 2, LOW: 1 };
          return priorities[b.priority] - priorities[a.priority];
        });
        setIncidents(sorted);
      })
      .catch(() => setMessage("Failed to load incidents"))
      .finally(() => setLoading(false));
  }, [auth.isAuthenticated]);

  async function handleResolve(id) {
    try {
      await resolveIncident(auth.user.access_token, id);
      setIncidents(i => i.map(x => x.id === id ? {...x, status: 'RESOLVED'} : x));
      setMessage("Incident resolved successfully");
    } catch {
      setMessage("Failed to resolve incident");
    }
  }

  return (
    <div className="min-h-screen bg-gray-100 p-4 md:p-8">
      <div className="max-w-4xl mx-auto">
        <div className="flex justify-between items-center mb-8">
          <h2 className="text-3xl font-bold">Admin Dashboard</h2>
          <LogoutButton />
        </div>

        {message && (
          <div className="bg-blue-100 border border-blue-400 text-blue-700 px-4 py-3 rounded mb-4">
            {message}
          </div>
        )}

        {loading ? (
          <p>Loading incidents...</p>
        ) : (
          <div className="space-y-4">
            {incidents.map(i => (
              <div
                key={i.id}
                className={`bg-white p-6 rounded-lg shadow-md ${
                  i.status === "OPEN" ? "bg-red-50 border-l-4 border-red-500" : 
                  i.status === "RESOLVED" ? "bg-green-50 border-l-4 border-green-500" : ""
                }`}
              >
                <div className="flex justify-between items-start">
                  <div className="flex-1">
                    <h4 className="text-lg font-semibold flex items-center">
                      {i.incident_name}
                      <span className={`ml-2 px-2 py-1 text-xs font-semibold rounded ${
                        i.priority === "HIGH" ? "bg-red-200 text-red-800" : 
                        i.priority === "MEDIUM" ? "bg-yellow-200 text-yellow-800" : 
                        "bg-green-200 text-green-800"
                      }`}>
                        {i.priority}
                      </span>
                    </h4>
                    <p className="text-sm text-gray-600 mt-2">User: {i.user_id}</p>
                    <div className="text-sm text-gray-500 mt-1">
                      <p>Created: {formatDateTime(i.created_at)}</p>
                      { i.created_at !== i.updated_at && ( 
                        <p>Updated: {formatDateTime(i.updated_at)}</p>
                    )}
                    </div>
                    <p className="mt-2">{i.description}</p>
                    {i.screenshot_url && (
                      <button
                        onClick={() => {
                          setSelectedImage(i.screenshot_url);
                          setShowModal(true);
                        }}
                        className="text-blue-500 mt-2 inline-flex items-center"
                      >
                        👁 View Screenshot
                      </button>
                    )}
                  </div>
                  <div className="ml-4 flex-shrink-0">
                    {i.status === 'OPEN' ? (
                      <button
                        onClick={() => handleResolve(i.id)}
                        className="bg-green-500 hover:bg-green-600 text-white font-bold py-2 px-4 rounded"
                      >
                        Resolve
                      </button>
                    ) : (
                      <span className="text-green-600 font-semibold">Resolved</span>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {showModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white p-4 rounded-lg max-w-4xl max-h-full overflow-auto">
            <img src={selectedImage} alt="Screenshot" className="max-w-full max-h-96 object-contain" />
            <button
              onClick={() => setShowModal(false)}
              className="mt-4 bg-gray-500 hover:bg-gray-600 text-white font-bold py-2 px-4 rounded"
            >
              Close
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
