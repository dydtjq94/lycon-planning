import { NextRequest, NextResponse } from 'next/server';

const FASTAPI_URL = process.env.FASTAPI_URL;

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ path: string[] }> }
) {
  if (!FASTAPI_URL) {
    return NextResponse.json(
      { error: 'FASTAPI_URL not configured' },
      { status: 500 }
    );
  }

  const { path } = await params;
  const pathString = path.join('/');
  const searchParams = request.nextUrl.searchParams.toString();
  const url = `${FASTAPI_URL}/finance/${pathString}${searchParams ? `?${searchParams}` : ''}`;

  try {
    const response = await fetch(url);
    const data = await response.json();

    if (!response.ok) {
      return NextResponse.json(data, { status: response.status });
    }

    return NextResponse.json(data);
  } catch (error) {
    console.error('[Finance API Proxy Error]', error);
    return NextResponse.json(
      { error: 'Failed to fetch from Finance API' },
      { status: 500 }
    );
  }
}
