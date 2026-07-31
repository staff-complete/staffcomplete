<script setup lang="ts">
import { ref, watch } from 'vue'
import mermaid from 'mermaid'
import { useI18n } from 'vue-i18n'
import { buildPhaseFlowDiagram } from '../../lib/phaseFlowDiagram'
import type { WorkflowTemplatePhase } from '../../composables/useWorkflowTemplates'

const props = defineProps<{
  phases: WorkflowTemplatePhase[]
}>()

const { t } = useI18n()

// mermaid.initialize is global and only needs to run once per page —
// calling it again on every render would just re-apply the same config.
let initialized = false
function ensureInitialized() {
  if (initialized) return
  mermaid.initialize({
    startOnLoad: false,
    // Default already, but explicit: labels are admin-authored phase names,
    // not trusted markup — sanitize the rendered SVG rather than relying on
    // buildPhaseFlowDiagram's quote-escaping alone.
    securityLevel: 'strict',
    theme: 'base',
    themeVariables: {
      primaryColor: '#e6f2f0',
      primaryTextColor: '#0b3d37',
      primaryBorderColor: '#0e7c70',
      lineColor: '#6b9e98',
      fontSize: '13px',
    },
  })
  initialized = true
}

const svgMarkup = ref('')
const renderFailed = ref(false)
// mermaid.render is async — phases can change again (rename, toggle a
// dependency) before an in-flight render resolves, so a stale response
// arriving after a newer one must not overwrite it.
let renderToken = 0

async function renderDiagram() {
  const source = buildPhaseFlowDiagram(
    props.phases.map((phase) => ({
      id: phase.id,
      name: phase.name,
      dependsOnPhaseIds: phase.dependsOnPhaseIds,
    })),
  )
  if (!source) {
    svgMarkup.value = ''
    renderFailed.value = false
    return
  }

  ensureInitialized()
  const token = ++renderToken
  try {
    const { svg } = await mermaid.render(`phase-flow-${token}`, source)
    if (token === renderToken) {
      svgMarkup.value = svg
      renderFailed.value = false
    }
  } catch {
    if (token === renderToken) {
      renderFailed.value = true
    }
  }
}

watch(() => props.phases, renderDiagram, { immediate: true, deep: true })
</script>

<template>
  <div v-if="phases.length > 0" class="mb-4.5 rounded-[20px] bg-white p-5.5">
    <h2 class="mb-3.5 text-[15px] font-extrabold">
      {{ t('workflows.editor.dependencyGraphHeading') }}
    </h2>
    <p v-if="renderFailed" class="text-[13px] text-app-danger">
      {{ t('workflows.editor.dependencyGraphError') }}
    </p>
    <!-- svgMarkup is mermaid's own sanitized SVG output (securityLevel: 'strict'), not raw
         admin input — this rule targets raw, un-sanitized HTML reflected into the DOM, which
         doesn't apply once mermaid has already run it through DOMPurify. -->
    <!-- nosemgrep -->
    <div class="overflow-x-auto" v-html="svgMarkup"></div>
  </div>
</template>
