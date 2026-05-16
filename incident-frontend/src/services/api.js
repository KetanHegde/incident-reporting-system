const API_BASE = "https://d1q0sj65yyzz7l.cloudfront.net";

export async function createIncident(accessToken, incidentData) {
  const res = await fetch(`${API_BASE}/incident`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(incidentData),
  });
  return res.json();
}

export async function uploadScreenshot(uploadUrl, file) {
  await fetch(uploadUrl, {
    method: "PUT",
    headers: { "Content-Type": file.type },
    body: file,
  });
}

export async function getMyIncidents(accessToken) {
  const res = await fetch(`${API_BASE}/incidents/my`, {
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
  });
  return res.json();
}

export async function getAllIncidents(accessToken) {
  const res = await fetch(`${API_BASE}/admin/incidents`, {
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
  });
  return res.json();
}

export async function resolveIncident(accessToken, id) {
  const res = await fetch(`${API_BASE}/admin/resolve/${id}`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
  });
  return res.json();
}

export async function confirmScreenshot(accessToken, incidentId) {
  const res = await fetch(`${API_BASE}/incident/${incidentId}/screenshot`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
  });
  return res.json();
}