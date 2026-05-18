import { cn } from '@/lib/ui/cn';

const TWEET_MAX_LENGTH = 25000;
const TWEET_WARN_THRESHOLD = 23000;
const TWEET_DANGER_THRESHOLD = 24500;

type TweetCharacterCountProps = {
  count: number;
};

export function TweetCharacterCount({ count }: TweetCharacterCountProps) {
  return (
    <span className={cn(
      'text-xs tabular-nums font-medium',
      count < TWEET_WARN_THRESHOLD && 'text-emerald-500',
      count >= TWEET_WARN_THRESHOLD && count < TWEET_DANGER_THRESHOLD && 'text-amber-500',
      count >= TWEET_DANGER_THRESHOLD && 'text-destructive',
    )}
    >
      {count}
      /
      {TWEET_MAX_LENGTH}
    </span>
  );
}
