// ═══════════════════════════════════════════════════════════════════════════
// SELECTIVE BLOOM for the anchor-building viewers.
//
// WHY THIS EXISTS
// The owner's references (public/kraytower.jpeg, public/bitflowhq.jpeg) are
// night renders whose dominant quality is the warm halo bleeding off every lit
// window, every LED line and every sign. Without post-processing a lit surface
// stops exactly at its own geometry, so the buildings read clean but flat — the
// single biggest remaining gap to the reference.
//
// WHY ONE MODULE, TWO CONSUMERS
// app/dogcity/partners/tower-viewer.tsx (ships) and
// app/city/explore/anchor-preview/glb-viewer.tsx (local-only workbench) must
// agree to the last decimal, because the workbench is the harness the modelling
// agents judge by. A copied constant drifts; an imported one cannot. lib/ ships,
// so this file is a legal import for both.
//
// ── WHY THE PIPELINE IS render → bloom → OUTPUT, IN THAT ORDER ──────────────
// three applies `renderer.toneMapping` only when the destination is the canvas:
// WebGLRenderer forces NoToneMapping for anything drawn into a render target.
// So the moment a composer exists, the RenderPass output is LINEAR HDR and the
// ACES curve has to be re-applied at the end — that is OutputPass's whole job
// (it reads renderer.toneMapping and renderer.toneMappingExposure itself, so the
// exposure 1.05 the viewers set still governs).
//
// This ordering is not incidental, it is the reason the brand colours survive.
// Bloom in linear light adds ENERGY, and ACES then compresses that energy with
// the same curve as everything else. Bloom applied after tone mapping would add
// display-referred white to an already-compressed image and take BitFlow's
// salamander #F78116 straight to cream — the exact failure PIPELINE.md warns
// about ("saturated orange goes pale cream above ~2, you lose the brand colour").
//
// ── WHY MSAA IS PART OF THE BLOOM COMMIT ───────────────────────────────────
// The viewers ask for `antialias: true`, which only ever applied to the default
// framebuffer. Routing through a composer would silently throw it away, and
// these buildings are almost entirely thin mullions, kerbs and LED lines — the
// worst possible subject for aliasing. The composer therefore gets an explicit
// multisampled HalfFloat target, so switching bloom on cannot cost edge quality.
//
// ── WHY THIS IS "SELECTIVE" WITHOUT A SECOND SCENE ─────────────────────────
// The tuning below is a HIGH-THRESHOLD single pass, not a bright-layer split.
// Measured in the real renderer, the gap between the two populations is three
// orders of magnitude: the near-black massing (#0A0B0D albedo under this rig)
// sits at linear luminance ~1e-3…1e-2, while lit glass, LED trim, signage, the
// water jet and the beacon sit at ~0.3…3. A threshold in between separates them
// completely, so a second render of a bright-only layer would buy nothing and
// cost a full extra scene pass. See BLOOM.threshold for the numbers.
// ═══════════════════════════════════════════════════════════════════════════

import type * as THREE_NS from "three"

export interface BloomTuning {
  /** UnrealBloomPass strength — how much of the halo is added back */
  strength: number
  /** UnrealBloomPass radius — how far the widest mip spreads */
  radius: number
  /** linear-luminance cut. Below this a pixel contributes nothing. */
  threshold: number
  /** MSAA samples on the composer target (0 = none) */
  samples: number
  /**
   * Bloom mip chain resolution as a fraction of the DRAWING BUFFER (device
   * pixels, not CSS). The pass is 1 high-pass + 10 separable blurs + 1 composite
   * + 1 additive blend, all at this scale.
   *
   * Do not reach for this as a perf lever — measured, it is not one: 0.5, 0.35 and
   * 0.25 all land within 0.03 ms of each other (see BLOOM_MOBILE). What it DOES
   * change is the look, because the blur kernels are sized in bloom-target pixels:
   * halving the scale doubles the halo's spread relative to the frame. Keep it the
   * same on every device or the phone gets a different effect from the desktop.
   */
  bloomScale: number
}

