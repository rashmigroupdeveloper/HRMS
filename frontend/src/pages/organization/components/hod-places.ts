// HOD places grouped for the Department heads tab and its picker (BACKLOG 3e - a place is a department at a plant of a
// company): company -> plant -> places, and whether a set of places covers a whole plant or a whole company, so "all 18
// departments" or "whole company" is shown instead of a list of 200 departments. "Whole" is only said when the user's
// data access covers all of that company / plant - the APIs list only the places inside it, so for someone limited to
// one plant, "every place I can see" is not "the whole company".

// What every place from employees.hods.list / places / gaps has
export type PlaceLike = {
  id: number
  isActive: boolean
  company: { id: number; code: string; name: string }
  plant: { id: number; plantCode: string; name: string }
  department: { id: number; name: string }
}

export type PlantGroup<P> = { id: number; plantCode: string; name: string; places: P[]; whole: boolean }
export type CompanyGroup<P> = { id: number; code: string; name: string; plants: PlantGroup<P>[]; places: P[]; whole: boolean; total: number }

// How many places each plant and company has - from employees.hods.places, every place inside the user's data access -
// and whether that access covers all of a company / plant (useAccess().coversWhole)
export type SeesWhole = (where: { companyId: number; plantId?: number }) => boolean
export type PlaceTotals = { plant: Map<number, number>; company: Map<number, { places: number; plants: number }>; seesWhole: SeesWhole }

export function placeTotals(all: PlaceLike[], seesWhole: SeesWhole): PlaceTotals {
  const plant = new Map<number, number>()
  const plantsOf = new Map<number, Set<number>>()
  for (const place of all) {
    plant.set(place.plant.id, (plant.get(place.plant.id) ?? 0) + 1)
    plantsOf.set(place.company.id, (plantsOf.get(place.company.id) ?? new Set()).add(place.plant.id))
  }
  const company = new Map<number, { places: number; plants: number }>()
  for (const [id, plants] of plantsOf) company.set(id, { places: [...plants].reduce((n, p) => n + (plant.get(p) ?? 0), 0), plants: plants.size })
  return { plant, company, seesWhole }
}

// The places grouped in the order they come (the APIs sort them by company, plant, department). With `totals`, a plant
// is `whole` when the places are all of its places (two or more), a company when every one of its plants is whole - both
// only when the user's data access covers all of it.
export function groupPlaces<P extends PlaceLike>(places: P[], totals?: PlaceTotals): CompanyGroup<P>[] {
  const companies = new Map<number, CompanyGroup<P>>()
  for (const place of places) {
    const company = companies.get(place.company.id) ?? { ...place.company, plants: [], places: [], whole: false, total: 0 }
    let plant = company.plants.find((p) => p.id === place.plant.id)
    if (!plant) {
      plant = { ...place.plant, places: [], whole: false }
      company.plants.push(plant)
    }
    plant.places.push(place)
    company.places.push(place)
    companies.set(company.id, company)
  }
  const groups = [...companies.values()]
  for (const company of groups) {
    company.total = company.places.length
    if (!totals) continue
    for (const plant of company.plants) {
      const all = totals.plant.get(plant.id) ?? 0
      plant.whole = all >= 2 && plant.places.length === all && totals.seesWhole({ companyId: company.id, plantId: plant.id })
    }
    const all = totals.company.get(company.id)
    company.total = all?.places ?? company.places.length
    company.whole =
      !!all && company.places.length >= 2 && company.places.length === all.places && company.plants.length === all.plants && totals.seesWhole({ companyId: company.id })
  }
  return groups
}

export const plural = (n: number, one: string, many = `${one}s`) => `${n.toLocaleString('en-IN')} ${n === 1 ? one : many}`
