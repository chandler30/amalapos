import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // El chequeo de TIPOS sigue activo en el build; solo se omite ESLint (reglas de estilo).
  eslint: { ignoreDuringBuilds: true },
};

export default nextConfig;
