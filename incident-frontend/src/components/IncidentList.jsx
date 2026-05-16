import { useAuth } from "react-oidc-context";
import { useEffect, useState } from "react";
import { getMyIncidents } from "../services/api";

export default function IncidentList({ refreshKey }) {
  const auth = useAuth();
  const [incidents, setIncidents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("");

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

    getMyIncidents(auth.user.access_token)
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
  }, [auth.isAuthenticated, refreshKey]);

  if (loading) {
    return <p>Loading incidents...</p>;
  }

  if (message) {
    return (
      <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded">
        {message}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {incidents.length === 0 ? (
        <p className="text-gray-500">No incidents found.</p>
      ) : (
        incidents.map(i => (
          <div
            key={i.id}
            className={`bg-white p-4 rounded-lg shadow-md border ${
              i.status === "OPEN" ? "bg-red-50 border-l-4 border-red-500" : 
              "bg-green-50 border-l-4 border-green-500"
            }`}
          >
            <div className="flex justify-between items-start">
              <div className="flex-1">
                <h4 className="font-semibold text-lg flex items-center">
                  {i.incident_name}
                  <span className={`ml-2 px-2 py-1 text-xs font-semibold rounded ${
                    i.priority === "HIGH" ? "bg-red-200 text-red-800" : 
                    i.priority === "MEDIUM" ? "bg-yellow-200 text-yellow-800" : 
                    "bg-green-200 text-green-800"
                  }`}>
                    {i.priority}
                  </span>
                </h4>
                <p className="mt-2">{i.description}</p>
                <p className="text-sm text-gray-500 mt-1">Created: {formatDateTime(i.created_at)}</p>
                {i.screenshot_url && (
                  <a
                    href={i.screenshot_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-blue-500 hover:underline mt-2 inline-block"
                  >
                    View Screenshot
                  </a>
                )}
              </div>
              <div className="ml-4 flex-shrink-0">
                <span className={`text-sm ${
                  i.status === "OPEN" ? "text-red-600 font-semibold" : "text-green-600 font-semibold"
                }`}>{i.status}</span>
              </div>
            </div>
          </div>
        ))
      )}
    </div>
  );
}