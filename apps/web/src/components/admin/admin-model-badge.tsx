/**
 * Admin Model Badge
 *
 * Extracts short model name from full ID (e.g. "openai/gpt-5.1" → "gpt-5.1")
 * and renders a consistent badge.
 */

import { Badge } from '@/components/ui/badge';

function AdminModelBadge({ modelId }: { modelId: string }) {
  const shortName = modelId.split('/')[1] ?? modelId;

  return (
    <Badge variant="secondary" className="text-xs">
      {shortName}
    </Badge>
  );
}

export { AdminModelBadge };
