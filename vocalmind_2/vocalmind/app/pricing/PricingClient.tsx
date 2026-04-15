'use client';

import Nav from '@/components/shared/Nav';
import Pricing from '@/components/marketing/Pricing';

export default function PricingClient() {
  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg-base)' }}>
      <Nav />
      <Pricing />
    </div>
  );
}
