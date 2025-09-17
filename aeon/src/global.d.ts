import type { DetailedHTMLProps, HTMLAttributes } from 'react'

declare namespace JSX {
  interface IntrinsicElements {
    'model-viewer': DetailedHTMLProps<HTMLAttributes<HTMLElement>, HTMLElement> & {
      src?: string
      'ios-src'?: string
      ar?: boolean
      'ar-modes'?: string
      'camera-controls'?: boolean
      'auto-rotate'?: boolean
      'auto-rotate-speed'?: string | number
      'shadow-intensity'?: string | number
      exposure?: string | number
      'disable-zoom'?: boolean
    }
  }
}


