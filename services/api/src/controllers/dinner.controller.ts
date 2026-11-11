import { z } from 'zod';

import { AuthGuard, type AuthenticatedUser } from '../guards/auth.guard';
import { Controller, Delete, Get, Put, UseGuards } from '../lib/router/router.decorators';
import { dinnerService } from '../services/dinner.service';

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

@Controller('/dinners')
export class DinnerController {
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
