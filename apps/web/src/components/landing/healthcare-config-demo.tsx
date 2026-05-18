'use client';

import { getRoleBadgeStyle, getRoleColors, getShortRoleName, ModelIds } from '@debatekit/shared';
import type { CSSProperties } from 'react';
import { useMemo, useState } from 'react';

import { Icons } from '@/components/icons';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { cn } from '@/lib/ui/cn';
import { getProviderIcon } from '@/lib/utils';

// ============================================================================
// PRESET DATA
// ============================================================================

const PRESETS = [
  {
    description: 'Multi-specialty differential diagnosis with evidence-based reasoning and workup planning.',
    models: [
      { modelId: ModelIds.ANTHROPIC_CLAUDE_SONNET_4, provider: 'anthropic', role: 'Primary Care Physician' },
      { modelId: ModelIds.OPENAI_GPT_4_1, provider: 'openai', role: 'Specialist Consultant' },
      { modelId: ModelIds.GOOGLE_GEMINI_2_5_PRO, provider: 'google', role: 'Pharmacist' },
      { modelId: ModelIds.X_AI_GROK_4, provider: 'xai', role: 'Evidence Reviewer' },
    ],
    name: 'Differential Diagnosis',
  },
  {
    description: 'Treatment protocol evaluation, guideline concordance, and patient-specific therapy planning.',
    models: [
      { modelId: ModelIds.ANTHROPIC_CLAUDE_SONNET_4, provider: 'anthropic', role: 'Treating Physician' },
      { modelId: ModelIds.OPENAI_GPT_4_1, provider: 'openai', role: 'Clinical Pharmacist' },
      { modelId: ModelIds.GOOGLE_GEMINI_2_5_PRO, provider: 'google', role: 'Guidelines Specialist' },
    ],
    name: 'Treatment Planning',
  },
  {
    description: 'Comprehensive medication review, interaction checking, and polypharmacy risk assessment.',
    models: [
      { modelId: ModelIds.ANTHROPIC_CLAUDE_SONNET_4, provider: 'anthropic', role: 'Clinical Pharmacist' },
      { modelId: ModelIds.OPENAI_GPT_4_1, provider: 'openai', role: 'Drug Safety Reviewer' },
      { modelId: ModelIds.GOOGLE_GEMINI_2_5_PRO, provider: 'google', role: 'Interaction Analyst' },
      { modelId: ModelIds.X_AI_GROK_4, provider: 'xai', role: 'Literature Reviewer' },
    ],
    name: 'Drug Interaction Review',
  },
  {
    description: 'Virtual tumor board or clinical case conference with multi-specialty deliberation.',
    models: [
      { modelId: ModelIds.ANTHROPIC_CLAUDE_SONNET_4, provider: 'anthropic', role: 'Oncologist' },
      { modelId: ModelIds.OPENAI_GPT_4_1, provider: 'openai', role: 'Radiologist' },
      { modelId: ModelIds.GOOGLE_GEMINI_2_5_PRO, provider: 'google', role: 'Pathologist' },
      { modelId: ModelIds.X_AI_GROK_4, provider: 'xai', role: 'Surgical Consultant' },
    ],
    name: 'Clinical Case Conference',
  },
] as const;

// ============================================================================
// BUILDER DATA
// ============================================================================

const BUILDER_MODELS = [
  { description: 'Anthropic · Advanced reasoning & analysis', enabled: true, modelId: ModelIds.ANTHROPIC_CLAUDE_SONNET_4, name: 'Claude Sonnet 4', provider: 'anthropic', role: 'Primary Care Physician' },
  { description: 'OpenAI · General-purpose intelligence', enabled: true, modelId: ModelIds.OPENAI_GPT_4_1, name: 'GPT-4.1', provider: 'openai', role: 'Specialist Consultant' },
  { description: 'Google · Multimodal reasoning', enabled: true, modelId: ModelIds.GOOGLE_GEMINI_2_5_PRO, name: 'Gemini 2.5 Pro', provider: 'google', role: 'Pharmacist' },
  { description: 'xAI · Real-time knowledge', enabled: true, modelId: ModelIds.X_AI_GROK_4, name: 'Grok 4', provider: 'xai', role: 'Evidence Reviewer' },
  { description: 'DeepSeek · Cost-efficient reasoning', enabled: false, modelId: ModelIds.DEEPSEEK_DEEPSEEK_V3_2, name: 'DeepSeek V3', provider: 'deepseek', role: null },
  { description: 'Mistral AI · European open-weight model', enabled: false, modelId: ModelIds.MISTRALAI_MISTRAL_LARGE_2512, name: 'Mistral Large', provider: 'mistralai', role: null },
] as const;

