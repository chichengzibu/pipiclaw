// Ambient module declarations for dependencies without bundled types.

declare module 'vue-i18n' {
  export const useI18n: () => {
    t: (key: string, params?: any) => string
    locale: { value: string }
  }
  export const createI18n: (options?: any) => any
}

declare module 'element-plus/dist/locale/zh-cn.mjs' {
  const locale: any
  export default locale
}

declare module 'element-plus/dist/locale/en.mjs' {
  const locale: any
  export default locale
}
