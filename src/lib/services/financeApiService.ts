/**
 * Finance API Service
 * API Route를 통해 FastAPI 서버와 통신 (URL 노출 방지)
 */

const API_BASE = '/api/finance';

export interface StockData {
  Date: string;
  Open: number;
  High: number;
  Low: number;
  Close: number;
  Volume: number;
  Change?: number;
}

export interface StockResponse {
  symbol: string;
  count: number;
  data: StockData[];
}

export interface IndexResponse {
  symbol: string;
  count: number;
  data: StockData[];
}

export interface ExchangeResponse {
  currency: string;
  count: number;
  data: { Date: string; Close: number; Open?: number; High?: number; Low?: number }[];
}

export interface KRXStock {
  Code: string;
  Name: string;
  Market: string;
  Sector?: string;
  Industry?: string;
}

export interface KRXStocksResponse {
  market: string;
  count: number;
  data: KRXStock[];
}

/**
 * 주식 데이터 조회
 */
export async function getStockData(
  symbol: string,
  options?: { start?: string; end?: string; days?: number }
): Promise<StockResponse> {
  const params = new URLSearchParams();
  if (options?.start) params.append('start', options.start);
  if (options?.end) params.append('end', options.end);
  if (options?.days) params.append('days', options.days.toString());

  const queryString = params.toString();
  const url = `${API_BASE}/stock/${symbol}${queryString ? `?${queryString}` : ''}`;

  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Failed to fetch stock data: ${response.statusText}`);
  }
  return response.json();
}

/**
 * 지수 데이터 조회
 */
export async function getIndexData(
  symbol: string,
  options?: { start?: string; end?: string; days?: number }
): Promise<IndexResponse> {
  const params = new URLSearchParams();
  if (options?.start) params.append('start', options.start);
  if (options?.end) params.append('end', options.end);
  if (options?.days) params.append('days', options.days.toString());

  const queryString = params.toString();
  const url = `${API_BASE}/index/${symbol}${queryString ? `?${queryString}` : ''}`;

  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Failed to fetch index data: ${response.statusText}`);
  }
  return response.json();
}

/**
 * 환율 데이터 조회
 */
export async function getExchangeRate(
  currency: string,
  options?: { start?: string; end?: string; days?: number }
): Promise<ExchangeResponse> {
  const params = new URLSearchParams();
  if (options?.start) params.append('start', options.start);
  if (options?.end) params.append('end', options.end);
  if (options?.days) params.append('days', options.days.toString());

  const queryString = params.toString();
  const url = `${API_BASE}/exchange/${currency}${queryString ? `?${queryString}` : ''}`;

  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Failed to fetch exchange rate: ${response.statusText}`);
  }
  return response.json();
}

/**
 * KRX 상장 종목 목록 조회
 */
export async function getKRXStocks(market: string = 'KOSPI'): Promise<KRXStocksResponse> {
  const url = `${API_BASE}/krx/stocks?market=${market}`;

  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Failed to fetch KRX stocks: ${response.statusText}`);
  }
  return response.json();
}

/**
 * 암호화폐 데이터 조회
 */
export async function getCryptoData(
  symbol: string,
  options?: { start?: string; end?: string; days?: number }
): Promise<StockResponse> {
  const params = new URLSearchParams();
  if (options?.start) params.append('start', options.start);
  if (options?.end) params.append('end', options.end);
  if (options?.days) params.append('days', options.days.toString());

  const queryString = params.toString();
  const url = `${API_BASE}/crypto/${symbol}${queryString ? `?${queryString}` : ''}`;

  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Failed to fetch crypto data: ${response.statusText}`);
  }
  return response.json();
}

/**
 * API 헬스 체크
 */
export async function checkApiHealth(): Promise<boolean> {
  try {
    const response = await fetch(`${API_BASE}/health`);
    return response.ok;
  } catch {
    return false;
  }
}
