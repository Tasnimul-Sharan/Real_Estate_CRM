import "./globals.css";
import "./brand.css";
import type { Metadata } from "next";
export const metadata: Metadata = {
  title: "Anondo Housing Society | CRM",
  description: "Anondo Housing Society — customer relationships, property inventory and sales.",
};
export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