const ENABLED_COUNT = BUILDER_MODELS.filter(m => m.enabled).length;
const TOTAL_COUNT = BUILDER_MODELS.length + 2;

// ============================================================================
// SUB-COMPONENTS
// ============================================================================

/** Matches the real ModelAvatarWithRole layout: vertical avatar + colored role name */
function DemoModelAvatarWithRole({ provider, role }: { provider: string; role: string }) {
  const shortRole = getShortRoleName(role);
  const roleColors = useMemo(() => getRoleColors(shortRole), [shortRole]);
  const cssVars = useMemo(() => ({
    '--role-icon-color': roleColors.iconColor,
  } as CSSProperties), [roleColors]);

  return (
    <div className="flex flex-col items-center gap-1.5 shrink-0" style={cssVars}>
      <Avatar className="size-8 bg-card">
        <AvatarImage
          src={getProviderIcon(provider)}
          alt={provider}
          className="object-contain p-1"
        />
        <AvatarFallback className="text-[11px] bg-card font-semibold">
          {provider.slice(0, 2).toUpperCase()}
        </AvatarFallback>
      </Avatar>
      <span className="text-[11px] font-medium leading-tight text-[var(--role-icon-color)] truncate max-w-[5.5rem] text-center">
        {shortRole}
      </span>
    </div>
  );
}

/** Matches the real ModelPresetCard layout */
function PresetCard({ isSelected, preset }: {
  preset: typeof PRESETS[number];
  isSelected: boolean;
}) {
  return (
    <div
      className={cn(
        'relative flex flex-col p-4 rounded-2xl text-left w-full',
        'bg-card border transition-colors cursor-pointer',
        !isSelected && 'border-border/50 hover:bg-white/[0.07] hover:border-border',
        isSelected && 'bg-white/10 border-white/20',
      )}
    >
      <h3 className="text-base font-semibold text-foreground leading-tight truncate mb-3">
        {preset.name}
      </h3>

      {/* Horizontal model avatars — matches real ModelPresetCard scroll area */}
      <div className="flex items-start gap-3 mb-3">
        {preset.models.map(m => (
          <DemoModelAvatarWithRole
            key={m.modelId}
            provider={m.provider}
            role={m.role}
          />
        ))}
      </div>

      <p className="text-xs text-muted-foreground leading-relaxed line-clamp-2">
        {preset.description}
      </p>
    </div>
  );
}

function PresetsTab() {
  const [selectedIndex, setSelectedIndex] = useState(0);

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 p-4 sm:p-6">
      {PRESETS.map((preset, i) => (
        <div key={preset.name} onClick={() => setSelectedIndex(i)}>
          <PresetCard preset={preset} isSelected={i === selectedIndex} />
        </div>
      ))}
    </div>
  );
}

