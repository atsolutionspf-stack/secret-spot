import { lazy, Suspense } from "react";
import { Routes, Route } from "react-router-dom";
import { Toaster } from "@/components/ui/sonner";
import { I18nProvider } from "@/lib/i18n";
import { CartProvider } from "@/features/orders/CartProvider";
import Home from "@/pages/Home";
const Admin = lazy(() => import("@/pages/Admin"));

// One <Route> per page in src/pages; BrowserRouter already wraps this in main.tsx.
export default function App() {
  return (
    <I18nProvider>
      <CartProvider>
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/admin" element={<Suspense fallback={<div className="min-h-screen bg-[#0B0E14]" />}><Admin /></Suspense>} />
          <Route path="*" element={<Home />} />
        </Routes>
      </CartProvider>
      <Toaster richColors position="bottom-right" />
    </I18nProvider>
  );
}
