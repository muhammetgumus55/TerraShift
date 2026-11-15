// Contract types — PLAN_MVP §4, ARAYUZLER §8. Owner: Gümüş (Rol B).
// Do not edit locally. Changes go through Gümüş: ARAYUZLER.md + this file + docs/contract/*.schema.json + mock JSON, one PR.

/** Location ids come from site_index.locations (engine/config/locations.yaml); not a fixed list since 14 Nov. */
export type LocationId = string;
export type RotationId = 'fallow_wheat' | 'chickpea_wheat' | 'lentil_wheat';
export type DepthId = 'shallow' | 'medium' | 'deep';
export type CropId = 'wheat' | 'chickpea' | 'lentil' | 'fallow';
export type LegumeId = 'chickpea' | 'lentil';
export type Badge = 'measured' | 'model' | 'official' | 'statistic' | 'literature' | 'assumption' | 'user';

export interface Text { en: string; tr: string }

/** Value object. `value: null` = not yet sourced ("pending"): show "pending", never a number. */
export interface V {
  value: number | null;
  unit: string;
  source: string;
  source_url?: string;
  type: Badge;
  verified: boolean;
  as_of?: string;
}

interface FileHeader {
  schema_version: '1.0';
  mock: boolean;
  generated_at: string;
}

// §4.1 site_index.json
export interface Location {
  id: LocationId; name: string; district: string; province: string;
  lat: number; lon: number; elevation_m: number; note: Text;
}
export interface Evidence { text: Text; source: string; source_url?: string }
export interface Strategy { why: Text; evidence: Evidence[]; benefits: Text[]; gaps: Text[]; local_review: Text[] }
export interface Rotation {
  id: RotationId;
  is_baseline: boolean;
  crops: [CropId, CropId];          // [year-1 crop, 'wheat']
  label: Text;
  soil_traits: { n_fixing: boolean; tillage_passes: V; note: Text };
  strategy: Strategy;
}
export interface DepthClass { id: DepthId; depth_m: number; label: Text }
/** E2 "what if the same 24 years were drier or warmer?" — a sensitivity test, not a projection. */
export interface Scenario { id: string; label: Text; precip_factor: number; temp_shift_c: number }
export interface SiteIndex extends FileHeader {
  power_range: { start: string; end: string };
  locations: Location[];
  rotations: Rotation[];            // baseline always first
  depth_classes: DepthClass[];
  start_years: [number, number];    // [first, last], both inclusive
  scenarios: Scenario[];            // E2; baseline first. Non-baseline results: results/{location_id}__{scenario_id}.json
}

// §4.2 results/{location_id}.json
export interface SoilProperty {
  id: 'clay' | 'sand' | 'silt' | 'phh2o' | 'soc' | 'nitrogen' | 'cec' | 'bdod' | 'cfvo';
  label: Text; depth: string; q05: number; q50: number; q95: number; unit: string;
  source: string; type: Badge; how_obtained: 'wcs' | 'gee' | 'manual_viewer'; meaning: Text;
}
export interface FirstCrop { crop_id: LegumeId; eta_mm: number; etc_mm: number; stress_days: number; yield_ratio: number }
export interface WheatResult { eta_mm: number; etc_mm: number; stress_days: number; heat_days_flowering: number; yield_ratio: number }
export interface SequenceRow {
  start_year: number;
  rotation_id: RotationId;
  depth_id: DepthId;
  pre_sowing_precip_mm: number;
  water_at_wheat_sowing_mm: number;
  fallow_storage_efficiency: number | null;  // fallow_wheat only
  bare_days: number;
  wind_exposed_bare_days: number;
  bare_by_month: number[];                   // 24, index 0 = July of start_year
  stress_by_month: number[];                 // 24
  fullness_by_month: number[];               // 24, 0–100 (100 = field capacity)
  first_crop: FirstCrop | null;              // null for fallow_wheat
  wheat: WheatResult;
}
export interface ResultsFile extends FileHeader {
  location_id: LocationId;
  scenario_id: string;                       // 'baseline' in results/{loc}.json
  soil: {
    awc_mm_per_m: { value: number | null; unit?: string; source: string; type: Badge; verified: boolean };
    /** 15 Nov: AWC estimates the engine did NOT use (soil-card transparency), e.g. soilgrids_wv0033_wv1500, saxton_rawls_2006. */
    awc_alternatives?: Record<string, { value: number; unit: string; source: string; type: Badge; verified: boolean; range_q05_q95?: [number, number] }>;
    texture_class?: string;                  // USDA class, 0–100 cm (e.g. "silty clay")
    properties: SoilProperty[];
    not_available_remotely: string[];
  };
  sequences: SequenceRow[];                  // 216 = 3 rotations × 3 depths × 24 years
}

