import { describe, expect, it } from 'vitest'
import { DialogueSession } from '../src/game/interaction/DialogueSession'
import type { InteractableNpcDefinition } from '../src/game/interaction/types'

function npc(overrides: Partial<InteractableNpcDefinition> = {}): InteractableNpcDefinition {
  return {
    id: 'test-npc',
    scenePath: 'res://Town.tscn',
    tile: { x: 1, y: 1 },
    facing: 'down',
    displayName: 'Guide',
    dialogue: 'Hello.',
    texturePath: '/assets/Player/Male_Spritesheet.png',
    ...overrides,
  }
}

describe('DialogueSession', () => {
  it('falls back to the NPC summary dialogue as a single page', () => {
    const session = new DialogueSession(npc())

    expect(session.currentPage).toBe('Hello.')
    expect(session.pageNumber).toBe(1)
    expect(session.totalPages).toBe(1)
    expect(session.isLastPage).toBe(true)
  })

  it('advances through data-driven pages in order', () => {
    const session = new DialogueSession(npc({
      dialoguePages: ['First.', 'Second.', 'Third.'],
    }))

    expect(session.currentPage).toBe('First.')
    expect(session.advance()).toBe(true)
    expect(session.currentPage).toBe('Second.')
    expect(session.pageNumber).toBe(2)
    expect(session.advance()).toBe(true)
    expect(session.currentPage).toBe('Third.')
    expect(session.isLastPage).toBe(true)
  })

  it('does not advance beyond the final page', () => {
    const session = new DialogueSession(npc({
      dialoguePages: ['First.', 'Second.'],
    }))

    expect(session.advance()).toBe(true)
    expect(session.advance()).toBe(false)
    expect(session.currentPage).toBe('Second.')
    expect(session.pageNumber).toBe(2)
  })

  it('rejects empty dialogue pages', () => {
    expect(() => new DialogueSession(npc({
      dialoguePages: ['Valid.', '   '],
    }))).toThrow('NPC dialogue pages must not be empty')
  })

  it('owns a defensive copy of the page sequence', () => {
    const pages = ['One.', 'Two.']
    const session = new DialogueSession(npc({ dialoguePages: pages }))

    pages[0] = 'Changed.'
    expect(session.currentPage).toBe('One.')
  })

  it('exposes choices only on the final page', () => {
    const session = new DialogueSession(npc(), {
      pages: ['Intro.', 'Choose.'],
      choices: [
        { id: 'yes', label: 'Yes' },
        { id: 'no', label: 'No' },
      ],
    })

    expect(session.hasChoices).toBe(false)
    expect(session.selectedChoice).toBeUndefined()
    expect(session.advance()).toBe(true)
    expect(session.hasChoices).toBe(true)
    expect(session.selectedChoice?.id).toBe('yes')
  })

  it('wraps choice navigation deterministically', () => {
    const session = new DialogueSession(npc(), {
      pages: ['Choose.'],
      choices: [
        { id: 'yes', label: 'Yes' },
        { id: 'no', label: 'No' },
      ],
    })

    expect(session.moveChoice(-1)).toBe(true)
    expect(session.selectedChoice?.id).toBe('no')
    expect(session.moveChoice(1)).toBe(true)
    expect(session.selectedChoice?.id).toBe('yes')
  })

  it('rejects duplicate or empty dialogue choices', () => {
    expect(() => new DialogueSession(npc(), {
      pages: ['Choose.'],
      choices: [
        { id: 'same', label: 'Yes' },
        { id: 'same', label: 'No' },
      ],
    })).toThrow('unique non-empty ids and labels')

    expect(() => new DialogueSession(npc(), {
      pages: ['Choose.'],
      choices: [{ id: '', label: 'Invalid' }],
    })).toThrow('unique non-empty ids and labels')
  })

})
