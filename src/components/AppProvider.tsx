"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { ApiError, postJson, type PresenceProof } from "@/sync";

export interface AppConfig {
  dealTitle: string;
  dealItems: string;
  price: string;
  devMode: boolean;
  devStores: { id: string; name: string }[];
}

export type PresenceState =
  | { kind: "checking" }
  | { kind: "insecure" } // geolocation needs HTTPS (or localhost)
  | { kind: "unsupported" }
  | { kind: "denied" }
  | { kind: "unavailable" } // GPS timeout / no fix
  | { kind: "not_in_store" }
  | { kind: "ok"; store: { id: string; name: string }; proof: PresenceProof };

interface AppContextValue {
  config: AppConfig | null;
  presence: PresenceState;
  refreshPresence: () => void;
  devStoreId: string | null;
  setDevStoreId: (id: string | null) => void;
}

const AppContext = createContext<AppContextValue | null>(null);
const DEV_KEY = "twinsync.devStoreId";

function getPosition(): Promise<GeolocationPosition> {
  return new Promise((resolve, reject) =>
    navigator.geolocation.getCurrentPosition(resolve, reject, {
      enableHighAccuracy: true,
      timeout: 15_000,
      maximumAge: 30_000,
    }),
  );
}

export function AppProvider({ children }: { children: React.ReactNode }) {
  const [config, setConfig] = useState<AppConfig | null>(null);
  const [presence, setPresence] = useState<PresenceState>({ kind: "checking" });
  const [devStoreId, setDevStoreIdState] = useState<string | null>(null);
  const [nonce, setNonce] = useState(0);

  // Device cookie + config. Must finish before any other API call so the
  // device cookie exists.
  useEffect(() => {
    fetch("/api/device", { cache: "no-store" })
      .then((r) => r.json())
      .then((c: AppConfig) => {
        setConfig(c);
        if (c.devMode) {
          try {
            setDevStoreIdState(localStorage.getItem(DEV_KEY));
          } catch {}
        }
      })
      .catch(() => setConfig({ dealTitle: "Two Is Better", dealItems: "", price: "", devMode: false, devStores: [] }));
  }, []);

  useEffect(() => {
    if (!config) return;
    let cancelled = false;
    const done = (p: PresenceState) => !cancelled && setPresence(p);

    (async () => {
      setPresence({ kind: "checking" });
      let proof: PresenceProof;

      if (config.devMode && devStoreId) {
        proof = { devStoreId };
      } else {
        if (!window.isSecureContext) return done({ kind: "insecure" });
        if (!("geolocation" in navigator)) return done({ kind: "unsupported" });
        try {
          const pos = await getPosition();
          proof = { location: { lat: pos.coords.latitude, lng: pos.coords.longitude } };
        } catch (e) {
          return done({ kind: (e as GeolocationPositionError).code === 1 ? "denied" : "unavailable" });
        }
      }

      try {
        const { store } = await postJson<{ store: { id: string; name: string } }>("/api/stores/locate", proof);
        done({ kind: "ok", store, proof });
      } catch (e) {
        done({ kind: e instanceof ApiError && e.code === "NOT_IN_STORE" ? "not_in_store" : "unavailable" });
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [config, devStoreId, nonce]);

  const setDevStoreId = useCallback((id: string | null) => {
    try {
      if (id) localStorage.setItem(DEV_KEY, id);
      else localStorage.removeItem(DEV_KEY);
    } catch {}
    setDevStoreIdState(id);
  }, []);

  const value = useMemo(
    () => ({ config, presence, refreshPresence: () => setNonce((n) => n + 1), devStoreId, setDevStoreId }),
    [config, presence, devStoreId, setDevStoreId],
  );
  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
}

export function useApp() {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error("useApp outside AppProvider");
  return ctx;
}
