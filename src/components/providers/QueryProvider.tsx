'use client'

import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { useState, type ReactNode } from 'react'

interface QueryProviderProps {
  children: ReactNode
}

export function QueryProvider({ children }: QueryProviderProps) {
  // useState로 QueryClient 생성 (컴포넌트 간 공유 방지)
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            // 5분간 캐시된 데이터를 "신선"하다고 간주
            staleTime: 5 * 60 * 1000,
            // 캐시 유지 시간 (30분)
            gcTime: 30 * 60 * 1000,
            // 창 포커스 시 자동 refetch 비활성화
            refetchOnWindowFocus: false,
            // 재연결 시 자동 refetch 비활성화
            refetchOnReconnect: false,
            // 실패 시 1번만 재시도
            retry: 1,
          },
        },
      })
  )

  return (
    <QueryClientProvider client={queryClient}>
      {children}
    </QueryClientProvider>
  )
}
