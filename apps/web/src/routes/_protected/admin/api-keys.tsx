'use client';

import { createFileRoute } from '@tanstack/react-router';
import { useState } from 'react';

import { Icons } from '@/components/icons';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { useApiKeysQuery, useCreateApiKeyMutation, useDeleteApiKeyMutation } from '@/hooks';

export const Route = createFileRoute('/_protected/admin/api-keys')({
  component: ApiKeysPage,
});

function ApiKeysPage() {
  const { data, isPending } = useApiKeysQuery();
  const createMutation = useCreateApiKeyMutation();
  const deleteMutation = useDeleteApiKeyMutation();

  const [showCreateForm, setShowCreateForm] = useState(false);
  const [newKeyName, setNewKeyName] = useState('');
  const [createdKey, setCreatedKey] = useState<string | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [copiedCreatedKey, setCopiedCreatedKey] = useState(false);

  const apiKeys = data?.data?.items ?? [];

  const handleCreate = () => {
    if (newKeyName.length < 3) {
      return;
    }

    createMutation.mutate(
      { json: { name: newKeyName } },
      {
        onSuccess: (result) => {
          const keyValue = result?.data?.apiKey?.key;
          if (keyValue) {
            setCreatedKey(keyValue);
          }
          setNewKeyName('');
          setShowCreateForm(false);
        },
      },
    );
  };

  const handleDelete = (keyId: string) => {
    deleteMutation.mutate({ param: { keyId } });
  };

  const handleCopyKeyId = async (keyId: string) => {
    await navigator.clipboard.writeText(keyId);
    setCopiedId(keyId);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const handleCopyCreatedKey = async () => {
    if (!createdKey) {
      return;
    }
    await navigator.clipboard.writeText(createdKey);
    setCopiedCreatedKey(true);
    setTimeout(() => setCopiedCreatedKey(false), 2000);
  };

  return (
    <div className="flex flex-1 items-center justify-center p-4">
      <Card className="w-full max-w-2xl">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Icons.key className="size-5" />
            API Keys
          </CardTitle>
          <CardDescription>
            Manage your API keys for programmatic access
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Created key banner - show once after creation */}
          {createdKey && (
            <div className="rounded-md border border-yellow-500/50 bg-yellow-500/10 p-4 space-y-2">
              <p className="text-sm font-medium text-yellow-600 dark:text-yellow-400">
                API key created successfully. Copy it now -- it will not be shown again.
              </p>
              <div className="flex items-center gap-2">
                <code className="flex-1 rounded bg-muted px-3 py-2 text-sm font-mono break-all">
                  {createdKey}
                </code>
                <Button
                  variant="outline"
                  size="icon"
                  onClick={handleCopyCreatedKey}
                  className="shrink-0"
                >
                  {copiedCreatedKey
                    ? <Icons.check className="size-4 text-green-500" />
                    : <Icons.copy className="size-4" />}
                </Button>
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setCreatedKey(null)}
                className="text-xs text-muted-foreground"
              >
                Dismiss
              </Button>
            </div>
          )}

          {/* Create form */}
          {showCreateForm
            ? (
                <div className="space-y-3 rounded-md border p-4">
                  <label className="text-sm font-medium">Key Name</label>
                  <div className="flex items-center gap-2">
                    <Input
                      placeholder="e.g. Production API Key"
                      value={newKeyName}
                      onChange={e => setNewKeyName(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          handleCreate();
                        }
                      }}
                      minLength={3}
                    />
                    <Button
                      onClick={handleCreate}
                      disabled={newKeyName.length < 3 || createMutation.isPending}
                      loading={createMutation.isPending}
                      loadingText="Creating..."
                    >
                      Create
                    </Button>
                    <Button
                      variant="ghost"
                      onClick={() => {
                        setShowCreateForm(false);
                        setNewKeyName('');
                      }}
                    >
                      Cancel
                    </Button>
                  </div>
                  {newKeyName.length > 0 && newKeyName.length < 3 && (
                    <p className="text-xs text-muted-foreground">
                      Name must be at least 3 characters
                    </p>
                  )}
                </div>
              )
            : (
                <Button
                  variant="outline"
                  onClick={() => setShowCreateForm(true)}
                  startIcon={<Icons.plus />}
                >
                  Create API Key
                </Button>
              )}

          {/* API keys list */}
          {isPending
            ? (
                <div className="flex items-center justify-center py-8">
                  <Icons.loader className="size-5 animate-spin text-muted-foreground" />
                </div>
              )
            : apiKeys.length === 0
              ? (
                  <div className="py-8 text-center text-sm text-muted-foreground">
                    No API keys yet. Create one to get started.
                  </div>
                )
              : (
                  <div className="space-y-3">
                    {apiKeys.map(key => (
                      <div
                        key={key.id}
                        className="flex items-center gap-3 rounded-md border p-3"
                      >
                        <Icons.key className="size-4 shrink-0 text-muted-foreground" />
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <p className="text-sm font-medium truncate">{key.name}</p>
                            <Badge variant={key.enabled ? 'default' : 'secondary'}>
                              {key.enabled ? 'Enabled' : 'Disabled'}
                            </Badge>
                          </div>
                          <p className="text-xs text-muted-foreground">
                            Created
                            {' '}
                            {new Date(key.createdAt).toLocaleDateString()}
                            {key.lastRequest && (
                              <>
                                {' '}
                                &middot; Last used
                                {new Date(key.lastRequest).toLocaleDateString()}
                              </>
                            )}
                          </p>
                        </div>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleCopyKeyId(key.id)}
                          title="Copy Key ID"
                        >
                          {copiedId === key.id
                            ? <Icons.check className="size-4 text-green-500" />
                            : <Icons.copy className="size-4" />}
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleDelete(key.id)}
                          disabled={deleteMutation.isPending}
                          title="Delete Key"
                        >
                          <Icons.trash className="size-4 text-destructive" />
                        </Button>
                      </div>
                    ))}
                  </div>
                )}
        </CardContent>
      </Card>
    </div>
  );
}
