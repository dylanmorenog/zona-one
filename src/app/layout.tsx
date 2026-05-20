import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Zona One",
  description: "Sistema de administración Zona One",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="es">
      <body>{children}</body>
    </html>
  );
}
