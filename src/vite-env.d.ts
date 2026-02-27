/// <reference types="vite/client" />
/// <reference types="vite-svg-loader" />

declare module '*.svg?component' {
  import type { DefineComponent } from 'vue'
  const component: DefineComponent<object, object, unknown>
  export default component
}
