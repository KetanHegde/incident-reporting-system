export function parseTokens() {
  if (!window.location.hash) return;

  const params = new URLSearchParams(window.location.hash.substring(1));
  localStorage.setItem("access_token", params.get("access_token"));
  localStorage.setItem("id_token", params.get("id_token"));
  window.history.replaceState({}, document.title, "/");
}

export function getUser() {
  const token = localStorage.getItem("id_token");
  if (!token) return null;
  return JSON.parse(atob(token.split(".")[1]));
}

export function isAdmin() {
  const user = getUser();
  return user?.["cognito:groups"]?.includes("admin");
}