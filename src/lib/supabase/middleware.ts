import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

export async function updateSession(request: NextRequest) {
  let supabaseResponse = NextResponse.next({
    request,
  })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value))
          supabaseResponse = NextResponse.next({
            request,
          })
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          )
        },
      },
    }
  )

  const {
    data: { user },
  } = await supabase.auth.getUser()

  // 보호된 경로 체크
  const protectedPaths = ['/dashboard', '/onboarding', '/waiting']
  const isProtectedPath = protectedPaths.some(path =>
    request.nextUrl.pathname.startsWith(path)
  )

  if (isProtectedPath && !user) {
    const url = request.nextUrl.clone()
    url.pathname = '/auth/login'
    return NextResponse.redirect(url)
  }

  // 이미 로그인한 사용자가 로그인/회원가입 페이지 접근 시 → 온보딩으로
  // (PIN 설정, PIN 입력, 전화번호 인증, 콜백은 제외)
  const authExcludedPages = ['/auth/pin-setup', '/auth/pin-verify', '/auth/phone-verify', '/auth/callback']
  const isExcludedAuthPage = authExcludedPages.some(path => request.nextUrl.pathname.startsWith(path))

  if (user && request.nextUrl.pathname.startsWith('/auth') && !isExcludedAuthPage) {
    const url = request.nextUrl.clone()
    url.pathname = '/onboarding'
    return NextResponse.redirect(url)
  }

  return supabaseResponse
}
