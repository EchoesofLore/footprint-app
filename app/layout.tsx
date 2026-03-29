import "./globals.css";
import { ClerkProvider } from "@clerk/nextjs";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Footprint — Secure Password Manager",
  description:
    "End-to-end encrypted. Zero knowledge. Your master password never leaves your device.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <ClerkProvider
      signInUrl="/sign-in"
      appearance={{
        variables: {
          colorPrimary: "#00d4ff",
          colorBackground: "#060f1e",
          colorText: "#dff4fa",
          colorTextSecondary: "rgba(223,244,250,0.45)",
          colorInputBackground: "#030912",
          colorInputText: "#dff4fa",
          borderRadius: "2px",
          fontFamily: "Inter, sans-serif",
        },
      }}
    >
      <html lang="en">
        <body>{children}</body>
      </html>
    </ClerkProvider>
  );
}
