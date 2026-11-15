// The look plan, in one place: dusk at an industrial foundry — ember orange against cold
// slate and concrete, under a sky that falls from deep indigo to a burnt horizon. The six
// core values are shared with the CSS custom properties in index.html; the sky, fog and
// light values below are the 3D-only extension of the same plan, so the page and the
// world can never drift apart. Lighting shades everything between these anchors.
export const PALETTE = {
  canvas: '#17130f',
  surface: '#221c16',
  hairline: '#3a3128',
  ink: '#f2ead9',
  muted: '#a89a83',
  accent: '#ff7a1a',
  danger: '#e5484d',
  ally: '#ffb454',
};

// The sky, top to bottom: zenith indigo, a violet band, then the ember horizon the sun
// has just dropped behind. world.js paints these onto the sky dome as a gradient.
export const SKY = {
  zenith: '#1c2340',
  upper: '#3a2c4e',
  lower: '#8a4632',
  horizon: '#ff8a3d',
  sunCore: '#ffd9a0',
  sunGlow: '#ff7a1a',
};

// Atmosphere: warm dust hanging in the air. Fog starts past the far site so a long lane
// stays readable, and ends just beyond the map shell so the walls melt into dusk.
export const ATMOSPHERE = {
  fog: '#4a2c20',
  fogNear: 30,
  fogFar: 78,
  dust: '#ffb454',
};

// Light rig anchors: one low warm sun, a cool sky bounce, and the foundry's own lamps.
export const LIGHTS = {
  sun: '#ffb36b',
  sunIntensity: 3.1,
  sky: '#8a97c4',
  ground: '#2e2015',
  skyIntensity: 1.3,
  fill: '#5a6a8a',
  fillIntensity: 0.7,
  lamp: '#ffd9a0',
  ember: '#ff7a1a',
};

export function shade(name) {
  return PALETTE[name];
}
