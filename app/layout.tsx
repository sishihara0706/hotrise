import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "HotRise",
  description: "YouTube急上昇発掘（MVP）"
};

export default function RootLayout({
  children
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ja" suppressHydrationWarning>
      <body suppressHydrationWarning>{children}</body>
    </html>
  );
}
