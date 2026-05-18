/**
 * Model Preferences Store
 *
 * Cookie-persisted user preferences for model selection.
 * Uses custom store with persist middleware (replaces zustand/immer/devtools).
 */

import { z } from 'zod';

import { MIN_PARTICIPANTS_REQUIRED } from '@/lib/config';
import { createStore } from '@/lib/store';
import { withPersist } from '@/lib/store/persist';
import { rlog } from '@/lib/utils/dev-logger';

// ============================================================================
// CONSTANTS
// ============================================================================

/** Cookie name for preferences storage */
export const PREFERENCES_COOKIE_NAME = 'model-preferences';

/** Cookie max age: 30 days */
const COOKIE_MAX_AGE = 30 * 24 * 60 * 60;

// ============================================================================
// COOKIE STORAGE ADAPTER
// ============================================================================

const cookieStorage = {
  getItem: (name: string): string | null => {
    if (typeof document === 'undefined') {
      return null;
    }
    const cookies = document.cookie.split(';');
    for (const cookie of cookies) {
      const [key, value] = cookie.trim().split('=');
      if (key === name && value) {
        try {
          return decodeURIComponent(value);
        } catch (error) {
          rlog.stuck('cookie-storage', `decode-failed: ${error instanceof Error ? error.message : String(error)}`);
          return null;
        }
      }
    }
    return null;
  },

  removeItem: (name: string): void => {
    if (typeof document === 'undefined') {
      return;
    }
    document.cookie = `${name}=; path=/; max-age=0`;
  },

  setItem: (name: string, value: string): void => {
    if (typeof document === 'undefined') {
      return;
    }
    const encodedValue = encodeURIComponent(value);
    document.cookie = `${name}=${encodedValue}; path=/; max-age=${COOKIE_MAX_AGE}; SameSite=Lax`;
  },
};

// ============================================================================
// STATE TYPES (Zod-First Pattern)
// ============================================================================

const ModelPreferencesStateSchema = z.object({
  _hasHydrated: z.boolean(),
  enableWebSearch: z.boolean(),
  modelOrder: z.array(z.string()),
  selectedMode: z.string().nullable(),
  selectedModelIds: z.array(z.string()),
});

const ModelPreferencesActionsSchema = z.object({
  getInitialModelIds: z.custom<(accessibleModelIds: string[]) => string[]>(),
  setEnableWebSearch: z.custom<(enabled: boolean) => void>(),
  setHasHydrated: z.custom<(state: boolean) => void>(),
  setModelOrder: z.custom<(order: string[]) => void>(),
  setSelectedMode: z.custom<(mode: string | null) => void>(),
  setSelectedModelIds: z.custom<(ids: string[]) => void>(),
  syncWithAccessibleModels: z.custom<(accessibleModelIds: string[]) => void>(),
  toggleModel: z.custom<(modelId: string) => boolean>(),
});

const _ModelPreferencesStoreSchema = z.intersection(
  ModelPreferencesStateSchema,
  ModelPreferencesActionsSchema,
);

export type ModelPreferencesState = z.infer<typeof ModelPreferencesStateSchema>;
export type ModelPreferencesActions = z.infer<typeof ModelPreferencesActionsSchema>;
export type ModelPreferencesStore = z.infer<typeof _ModelPreferencesStoreSchema>;

/**
 * Persisted state schema (what gets saved to cookie)
 */
const PersistedModelPreferencesSchema = z.object({
  enableWebSearch: z.boolean(),
  modelOrder: z.array(z.string()),
  selectedMode: z.string().nullable(),
  selectedModelIds: z.array(z.string()),
});

export type PersistedModelPreferences = z.infer<typeof PersistedModelPreferencesSchema>;

// ============================================================================
// DEFAULT STATE
// ============================================================================

export const defaultInitState: ModelPreferencesState = {
  _hasHydrated: false,
  enableWebSearch: false,
  modelOrder: [],
  selectedMode: null,
  selectedModelIds: [],
};

// ============================================================================
// INIT FUNCTION
// ============================================================================

export function initPreferencesStore(
  serverState?: ModelPreferencesState | null,
): ModelPreferencesState {
  if (serverState) {
    return {
      ...defaultInitState,
      ...serverState,
      _hasHydrated: true,
    };
  }
  return defaultInitState;
}

// ============================================================================
// COOKIE DATA VALIDATION SCHEMA
// ============================================================================

const CookieDataSchema = z.object({
  state: z.object({
    enableWebSearch: z.boolean().optional(),
    modelOrder: z.array(z.string()).optional(),
    selectedMode: z.string().nullable().optional(),
    selectedModelIds: z.array(z.string()).optional(),
  }).optional(),
  version: z.number().optional(),
});

// ============================================================================
// SERVER-SIDE COOKIE PARSER
// ============================================================================

export function parsePreferencesCookie(
  cookieValue: string | undefined,
): ModelPreferencesState | null {
  if (!cookieValue) {
    return null;
  }

  try {
    const decoded = decodeURIComponent(cookieValue);
    const parsed = JSON.parse(decoded);

    const result = CookieDataSchema.safeParse(parsed);

    if (!result.success) {
      return null;
    }

    const { data } = result;

    if (data?.state) {
      return {
        _hasHydrated: true,
        enableWebSearch: data.state.enableWebSearch ?? false,
        modelOrder: data.state.modelOrder ?? [],
        selectedMode: data.state.selectedMode ?? null,
        selectedModelIds: data.state.selectedModelIds ?? [],
      };
    }

    return null;
  } catch (error) {
    rlog.stuck('preferences-cookie', `parse-failed: ${error instanceof Error ? error.message : String(error)}`);
    return null;
  }
}

