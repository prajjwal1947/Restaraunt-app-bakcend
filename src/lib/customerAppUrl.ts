export const DEFAULT_CUSTOMER_APP_URL = "https://restaurent-app-frontend-n5yh-six.vercel.app";

export function customerAppUrl(configuredValue?: string, isProduction = process.env.NODE_ENV === "production") {
  const candidates = (configuredValue ?? (isProduction ? DEFAULT_CUSTOMER_APP_URL : "http://localhost:5174"))
    .split(",")
    .map((value) => value.trim())
    .filter(Boolean)
    .flatMap((value) => {
      try {
        const url = new URL(value);
        return url.protocol === "http:" || url.protocol === "https:" ? [url.origin] : [];
      } catch {
        return [];
      }
    });
  const local = candidates.find((candidate) => {
    const hostname = new URL(candidate).hostname;
    return hostname === "localhost" || hostname === "127.0.0.1";
  });
  const secure = candidates.find((candidate) => candidate.startsWith("https://"));
  return (isProduction ? secure ?? candidates[0] : local ?? candidates[0])
    ?? (isProduction ? DEFAULT_CUSTOMER_APP_URL : "http://localhost:5174");
}

export function tableCustomerUrl(token: string, configuredValue?: string, isProduction = process.env.NODE_ENV === "production") {
  return new URL(`/t/${encodeURIComponent(token)}`, customerAppUrl(configuredValue, isProduction)).toString();
}