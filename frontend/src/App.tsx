import { Routes, Route } from "react-router-dom";
import { Toaster } from "@/components/ui/sonner";
import { I18nProvider } from "@/lib/i18n";
import { CartProvider } from "@/features/orders/CartProvider";
import Home from "@/pages/Home";
import Admin from "@/pages/Admin";
import LegalPage from "@/pages/LegalPage";

// One <Route> per page in src/pages; BrowserRouter already wraps this in main.tsx.
export default function App() {
  return (
    <I18nProvider>
      <CartProvider>
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/admin" element={<Admin />} />
          <Route path="/aviso-legal" element={<LegalPage />} />
          <Route path="/privacidad" element={<LegalPage />} />
          <Route path="/cookies" element={<LegalPage />} />
          <Route path="/condiciones" element={<LegalPage />} />
          <Route path="*" element={<Home />} />
        </Routes>
      </CartProvider>
      <Toaster richColors position="bottom-right" />
    </I18nProvider>
  );
}
