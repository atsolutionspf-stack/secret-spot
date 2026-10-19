import Header from "@/components/site/Header";
import Hero from "@/components/site/Hero";
import { Services, Story } from "@/components/site/StoryServices";
import MenuSection from "@/components/site/MenuSection";
import BookingSection from "@/components/site/BookingSection";
import ContactSection from "@/components/site/ContactSection";
import { Footer, MobileBar } from "@/components/site/Footer";

export default function Home() {
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
    </div>
  );
}
