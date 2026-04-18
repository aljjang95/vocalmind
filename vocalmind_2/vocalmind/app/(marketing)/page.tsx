import Hero from '@/components/marketing/Hero';
import Proof from '@/components/marketing/Proof';
import Features from '@/components/marketing/Features';
import HowItWorks from '@/components/marketing/HowItWorks';
import Demo from '@/components/marketing/Demo';
import AIStudioBeta from '@/components/marketing/AIStudioBeta';
import Pricing from '@/components/marketing/Pricing';
import Testimonials from '@/components/marketing/Testimonials';
import CtaSection from '@/components/marketing/CtaSection';

export default function HomePage() {
  return (
    <>
      <Hero />
      <Proof />
      <Features />
      <HowItWorks />
      <Demo />
      <AIStudioBeta />
      <Pricing />
      <Testimonials />
      <CtaSection />
    </>
  );
}
