import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  basePath: "/admin",
  experimental: {
    serverActions: {
      bodySizeLimit: "10mb",
    },
  },
  // Descoberta de OAuth (RFC 8414 / RFC 9728) precisa viver na raiz do
  // domínio, sem o /admin — clientes OAuth (Claude.ai) tentam
  // "{issuer}/.well-known/X" ou "/.well-known/X{path-do-issuer}" e não tem
  // como adivinhar o basePath desse app. Mantém o issuer como a raiz do
  // domínio (lib/mcp/oauthConfig.ts) e só expõe os endpoints de metadata
  // fora do basePath; os endpoints reais (/admin/oauth/*, /admin/api/mcp)
  // continuam normalmente, já que são usados como URL absoluta, não
  // reconstruídos pelo cliente.
  async rewrites() {
    // Next exige destino absoluto (http/https) quando a origem do rewrite
    // tem basePath:false — vira um proxy interno pro próprio app, mas é o
    // jeito suportado de expor uma rota fora do basePath global.
    const siteUrl = (process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000").replace(/\/$/, "");
    return [
      { source: "/.well-known/:path*", destination: `${siteUrl}/admin/.well-known/:path*`, basePath: false },
    ];
  },
};

export default nextConfig;
