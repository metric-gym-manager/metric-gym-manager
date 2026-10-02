/** Zoom Out — 30s at 30fps. See the Video Ideas Registry, film 2. */
export const DURATION = 900

export const T = {
  hook: { from: 0, to: 60 },
  /** Pull back from macro until the QR is legible. */
  pull: { from: 60, to: 250 },
  /** Continue out to the poster on the wall. */
  poster: { from: 250, to: 420 },
  /** Phone scans and the join form fills. */
  phone: { from: 420, to: 600 },
  /** Success screen, then the gym's member list. */
  joined: { from: 600, to: 720 },
  reveal: { from: 720, to: 840 },
  card: { from: 840, to: 900 },
} as const

/** Camera scale at the start (macro) and end (whole wall). */
export const MACRO_SCALE = 14

export const SCAN_AT = 462
export const FORM_AT = 468
export const NAME = { text: 'Sahan Perera', from: 476, framesPerChar: 2 }
export const PHONE = { text: '0771234567', from: 504, framesPerChar: 2 }
export const PLAN_AT = 530
export const SELFIE_AT = 552
export const REGISTER_AT = 576
export const SUCCESS_AT = 592
export const PANEL_AT = 668
export const ROW_AT = 700

/** Fictional gym and amounts. The charged amount is plan + admission fee, as in the product. */
export const GYM = 'Iron Yard Fitness'
export const PLAN_LABEL = 'Monthly'
export const PLAN_AMOUNT = 6500
export const ADMISSION_FEE = 2000
export const AMOUNT_DUE = PLAN_AMOUNT + ADMISSION_FEE
export const rs = (n: number) => `Rs. ${n.toLocaleString('en-US')}`
