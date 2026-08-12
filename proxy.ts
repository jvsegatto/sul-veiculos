import { createServerClient, type CookieOptions } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

export async function proxy(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet: Array<{ name: string; value: string; options?: CookieOptions }>) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value))
          supabaseResponse = NextResponse.next({ request })
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options as Parameters<typeof supabaseResponse.cookies.set>[2])
          )
        },
      },
    }
  )

  const {
    data: { user },
  } = await supabase.auth.getUser()

  const { pathname } = request.nextUrl

  // Rotas do conector MCP (/api/*) e OAuth (/oauth/*, /.well-known/*) não usam
  // sessão de cookie de navegador — são chamadas servidor-a-servidor
  // autenticadas por token Bearer (ou endpoints públicos de metadata), então
  // não passam por esse redirect. /estoque/rascunhos/* também é público de
  // propósito — o link (uuid v4) funciona como capability link, mandado pelo
  // Claude na conversa, pro admin subir foto sem precisar logar de novo.
  const isMcpOrOAuthRoute =
    pathname.startsWith('/api/') ||
    pathname.startsWith('/oauth/') ||
    pathname.startsWith('/.well-known/') ||
    pathname.startsWith('/estoque/rascunhos/')

  if (
    !user &&
    !isMcpOrOAuthRoute &&
    !pathname.startsWith('/login') &&
    !pathname.startsWith('/_next') &&
    pathname !== '/favicon.ico'
  ) {
    const url = request.nextUrl.clone()
    url.pathname = '/login'
    return NextResponse.redirect(url)
  }

  return supabaseResponse
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)'],
}
