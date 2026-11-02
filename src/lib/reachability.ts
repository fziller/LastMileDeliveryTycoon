export function reachableIndices(distances: number[], durations: (number | null)[][]): number[] {
  return distances.flatMap((distance, index) => index > 0 && distance <= 100 &&
    typeof durations[0]?.[index] === 'number' && typeof durations[index]?.[0] === 'number'
    ? [index - 1] : []);
}
