'use client';

import { CardVariants } from '@debatekit/shared';
import { useState } from 'react';

import { Icons } from '@/components/icons';
import { BlurFade } from '@/components/ui/blur-fade';
import { Card } from '@/components/ui/card';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';

import type { LandingFAQItem } from './landing-types';
import { SectionHeader } from './section-header';

type FAQSectionProps = {
  children?: React.ReactNode;
  items: readonly LandingFAQItem[];
  variant?: 'card' | 'minimal';
};

/**
 * Shared FAQ accordion section used across all landing pages.
 *
 * - `variant="card"` (default): Each FAQ in a glass card with chevron (solution pages)
 * - `variant="minimal"`: Divider-separated list with +/- toggle (MCP page)
 * - `children`: Optional content rendered after the accordion (e.g. CTA block)
 */
export function FAQSection({ children, items, variant = 'card' }: FAQSectionProps) {
  const [openIndex, setOpenIndex] = useState<number | null>(null);

  return (
    <section className="py-12 sm:py-16 md:py-24">
      <div className="mx-auto max-w-5xl px-4 sm:px-6">
        <div className="mx-auto max-w-3xl">
          <SectionHeader
            label="FAQ"
            heading="Frequently asked"
            headingHighlight="questions"
          />

          {variant === 'minimal'
            ? (
                <div className="divide-y divide-white/[0.06]">
                  {items.map((faq, i) => (
                    <Collapsible
                      key={i}
                      open={openIndex === i}
                      onOpenChange={open => setOpenIndex(open ? i : null)}
                    >
                      <CollapsibleTrigger className="w-full py-4 flex items-center justify-between gap-4 text-left cursor-pointer hover:bg-white/[0.02] transition-colors -mx-2 px-2 rounded">
                        <span className="font-sans text-sm font-medium text-white">{faq.question}</span>
                        <span className="text-sm text-gray-600 shrink-0 w-4 text-center">
                          {openIndex === i ? '\u2212' : '+'}
                        </span>
                      </CollapsibleTrigger>
                      <CollapsibleContent>
                        <div className="pb-4 text-sm text-gray-400 leading-relaxed">
                          {faq.answer}
                        </div>
                      </CollapsibleContent>
                    </Collapsible>
                  ))}
                </div>
              )
            : (
                <div className="space-y-2">
                  {items.map((faq, i) => (
                    <BlurFade key={i} delay={i * 0.05} inView>
                      <Collapsible
                        open={openIndex === i}
                        onOpenChange={open => setOpenIndex(open ? i : null)}
                      >
                        <Card variant={CardVariants.GLASS_SUBTLE} className="py-0">
                          <CollapsibleTrigger className="w-full px-4 sm:px-5 py-2.5 flex items-center justify-between gap-4 text-left cursor-pointer">
                            <span className="text-sm font-medium">{faq.question}</span>
                            <Icons.chevronDown
                              className={`size-4 shrink-0 text-muted-foreground transition-transform duration-200 ${openIndex === i ? 'rotate-180' : ''}`}
                            />
                          </CollapsibleTrigger>
                          <CollapsibleContent>
                            <div className="px-4 sm:px-5 pb-3 text-sm text-muted-foreground leading-relaxed">
                              {faq.answer}
                            </div>
                          </CollapsibleContent>
                        </Card>
                      </Collapsible>
                    </BlurFade>
                  ))}
                </div>
              )}

          {children}
        </div>
      </div>
    </section>
  );
}