// ============================================================================
// STORE FACTORY
// ============================================================================

export function createModelPreferencesStore(
  initState: ModelPreferencesState = defaultInitState,
) {
  return createStore<ModelPreferencesStore>(
    withPersist(
      (set, get) => ({
        ...initState,

        getInitialModelIds: (accessibleModelIds: string[]): string[] => {
          const state = get();

          if (state.selectedModelIds.length > 0) {
            const validPersistedIds = state.selectedModelIds.filter((id: string) =>
              accessibleModelIds.includes(id),
            );
            if (validPersistedIds.length > 0) {
              if (validPersistedIds.length !== state.selectedModelIds.length) {
                set({ selectedModelIds: validPersistedIds }, false, 'preferences/cleanupInvalidModels');
              }
              return validPersistedIds;
            }
          }

          const defaultIds = accessibleModelIds.slice(0, MIN_PARTICIPANTS_REQUIRED);
          if (defaultIds.length > 0) {
            set({ selectedModelIds: defaultIds }, false, 'preferences/setDefaultModelIds');
          }
          return defaultIds;
        },

        setEnableWebSearch: (enabled: boolean) =>
          set({ enableWebSearch: enabled }, false, 'preferences/setEnableWebSearch'),

        setHasHydrated: (hydrated: boolean) =>
          set({ _hasHydrated: hydrated }, false, 'preferences/setHasHydrated'),

        setModelOrder: (order: string[]) =>
          set({ modelOrder: order }, false, 'preferences/setModelOrder'),

        setSelectedMode: (mode: string | null) =>
          set({ selectedMode: mode }, false, 'preferences/setSelectedMode'),

        setSelectedModelIds: (ids: string[]) => {
          if (ids.length === 0) {
            return;
          }
          set({ selectedModelIds: ids }, false, 'preferences/setSelectedModelIds');
        },

        syncWithAccessibleModels: (accessibleModelIds: string[]): void => {
          const state = get();
          const accessibleSet = new Set(accessibleModelIds);

          const validSelectedIds = state.selectedModelIds.filter((id: string) =>
            accessibleSet.has(id),
          );

          const validOrder = state.modelOrder.filter((id: string) =>
            accessibleSet.has(id),
          );

          const validOrderSet = new Set(validOrder);
          const newModels = accessibleModelIds.filter(id =>
            !validOrderSet.has(id),
          );
          const updatedOrder = [...validOrder, ...newModels];

          const selectionChanged = validSelectedIds.length !== state.selectedModelIds.length;
          const orderChanged = updatedOrder.length !== state.modelOrder.length
            || !updatedOrder.every((id, i) => state.modelOrder[i] === id);

          if (selectionChanged || orderChanged) {
            set({
              ...(selectionChanged ? { selectedModelIds: validSelectedIds } : {}),
              ...(orderChanged ? { modelOrder: updatedOrder } : {}),
            }, false, 'preferences/syncWithAccessibleModels');
          }
        },

        toggleModel: (modelId: string): boolean => {
          const state = get();
          const idx = state.selectedModelIds.indexOf(modelId);

          if (idx !== -1) {
            if (state.selectedModelIds.length <= 1) {
              return false;
            }
            set({
              selectedModelIds: state.selectedModelIds.filter((_, i) => i !== idx),
            }, false, 'preferences/toggleModel/remove');
          } else {
            set({
              selectedModelIds: [...state.selectedModelIds, modelId],
            }, false, 'preferences/toggleModel/add');
          }
          return true;
        },
      }),
      {
        merge: (persistedState, currentState) => {
          const result = PersistedModelPreferencesSchema.safeParse(persistedState);
          if (!result.success) {
            return currentState;
          }
          return {
            ...currentState,
            ...result.data,
          };
        },
        name: PREFERENCES_COOKIE_NAME,
        onRehydrateStorage: () => (state) => {
          state?.setHasHydrated(true);
        },
        partialize: (state): PersistedModelPreferences => ({
          enableWebSearch: state.enableWebSearch,
          modelOrder: state.modelOrder,
          selectedMode: state.selectedMode,
          selectedModelIds: state.selectedModelIds,
        }),
        skipHydration: true,
        storage: {
          getItem: (name) => {
            const value = cookieStorage.getItem(name);
            if (!value) {
              return null;
            }
            const parsed = JSON.parse(value);
            const result = PersistedModelPreferencesSchema.safeParse(parsed?.state);
            if (!result.success) {
              return null;
            }
            return { state: result.data, version: parsed?.version ?? 0 };
          },
          removeItem: (name) => {
            cookieStorage.removeItem(name);
          },
          setItem: (name, value) => {
            cookieStorage.setItem(name, JSON.stringify(value));
          },
        },
      },
    ),
  );
}

// ============================================================================
// STORE API TYPE
// ============================================================================

export type ModelPreferencesStoreApi = ReturnType<typeof createModelPreferencesStore>;
