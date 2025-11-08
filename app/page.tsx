'use client';

import { useState } from 'react';

interface StockAccumulation {
  symbol: string;
  totalBuyQuantity: number;
  totalBuyValue: number;
  transactions: number;
  avgPrice: number;
}

export default function Home() {
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState<StockAccumulation[]>([]);
  const [error, setError] = useState<string>('');
  const [progress, setProgress] = useState<string>('');

  const analyzeAccumulation = async () => {
    setLoading(true);
    setError('');
    setResults([]);
    setProgress('Starting analysis...');

    try {
      const response = await fetch('/api/analyze', {
        method: 'POST',
      });

      if (!response.ok) {
        throw new Error('Analysis failed');
      }

      const reader = response.body?.getReader();
      const decoder = new TextDecoder();

      if (reader) {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          const chunk = decoder.decode(value);
          const lines = chunk.split('\n');

          for (const line of lines) {
            if (line.startsWith('data: ')) {
              const data = JSON.parse(line.slice(6));

              if (data.type === 'progress') {
                setProgress(data.message);
              } else if (data.type === 'result') {
                setResults(data.data);
                setProgress('Analysis complete!');
              } else if (data.type === 'error') {
                setError(data.message);
              }
            }
          }
        }
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{
      minHeight: '100vh',
      padding: '2rem',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      color: 'white'
    }}>
      <div style={{
        background: 'rgba(255, 255, 255, 0.1)',
        backdropFilter: 'blur(10px)',
        borderRadius: '20px',
        padding: '3rem',
        maxWidth: '1200px',
        width: '100%',
        boxShadow: '0 8px 32px 0 rgba(31, 38, 135, 0.37)',
        border: '1px solid rgba(255, 255, 255, 0.18)'
      }}>
        <h1 style={{
          fontSize: '2.5rem',
          marginBottom: '1rem',
          textAlign: 'center',
          fontWeight: 'bold'
        }}>
          NSE Institutional Accumulation Analyzer
        </h1>

        <p style={{
          textAlign: 'center',
          marginBottom: '2rem',
          opacity: 0.9,
          fontSize: '1.1rem'
        }}>
          Analyze bulk/block deals from NSE to identify top institutional accumulation patterns
        </p>

        <div style={{ textAlign: 'center', marginBottom: '2rem' }}>
          <button
            onClick={analyzeAccumulation}
            disabled={loading}
            style={{
              background: loading ? '#666' : 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
              color: 'white',
              padding: '1rem 3rem',
              fontSize: '1.1rem',
              border: 'none',
              borderRadius: '50px',
              cursor: loading ? 'not-allowed' : 'pointer',
              fontWeight: 'bold',
              boxShadow: '0 4px 15px 0 rgba(0, 0, 0, 0.2)',
              transition: 'all 0.3s ease',
              transform: loading ? 'scale(0.98)' : 'scale(1)'
            }}
          >
            {loading ? 'Analyzing...' : 'Start Analysis'}
          </button>
        </div>

        {progress && (
          <div style={{
            background: 'rgba(255, 255, 255, 0.2)',
            padding: '1rem',
            borderRadius: '10px',
            marginBottom: '1rem',
            textAlign: 'center',
            fontSize: '0.95rem'
          }}>
            {progress}
          </div>
        )}

        {error && (
          <div style={{
            background: 'rgba(255, 0, 0, 0.2)',
            padding: '1rem',
            borderRadius: '10px',
            marginBottom: '1rem',
            border: '1px solid rgba(255, 0, 0, 0.4)',
            color: '#ffcccc'
          }}>
            Error: {error}
          </div>
        )}

        {results.length > 0 && (
          <div>
            <h2 style={{
              fontSize: '1.8rem',
              marginBottom: '1.5rem',
              textAlign: 'center'
            }}>
              Top 10 Stocks with Maximum Institutional Accumulation
            </h2>

            <div style={{ overflowX: 'auto' }}>
              <table style={{
                width: '100%',
                borderCollapse: 'collapse',
                background: 'rgba(255, 255, 255, 0.05)',
                borderRadius: '10px',
                overflow: 'hidden'
              }}>
                <thead>
                  <tr style={{ background: 'rgba(255, 255, 255, 0.1)' }}>
                    <th style={tableHeaderStyle}>Rank</th>
                    <th style={tableHeaderStyle}>Stock Symbol</th>
                    <th style={tableHeaderStyle}>Total Buy Qty</th>
                    <th style={tableHeaderStyle}>Total Buy Value (₹)</th>
                    <th style={tableHeaderStyle}>Transactions</th>
                    <th style={tableHeaderStyle}>Avg Price (₹)</th>
                  </tr>
                </thead>
                <tbody>
                  {results.map((stock, index) => (
                    <tr
                      key={stock.symbol}
                      style={{
                        background: index % 2 === 0 ? 'rgba(255, 255, 255, 0.02)' : 'transparent'
                      }}
                    >
                      <td style={tableCellStyle}>{index + 1}</td>
                      <td style={{...tableCellStyle, fontWeight: 'bold'}}>{stock.symbol}</td>
                      <td style={tableCellStyle}>{stock.totalBuyQuantity.toLocaleString('en-IN')}</td>
                      <td style={tableCellStyle}>{stock.totalBuyValue.toLocaleString('en-IN', { maximumFractionDigits: 0 })}</td>
                      <td style={tableCellStyle}>{stock.transactions}</td>
                      <td style={tableCellStyle}>{stock.avgPrice.toFixed(2)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

const tableHeaderStyle: React.CSSProperties = {
  padding: '1rem',
  textAlign: 'left',
  fontWeight: 'bold',
  fontSize: '0.9rem'
};

const tableCellStyle: React.CSSProperties = {
  padding: '1rem',
  borderTop: '1px solid rgba(255, 255, 255, 0.1)',
  fontSize: '0.9rem'
};
