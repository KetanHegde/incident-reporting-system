import { useAuth } from "react-oidc-context";

export default function LogoutButton() {
  const auth = useAuth();

  const handleLogout = async () => {
    await auth.removeUser();

    const cognitoDomain = "https://ap-south-1ubt3h8qoa.auth.ap-south-1.amazoncognito.com";
    const clientId = "2f6141vpqipgq55jeos8rel2qh";
    const logoutUri = 'https://d3v1bwweufhpww.cloudfront.net'

    window.location.href =
      `${cognitoDomain}/logout` +
      `?client_id=${clientId}` +
      `&logout_uri=${encodeURIComponent(logoutUri)}`;
  };

  return (
    <button
      onClick={handleLogout}
      className="bg-red-500 hover:bg-red-600 text-white font-bold py-2 px-4 rounded"
    >
      Sign out
    </button>
  );
}