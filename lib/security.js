/**
 * Validates a client-controlled URL for redirection to prevent open redirect vulnerabilities.
 * Allows relative paths starting with "/" but blocks protocol-relative paths ("//attacker.com")
 * and absolute URLs.
 *
 * @param {string} url - The URL destination.
 * @returns {boolean} True if the redirect path is safe.
 */
export function isSafeRedirect(url) {
  if (!url || typeof url !== "string") {
    return false;
  }

  // Allow standard relative paths starting with "/"
  if (url.startsWith("/")) {
    // Prevent protocol-relative URLs (e.g. "//attacker.com")
    if (url.startsWith("//")) {
      return false;
    }
    // Prevent backslash protocol-relative or Windows file path bypasses
    if (url.startsWith("/\\") || url.startsWith("\\")) {
      return false;
    }
    return true;
  }

  // Block any absolute URLs or other paths
  return false;
}

/**
 * Checks if a hostname resolves to a private or loopback IP address.
 *
 * @param {string} ip - The resolved IP address.
 * @returns {boolean} True if the IP is private.
 */
export function isPrivateIp(ip) {
  if (!ip) return true;

  const parts = ip.split(".");
  if (parts.length === 4) {
    const p1 = parseInt(parts[0], 10);
    const p2 = parseInt(parts[1], 10);

    if (p1 === 10) return true;
    if (p1 === 127) return true;
    if (p1 === 169 && p2 === 254) return true;
    if (p1 === 192 && p2 === 168) return true;
    if (p1 === 172 && p2 >= 16 && p2 <= 31) return true;
    if (p1 === 0) return true;
  }

  // IPv6 check
  // Loopback (::1) or Unique Local Addresses (fc00::/7) or Link-local (fe80::/10)
  if (ip === "::1" || ip === "0:0:0:0:0:0:0:1") return true;
  if (ip.toLowerCase().startsWith("fc00") || ip.toLowerCase().startsWith("fd00")) return true;
  if (ip.toLowerCase().startsWith("fe80")) return true;

  return false;
}

/**
 * Validates that a URL is safe to retrieve via SSRF-susceptible backends.
 * Checks the hostname against a whitelist of trusted domains to prevent loopback,
 * private IP addresses, and DNS lookup overhead/errors.
 *
 * @param {string} urlString - The URL to validate.
 * @returns {Promise<boolean>} True if the URL is public and safe to fetch.
 */
export async function isSafeUrl(urlString) {
  if (!urlString || typeof urlString !== "string") {
    return false;
  }

  try {
    const parsed = new URL(urlString);
    
    // Only allow HTTP/HTTPS protocols
    if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
      return false;
    }

    const hostname = parsed.hostname.toLowerCase();
    if (!hostname) {
      return false;
    }

    // Check directly if it is a private IP string to quickly discard loopback or local IPs
    if (isPrivateIp(hostname)) {
      return false;
    }

    // Whitelist of allowed trusted domains
    const trustedDomains = [
      "suno.com",
      "suno.ai",
      "apiframe.ai",
      "supabase.co",
      "supabase.in",
      "replicate.com",
      "replicate.delivery"
    ];

    // Append configured Supabase hostname from environment if present
    if (process.env.NEXT_PUBLIC_SUPABASE_URL) {
      try {
        const supabaseUrl = new URL(process.env.NEXT_PUBLIC_SUPABASE_URL);
        const supabaseHost = supabaseUrl.hostname.toLowerCase();
        if (supabaseHost && !trustedDomains.includes(supabaseHost)) {
          trustedDomains.push(supabaseHost);
        }
      } catch (err) {
        // Ignore parsing errors of env variables
      }
    }

    // Match exact domain or any sub-domain
    const isTrusted = trustedDomains.some((domain) => {
      return hostname === domain || hostname.endsWith("." + domain);
    });

    return isTrusted;
  } catch (err) {
    return false;
  }
}
