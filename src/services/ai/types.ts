import type { BodyKey } from '../../data/bodies';

/** How much the listener wants to be told. Drives both text and speech. */
export type GuideLevel = 'explorer' | 'student' | 'expert';

export const GUIDE_LEVELS: readonly GuideLevel[] = ['explorer', 'student', 'expert'];

export const LEVEL_LABEL: Record<GuideLevel, string> = {
  explorer: 'Explorer',
  student: 'Student',
  expert: 'Expert',
};

export const LEVEL_HINT: Record<GuideLevel, string> = {
  explorer: 'Plain language, no jargon',
  student: 'Adds the mechanism and the numbers',
  expert: 'Orbital elements and physical detail',
};

/** One exchange in the conversation about the currently selected body. */
export interface GuideTurn {
  readonly role: 'user' | 'guide';
  readonly text: string;
}

export interface GuideReply {
  readonly text: string;
  /** Which provider answered — surfaced in the UI so nothing is pretended. */
  readonly source: 'local' | 'remote';
}

export interface GuideRequest {
  readonly key: BodyKey;
  readonly level: GuideLevel;
  /** Absent for the opening introduction; present for a follow-up. */
  readonly question?: string;
  readonly history: readonly GuideTurn[];
  readonly signal?: AbortSignal;
}

/**
 * A source of explanations.
 *
 * Two implementations ship: a grounded local narrator that composes from the
 * project's own scientific data, and an HTTP provider used only when one is
 * configured. Nothing in the UI knows which it is talking to.
 */
export interface GuideProvider {
  readonly id: 'local' | 'remote';
  introduce(request: GuideRequest): Promise<GuideReply>;
  answer(request: GuideRequest & { question: string }): Promise<GuideReply>;
}
