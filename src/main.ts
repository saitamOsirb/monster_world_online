import { Application, Ticker } from 'pixi.js'
import { Game } from './game/Game'
import { LOGICAL_HEIGHT, LOGICAL_WIDTH } from './game/constants'
import './styles.css'

interface VisualTestHarness {
  app: Application
  game: Game
  sharedTicker: Ticker
}

declare global {
  interface Window {
    __MONSTER_WORLD_VISUAL_TEST__?: VisualTestHarness
  }
}

async function bootstrap(): Promise<void> {
  const mount = document.querySelector<HTMLElement>('#app')
  if (!mount) throw new Error('Missing #app mount element')

  const visualTestMode = new URLSearchParams(window.location.search).has('visualTest')
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

  if (visualTestMode) {
    app.ticker.stop()
    Ticker.shared.stop()
  }

  app.canvas.setAttribute('aria-label', 'Monster World Online game canvas')
  mount.appendChild(app.canvas)

  const game = new Game(app)
  await game.start()

  if (visualTestMode) {
    window.__MONSTER_WORLD_VISUAL_TEST__ = {
      app,
      game,
      sharedTicker: Ticker.shared,
    }
  }

  window.addEventListener('beforeunload', () => {
    delete window.__MONSTER_WORLD_VISUAL_TEST__
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
