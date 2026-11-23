// The same module seen with plain async functions, so vi.spyOn(...).mockImplementation(async ...) type-checks on a
// repository whose functions return a PrismaPromise (an awaited Promise is what the callers use)
export function asAsync<T extends object>(module: T) {
  return module as unknown as { [K in keyof T]: T[K] extends (...args: infer A) => infer R ? (...args: A) => Promise<Awaited<R>> : T[K] }
}