// §4.3 ledger/{location_id}.json
export type LedgerCrop = 'fallow' | 'bare' | 'wheat' | 'chickpea' | 'lentil';
export interface LedgerWeek { week_start: string; p_mm: number; eta_mm: number; dp_mm: number; aw_mm: number; crop: LedgerCrop }
export interface LedgerSeries { start_year: number; rotation_id: RotationId; depth_id: DepthId; weeks: LedgerWeek[] }
export interface LedgerFile extends FileHeader { location_id: LocationId; series: LedgerSeries[] }

// §4.3b smap/{location_id}.json — always present; when available is false, latest is null and lists are empty
export interface SmapFile extends FileHeader {
  location_id: LocationId;
  available: boolean;
  product: string;
  cell_km: number;
  // 15 Nov: SMAP dropped; the slot holds NASA MERRA-2 (degree of saturation only, so rootzone_m3m3 is null).
  latest: { date: string; rootzone_wetness: number; rootzone_m3m3: number | null; percentile_for_month: number } | null;
  monthly_climatology: { month: number; p10: number; p50: number; p90: number }[];
  monthly_series: { month_start: string; rootzone_wetness: number; surface_wetness: number }[];
}

// §4.4 defaults.json — decision parameters (14 Nov). National, same for every location.
// Prices and supports are INTERNAL parameters: never render them or any TL amount.
export interface CropParams { ref_yield_kg_per_da: V; price_tl_per_kg: V; support_tl_per_da: V }
export interface DecisionParams {
  weights: { value: V; yield: V; soil: V; water: V };
  guardrails: { min_wheat_ratio_vs_baseline: V; min_first_crop_ratio: V };
  close_call_margin: V;
}
export interface DefaultsFile extends FileHeader {
  crops: { wheat: CropParams; chickpea: CropParams; lentil: CropParams; fallow: { support_tl_per_da: V } };
  decision: DecisionParams;
}

// §4.5 validation.json
export type CheckId = 'mass_balance' | 'et0_fao56_ex18' | 'pse_literature' | 'trial_ratio' | 'precip_vs_mgm' | 'smap_anomaly';
export interface Check { id: CheckId; status: 'pass' | 'fail' | 'info' | 'pending'; value: string; reference: string; note: Text }
export interface ValidationFile extends FileHeader { checks: Check[] }

// agent/{location_id}.json — AI district commentary from a local model (15 Nov). Show `report` only when guards.passed.
export interface AgentReport {
  headline: Text;
  rotations: { rotation_id: string; strengths: Text[]; risks: Text[] }[];
  soil_health: Text[];
  satellites: Text[];
  climate_scenarios: Text[];
  uncertainties: Text[];
  ask_local_expert: Text[];
}
// explain/{location_id}.json — why this rotation (15 Nov): facts computed by the engine, worded by a local
// model and checked per cited fact; `source: template` = the fact sentences themselves. Audio is optional.
export interface ExplainFact { id: string; numbers: number[]; tr: string; en: string }
export interface ExplainText { text: string; sentences: { text: string; fact_ids: string[] }[]; source: 'model' | 'template'; tries: number; audio?: string }
export interface ExplainEntry { facts: ExplainFact[]; tr: ExplainText; en: ExplainText }
export interface ExplainFile extends FileHeader {
  location_id: LocationId;
  model: string | null;
  type: 'model';
  explanations: Record<DepthId, Record<RotationId, ExplainEntry>>;
}

