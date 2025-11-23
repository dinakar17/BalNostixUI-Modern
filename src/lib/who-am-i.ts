import { createMMKV } from "react-native-mmkv";
import { FMSApi } from "@/api/fms";

const storage = createMMKV();

/**
 * Fetch whoami token from API
 */
async function fetchWhoAmIToken(): Promise<string | null> {
  try {
    const response = await FMSApi.get("api/whoami", {
      params: { subscription_id: "Bajaj_CDMS" },
    });

    const errorCode = response.data.error;

    if (errorCode === 0) {
      const token = response.data.token;
      storage.set("whoAmI", token);
      return token;
    }
    if (errorCode === -2) {
      return null;
    }
    return null;
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    console.error("Error fetching whoAmI token:", message);
    return null;
  }
}

/**
 * Get whoami token - from storage or fetch new
 */
export async function getWhoAmI(clearToken = false): Promise<string | null> {
  if (clearToken) {
    storage.remove("whoAmI");
    return await fetchWhoAmIToken();
  }

  const cachedToken = storage.getString("whoAmI");

  if (!cachedToken) {
    return await fetchWhoAmIToken();
  }

  return cachedToken;
}
