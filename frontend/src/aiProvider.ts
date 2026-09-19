import type { Status } from './types'

type Model = Partial<Status['model']> | undefined

export function isCloudModel(model: Model): boolean {
  return (
    model?.provider === 'openai' ||
    model?.backend === 'openai' ||
    model?.data_processing === 'openai_cloud'
  )
}

export function isLocalModel(model: Model): boolean {
  return (
    !isCloudModel(model) &&
    (model?.provider === 'local_medgemma' ||
      ['llama_cpp', 'transformers'].includes(model?.backend || ''))
  )
}

export function processingLabelKey(model: Model): string {
  return isCloudModel(model)
    ? 'aiCloudProcessing'
    : isLocalModel(model)
      ? 'aiLocalProcessing'
      : 'aiProcessing'
}

export function processingHintKey(model: Model, compact = false): string {
  if (compact)
    return isCloudModel(model)
      ? 'aiCloudProcessingBrief'
      : isLocalModel(model)
        ? 'aiLocalProcessingBrief'
        : 'aiProviderBrief'
  return isCloudModel(model)
    ? 'aiCloudProcessingHint'
    : isLocalModel(model)
      ? 'aiLocalProcessingHint'
      : 'aiProviderHint'
}

export function providerName(model: Model): string {
  return isCloudModel(model) ? 'OpenAI' : isLocalModel(model) ? 'MedGemma' : 'AI'
}

export function supportsClinicalModel(model: Model): boolean {
  return ['llama_cpp', 'openai'].includes(model?.backend || '')
}
