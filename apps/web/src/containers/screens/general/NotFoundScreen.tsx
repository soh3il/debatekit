import { Link } from '@tanstack/react-router';

import { Icons } from '@/components/icons';
import { Button, buttonVariants } from '@/components/ui/button';
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from '@/components/ui/empty';
import { useTranslations } from '@/lib/i18n';

export default function NotFoundScreen() {
  const t = useTranslations();
  return (
    <div className="flex h-full min-h-0 flex-1 items-center justify-center overflow-hidden px-4">
      <Empty className="max-w-sm border-none bg-transparent">
        <EmptyHeader>
          <EmptyMedia variant="icon-xl">
            <Icons.fileQuestion />
          </EmptyMedia>
          <EmptyTitle className="text-xl font-semibold">
            {t('pages.notFound.title')}
          </EmptyTitle>
          <EmptyDescription className="text-base">
            {t('pages.notFound.description')}
          </EmptyDescription>
        </EmptyHeader>
        <EmptyContent>
          <div className="flex flex-col gap-2 w-full">
            <Link to="/" className={buttonVariants({ className: 'w-full' })}>
              <Icons.home />
              {t('pages.notFound.goHome')}
            </Link>
            <Button
              variant="outline"
              startIcon={<Icons.arrowLeft />}
              className="w-full"
              onClick={() => window.history.back()}
            >
              {t('pages.notFound.goBack')}
            </Button>
          </div>
        </EmptyContent>
      </Empty>
    </div>
  );
}
