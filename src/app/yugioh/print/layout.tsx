import "../../yugioh/yugioh.css";

// The print page needs a clean layout without the hub wrapper,
// which has overflow:hidden and height:100vh that breaks multi-page PDF printing.
export default function YugiohPrintLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <div style={{ minHeight: "100vh", background: "linear-gradient(180deg, #0b0e14 0%, #0d121a 100%)", color: "#e2e8f0" }}>
      {children}
    </div>
  );
}
