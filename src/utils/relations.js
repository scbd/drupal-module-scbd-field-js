// src/utils/relations.js
// One-way auto-link source: selecting a GBF Target fills related SDGs and Subjects from GBF_SAMEAS.

import { GBF_SAMEAS } from '@/utils/constants.js';

// Domains a GBF Target selection fills. SDGs/Subjects ignore AICHI ids for free, so they never match loaded options in these domains.
export const LINKABLE_DOMAINS = ['sdgs', 'subjects'];

/**
 * Identifiers a selection should auto-link. Only GBF Target keys carry relations, so SDG/Subject
 * selections return `[]` (one-way: no back-fill).
 * @param {string} identifier
 * @returns {string[]} related identifiers (SDGs/Subjects, plus AICHI/GUIDs filtered out at fill time)
 */
// Object.hasOwn blocks prototype-key lookups (constructor / __proto__ / toString) that would return a function where string[] is expected.
export const relatedKeys = (identifier) =>
  (Object.hasOwn(GBF_SAMEAS, identifier) ? GBF_SAMEAS[identifier] : undefined) ?? [];
