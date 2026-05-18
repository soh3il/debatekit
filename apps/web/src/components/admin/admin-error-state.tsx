import { Icons } from '@/components/icons';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { cn } from '@/lib/ui/cn';

function AdminErrorState({ className, message }: { className?: string; message: string }) {
  return (
    <div className={cn('flex flex-1 items-center justify-center', className)}>
      <Alert variant="destructive" className="max-w-sm">
        <Icons.alertCircle className="size-4" />
        <AlertDescription>{message}</AlertDescription>
      </Alert>
    </div>
  );
}

export { AdminErrorState };
