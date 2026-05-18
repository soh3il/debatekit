import { CardVariants } from '@debatekit/shared';
import { Link } from '@tanstack/react-router';

import { Icons } from '@/components/icons';
import { Badge } from '@/components/ui/badge';
import { BlurFade } from '@/components/ui/blur-fade';
import { Card, CardContent } from '@/components/ui/card';

export function ResearchFoundationCallout() {
  return (
    <section className="py-12 sm:py-16">
      <div className="mx-auto max-w-5xl px-4 sm:px-6">
        <BlurFade delay={0.1} inView>
          <Link to="/mcp" hash="research" className="block group">
            <Card variant={CardVariants.GLASS_SUBTLE} className="hover:border-white/[0.12] transition-colors">
              <CardContent className="p-4 sm:p-6 flex flex-col sm:flex-row items-start sm:items-center gap-3 sm:gap-4">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-2 flex-wrap">
                    <Badge variant="outline" className="text-[10px] uppercase tracking-[0.12em] text-amber-400 border-amber-400/30">
                      ICML 2024 Best Paper
                    </Badge>
                    <Badge variant="outline" className="text-[10px] uppercase tracking-[0.12em] text-blue-400 border-blue-400/30">
                      NeurIPS 2024
                    </Badge>
                    <Badge variant="outline" className="text-[10px] uppercase tracking-[0.12em] text-violet-400 border-violet-400/30">
                      ICLR 2025
                    </Badge>
                  </div>
                  <p className="text-sm text-gray-400 leading-relaxed">
                    Multi-model debate improves accuracy by
                    {' '}
                    <span className="text-white font-semibold">+28 percentage points</span>
                    {' '}
                    — validated at ICML 2024 (Best Paper), NeurIPS 2024, and ICLR 2025.
                  </p>
                </div>
                <div className="flex items-center gap-1.5 text-sm text-gray-500 group-hover:text-gray-300 transition-colors shrink-0">
                  <span>Read the research</span>
                  <Icons.arrowRight className="size-4 transition-transform group-hover:translate-x-0.5" />
                </div>
              </CardContent>
            </Card>
          </Link>
        </BlurFade>
      </div>
    </section>
  );
}
