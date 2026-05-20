import type { SessionOptions } from "iron-session";

export type Rol = "DUENO" | "EMPLEADO";

export interface SessionData {
  rol: Rol;
  isLoggedIn: boolean;
}

export const SESSION_TTL = 12 * 60 * 60; // 12 horas en segundos

export const sessionOptions: SessionOptions = {
  cookieName: "zona-one-session",
  password: process.env.SESSION_PASSWORD!,
  ttl: SESSION_TTL,
  cookieOptions: {
    secure: process.env.NODE_ENV === "production",
    httpOnly: true,
    sameSite: "lax",
    maxAge: SESSION_TTL,
  },
};
