"use server";

import { sessionOptions, type Rol, type SessionData } from "@/lib/session";
import bcrypt from "bcryptjs";
import { getIronSession } from "iron-session";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";

export async function loginAction(
  rol: Rol,
  pin: string
): Promise<{ error: string } | never> {
  const hashCorrecto =
    rol === "DUENO"
      ? process.env.PIN_DUENO_HASH
      : process.env.PIN_EMPLEADO_HASH;

  if (!hashCorrecto) {
    return { error: "Configuración de PIN no encontrada" };
  }

  const pinValido = await bcrypt.compare(pin, hashCorrecto);
  if (!pinValido) {
    return { error: "PIN incorrecto" };
  }

  const session = await getIronSession<SessionData>(
    await cookies(),
    sessionOptions
  );
  session.rol = rol;
  session.isLoggedIn = true;
  await session.save();

  redirect("/dashboard");
}

export async function logoutAction() {
  const session = await getIronSession<SessionData>(
    await cookies(),
    sessionOptions
  );
  session.destroy();
  redirect("/login");
}

export async function getSession(): Promise<SessionData | null> {
  const session = await getIronSession<SessionData>(
    await cookies(),
    sessionOptions
  );
  if (!session.isLoggedIn) return null;
  return session;
}
