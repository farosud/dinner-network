import { apiClient } from "@/lib/api";

export type DinnerProfile = {
  id?: string;
  cityId: string | null;
  shortBio: string | null;
  professionalBackground: string[];
  currentGoals: string[];
  interests: string[];
  socialPreferences: Record<string, unknown>;
  conversationPreferences: Record<string, unknown>;
  availability: Record<string, unknown>;
  rawImportedText: string | null;
  approvedAt?: string | null;
  updatedAt?: string;
};

export type DinnerProfileInput = Omit<DinnerProfile, "id" | "approvedAt" | "updatedAt"> & {
  dietaryConstraints: string[];
  accessibilityNeeds: string[];
  preferredGroupSize?: number | null;
  preferredEnergy?: string | null;
  noveltyPreference?: string | null;
  approvedFields?: string[];
};

export type DinnerEnrichmentResult = {
  enriched: boolean;
  brief: string;
  sources: Array<{ title?: string; url?: string; excerpt?: string }>;
};

export const dinnerProfileService = {
  get: () => apiClient.get<{ profile: DinnerProfile | null; preferences: Record<string, unknown> | null; facts: unknown[] }>("/dinners/profile"),
  save: (input: DinnerProfileInput) => apiClient.put<{ profile: DinnerProfile; preferences: Record<string, unknown> | null; facts: unknown[] }>("/dinners/profile", input),
  remove: () => apiClient.delete<{ deleted: boolean }>("/dinners/profile"),
  research: (input: { name?: string; city?: string; linkedinUrl?: string; professionalBackground?: string[] }) => apiClient.post<DinnerEnrichmentResult>("/dinners/enrichment/research", input),
  approveEnrichment: (input: Pick<DinnerEnrichmentResult, "brief" | "sources">) => apiClient.post<{ approved: boolean }>("/dinners/enrichment/approve", input),
};