/** Matches the real ModelItem layout */
function BuildCustomTab() {
  return (
    <div className="bg-background">
      {/* Search bar — matches real Input with startIcon */}
      <div className="px-4 sm:px-6 pt-4 pb-3 space-y-3">
        <div className="flex items-center h-9 rounded-md border border-border/50 bg-transparent px-3 gap-2">
          <Icons.search className="size-4 text-muted-foreground shrink-0" />
          <span className="text-sm text-muted-foreground flex-1">Search models...</span>
        </div>
        <div className="flex items-center justify-end">
          <span className="text-xs font-medium text-muted-foreground tabular-nums">
            {ENABLED_COUNT}
            /
            {TOTAL_COUNT}
          </span>
        </div>
      </div>

      {/* Model rows — matches real ModelItem layout */}
      <div className="flex flex-col gap-2 px-4 sm:px-6 pb-4">
        {BUILDER_MODELS.map(model => (
          <div
            key={model.modelId}
            className={cn(
              'p-3 sm:p-4 w-full rounded-xl',
              'transition-[background-color] duration-150',
              model.enabled && 'hover:bg-white/[0.07]',
              !model.enabled && 'opacity-50',
            )}
          >
            <div className="flex items-center gap-3 w-full min-w-0">
              {/* Grip handle */}
              <div className="shrink-0 text-muted-foreground p-1 -m-1">
                <Icons.gripVertical className="size-4 sm:size-5" />
              </div>

              {/* Provider avatar + info */}
              <div className="flex items-center gap-3 flex-1 min-w-0 overflow-hidden">
                <Avatar className="size-9 sm:size-10 shrink-0">
                  <AvatarImage
                    src={getProviderIcon(model.provider)}
                    alt={model.provider}
                    className="object-contain p-1"
                  />
                  <AvatarFallback className="text-[10px] sm:text-xs">
                    {model.name.slice(0, 2).toUpperCase()}
                  </AvatarFallback>
                </Avatar>
                <div className="flex-1 min-w-0 overflow-hidden space-y-0.5 sm:space-y-1">
                  <div className="flex items-center gap-1.5 sm:gap-2 min-w-0 overflow-hidden">
                    <span className="text-xs sm:text-sm font-semibold truncate min-w-0">{model.name}</span>
                    {model.role
                      ? (
                          <Badge
                            className="text-[10px] sm:text-xs px-1.5 sm:px-2 py-0.5 h-4 sm:h-5 font-semibold border rounded-full shrink-0"
                            style={getRoleBadgeStyle(getShortRoleName(model.role))}
                          >
                            <span className="truncate">{model.role}</span>
                          </Badge>
                        )
                      : (
                          <span className="inline-flex items-center gap-1 h-5 px-2 rounded-full text-[10px] sm:text-xs font-medium border border-dashed border-muted-foreground/40 text-muted-foreground shrink-0">
                            <Icons.plus className="size-2.5" />
                            Role
                          </span>
                        )}
                  </div>
                  <div className="text-[10px] sm:text-xs text-muted-foreground truncate w-full min-w-0">
                    {model.description}
                  </div>
                </div>
              </div>

              {/* Toggle */}
              <Switch checked={model.enabled} disabled className="shrink-0" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ============================================================================
// MAIN COMPONENT
// ============================================================================

type Tab = 'presets' | 'custom';

export function HealthcareConfigDemo() {
  const [activeTab, setActiveTab] = useState<Tab>('presets');

  return (
    <div className="bg-background">
      {/* Tab bar — matches real TabsList: bg-muted rounded-lg p-1, grid-cols-2 */}
      <div className="px-4 sm:px-6 pt-4">
        <div className="inline-flex h-9 items-center justify-center rounded-lg bg-muted p-1 text-muted-foreground w-full">
          <button
            type="button"
            onClick={() => setActiveTab('presets')}
            className={cn(
              'inline-flex items-center justify-center whitespace-nowrap rounded-md px-3 py-1 text-sm font-medium transition-all flex-1',
              activeTab === 'presets'
                ? 'bg-background text-foreground shadow'
                : 'text-muted-foreground hover:text-foreground',
            )}
          >
            Presets
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('custom')}
            className={cn(
              'inline-flex items-center justify-center whitespace-nowrap rounded-md px-3 py-1 text-sm font-medium transition-all flex-1',
              activeTab === 'custom'
                ? 'bg-background text-foreground shadow'
                : 'text-muted-foreground hover:text-foreground',
            )}
          >
            Build Custom
          </button>
        </div>
      </div>

      {/* Tab content */}
      {activeTab === 'presets' ? <PresetsTab /> : <BuildCustomTab />}
    </div>
  );
}
