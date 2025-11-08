import { NextResponse } from 'next/server';

interface Deal {
  date: string;
  symbol: string;
  clientName: string;
  dealType: string;
  quantity: number;
  price: number;
  value: number;
}

interface StockAccumulation {
  symbol: string;
  totalBuyQuantity: number;
  totalBuyValue: number;
  transactions: number;
  avgPrice: number;
}

const INSTITUTIONAL_KEYWORDS = [
  'INSURANCE',
  'MUTUAL FUND',
  'LIC',
  'TRUST',
  'BANK',
  'SECURITIES',
  'INVESTMENT',
  'CAPITAL',
  'FUND',
  'ASSET MANAGEMENT',
  'PENSION',
  'PMS',
  'AIF',
  'FII',
  'DII',
  'INSTITUTIONAL',
  'FINANCIAL SERVICES',
  'WEALTH',
  'HOLDINGS',
];

function isInstitutional(clientName: string): boolean {
  const upperClient = clientName.toUpperCase();
  return INSTITUTIONAL_KEYWORDS.some(keyword => upperClient.includes(keyword));
}

function getLastNBusinessDays(n: number): Date[] {
  const dates: Date[] = [];
  const today = new Date();
  let count = 0;
  let currentDate = new Date(today);

  while (count < n) {
    const dayOfWeek = currentDate.getDay();

    // Skip weekends (0 = Sunday, 6 = Saturday)
    if (dayOfWeek !== 0 && dayOfWeek !== 6) {
      dates.push(new Date(currentDate));
      count++;
    }

    currentDate.setDate(currentDate.getDate() - 1);
  }

  return dates;
}

function formatDateForNSE(date: Date): string {
  const day = String(date.getDate()).padStart(2, '0');
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const year = date.getFullYear();
  return `${day}${month}${year}`;
}

function parseCSVLine(line: string): string[] {
  const result: string[] = [];
  let current = '';
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const char = line[i];

    if (char === '"') {
      inQuotes = !inQuotes;
    } else if (char === ',' && !inQuotes) {
      result.push(current.trim());
      current = '';
    } else {
      current += char;
    }
  }

  result.push(current.trim());
  return result;
}

async function downloadBhavCopy(date: Date, encoder: TextEncoder, controller: ReadableStreamDefaultController): Promise<Deal[]> {
  const dateStr = formatDateForNSE(date);
  const url = `https://nsearchives.nseindia.com/content/equities/bulk_${dateStr}.csv`;

  const progressMsg = encoder.encode(`data: ${JSON.stringify({ type: 'progress', message: `Fetching data for ${date.toLocaleDateString('en-IN')}...` })}\n\n`);
  controller.enqueue(progressMsg);

  try {
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        'Accept': 'text/csv,application/csv,text/plain',
        'Accept-Language': 'en-US,en;q=0.9',
        'Referer': 'https://www.nseindia.com/',
        'Connection': 'keep-alive'
      }
    });

    if (!response.ok) {
      console.log(`No data available for ${date.toLocaleDateString('en-IN')}`);
      return [];
    }

    const csvText = await response.text();
    const lines = csvText.split('\n').filter(line => line.trim());

    if (lines.length < 2) {
      return [];
    }

    const deals: Deal[] = [];

    // Skip header
    for (let i = 1; i < lines.length; i++) {
      const fields = parseCSVLine(lines[i]);

      if (fields.length < 8) continue;

      const symbol = fields[1]?.trim() || '';
      const clientName = fields[2]?.trim() || '';
      const dealType = fields[3]?.trim().toUpperCase() || '';
      const quantity = parseFloat(fields[4]?.replace(/,/g, '') || '0');
      const price = parseFloat(fields[5]?.replace(/,/g, '') || '0');

      if (symbol && clientName && quantity > 0 && price > 0 && dealType === 'BUY') {
        deals.push({
          date: date.toISOString().split('T')[0],
          symbol,
          clientName,
          dealType,
          quantity,
          price,
          value: quantity * price
        });
      }
    }

    return deals;
  } catch (error) {
    console.error(`Error fetching data for ${dateStr}:`, error);
    return [];
  }
}

function analyzeAccumulation(allDeals: Deal[]): StockAccumulation[] {
  const stockMap = new Map<string, {
    totalBuyQuantity: number;
    totalBuyValue: number;
    transactions: number;
  }>();

  // Filter for institutional deals and accumulate
  const institutionalDeals = allDeals.filter(deal =>
    deal.dealType === 'BUY' && isInstitutional(deal.clientName)
  );

  for (const deal of institutionalDeals) {
    const existing = stockMap.get(deal.symbol) || {
      totalBuyQuantity: 0,
      totalBuyValue: 0,
      transactions: 0
    };

    stockMap.set(deal.symbol, {
      totalBuyQuantity: existing.totalBuyQuantity + deal.quantity,
      totalBuyValue: existing.totalBuyValue + deal.value,
      transactions: existing.transactions + 1
    });
  }

  // Convert to array and calculate averages
  const results: StockAccumulation[] = Array.from(stockMap.entries()).map(([symbol, data]) => ({
    symbol,
    totalBuyQuantity: data.totalBuyQuantity,
    totalBuyValue: data.totalBuyValue,
    transactions: data.transactions,
    avgPrice: data.totalBuyValue / data.totalBuyQuantity
  }));

  // Sort by total buy value and get top 10
  results.sort((a, b) => b.totalBuyValue - a.totalBuyValue);
  return results.slice(0, 10);
}

export async function POST() {
  const stream = new ReadableStream({
    async start(controller) {
      const encoder = new TextEncoder();

      try {
        const dates = getLastNBusinessDays(5);
        const allDeals: Deal[] = [];

        for (const date of dates) {
          const deals = await downloadBhavCopy(date, encoder, controller);
          allDeals.push(...deals);
        }

        const progressMsg = encoder.encode(`data: ${JSON.stringify({
          type: 'progress',
          message: `Analyzing ${allDeals.length} transactions from institutional investors...`
        })}\n\n`);
        controller.enqueue(progressMsg);

        const results = analyzeAccumulation(allDeals);

        const resultMsg = encoder.encode(`data: ${JSON.stringify({
          type: 'result',
          data: results
        })}\n\n`);
        controller.enqueue(resultMsg);

        controller.close();
      } catch (error) {
        const errorMsg = encoder.encode(`data: ${JSON.stringify({
          type: 'error',
          message: error instanceof Error ? error.message : 'Unknown error occurred'
        })}\n\n`);
        controller.enqueue(errorMsg);
        controller.close();
      }
    }
  });

  return new NextResponse(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
    },
  });
}
