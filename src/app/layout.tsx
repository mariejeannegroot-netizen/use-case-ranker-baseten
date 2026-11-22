export const metadata = {
  title: "Use Case Ranker",
  description: "Rank the most interesting use cases for an enterprise customer",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body style={{ fontFamily: "system-ui, sans-serif", maxWidth: 900, margin: "40px auto", padding: "0 20px" }}>
        {children}
      </body>
    </html>
  );
}
