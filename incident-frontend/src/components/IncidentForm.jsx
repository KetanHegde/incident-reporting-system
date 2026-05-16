import { useState } from "react";
import { useAuth } from "react-oidc-context";
import { createIncident, uploadScreenshot, confirmScreenshot } from "../services/api";

export default function IncidentForm({ onSuccess }) {
  const auth = useAuth();
  const [file, setFile] = useState(null);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");

  async function submitIncident(e) {
    e.preventDefault();
    setLoading(true);
    setMessage("");

    const payload = {
      incident_name: e.target.name.value,
      description: e.target.description.value,
      priority: e.target.priority.value,
    };

    try {
      const data = await createIncident(auth.user.access_token, payload);

      if (file && data.uploadUrl) {
        await uploadScreenshot(data.uploadUrl, file);
        await confirmScreenshot(auth.user.access_token, data.incident_id);
      }

      setMessage("Incident submitted successfully!");
      e.target.reset();
      setFile(null);
      onSuccess?.();
    } catch (error) {
      setMessage("Failed to submit incident. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div>
      {message && (
        <div className={`mb-4 p-3 rounded ${
          message.includes("successfully")
            ? "bg-green-100 border border-green-400 text-green-700"
            : "bg-red-100 border border-red-400 text-red-700"
        }`}>
          {message}
        </div>
      )}

      <form onSubmit={submitIncident} className="space-y-4">
        <div>
          <input
            name="name"
            placeholder="Incident Name"
            required
            className="w-full p-2 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>

        <div>
          <textarea
            name="description"
            placeholder="Description"
            required
            className="w-full p-2 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500 h-24"
          />
        </div>

        <div>
          <select
            name="priority"
            className="w-full p-2 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="LOW">LOW</option>
            <option value="MEDIUM">MEDIUM</option>
            <option value="HIGH">HIGH</option>
          </select>
        </div>

        <div>
          <input
            type="file"
            onChange={e => setFile(e.target.files[0])}
            className="w-full p-2 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>

        <button
          disabled={loading}
          className="w-full bg-blue-500 hover:bg-blue-600 disabled:bg-gray-400 text-white font-bold py-2 px-4 rounded"
        >
          {loading ? "Submitting..." : "Submit Incident"}
        </button>
      </form>
    </div>
  );
}