export interface AgentFile extends FileHeader {
  location_id: LocationId;
  depth_id: DepthId;
  model: string;
  type: 'model';
  report: AgentReport | null;
  tools_used: { tool: string; args: Record<string, unknown>; forced?: boolean }[];
  guards: { passed: boolean; problems: string[]; rewrites: number };
  disclaimer: Text;
}

// §4.6 fertilizer.json — fertilizer rules (15 Nov, docs/GUBRE.md). National (Central Anatolia tables), same for every location.
// The browser computes the plan with fertilizer.ts; amounts are kg/da of pure nutrient or of product. No money.
export type FertCropId = 'wheat' | 'barley' | 'chickpea' | 'lentil' | 'sugar_beet' | 'potato' | 'onion';
export type WaterRegime = 'rainfed' | 'limited' | 'irrigated';
export type Nutrient = 'n' | 'p2o5' | 'k2o';
export type Timing = 'pre_plant' | 'base' | 'top_1' | 'top_2' | 'foliar';
export type SoilFlag = 'alkaline' | 'high_lime' | 'low_om' | 'low_total_n' | 'saline' | 'zn_low' | 'zn_likely_low';

/** A comparison predicate. A missing input never matches, unless `missing: true` is asked. */
export interface Pred { gt?: number; gte?: number; lt?: number; lte?: number; eq?: string | number | boolean; in?: (string | number)[]; missing?: boolean }
/** All listed keys must match. Keys: SoilTest fields, request fields (water, inoculated, drip, banding), flags_any, flags_all. */
export interface When { [key: string]: Pred | SoilFlag[] | undefined; flags_any?: SoilFlag[]; flags_all?: SoilFlag[] }

export interface Sourced { source: string; source_url?: string; type: Badge; verified: boolean }
export interface FertProduct extends Sourced {
  label: Text;
  n: number; p2o5: number; k2o: number;        // % by weight (product grade)
  so3?: number; zn?: number;
  band_minus_kg?: number;                      // kg/da less of this product when placed in a band (combined seed drill)
}
export interface ProductChoice { product: string; when?: When }
export interface SplitPart { timing: Timing; fraction: number; label: Text }
export interface Advice extends Sourced { id: string; when?: When; text: Text }
/** Official soil-test table: the class the soil value falls in gives the pure nutrient to apply (kg/da). */
export interface ClassRow { max: number | null; kg_per_da: number }   // value ≤ max (null = above the last bound)
export interface SoilTable extends Sourced { rows: ClassRow[] }
export type SoilTableBy = 'om_pct' | 'p2o5_kg_per_da' | 'k2o_kg_per_da';
export interface GuideDose { product: string; timing: Timing; min_kg_per_da: number; max_kg_per_da: number }
export interface GuideRow { min: number | null; max: number | null; water?: WaterRegime[]; doses: GuideDose[]; note?: Text }
export interface GuideTable extends Sourced { by: 'target_yield_kg_per_da'; rows: GuideRow[] }
export interface FertCrop {
  label: Text;
  in_rotations: boolean;                       // true = also in the water-balance engine (wheat, chickpea, lentil)
  default_target_yield_kg_per_da: Record<WaterRegime, V>;
  /** Main method: TAGEM Central Anatolia tables per nutrient and water regime (a regime may be absent). */
  soil_tables: Record<Nutrient, Partial<Record<WaterRegime, SoilTable>>>;
  fixed_n_kg_per_da?: { inoculated: V };       // legumes with Rhizobium-inoculated seed: starter N only
  n_response?: { a: V; b: V; c: V };           // yield = a + b·N + c·N² → N at the top of the curve (used only without a table)
  n_cap_kg_per_da?: V;                         // applied N never above this
  uptake_kg_per_t: Record<Nutrient, V>;        // cross-check / fallback balance: nutrient taken up per 1000 kg product
  salinity_threshold_ec_ds_m: V;               // ECe above which yield starts to fall
  n_split: Record<WaterRegime, SplitPart[]>;   // how the N left after the base fertilizer is split (fractions sum to 1)
  base_products: ProductChoice[];              // first match supplies P (and its N, K)
  top_products: ProductChoice[];               // first match supplies the remaining N
  k_product: string;
  guide_table?: GuideTable;                    // a Turkish guide's product doses by target yield (shown for comparison)
  /** What farmers actually apply (survey); shown next to the plan, never used in the calculation. */
  farmer_practice?: Sourced & { text: Text; note?: Text; doses: { product: string; timing: Timing; kg_per_da: number; farms?: number }[] };
  advice: Advice[];
}
export interface FertilizerFile extends FileHeader {
  soil_table_by: Record<Nutrient, SoilTableBy>; // which soil value classifies each nutrient's table
  soil_layer: { mass_kg_per_da: V };
  conversions: { p_to_p2o5: V; k_to_k2o: V; soc_to_om: V };
  soil_supply: { n_available_fraction: V; n_uptake_fraction: V; p_uptake_fraction: V; k_uptake_fraction: V };
  fertilizer_efficiency: Record<Nutrient, V>;
  thresholds: { ph_alkaline: V; lime_high_pct: V; om_low_pct: V; total_n_low_pct: V; zn_low_ppm: V };
  banding: Sourced;                            // provenance of products' band_minus_kg
  min_dose_kg_per_da: V;                       // product doses below this are dropped (too small to spread evenly)
  products: Record<string, FertProduct>;
  crops: Record<FertCropId, FertCrop>;
  advice: Advice[];                            // general advice (all crops)
}