/**
 * The shipped tuning, in linear light. Every number below was measured, not
 * eyeballed — see the derivations.
 *
 * ── threshold 0.16 ─────────────────────────────────────────────────────────
 * From a readback of the actual half-float buffer behind the tone mapping
 * (BitFlow HQ, three-quarter, 217k opaque pixels), luminance distributes as:
 *
 *   p50 0.0215   p75 0.0237   p90 0.0542   p95 0.321   p99 0.532   max 2.49
 *
 * That is two populations with almost nothing between them: ~90% of the plate
 * is massing, paving and planting below 0.055, and the ~8% above 0.1 is the
 * emissive set. Coverage at or above L: 0.05→10.4%, 0.10→8.3%, 0.20→7.2%,
 * 0.42→1.8%. The cliff between 0.055 and 0.10 IS the boundary between the
 * building and its lights, which is why one threshold in that gap is enough and
 * a second bright-only render pass would buy nothing.
 *
 * 0.16 sits above the cliff — three times the 90th-percentile massing pixel —
 * and below BitFlow's salamander LED, which matters because a SATURATED source
 * has low luminance for its apparent brightness: the orange population measures
 * p10 0.054, p50 0.200, p90 0.372 against white signage at 1.4–1.5. A
 * "safe-looking" 0.42 excludes the entire orange spine and blooms only the white
 * glass — the wrong building, and the one halo the BitFlow reference is most
 * about. Measured: raising 0.16 → 0.35 costs the spine's glow and buys only
 * +0.03 of orange saturation, because the window grid dominates the energy at
 * every threshold in this range.
 *
 * ── strength 0.22 ─────────────────────────────────────────────────────────
 * This is the parameter that decides whether the brand survives, and it is the
 * one the library's defaults get most wrong for this subject.
 *
 * The composite sums five mips whose weights total 3.0 + 1.2·radius, and the
 * high pass keeps a passing pixel's FULL value rather than value-minus-threshold.
 * So over a LARGE bright area — and BitFlow's window grid is exactly that — the
 * additive gain is strength × ~3.1. At the library default of 1.0 the glass
 * quadruples, ACES compresses it to white, and the salamander spine goes with it.
 *
 * Measured on the BitFlow front elevation, which is the worst case because the
 * LED spine runs down the middle flanked by the two brightest window walls, so
 * the spine receives everyone else's cream halo on top of its own:
 *
 *   spine strip, mean saturation      strength 0.62 → 0.37   ← cream, a failure
 *                                     strength 0.30 → 0.37…0.46
 *                                     strength 0.22 → 0.455
 *                            (no bloom at all: 0.667)
 *   roof mark, isolated against sky   no bloom 0.759 → 0.768 at 0.22
 *                                     (0.740 at 0.30, 0.63 in its hottest decile)
 *   dark perforated panel, mean luma  35 → 67 at 0.22   (→ 86 at 0.30)
 *
 * 0.22 is where the roof mark — the brand element that stands alone against the
 * sky, so the honest test — comes through the pass with its saturation intact and
 * its hue moved by less than half a degree, while the panel beside the glass
 * gains a warm veil rather than a wash. bitflowhq.jpeg shows exactly that veil:
 * its perforated panels are warm dark brown, not black.
 *
 * ── radius 0.10 ───────────────────────────────────────────────────────────
 * Radius redistributes rather than adds: the per-mip weight is
 * mix(f, 1.2 − f, radius), so a LOW radius concentrates the energy in the sharp
 * mips and starves the 1/32-resolution one. That is the difference between the
 * references' tight two-or-three-pixel bleed and a soft-focus filter — and it is
 * also what keeps the massing honest, because the widest mip is the only part of
 * the pass that can lift a pixel forty pixels from any light at all. Measured on
 * BitFlow over void: dropping radius from 0.35 to 0.12 left the far massing
 * unchanged (+2.11 → +2.16 luma) while the halo ON the massing next to a light
 * went from +25.6 to +33.7 — tighter AND brighter exactly where it should be.
 */
export const BLOOM: BloomTuning = {
  strength: 0.22,
  radius: 0.10,
  threshold: 0.16,
  samples: 4,
  bloomScale: 0.5,
}

/**
 * Phones get the SAME halo, at half the multisampling.
 *
 * The first version of this cut bloomScale to 0.25 on mobile, which was wrong
 * twice over. Wrong on looks: the blur kernels are sized in bloom-target pixels,
 * so halving that target doubles the halo's spread RELATIVE to the frame — the
 * phone would have got the soft-focus version of the effect the desktop is
 * carefully avoiding. And wrong on cost: it buys nothing. Measured on a GTX 1650
 * at 390×844 with devicePixelRatio 2 (a 780×1614 drawing buffer), Kray Tower:
 *
 *   bloom off                        0.87 ms/frame
 *   bloom @0.5, samples 0            0.98 ms   (+0.12)
 *   bloom @0.5, samples 2            1.42 ms   (+0.55)
 *   bloom @0.35, samples 2           1.40 ms   (+0.53)
 *   bloom @0.25, samples 2           1.39 ms   (+0.52)
 *
 * The mip chain costs ~0.12 ms and does not care about its resolution; ALL the
 * rest is the multisampled composer target. So the only lever worth pulling on a
 * phone is `samples`, and it drops to 2 rather than to 0 because 0 means no
 * antialiasing anywhere — a regression against today's `antialias: true` canvas
 * on a subject made almost entirely of one-pixel mullions.
 */
