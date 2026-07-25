// Pure, so it's testable without mounting the editor view or loading mermaid
// itself (this repo has no jsdom/component-mounting test setup — see
// reorderSteps.ts). PhaseFlowDiagram.vue feeds the returned source straight
// into mermaid.render().

export interface PhaseFlowNode {
  id: string
  name: string
  dependsOnPhaseIds: string[]
}

// Phase names are admin-authored free text, not identifiers — quotes and
// newlines would otherwise break out of a mermaid `["..."]` label or the
// line itself.
function escapeLabel(name: string): string {
  const trimmed = name.trim()
  const label = trimmed === '' ? 'Untitled' : trimmed
  return label.replace(/"/g, '&quot;').replace(/[\r\n]+/g, ' ')
}

export function buildPhaseFlowDiagram(phases: PhaseFlowNode[]): string {
  if (phases.length === 0) {
    return ''
  }

  // mermaid node ids must be simple identifiers — phase.id is a UUID, so
  // every phase gets a short positional alias instead of using it directly.
  const nodeIdByPhaseId = new Map(phases.map((phase, index) => [phase.id, `phase${index}`]))
  function nodeIdFor(phaseId: string): string {
    const nodeId = nodeIdByPhaseId.get(phaseId)
    if (nodeId === undefined) {
      throw new Error(`buildPhaseFlowDiagram: phase ${phaseId} is not in the phases list`)
    }
    return nodeId
  }

  const lines = ['flowchart TD']
  for (const phase of phases) {
    lines.push(`    ${nodeIdFor(phase.id)}["${escapeLabel(phase.name)}"]`)
  }
  for (const phase of phases) {
    for (const dependsOnPhaseId of phase.dependsOnPhaseIds) {
      lines.push(`    ${nodeIdFor(dependsOnPhaseId)} --> ${nodeIdFor(phase.id)}`)
    }
  }
  return lines.join('\n')
}
