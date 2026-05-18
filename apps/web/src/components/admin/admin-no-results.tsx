import { Icons } from '@/components/icons';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { cn } from '@/lib/ui/cn';

function AdminNoResults({ className, message }: { className?: string; message: string }) {
  return (
    <div className={cn('flex flex-1 items-center justify-center', className)}>
      <Alert className="max-w-sm">
        <Icons.search className="size-4" />
        <AlertDescription>{message}</AlertDescription>
      </Alert>
    </div>
  );
}

export { AdminNoResults };
