import { startApp } from './app'

const root = document.querySelector<HTMLElement>('#app')
if (!root) throw new Error('#app root missing')
startApp(root)
