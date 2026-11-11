import { z } from 'zod';

import { AuthGuard, type AuthenticatedUser } from '../guards/auth.guard';
import { Controller, Delete, Get, Post, Put, UseGuards } from '../lib/router/router.decorators';
import { dinnerService } from '../services/dinner.service';
import { dinnerEnrichmentService } from '../services/dinner-enrichment.service';

const stringArray = z.array(z.string().trim().min(1)).max(100).default([]);
const profileBodySchema = z.object({
  cityId: z.string().trim().min(1).nullable().optional(),
  shortBio: z.string().trim().max(2000).nullable().optional(),
  professionalBackground: stringArray,
  currentGoals: stringArray,
  interests: stringArray,
  socialPreferences: z.record(z.string(), z.unknown()).default({}),
  conversationPreferences: z.record(z.string(), z.unknown()).default({}),
  availability: z.record(z.string(), z.unknown()).default({}),
  rawImportedText: z.string().max(30000).nullable().optional(),
  dietaryConstraints: stringArray,
  accessibilityNeeds: stringArray,
  preferredGroupSize: z.number().int().min(4).max(6).nullable().optional(),
  preferredEnergy: z.string().trim().max(100).nullable().optional(),
  noveltyPreference: z.string().trim().max(100).nullable().optional(),
  approvedFields: z.array(z.string()).max(100).default([]),
}).strict();

const researchBodySchema = z.object({
  name: z.string().trim().max(200).optional(),
  city: z.string().trim().max(200).optional(),
  linkedinUrl: z.string().url().max(500).optional().or(z.literal('')),
  professionalBackground: z.array(z.string().trim().min(1)).max(30).default([]),
}).strict();

const approvalBodySchema = z.object({
  brief: z.string().trim().min(1).max(10000),
  sources: z.array(z.object({ title: z.string().max(300).optional(), url: z.string().url().max(1000).optional(), excerpt: z.string().max(1000).optional() })).max(20),
}).strict();

@Controller('/dinners')
export class DinnerController {
  @Post('/enrichment/research')
  @UseGuards(AuthGuard)
  async research(req: Request, user: AuthenticatedUser) {
    const parsed = researchBodySchema.safeParse(await req.json().catch(() => ({})));
    if (!parsed.success) return Response.json({ error: 'Invalid enrichment research payload' }, { status: 400 });
    try {
      return Response.json(await dinnerEnrichmentService.research(user.id, parsed.data));
    } catch (error) {
      return Response.json({ error: error instanceof Error ? error.message : 'Enrichment research failed' }, { status: 502 });
    }
  }

  @Post('/enrichment/approve')
  @UseGuards(AuthGuard)
  async approveEnrichment(req: Request, user: AuthenticatedUser) {
    const parsed = approvalBodySchema.safeParse(await req.json().catch(() => ({})));
    if (!parsed.success) return Response.json({ error: 'Invalid enrichment approval payload' }, { status: 400 });
    await dinnerEnrichmentService.approve(user.id, parsed.data);
    return Response.json({ approved: true });
  }

  @Get('/profile')
  @UseGuards(AuthGuard)
  async getProfile(_req: Request, user: AuthenticatedUser) {
    return dinnerService.getProfile(user.id);
  }

  @Put('/profile')
  @UseGuards(AuthGuard)
  async saveProfile(req: Request, user: AuthenticatedUser) {
    const parsed = profileBodySchema.safeParse(await req.json().catch(() => ({})));
    if (!parsed.success) return Response.json({ error: 'Invalid dinner profile payload', details: parsed.error.flatten() }, { status: 400 });
    return dinnerService.saveProfile(user.id, parsed.data);
  }

  @Delete('/profile')
  @UseGuards(AuthGuard)
  async deleteProfile(_req: Request, user: AuthenticatedUser) {
    await dinnerService.deleteProfile(user.id);
    return Response.json({ deleted: true });
  }
}
