// lib/estimateCalculations.ts

/**
 * Single source of truth for all estimate financial calculations.
 *
 * Naming conventions:
 * - "Cents" suffix = integer cents (avoid floats)
 * - "Effective" = post-margin, pre-tax (the price the client sees)
 * - "Raw" = pre-margin, pre-tax (your cost basis)
 * - "Snapshot" fields = stored on the estimate at lock time, used for finalized estimates
 *
 * All functions here are pure — given the same inputs, they return the same outputs.
 * No side effects, no async, no external dependencies.
 */

// ============================================================
// TYPES
// ============================================================

export type MarginMode = 'none' | 'global' | 'service' | 'granular';

export interface EstimateItem {
  materialId: string;
  qty: number;
  taxRate: number;
  marginRate?: number;
  unit?: string;
  name?: string;
  cost_per_unit_cents?: number;
}

export interface EstimateSection {
  title: string;
  description?: string;
  laborHours: number;
  hourlyRate: number;
  laborType?: 'hourly' | 'daily';
  laborTaxRate: number;
  laborMarginRate?: number;
  marginRate?: number;
  items: EstimateItem[];
}

/**
 * The minimal set of estimate fields needed for calculations.
 * Use this for finalized estimates (locked) — the *_snapshot fields take priority.
 */
export interface EstimateFinancialContext {
  margin_mode_snapshot?: MarginMode | null;
  global_margin_snapshot?: number | null;
  tax_rate_snapshot?: number | null;
}

/**
 * The minimal set of profile fields needed for calculations as fallback.
 */
export interface ProfileFinancialContext {
  default_tax_rate?: number | null;
}

/**
 * A material record — used to hydrate items that only have a materialId reference.
 */
export interface Material {
  id: string;
  name?: string;
  cost_per_unit_cents?: number;
  unit?: string;
}

// ============================================================
// CORE: MARGIN MULTIPLIERS
// ============================================================

/**
 * Returns the margin multiplier (e.g., 1.20 for 20% margin) based on mode and context.
 *
 * Resolution order:
 *   - 'none': always 1
 *   - 'global': uses estimate.global_margin_snapshot
 *   - 'service': uses sec.marginRate
 *   - 'granular': uses sec.laborMarginRate (if isLabor) OR item.marginRate
 *
 * @param estimate - has margin_mode_snapshot + global_margin_snapshot
 * @param sec - the section (used for service-level and granular labor margins)
 * @param item - the line item (used for granular item margins; null for labor)
 * @param isLabor - whether we're calculating for labor specifically
 */
export function getMultiplier(
  estimate: EstimateFinancialContext,
  sec: EstimateSection,
  item: EstimateItem | null = null,
  isLabor: boolean = false
): number {
  const mode = estimate.margin_mode_snapshot || 'none';

  if (mode === 'global') {
    return 1 + (estimate.global_margin_snapshot || 0) / 100;
  }
  if (mode === 'service') {
    return 1 + (sec.marginRate || 0) / 100;
  }
  if (mode === 'granular') {
    if (isLabor) return 1 + (sec.laborMarginRate || 0) / 100;
    if (item) return 1 + (item.marginRate || 0) / 100;
  }
  return 1;
}

// ============================================================
// EFFECTIVE RATES (post-margin, pre-tax)
// ============================================================

/**
 * Returns the labor rate the client actually pays per hour/day, in cents.
 * (Raw rate × margin multiplier, rounded to integer cents.)
 */
export function getEffectiveLaborRateCents(
  estimate: EstimateFinancialContext,
  sec: EstimateSection
): number {
  const rawRateCents = (sec.hourlyRate || 0) * 100;
  return Math.round(rawRateCents * getMultiplier(estimate, sec, null, true));
}

/**
 * Returns the per-unit cost the client actually pays for this item, in cents.
 * Falls back to the live materials table for unsnapped costs.
 *
 * @param materialsById - optional Map for O(1) lookup; if not provided, only snapshot is used
 */
export function getEffectiveItemCostCents(
  estimate: EstimateFinancialContext,
  sec: EstimateSection,
  item: EstimateItem,
  materialsById?: Map<string, Material>
): number {
  const snapshottedCost = item.cost_per_unit_cents;
  const liveCost =
    materialsById?.get(item.materialId)?.cost_per_unit_cents || 0;
  const rawCost = snapshottedCost !== undefined ? snapshottedCost : liveCost;
  return Math.round(rawCost * getMultiplier(estimate, sec, item, false));
}

// ============================================================
// RAW RATES (pre-margin, pre-tax — cost basis)
// ============================================================

/**
 * Returns the labor cost the BUSINESS pays per hour/day, in cents (no margin applied).
 * Used for analytics / cost basis calculations.
 */
export function getRawLaborRateCents(sec: EstimateSection): number {
  return Math.round((sec.hourlyRate || 0) * 100);
}

/**
 * Returns the per-unit cost the BUSINESS pays for this item, in cents (no margin).
 * Used for analytics / cost basis calculations.
 */
export function getRawItemCostCents(
  item: EstimateItem,
  materialsById?: Map<string, Material>
): number {
  const snapshottedCost = item.cost_per_unit_cents;
  const liveCost =
    materialsById?.get(item.materialId)?.cost_per_unit_cents || 0;
  return snapshottedCost !== undefined ? snapshottedCost : liveCost;
}

// ============================================================
// SECTION TOTALS
// ============================================================

/**
 * Returns the section's total in CENTS (post-margin, pre-tax).
 * This is what the section contributes to the subtotal.
 */
