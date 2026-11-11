import { and, db, eq, schema } from '../adapters/database.shared';

type ResearchInput = {
  name?: string;
  city?: string;
  linkedinUrl?: string;
  professionalBackground?: string[];
};

type ExaResult = { title?: string; url?: string; text?: string; highlights?: string[] };

function cleanText(value: unknown, max = 1800) {
  return typeof value === 'string' ? value.replace(/\s+/g, ' ').trim().slice(0, max) : '';
}

function buildQuery(input: ResearchInput) {
  const parts = ['public professional profile'];
  if (input.name?.trim()) parts.push(`person named ${input.name.trim()}`);
  if (input.city?.trim()) parts.push(`in ${input.city.trim()}`);
  if (input.linkedinUrl?.trim()) parts.push(`LinkedIn profile ${input.linkedinUrl.trim()}`);
  if (input.professionalBackground?.length) parts.push(`background in ${input.professionalBackground.join(', ')}`);
  return parts.join(' ');
}

async function searchExa(input: ResearchInput): Promise<ExaResult[]> {
  const apiKey = process.env.EXA_API_KEY;
  if (!apiKey) throw new Error('Exa enrichment is not configured yet.');

  const response = await fetch('https://api.exa.ai/search', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-api-key': apiKey },
    body: JSON.stringify({
      query: buildQuery(input),
      includeDomains: ['exa.ai/library/person'],
      numResults: 5,
      contents: { text: true, highlights: { maxCharacters: 1200 } },
    }),
  });

  if (response.status === 402) throw new Error('Exa search needs an active paid plan or credits.');
  if (!response.ok) throw new Error(`Exa search failed (${response.status}).`);
  const body = await response.json() as { results?: ExaResult[] };
  return (body.results ?? []).filter((result) => result.url || result.title);
}

async function summarize(input: ResearchInput, results: ExaResult[]) {
  const apiKey = process.env.OPENROUTER_API_KEY;
  const evidence = results.map((result, index) => `${index + 1}. ${cleanText(result.title, 200)}\nURL: ${result.url ?? ''}\n${cleanText(result.text || result.highlights?.join(' '))}`).join('\n\n');
  if (!apiKey || !evidence) return results.length ? 'We found public professional sources, but could not generate a brief yet. Review the sources below.' : 'We could not confidently find a public professional profile yet.';

  const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
    body: JSON.stringify({
      model: process.env.CHAT_MODEL || 'openai/gpt-4o-mini',
      temperature: 0.2,
      messages: [
        { role: 'system', content: 'Write a careful, concise private profile brief for dinner matching. Use only the supplied public evidence. Separate facts from reasonable, clearly labeled inferences. Never include email addresses, phone numbers, exact home addresses, sensitive personal data, or anything not supported by the sources. Return 2 short paragraphs and 3 bullets: likely interests, conversation openings, and confidence/caveats.' },
        { role: 'user', content: `Person hints: ${JSON.stringify(input)}\n\nPublic evidence:\n${evidence}` },
      ],
    }),
  });
  if (!response.ok) return 'We found public sources, but the brief could not be generated. Review the sources below.';
  const body = await response.json() as { choices?: Array<{ message?: { content?: string } }> };
  return cleanText(body.choices?.[0]?.message?.content, 5000) || 'We found public sources, but the brief was empty. Review the sources below.';
}

export const dinnerEnrichmentService = {
  async research(userId: string, input: ResearchInput) {
    void userId;
    const results = await searchExa(input);
    const brief = await summarize(input, results);
    return {
      enriched: results.length > 0,
      brief,
      sources: results.map((result) => ({ title: cleanText(result.title, 200), url: result.url, excerpt: cleanText(result.text || result.highlights?.join(' '), 500) })),
    };
  },

  async approve(userId: string, payload: { brief: string; sources: Array<{ title?: string; url?: string; excerpt?: string }> }) {
    const [profile] = await db.select().from(schema.dinnerProfiles).where(eq(schema.dinnerProfiles.userId, userId)).limit(1);
    if (!profile) throw new Error('Create a dinner profile before approving web enrichment.');
    await db.delete(schema.dinnerProfileFacts).where(and(eq(schema.dinnerProfileFacts.profileId, profile.id), eq(schema.dinnerProfileFacts.fieldName, 'web_enrichment')));
    await db.insert(schema.dinnerProfileFacts).values({
      profileId: profile.id,
      fieldName: 'web_enrichment',
      value: payload,
      provenance: 'web_enriched',
      sourceUrl: payload.sources.find((source) => source.url)?.url ?? null,
      approvedAt: new Date(),
    });
    return { approved: true };
  },
};
