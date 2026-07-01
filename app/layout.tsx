import type { Metadata } from "next";
import { Anton, Alfa_Slab_One, Baloo_2, JetBrains_Mono } from "next/font/google";
import "./globals.css";

const anton = Anton({ weight: "400", variable: "--font-anton", subsets: ["latin"] });
const alfa = Alfa_Slab_One({ weight: "400", variable: "--font-alfa", subsets: ["latin"] });
const baloo = Baloo_2({ weight: ["400", "500", "600", "700"], variable: "--font-baloo", subsets: ["latin"] });
const jbmono = JetBrains_Mono({ weight: ["400", "700"], variable: "--font-jbmono", subsets: ["latin"] });

export const metadata: Metadata = {
  title: "Amala Pizza & Tacos — POS",
  description: "Sistema POS · Amala Pizza & Tacos · Crespo, Cartagena",
};

// Aplica el tema guardado ANTES de pintar (evita flash)
const themeBoot = `try{if(localStorage.getItem('theme')==='dark'){document.documentElement.classList.add('dark')}}catch(e){}`;

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="es" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeBoot }} />
      </head>
      <body className={`${anton.variable} ${alfa.variable} ${baloo.variable} ${jbmono.variable} antialiased`}>
        {children}
      </body>
    </html>
  );
}
