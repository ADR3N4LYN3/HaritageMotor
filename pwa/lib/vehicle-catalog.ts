/**
 * Vehicle catalog powered by NHTSA vPIC API (US Dept of Transportation).
 * Provides make and model data automatically kept up-to-date.
 * https://vpic.nhtsa.dot.gov/api/
 */

import useSWRImmutable from "swr/immutable";

const BASE = "https://vpic.nhtsa.dot.gov/api/vehicles";

interface NHTSAMake {
  Make_ID: number;
  Make_Name: string;
}

interface NHTSAModel {
  Model_ID: number;
  Model_Name: string;
}

interface NHTSAResponse<T> {
  Results: T[];
}

async function fetchJSON<T>(url: string): Promise<T> {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`NHTSA API error: ${res.status}`);
  return res.json();
}

/**
 * Hook: fetch all vehicle makes from NHTSA.
 * Cached immutably (data doesn't change often).
 */
export function useVehicleMakes() {
  const { data, isLoading, error } = useSWRImmutable<NHTSAResponse<NHTSAMake>>(
    `${BASE}/GetAllMakes?format=json`,
    fetchJSON,
    { revalidateOnFocus: false }
  );

  const makes = data?.Results
    ? data.Results.map((m) => m.Make_Name)
        .sort((a, b) => a.localeCompare(b))
    : [];

  return { makes, isLoading, error };
}

/**
 * Hook: fetch models for a given make from NHTSA.
 */
export function useVehicleModels(make: string | null) {
  const { data, isLoading, error } = useSWRImmutable<NHTSAResponse<NHTSAModel>>(
    make ? `${BASE}/GetModelsForMake/${encodeURIComponent(make)}?format=json` : null,
    fetchJSON,
    { revalidateOnFocus: false }
  );

  const models = data?.Results
    ? data.Results.map((m) => m.Model_Name).sort((a, b) => a.localeCompare(b))
    : [];

  return { models, isLoading, error };
}

/** Generate year options from current year down to 1920 */
export function getYearOptions(): { value: string; label: string }[] {
  const current = new Date().getFullYear() + 1;
  const years: { value: string; label: string }[] = [];
  for (let y = current; y >= 1920; y--) {
    years.push({ value: String(y), label: String(y) });
  }
  return years;
}
