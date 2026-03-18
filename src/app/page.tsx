import {
  Navigation,
  NewHeroSection,
  NewFeaturesSection,
  LankaSection,
  NewPricingSection,
  NewTestimonialsSection,
  FinalCTASection,
  NewFooter,
} from '@/components/landing';

export default function HomePage() {
  return (
    <main className="flex min-h-screen flex-col">
      <Navigation />
      <NewHeroSection />
      <NewFeaturesSection />
      <LankaSection />
      <NewPricingSection />
      <NewTestimonialsSection />
      <FinalCTASection />
      <NewFooter />
    </main>
  );
}
