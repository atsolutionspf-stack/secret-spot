import { lazy, Suspense, useEffect } from "react";
import Header from "@/components/site/Header";
import Hero from "@/components/site/Hero";
import { Services, Story } from "@/components/site/StoryServices";
import MenuSection from "@/components/site/MenuSection";
import BookingSection from "@/components/site/BookingSection";
import ContactSection from "@/components/site/ContactSection";
import { Footer, MobileBar } from "@/components/site/Footer";
import { useCart } from "@/features/orders/CartProvider";
import { queryClient } from "@/lib/queryClient";
import { fetchMenu, fetchOrderConfig } from "@/lib/data";
import { orderKeys } from "@/features/orders/orderService";

const OrderSheet = lazy(() => import("@/features/orders/components/OrderSheet"));

function DeferredOrderSheet() {
  const { isOpen } = useCart();
  if (!isOpen) return null;
  return (
    <Suspense fallback={null}>
      <OrderSheet />
    </Suspense>
  );
}

export default function Home() {
  useEffect(() => {
    // Warm the order sheet and its data after the first paint, so the CTA opens immediately.
    const timer = window.setTimeout(() => {
      void import("@/features/orders/components/OrderSheet");
      void queryClient.prefetchQuery({ queryKey: ["menu"], queryFn: fetchMenu, staleTime: 60_000 });
      void queryClient.prefetchQuery({ queryKey: orderKeys.config, queryFn: fetchOrderConfig, staleTime: 30_000 });
    }, 900);
    return () => window.clearTimeout(timer);
  }, []);

  return (
    <div className="min-h-screen bg-[#0B0E14] text-stone-100" data-testid="home-page">
      <Header />
      <main>
        <Hero />
        <Story />
        <Services />
        <MenuSection />
        <BookingSection />
        <ContactSection />
      </main>
      <Footer />
      <MobileBar />
      <DeferredOrderSheet />
    </div>
  );
}
