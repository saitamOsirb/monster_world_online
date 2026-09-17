import type { Direction } from '../constants'

const directionKeys: Record<string, Direction> = {
  ArrowLeft: 'left',
  ArrowRight: 'right',
  ArrowUp: 'up',
  ArrowDown: 'down',
}

export class InputController {
  private readonly held = new Set<string>()
  private readonly pressed = new Set<string>()

  constructor(private readonly target: Window = window) {
    this.target.addEventListener('keydown', this.onKeyDown, { passive: false })
    this.target.addEventListener('keyup', this.onKeyUp, { passive: false })
    this.target.addEventListener('blur', this.onBlur)
  }

  destroy(): void {
    this.target.removeEventListener('keydown', this.onKeyDown)
    this.target.removeEventListener('keyup', this.onKeyUp)
    this.target.removeEventListener('blur', this.onBlur)
    this.held.clear()
    this.pressed.clear()
  }

  endFrame(): void {
    this.pressed.clear()
  }

  isDown(code: string): boolean {
    return this.held.has(code)
  }

  wasPressed(code: string): boolean {
    return this.pressed.has(code)
  }

  getDirection(): Direction | null {
    if (this.isDown('ArrowLeft')) return 'left'
    if (this.isDown('ArrowRight')) return 'right'
    if (this.isDown('ArrowUp')) return 'up'
    if (this.isDown('ArrowDown')) return 'down'
    return null
  }

  isMenuPressed(): boolean {
    return this.wasPressed('Enter')
  }

  isConfirmPressed(): boolean {
    return this.wasPressed('KeyZ') || this.wasPressed('Enter')
  }

  isCancelPressed(): boolean {
    return this.wasPressed('KeyX') || this.wasPressed('Escape')
  }

  private readonly onKeyDown = (event: KeyboardEvent): void => {
    if (event.repeat) return
    if (directionKeys[event.code] || ['Enter', 'KeyZ', 'KeyX', 'Escape'].includes(event.code)) {
      event.preventDefault()
    }
    this.held.add(event.code)
    this.pressed.add(event.code)
  }

  private readonly onKeyUp = (event: KeyboardEvent): void => {
    this.held.delete(event.code)
  }

  private readonly onBlur = (): void => {
    this.held.clear()
    this.pressed.clear()
  }
}