export const BLOOM_MOBILE: BloomTuning = {
  ...BLOOM,
  samples: 2,
}

/** the breakpoint the viewers already use for shadows — kept identical on purpose */
export const BLOOM_MOBILE_BREAKPOINT = 768

export function bloomTuningFor(viewportWidth: number): BloomTuning {
  return viewportWidth >= BLOOM_MOBILE_BREAKPOINT ? BLOOM : BLOOM_MOBILE
}

export interface BloomRig {
  /** call instead of renderer.render(scene, camera) */
  render: () => void
  /** CSS pixels; pixel ratio is read off the renderer, so a DPR change lands too */
  setSize: (w: number, h: number) => void
  dispose: () => void
  /** live handle, for the workbench's readout and for tuning sweeps */
  bloom: { strength: number; radius: number; threshold: number }
}

/**
 * Build the composer. The jsm postprocessing modules are imported HERE rather
 * than at module scope so they stay out of the initial bundle — the viewers
 * already dynamic-import three itself for the same reason.
 */
export async function createBloomRig(
  THREE: typeof THREE_NS,
  renderer: THREE_NS.WebGLRenderer,
  scene: THREE_NS.Scene,
  camera: THREE_NS.Camera,
  width: number,
  height: number,
  tuning: BloomTuning = BLOOM,
): Promise<BloomRig> {
  const { EffectComposer } = await import("three/examples/jsm/postprocessing/EffectComposer.js")
  const { RenderPass } = await import("three/examples/jsm/postprocessing/RenderPass.js")
  const { UnrealBloomPass } = await import("three/examples/jsm/postprocessing/UnrealBloomPass.js")
  const { OutputPass } = await import("three/examples/jsm/postprocessing/OutputPass.js")

  // HalfFloat is what makes the threshold meaningful: an 8-bit target clips at
  // 1.0 and every emissive surface would arrive at the high pass as the same
  // white. `samples` restores the antialiasing the composer would otherwise
  // take away (see the header).
  const target = new THREE.WebGLRenderTarget(Math.max(1, width), Math.max(1, height), {
    type: THREE.HalfFloatType,
    samples: tuning.samples,
  })
  target.texture.name = "AnchorComposer.rt"

  const composer = new EffectComposer(renderer, target)
  // The target was made at CSS size; this multiplies both buffers up by the
  // renderer's pixel ratio and is also what teaches the composer that ratio.
  composer.setSize(width, height)

  composer.addPass(new RenderPass(scene, camera))

  // resolution is set by setSize() below, in DRAWING-BUFFER pixels — passing CSS
  // pixels here and device pixels there is how a mip chain silently changes scale
  // on the first resize.
  const bloom = new UnrealBloomPass(
    new THREE.Vector2(1, 1),
    tuning.strength,
    tuning.radius,
    tuning.threshold,
  )
  composer.addPass(bloom)

  // ACES + sRGB, re-applied at the end because a render target got NoToneMapping.
  // Without this pass the whole plate arrives linear and washed out.
  const output = new OutputPass()
  composer.addPass(output)

  const setSize = (w: number, h: number) => {
    // The composer caches the pixel ratio it was CONSTRUCTED with, so an
    // orientation change that also changes devicePixelRatio has to re-seed it —
    // otherwise the buffers keep the old scale and the whole plate renders soft.
    composer.setPixelRatio(renderer.getPixelRatio())
    composer.setSize(Math.max(1, w), Math.max(1, h))
    // composer.setSize() has just called bloom.setSize() at FULL drawing-buffer
    // resolution; the bloom's own scale is re-applied on top of that.
    const pr = renderer.getPixelRatio()
    bloom.setSize(
      Math.max(1, Math.round(w * pr * tuning.bloomScale)),
      Math.max(1, Math.round(h * pr * tuning.bloomScale)),
    )
  }
  setSize(width, height)

  return {
    render: () => composer.render(),
    setSize,
    dispose: () => {
      // composer.dispose() frees its two ping-pong targets and the copy pass —
      // it does NOT touch the passes, and UnrealBloomPass owns 11 render targets
      // of its own. Leaking those on every scroll-past is a real leak.
      bloom.dispose()
      output.dispose()
      composer.dispose()
    },
    bloom,
  }
}
