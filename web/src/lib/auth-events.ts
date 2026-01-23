"use client";

export const AUTH_CHANGE_EVENT = "knot-auth-change";

export type AuthChangeDetail = {
  authenticated: boolean;
};

export function emitAuthChange(authenticated: boolean) {
  if (typeof window === "undefined") return;
  window.dispatchEvent(
    new CustomEvent<AuthChangeDetail>(AUTH_CHANGE_EVENT, {
      detail: { authenticated },
    })
  );
}

export function subscribeAuthChange(
  callback: (detail: AuthChangeDetail) => void
) {
  if (typeof window === "undefined") {
    return () => {};
  }
  const handler = (event: Event) => {
    const detail = (event as CustomEvent<AuthChangeDetail>).detail;
    callback(detail);
  };
  window.addEventListener(
    AUTH_CHANGE_EVENT,
    handler as unknown as EventListener
  );
  return () =>
    window.removeEventListener(
      AUTH_CHANGE_EVENT,
      handler as unknown as EventListener
    );
}
