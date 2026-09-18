import type { InteractableNpcDefinition } from './types'

export class DialogueSession {
  readonly npc: InteractableNpcDefinition
  readonly pages: readonly string[]
  private index = 0

  constructor(npc: InteractableNpcDefinition) {
    this.npc = npc
    const pages = npc.dialoguePages && npc.dialoguePages.length > 0
      ? [...npc.dialoguePages]
      : [npc.dialogue]

    if (pages.some((page) => page.trim().length === 0)) {
      throw new Error(`NPC dialogue pages must not be empty: ${npc.id}`)
    }

    this.pages = pages
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

  advance(): boolean {
    if (this.isLastPage) return false
    this.index += 1
    return true
  }
}
