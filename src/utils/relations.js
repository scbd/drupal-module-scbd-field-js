// src/utils/relations.js
//
// One-way auto-link source for the field widget: selecting a GBF Target fills its related SDGs and
// CBD Subjects. Relationships are defined per GBF Target in GBF_SAMEAS, so we look them up directly.
// Only GBF Target identifiers resolve to a related list — that is exactly what makes the link
// one-directional: picking an SDG or Subject returns [] and fills nothing (no inverse). This
// replaces decorating the term objects with a `sameAs` array.

import { GBF_SAMEAS } from '@/utils/constants.js';

// Domains a GBF Target selection fills. A target's related list never contains other targets, and
// AICHI ids / stray GUIDs are ignored for free — they never match a loaded option in these domains.
export const LINKABLE_DOMAINS = ['sdgs', 'subjects'];

/**
 * Identifiers a selection should auto-link. Only GBF Target keys carry relations, so SDG/Subject
 * selections return `[]` (one-way: no back-fill).
 * @param {string} identifier
 * @returns {string[]} related identifiers (SDGs/Subjects, plus AICHI/GUIDs filtered out at fill time)
 */
export const relatedKeys = (identifier) => GBF_SAMEAS[identifier] ?? [];
