import type {
  DialogueChoice,
  DialogueContent,
  InteractableNpcDefinition,
} from './types'

export class DialogueSession {
  readonly npc: InteractableNpcDefinition
  readonly pages: readonly string[]
  readonly choices: readonly DialogueChoice[]
  private index = 0
  private choiceIndex = 0

  constructor(
    npc: InteractableNpcDefinition,
    content?: DialogueContent,
  ) {
    this.npc = npc
    const pages = content?.pages && content.pages.length > 0
      ? [...content.pages]
      : npc.dialoguePages && npc.dialoguePages.length > 0
        ? [...npc.dialoguePages]
        : [npc.dialogue]

    if (pages.some((page) => page.trim().length === 0)) {
      throw new Error(`NPC dialogue pages must not be empty: ${npc.id}`)
    }

    const choices = content?.choices ? [...content.choices] : []
    if (
      choices.some((choice) => choice.id.trim().length === 0 || choice.label.trim().length === 0)
      || new Set(choices.map((choice) => choice.id)).size !== choices.length
    ) {
      throw new Error(`NPC dialogue choices must have unique non-empty ids and labels: ${npc.id}`)
    }

    this.pages = pages
    this.choices = choices
  }

  get currentPage(): string {
    return this.pages[this.index]
  }

  get pageNumber(): number {
    return this.index + 1
  }

  get totalPages(): number {
    return this.pages.length
  }

  get isLastPage(): boolean {
    return this.index >= this.pages.length - 1
  }

  get hasChoices(): boolean {
    return this.isLastPage && this.choices.length > 0
  }

  get selectedChoiceIndex(): number {
    return this.choiceIndex
  }

  get selectedChoice(): DialogueChoice | undefined {
    return this.hasChoices ? this.choices[this.choiceIndex] : undefined
  }

  advance(): boolean {
    if (this.isLastPage) return false
    this.index += 1
    this.choiceIndex = 0
    return true
  }

  moveChoice(delta: -1 | 1): boolean {
    if (!this.hasChoices || this.choices.length <= 1) return false
    this.choiceIndex = (
      this.choiceIndex + delta + this.choices.length
    ) % this.choices.length
    return true
  }
}
