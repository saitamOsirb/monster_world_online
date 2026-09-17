import { Application } from 'pixi.js'
import { Game } from './game/Game'
import { LOGICAL_HEIGHT, LOGICAL_WIDTH } from './game/constants'
import './styles.css'

async function bootstrap(): Promise<void> {
  const mount = document.querySelector<HTMLElement>('#app')
  if (!mount) throw new Error('Missing #app mount element')

  const app = new Application()
  await app.init({
    width: LOGICAL_WIDTH,
    height: LOGICAL_HEIGHT,
    antialias: false,
    autoDensity: false,
    resolution: 1,
    background: '#000000',
    preference: 'webgl',
  })

  app.canvas.setAttribute('aria-label', 'Monster World Online game canvas')
  mount.appendChild(app.canvas)

  const game = new Game(app)
  await game.start()

  window.addEventListener('beforeunload', () => {
    game.destroy()
    app.destroy(true)
  }, { once: true })
}

bootstrap().catch((error: unknown) => {
  console.error(error)
  const mount = document.querySelector<HTMLElement>('#app')
  if (!mount) return
  const message = error instanceof Error ? error.message : String(error)
  mount.innerHTML = `
    <section class="boot-error">
      <h1>Unable to start Monster World Online</h1>
      <p>${message}</p>
      <p>Run <code>pnpm assets:sync</code> before <code>pnpm dev</code>.</p>
    </section>
  `
})
