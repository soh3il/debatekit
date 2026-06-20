import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { FieldPath, FieldValues } from 'react-hook-form';
import { useFormContext } from 'react-hook-form';
import { z } from 'zod';

import { LazyMarkdownRenderer } from '@/components/markdown/lazy-markdown-renderer';
import {
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import { Textarea } from '@/components/ui/textarea';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { useAdminSkillsQuery } from '@/hooks/queries';
import type { AdminPromptTemplate } from '@/lib/config/prompt-templates';
import { ADMIN_PROMPT_TEMPLATES } from '@/lib/config/prompt-templates';
import { cn } from '@/lib/ui';
import type { AdminSkill } from '@/services/api/admin/skills';
import { AdminSkillSchema } from '@/services/api/admin/skills';

type AutocompleteMode = 'skill' | 'template' | null;
type ViewMode = 'edit' | 'preview';

type PromptTextareaWithTemplatesProps<TFieldValues extends FieldValues = FieldValues> = {
  description?: string;
  disabled?: boolean;
  maxLength?: number;
  name: FieldPath<TFieldValues>;
  placeholder?: string;
  rows?: number;
  target?: string;
  title?: string;
};

export function PromptTextareaWithTemplates<TFieldValues extends FieldValues = FieldValues>({
  description,
  disabled,
  maxLength,
  name,
  placeholder,
  rows = 6,
  target,
  title,
}: PromptTextareaWithTemplatesProps<TFieldValues>) {
  const { control } = useFormContext<TFieldValues>();
  const [viewMode, setViewMode] = useState<ViewMode>('edit');
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [mode, setMode] = useState<AutocompleteMode>(null);
  const [query, setQuery] = useState('');
  const [selectedIndex, setSelectedIndex] = useState(0);
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);
  const triggerPosRef = useRef<number>(-1);
  const suggestionsRef = useRef<HTMLDivElement>(null);

  // Template suggestions (/ trigger)
  const templates = useMemo(
    () => target ? ADMIN_PROMPT_TEMPLATES.filter(t => t.target === target) : [],
    [target],
  );

  const filteredTemplates = useMemo(() => {
    if (!query) {
      return templates;
    }
    const q = query.toLowerCase();
    return templates.filter(
      t => t.label.toLowerCase().includes(q)
        || t.category.toLowerCase().includes(q)
        || t.description.toLowerCase().includes(q),
    );
  }, [templates, query]);

  // Skill suggestions ({ trigger)
  const { data: skillsData } = useAdminSkillsQuery();
  const skills = useMemo((): AdminSkill[] => {
    if (!skillsData || !('success' in skillsData) || !skillsData.success) {
      return [];
    }
    const parsed = z.array(AdminSkillSchema).safeParse(skillsData.data?.skills);
    return parsed.success ? parsed.data : [];
  }, [skillsData]);

  const filteredSkills = useMemo(() => {
    if (!query) {
      return skills;
    }
    const q = query.toLowerCase();
    return skills.filter(
      s => s.id.toLowerCase().includes(q)
        || s.name.toLowerCase().includes(q)
        || s.category.toLowerCase().includes(q),
    );
  }, [skills, query]);

  // Unified filtered items count for keyboard nav
  const filteredCount = mode === 'template' ? filteredTemplates.length : filteredSkills.length;

  useEffect(() => {
    setSelectedIndex(0);
  }, [filteredCount]);

  // Scroll selected item into view
  useEffect(() => {
    if (!suggestionsRef.current) {
      return;
    }
    const item = suggestionsRef.current.children.item(selectedIndex);
    if (item instanceof HTMLElement) {
      item.scrollIntoView({ block: 'nearest' });
    }
  }, [selectedIndex]);

  const closeSuggestions = useCallback(() => {
    setShowSuggestions(false);
    setMode(null);
    setQuery('');
    triggerPosRef.current = -1;
  }, []);

  const insertText = useCallback((text: string, fieldOnChange: (value: string) => void, currentValue: string) => {
    const before = currentValue.slice(0, triggerPosRef.current);
    // +1 for trigger char, +query length for typed text
    const afterTrigger = triggerPosRef.current + 1 + query.length;
    const after = currentValue.slice(afterTrigger);
    const newValue = before + text + after;
    fieldOnChange(newValue);
    closeSuggestions();

    requestAnimationFrame(() => {
      if (textareaRef.current) {
        const cursorPos = before.length + text.length;
        textareaRef.current.focus();
        textareaRef.current.setSelectionRange(cursorPos, cursorPos);
      }
    });
  }, [query, closeSuggestions]);

  const insertTemplate = useCallback((template: AdminPromptTemplate, fieldOnChange: (value: string) => void, currentValue: string) => {
    insertText(template.content, fieldOnChange, currentValue);
  }, [insertText]);

  const insertSkill = useCallback((skill: AdminSkill, fieldOnChange: (value: string) => void, currentValue: string) => {
    // Insert {skill_id} token (with closing brace)
    insertText(`{${skill.id}}`, fieldOnChange, currentValue);
  }, [insertText]);

  const handleKeyDown = useCallback((
    e: React.KeyboardEvent<HTMLTextAreaElement>,
    fieldOnChange: (value: string) => void,
    currentValue: string,
  ) => {
    if (!showSuggestions) {
      return;
    }

    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setSelectedIndex(i => Math.min(i + 1, filteredCount - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setSelectedIndex(i => Math.max(i - 1, 0));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (mode === 'template' && filteredTemplates[selectedIndex]) {
        insertTemplate(filteredTemplates[selectedIndex], fieldOnChange, currentValue);
      } else if (mode === 'skill' && filteredSkills[selectedIndex]) {
        insertSkill(filteredSkills[selectedIndex], fieldOnChange, currentValue);
      }
    } else if (e.key === 'Escape') {
      e.preventDefault();
      closeSuggestions();
    }
  }, [showSuggestions, filteredCount, mode, filteredTemplates, filteredSkills, selectedIndex, insertTemplate, insertSkill, closeSuggestions]);

  const handleChange = useCallback((
    value: string,
    fieldOnChange: (value: string) => void,
  ) => {
    fieldOnChange(value);

    const textarea = textareaRef.current;
    if (!textarea) {
      return;
    }

    const cursorPos = textarea.selectionStart;
    const textBeforeCursor = value.slice(0, cursorPos);

    // Check for '{' trigger (skill autocomplete)
    const lastBraceIndex = textBeforeCursor.lastIndexOf('{');
    if (lastBraceIndex >= 0) {
      const charBefore = lastBraceIndex === 0 ? '\n' : textBeforeCursor[lastBraceIndex - 1];
      if (charBefore === '\n' || charBefore === ' ' || charBefore === '\t' || lastBraceIndex === 0) {
        const queryText = textBeforeCursor.slice(lastBraceIndex + 1);
        // Only if no closing brace or space yet
        if (!queryText.includes('}') && !queryText.includes(' ') && !queryText.includes('\n')) {
          triggerPosRef.current = lastBraceIndex;
          setQuery(queryText);
          setMode('skill');
          setShowSuggestions(true);
          return;
        }
      }
    }

    // Check for '/' trigger (template autocomplete) — only if target is set
    if (target) {
      const lastSlashIndex = textBeforeCursor.lastIndexOf('/');
      if (lastSlashIndex >= 0) {
        const charBefore = lastSlashIndex === 0 ? '\n' : textBeforeCursor[lastSlashIndex - 1];
        if (charBefore === '\n' || charBefore === ' ' || charBefore === '\t' || lastSlashIndex === 0) {
          const queryText = textBeforeCursor.slice(lastSlashIndex + 1);
          if (!queryText.includes(' ') && !queryText.includes('\n')) {
            triggerPosRef.current = lastSlashIndex;
            setQuery(queryText);
            setMode('template');
            setShowSuggestions(true);
            return;
          }
        }
      }
    }

    closeSuggestions();
  }, [target, closeSuggestions]);

  return (
    <FormField
      control={control}
      name={name}
      render={({ field }) => (
        <FormItem className="w-full relative">
          <div className="flex items-center justify-between">
            {title ? <FormLabel>{title}</FormLabel> : <span />}
            <TooltipProvider delayDuration={400}>
              <div className="flex items-center gap-0.5 rounded-md bg-muted p-0.5">
                <Tooltip>
                  <TooltipTrigger asChild>
                    <button
                      type="button"
                      onClick={() => setViewMode('edit')}
                      className={cn(
                        'text-xs px-2 py-0.5 rounded-sm transition-colors',
                        viewMode === 'edit'
                          ? 'bg-accent text-accent-foreground'
                          : 'text-muted-foreground hover:text-foreground',
                      )}
                    >
                      Edit
                    </button>
                  </TooltipTrigger>
                  <TooltipContent side="bottom">Edit prompt text</TooltipContent>
                </Tooltip>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <button
                      type="button"
                      onClick={() => setViewMode('preview')}
                      className={cn(
                        'text-xs px-2 py-0.5 rounded-sm transition-colors',
                        viewMode === 'preview'
                          ? 'bg-accent text-accent-foreground'
                          : 'text-muted-foreground hover:text-foreground',
                      )}
                    >
                      Preview
                    </button>
                  </TooltipTrigger>
                  <TooltipContent side="bottom">Preview formatted markdown</TooltipContent>
                </Tooltip>
              </div>
            </TooltipProvider>
          </div>
          <FormControl>
            <div className="relative">
              {viewMode === 'edit'
                ? (
                    <>
                      <Textarea
                        {...field}
                        ref={(el) => {
                          textareaRef.current = el;
                          if (typeof field.ref === 'function') {
                            field.ref(el);
                          }
                        }}
                        rows={rows}
                        disabled={disabled}
                        data-testid={field.name}
                        placeholder={placeholder}
                        className="resize-none"
                        value={field.value ?? ''}
                        onChange={e => handleChange(e.target.value, field.onChange)}
                        onKeyDown={e => handleKeyDown(e, field.onChange, field.value ?? '')}
                        onBlur={() => {
                          field.onBlur();
                          setTimeout(closeSuggestions, 200);
                        }}
                      />

                      {/* Template suggestions dropdown (/ trigger) */}
                      {showSuggestions && mode === 'template' && filteredTemplates.length > 0 && (
                        <div
                          ref={suggestionsRef}
                          className="absolute left-0 right-0 z-50 mt-1 max-h-56 overflow-y-auto rounded-lg border border-white/10 bg-popover shadow-lg"
                        >
                          {filteredTemplates.map((template, index) => (
                            <button
                              key={template.id}
                              type="button"
                              className={cn(
                                'flex w-full flex-col gap-0.5 px-3 py-2 text-left text-sm transition-colors hover:bg-accent',
                                index === selectedIndex && 'bg-accent',
                              )}
                              onMouseDown={(e) => {
                                e.preventDefault();
                                insertTemplate(template, field.onChange, field.value ?? '');
                              }}
                              onMouseEnter={() => setSelectedIndex(index)}
                            >
                              <div className="flex items-center gap-2">
                                <span className="font-medium">{template.label}</span>
                                <span className="rounded bg-muted/50 px-1.5 py-0.5 text-[10px] text-muted-foreground/60">
                                  {template.category}
                                </span>
                              </div>
                              <span className="line-clamp-1 text-xs text-muted-foreground">
                                {template.description}
                              </span>
                            </button>
                          ))}
                        </div>
                      )}

                      {/* Skill suggestions dropdown ({ trigger) */}
                      {showSuggestions && mode === 'skill' && filteredSkills.length > 0 && (
                        <div
                          ref={suggestionsRef}
                          className="absolute left-0 right-0 z-50 mt-1 max-h-56 overflow-y-auto rounded-lg border border-white/10 bg-popover shadow-lg"
                        >
                          {filteredSkills.map((skill, index) => (
                            <button
                              key={skill.id}
                              type="button"
                              className={cn(
                                'flex w-full flex-col gap-0.5 px-3 py-2 text-left text-sm transition-colors hover:bg-accent',
                                index === selectedIndex && 'bg-accent',
                              )}
                              onMouseDown={(e) => {
                                e.preventDefault();
                                insertSkill(skill, field.onChange, field.value ?? '');
                              }}
                              onMouseEnter={() => setSelectedIndex(index)}
                            >
                              <div className="flex items-center gap-2">
                                <span className="font-mono text-xs text-primary/80">
                                  {`{${skill.id}}`}
                                </span>
                                <span className="font-medium">{skill.name}</span>
                                <span className="rounded bg-muted/50 px-1.5 py-0.5 text-[10px] text-muted-foreground/60">
                                  {skill.category}
                                </span>
                              </div>
                              <span className="line-clamp-1 text-xs text-muted-foreground">
                                {skill.contentPreview}
                              </span>
                            </button>
                          ))}
                        </div>
                      )}
                    </>
                  )
                : (
                    <div
                      className={cn(
                        'rounded-md border border-input bg-transparent px-3 py-2 text-sm overflow-y-auto',
                        'prose prose-sm prose-invert max-w-none',
                        !field.value && 'text-muted-foreground',
                      )}
                      style={{ minHeight: `${rows * 1.5 + 1}rem` }}
                    >
                      {field.value
                        ? <LazyMarkdownRenderer content={field.value} />
                        : (placeholder ?? 'Nothing to preview')}
                    </div>
                  )}
            </div>
          </FormControl>
          {description && (
            <FormDescription>
              {description}
              {viewMode === 'edit' && (
                <>
                  {' '}
                  <span className="text-muted-foreground/50">
                    {target ? 'Type / for templates or { for skills' : 'Type { for skills'}
                  </span>
                </>
              )}
            </FormDescription>
          )}
          <FormMessage />
          {maxLength && viewMode === 'edit' && (
            <div className={cn(
              'text-right text-[11px]',
              (field.value?.length ?? 0) > maxLength * 0.9
                ? 'text-destructive'
                : 'text-muted-foreground/50',
            )}
            >
              {field.value?.length ?? 0}
              {' / '}
              {maxLength}
            </div>
          )}
        </FormItem>
      )}
    />
  );
}
