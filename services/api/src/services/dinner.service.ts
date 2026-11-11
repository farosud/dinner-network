import { db, eq, schema } from '../adapters/database.shared';

export type DinnerProfileInput = {
  cityId?: string | null;
  shortBio?: string | null;
  professionalBackground: string[];
  currentGoals: string[];
  interests: string[];
  socialPreferences: Record<string, unknown>;
  conversationPreferences: Record<string, unknown>;
  availability: Record<string, unknown>;
  rawImportedText?: string | null;
  dietaryConstraints: string[];
  accessibilityNeeds: string[];
  preferredGroupSize?: number | null;
  preferredEnergy?: string | null;
  noveltyPreference?: string | null;
  approvedFields: string[];
};

function toProfileResponse(profile: typeof schema.dinnerProfiles.$inferSelect | null, preferences: typeof schema.dinnerPreferences.$inferSelect | null, facts: typeof schema.dinnerProfileFacts.$inferSelect[]) {
  if (!profile) return { profile: null, preferences: null, facts: [] };
  return {
    profile: {
      id: profile.id,
      cityId: profile.cityId,
      shortBio: profile.shortBio,
      professionalBackground: profile.professionalBackground ?? [],
      currentGoals: profile.currentGoals ?? [],
      interests: profile.interests ?? [],
      socialPreferences: profile.socialPreferences ?? {},
      conversationPreferences: profile.conversationPreferences ?? {},
      availability: profile.availability ?? {},
      rawImportedText: profile.rawImportedText,
      approvedAt: profile.approvedAt?.toISOString() ?? null,
      updatedAt: profile.updatedAt.toISOString(),
    },
    preferences: preferences ? {
      preferredGroupSize: preferences.preferredGroupSize,
      preferredEnergy: preferences.preferredEnergy,
      noveltyPreference: preferences.noveltyPreference,
      dietaryConstraints: preferences.dietaryConstraints ?? [],
      accessibilityNeeds: preferences.accessibilityNeeds ?? [],
      poolPreferences: preferences.poolPreferences ?? {},
    } : null,
    facts: facts.map((fact) => ({
      id: fact.id,
      fieldName: fact.fieldName,
      value: fact.value,
      provenance: fact.provenance,
      sourceUrl: fact.sourceUrl,
      approvedAt: fact.approvedAt?.toISOString() ?? null,
    })),
  };
}

export const dinnerService = {
  async getProfile(userId: string) {
    const [profile] = await db.select().from(schema.dinnerProfiles).where(eq(schema.dinnerProfiles.userId, userId)).limit(1);
    if (!profile) return toProfileResponse(null, null, []);
    const [preferences] = await db.select().from(schema.dinnerPreferences).where(eq(schema.dinnerPreferences.userId, userId)).limit(1);
    const facts = await db.select().from(schema.dinnerProfileFacts).where(eq(schema.dinnerProfileFacts.profileId, profile.id));
    return toProfileResponse(profile, preferences ?? null, facts);
  },

  async saveProfile(userId: string, body: DinnerProfileInput) {
    const now = new Date();
    let cityId = body.cityId ?? null;
    if (cityId) {
      const [byId] = await db.select({ id: schema.dinnerCities.id }).from(schema.dinnerCities).where(eq(schema.dinnerCities.id, cityId)).limit(1);
      if (!byId) {
        const [byName] = await db.select({ id: schema.dinnerCities.id }).from(schema.dinnerCities).where(eq(schema.dinnerCities.name, cityId)).limit(1);
        if (byName) cityId = byName.id;
        else {
          const [created] = await db.insert(schema.dinnerCities).values({ name: cityId, country: 'Unknown', timezone: 'UTC' }).returning({ id: schema.dinnerCities.id });
          cityId = created?.id ?? null;
        }
      }
    }
    const [existing] = await db.select().from(schema.dinnerProfiles).where(eq(schema.dinnerProfiles.userId, userId)).limit(1);
    const profile = existing
      ? (await db.update(schema.dinnerProfiles).set({
        cityId,
        shortBio: body.shortBio ?? null,
        professionalBackground: body.professionalBackground,
        currentGoals: body.currentGoals,
        interests: body.interests,
        socialPreferences: body.socialPreferences,
        conversationPreferences: body.conversationPreferences,
        availability: body.availability,
        rawImportedText: body.rawImportedText ?? null,
        approvedAt: now,
        updatedAt: now,
      }).where(eq(schema.dinnerProfiles.id, existing.id)).returning())[0]
      : (await db.insert(schema.dinnerProfiles).values({
        userId,
        cityId,
        shortBio: body.shortBio ?? null,
        professionalBackground: body.professionalBackground,
        currentGoals: body.currentGoals,
        interests: body.interests,
        socialPreferences: body.socialPreferences,
        conversationPreferences: body.conversationPreferences,
        availability: body.availability,
        rawImportedText: body.rawImportedText ?? null,
        approvedAt: now,
        updatedAt: now,
      }).returning())[0];

    if (!profile) throw new Error('Unable to save dinner profile');
    const [preferences] = await db.select().from(schema.dinnerPreferences).where(eq(schema.dinnerPreferences.userId, userId)).limit(1);
    const preferenceValues = {
      userId,
      preferredGroupSize: body.preferredGroupSize ?? 5,
      preferredEnergy: body.preferredEnergy ?? null,
      noveltyPreference: body.noveltyPreference ?? null,
      dietaryConstraints: body.dietaryConstraints,
      accessibilityNeeds: body.accessibilityNeeds,
      updatedAt: now,
    };
    const savedPreferences = preferences
      ? (await db.update(schema.dinnerPreferences).set(preferenceValues).where(eq(schema.dinnerPreferences.id, preferences.id)).returning())[0]
      : (await db.insert(schema.dinnerPreferences).values(preferenceValues).returning())[0];

    await db.delete(schema.dinnerProfileFacts).where(eq(schema.dinnerProfileFacts.profileId, profile.id));
    if (body.approvedFields.length > 0) {
      await db.insert(schema.dinnerProfileFacts).values(body.approvedFields.map((fieldName) => ({
        profileId: profile.id,
        fieldName,
        value: { approved: true },
        provenance: body.rawImportedText ? 'assistant_imported' as const : 'user_entered' as const,
        approvedAt: now,
      })));
    }
    return toProfileResponse(profile, savedPreferences ?? null, []);
  },

  async deleteProfile(userId: string) {
    await db.delete(schema.dinnerPreferences).where(eq(schema.dinnerPreferences.userId, userId));
    await db.delete(schema.dinnerProfiles).where(eq(schema.dinnerProfiles.userId, userId));
  },

};
