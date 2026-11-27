const CLOUDFLARE_CONTEXT_SYMBOL = Symbol.for("__cloudflare-context__");

/**
 * Detect whether the code is executing inside Cloudflare Workers (workerd).
 */
export function isCloudflareWorkers(): boolean {
  if (typeof navigator !== "undefined" && navigator.userAgent === "Cloudflare-Workers") {
    return true;
  }
  return Boolean((globalThis as any)[CLOUDFLARE_CONTEXT_SYMBOL]);
}

/**
 * Read an environment variable dynamically at runtime, falling back to Cloudflare Worker `env` bindings.
 * Avoids static build-time inlining of undefined NEXT_PUBLIC_* vars in server bundles.
 */
export function getRuntimeEnv(key: string): string | undefined {
  const procEnv = typeof process !== "undefined" ? process.env : undefined;
  const procVal = procEnv?.[key];
  if (typeof procVal === "string" && procVal.trim() !== "") {
    return procVal;
  }

  const cfCtx = (globalThis as any)[CLOUDFLARE_CONTEXT_SYMBOL];
  const cfVal = cfCtx?.env?.[key];
  if (typeof cfVal === "string" && cfVal.trim() !== "") {
    return cfVal;
  }

  return undefined;
}
