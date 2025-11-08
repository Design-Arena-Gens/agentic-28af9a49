import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'NSE Institutional Accumulation Analyzer',
  description: 'Analyze institutional accumulation patterns in NSE stocks',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  )
}
