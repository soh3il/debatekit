import { Icons } from '@/components/icons';
import { Alert, AlertDescription } from '@/components/ui/alert';

function AdminItemError({ message }: { message: string }) {
  return (
    <Alert variant="destructive" className="py-1.5 px-2 text-xs [&>svg]:size-3">
      <Icons.alertCircle />
      <AlertDescription className="text-xs">{message}</AlertDescription>
    </Alert>
  );
}

export { AdminItemError };
