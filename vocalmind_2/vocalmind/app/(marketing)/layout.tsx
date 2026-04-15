import Nav from '@/components/shared/Nav';
import Footer from '@/components/shared/Footer';
import ScrollReveal from '@/components/shared/ScrollReveal';

export default function MarketingLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <div className="gradient-bg" aria-hidden="true" />
      <Nav />
      <main>{children}</main>
      <Footer />
      <ScrollReveal />
    </>
  );
}
