/**
 * Auth0 Provider Configuration
 *
 * Wraps the app with Auth0Provider and wires up the token getter
 * for the API client.
 */

import { Auth0Provider, useAuth0 } from "@auth0/auth0-react";
import { useEffect, type ReactNode } from "react";
import { setTokenGetter } from "../lib/api";

const AUTH0_DOMAIN = import.meta.env.VITE_AUTH0_DOMAIN;
const AUTH0_CLIENT_ID = import.meta.env.VITE_AUTH0_CLIENT_ID;
const AUTH0_AUDIENCE = import.meta.env.VITE_AUTH0_AUDIENCE;

function TokenWirer({ children }: { children: ReactNode }) {
  const { getAccessTokenSilently } = useAuth0();

  useEffect(() => {
    setTokenGetter(getAccessTokenSilently);
  }, [getAccessTokenSilently]);

  return <>{children}</>;
}

export function AuthProvider({ children }: { children: ReactNode }) {
  return (
    <Auth0Provider
      domain={AUTH0_DOMAIN}
      clientId={AUTH0_CLIENT_ID}
      authorizationParams={{
        redirect_uri: window.location.origin,
        audience: AUTH0_AUDIENCE,
        scope: "openid profile email",
        connection: "github", // prefer GitHub social login
      }}
      cacheLocation="localstorage"
    >
      <TokenWirer>{children}</TokenWirer>
    </Auth0Provider>
  );
}
