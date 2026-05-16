import { useState } from "react";
import IncidentList from "../components/IncidentList";
import IncidentForm from "../components/IncidentForm";
import LogoutButton from "../components/LogoutButton";

export default function UserDashboard() {
  const [refreshKey, setRefreshKey] = useState(0);

  return (
    <div className="min-h-screen bg-gray-100 p-4 md:p-8">
      <div className="max-w-4xl mx-auto">
        <div className="flex justify-between items-center mb-8">
          <h2 className="text-3xl font-bold">User Dashboard</h2>
          <LogoutButton />
        </div>

        <div className="bg-white p-6 rounded-lg shadow-md mb-8">
          <h3 className="text-xl font-semibold mb-4">Create Incident</h3>
          <IncidentForm onSuccess={() => setRefreshKey(prev => prev + 1)} />
        </div>

        <div className="bg-white p-6 rounded-lg shadow-md">
          <h3 className="text-xl font-semibold mb-4">Your Incidents</h3>
          <IncidentList refreshKey={refreshKey} />
        </div>
      </div>
    </div>
  );
}