export function getSectionTotalCents(
  estimate: EstimateFinancialContext,
  sec: EstimateSection,
  materialsById?: Map<string, Material>
): number {
  const laborCents =
    getEffectiveLaborRateCents(estimate, sec) * (sec.laborHours || 0);
  const matsCents = (sec.items || []).reduce((acc: number, item) => {
    return (
      acc +
      getEffectiveItemCostCents(estimate, sec, item, materialsById) *
        (item.qty || 0)
    );
  }, 0);
  return matsCents + laborCents;
}

/**
 * Convenience wrapper: returns the section total in dollars/euros (not cents).
 * Use this when handing off to UI code.
 */
export function getSectionTotal(
  estimate: EstimateFinancialContext,
  sec: EstimateSection,
  materialsById?: Map<string, Material>
): number {
  return getSectionTotalCents(estimate, sec, materialsById) / 100;
}

// ============================================================
// TAX SUMMARY
// ============================================================

export interface TaxSummary {
  /** Subtotal (post-margin, pre-tax) in cents — sum of all section totals */
  subtotalCents: number;
  /** Tax broken down by rate, in cents. Keyed by rate (e.g. 7 for 7%). */
  taxGroups: Record<number, number>;
  /** Total tax across all groups, in cents */
  totalTaxCents: number;
}

/**
 * Computes the subtotal and tax breakdown for a complete estimate.
 *
 * @param estimate - estimate financial context (snapshots)
 * @param sections - the line items
 * @param profileTaxRate - default tax rate from the profile (used as fallback when item has no taxRate)
 * @param materialsById - optional Map for O(1) material lookups
 */
export function getTaxSummary(
  estimate: EstimateFinancialContext,
  sections: EstimateSection[],
  profileTaxRate: number = 0,
  materialsById?: Map<string, Material>
): TaxSummary {
  const baseTaxRate =
    estimate.tax_rate_snapshot !== null &&
    estimate.tax_rate_snapshot !== undefined
      ? estimate.tax_rate_snapshot
      : profileTaxRate;

  let subtotalCents = 0;
  const taxGroups: Record<number, number> = {};

  (sections || []).forEach((sec) => {
    // Labor portion
    const laborCents =
      getEffectiveLaborRateCents(estimate, sec) * (sec.laborHours || 0);
    if (laborCents > 0) {
      subtotalCents += laborCents;
      const r = sec.laborTaxRate !== undefined ? sec.laborTaxRate : baseTaxRate;
      taxGroups[r] = (taxGroups[r] || 0) + Math.round(laborCents * (r / 100));
    }

    // Materials portion
    (sec.items || []).forEach((item) => {
      const matCents =
        getEffectiveItemCostCents(estimate, sec, item, materialsById) *
        (item.qty || 0);
      if (matCents > 0) {
        subtotalCents += matCents;
        const r = item.taxRate !== undefined ? item.taxRate : baseTaxRate;
        taxGroups[r] = (taxGroups[r] || 0) + Math.round(matCents * (r / 100));
      }
    });
  });

  const totalTaxCents = Object.values(taxGroups).reduce((acc, v) => acc + v, 0);

  return { subtotalCents, taxGroups, totalTaxCents };
}

// ============================================================
// AUTO-GENERATED DESCRIPTIONS
// ============================================================

export interface DescriptionTranslations {
  descBase: string;
  descZeroCostMats: string; // contains "{mats}" placeholder
  descZeroCostLabor: string;
}

/**
 * Returns the section's description.
 * - If the user wrote a description, returns that verbatim.
 * - Otherwise auto-generates one based on the section's content.
 *
 * @param translations - object with descBase, descZeroCostMats, descZeroCostLabor
 */
export function generateDescription(
  estimate: EstimateFinancialContext,
  sec: EstimateSection,
  translations: DescriptionTranslations,
  materialsById?: Map<string, Material>
): string {
  if (sec.description && sec.description.trim() !== '') {
    return sec.description;
  }

  let baseText = translations.descBase;

  // Find all materials with effective cost of 0 (free/client-provided)
  const zeroCostMats = (sec.items || [])
    .map((item) => {
      const effectiveCost = getEffectiveItemCostCents(
        estimate,
        sec,
        item,
        materialsById
      );
      const m = materialsById?.get(item.materialId);
      const name = item.name || m?.name;
      return effectiveCost === 0 && name ? name : null;
    })
    .filter((n): n is string => n !== null);

  if (zeroCostMats.length > 0) {
    const matsString = zeroCostMats.join(', ');
    baseText +=
      ' ' + translations.descZeroCostMats.replace('{mats}', matsString);
  }

  // Free labor case
  if (sec.laborHours > 0 && getEffectiveLaborRateCents(estimate, sec) === 0) {
    baseText += ' ' + translations.descZeroCostLabor;
  }

  return baseText;
}

// ============================================================
// HELPERS
// ============================================================

/**
 * Builds a Map for O(1) material lookups by ID.
 * Use this when a function will be called many times in a loop.
 */
export function buildMaterialsMap(
  materials: Material[]
): Map<string, Material> {
  return new Map(materials.map((m) => [m.id, m]));
}

/**
 * Hydrates an estimate's sections by filling in name/cost/unit from the materials table
 * for items that only have a materialId reference. Does NOT mutate the input.
 *
 * Use this for the dashboard ZIP export where draft estimates may have items
 * without snapshotted costs.
 */
export function hydrateSections(
  sections: EstimateSection[],
  materialsById: Map<string, Material>
): EstimateSection[] {
  return (sections || []).map((sec) => ({
    ...sec,
    items: (sec.items || []).map((item) => {
      if (!item.materialId) return item;
      const m = materialsById.get(item.materialId);
      return {
        ...item,
        name: item.name || m?.name,
        cost_per_unit_cents:
          item.cost_per_unit_cents ?? m?.cost_per_unit_cents ?? 0,
        unit: item.unit || m?.unit
      };
    })
  }));
}
