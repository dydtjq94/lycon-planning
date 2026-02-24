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

  let user = null
  try {
    const { data } = await supabase.auth.getUser()
    user = data.user
  } catch {
    // Invalid refresh token — treat as unauthenticated
  }

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

  // 전문가(admin)인지 확인
  if (user) {
    const { data: expert } = await supabase
      .from('experts')
      .select('id')
      .eq('user_id', user.id)
      .maybeSingle()

    // 전문가가 /auth 페이지 접근 시 (로그인/회원가입은 제외) → /admin으로
    const authAllowedForExpert = ['/auth/login', '/auth/signup', '/auth/callback']
    const isAllowedAuthPage = authAllowedForExpert.some(path => request.nextUrl.pathname.startsWith(path))
    if (expert && request.nextUrl.pathname.startsWith('/auth') && !isAllowedAuthPage) {
      const url = request.nextUrl.clone()
      url.pathname = '/admin'
      return NextResponse.redirect(url)
    }

    // 전문가가 일반 사용자 페이지 접근 시 → /admin으로
    // 단, viewAs 파라미터가 있으면 고객 대시보드 관리자 모드이므로 허용
    const userOnlyPaths = ['/onboarding', '/waiting', '/dashboard']
    const isUserOnlyPath = userOnlyPaths.some(path => request.nextUrl.pathname.startsWith(path))
    const hasViewAs = request.nextUrl.searchParams.has('viewAs')
    if (expert && isUserOnlyPath && !hasViewAs) {
      const url = request.nextUrl.clone()
      url.pathname = '/admin'
      return NextResponse.redirect(url)
    }
  }

  return supabaseResponse
}
