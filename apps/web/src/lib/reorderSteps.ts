// Pure so it can be unit tested without mounting the editor view (this repo
// has no jsdom/component-mounting test setup — see router/guards.ts).
export function moveStep(stepIds: string[], stepId: string, direction: 'up' | 'down'): string[] {
  const index = stepIds.indexOf(stepId)
  if (index === -1) {
    return stepIds
  }
  const swapWith = direction === 'up' ? index - 1 : index + 1
  if (swapWith < 0 || swapWith >= stepIds.length) {
    return stepIds
  }
  const next = [...stepIds]
  ;[next[index], next[swapWith]] = [next[swapWith], next[index]]
  return next
}