// §4.7 sowing.json — "nasıl ekilir" rules (15 Nov, docs/GUBRE.md §9). Computed in the browser by sowing.ts.
// Seed amounts are kg/da and seeds or plants per m²; no money.
export type SowCropId = 'wheat' | 'barley' | 'lentil' | 'chickpea';
/** A sourced range; min = max for a single value. */
export interface R extends Sourced { min: number; max: number; unit: string }
export interface SowWindow extends Sourced { from: string; to: string }   // MM-DD, both inclusive
export interface SowType {
  id: string;
  label: Text;
  season: 'autumn' | 'spring';
  window?: Record<WaterRegime, SowWindow>;     // dates where the source gives them
  window_text?: Text;                         // otherwise the source's words
  seeds_per_m2?: R;                           // viable seeds per m²
  plants_per_m2?: R;                          // target plants per m² (chickpea)
  guide_kg_per_da?: R;                        // the source's kg/da for drilled sowing
  depth_cm: R;
}
export interface SowRow extends R { when?: When; label: Text }
export interface SowExtra extends R { when?: When; label: Text }
export interface SowCrop { label: Text; types: SowType[]; rows: SowRow[]; extra_kg_per_da?: SowExtra[]; advice: Advice[] }
export interface SowingFile extends FileHeader {
  seed_formula: Sourced;
  nearest_window_note: { text: Text; districts: string[]; source: string; type: Badge; verified: boolean };
  cold_districts: { ids: string[]; text: Text; source: string; type: Badge; verified: boolean };
  crops: Record<SowCropId, SowCrop>;
  annual_precip_mm: Record<string, V & { station?: string }>;   // MGM/WMO 1991–2020 normal per district
}

// §4.8 soil_health.json — soil-health card (15 Nov, docs/GUBRE.md §10). Computed in the browser by soilhealth.ts.
export interface SoilEvidence extends Sourced { text: Text }
export interface SoilPractice {
  id: string;
  when?: When;                // keys: location_id, depth, depth_known, water, om_pct, ec_ds_m, practice
  title: Text;
  body: Text;
  show_model?: boolean;       // the card adds the engine's own numbers for this field (legume rotation)
  evidence: SoilEvidence[];
}
export interface SoilHealthFile extends FileHeader {
  om_classes: Sourced & { rows: { max: number | null; label: Text }[] };
  practices: SoilPractice[];  // strongest evidence first
}
