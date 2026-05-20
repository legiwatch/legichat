import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "LegiChat — Assistant juridique",
  description: "Assistant juridique RAG sur le droit du travail français",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="fr">
      <body className="min-h-screen bg-slate-50">
        {children}
      </body>
    </html>
  );
}
