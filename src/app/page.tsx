import {
  HeroSection,
  FeaturesSection,
  AccessControlSection,
  WhyChooseSection,
  GetStartedSection,
  PricingSection,
  TestimonialsSection,
  ContactSection,
  Footer,
  FloatingChatWidget,
} from '@/components/landing';

export default function HomePage() {
  return (
    <main className="flex min-h-screen flex-col">
      <HeroSection />
      <FeaturesSection />
      <AccessControlSection />
      <WhyChooseSection />
      <GetStartedSection />
      <PricingSection />
      <TestimonialsSection />
      <ContactSection />
      <Footer />
      <FloatingChatWidget />
    </main>
  );
}
