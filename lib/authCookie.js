// lib/authCookie.js — how long this device stays signed in: 30 days from the
// last time the app was used. Every Supabase client (server, browser, proxy,
// the demo door) writes its session cookies with this lifetime, and
// app/api/auth/keep renews them from the server once a day while the app is
// in use, so someone who opens VoltMira at least once a month never sees the
// sign-in form again on that device.
//
// Why renew from the server: Safari, and the iPhone home-screen app with it,
// keeps a cookie written by a page's own script for at most 7 days whatever
// it asks for. The same cookie sent by the server in a Set-Cookie header
// keeps its full lifetime.

export const AUTH_COOKIE_DAYS = 30;
export const AUTH_COOKIE_MAX_AGE = 60 * 60 * 24 * AUTH_COOKIE_DAYS;

/** Supabase's session cookies: sb-<project>-auth-token, and its .0 .1 chunks when large. */
export const isAuthCookie = (name) => /^sb-[^-]+-auth-token(\.\d+)?$/.test(String(name || ""));
