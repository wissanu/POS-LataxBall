// Icon artwork for the container buttons (48×48 grid, stroke = currentColor).
export const ICONS = {
  // lump on its own, no container
  none: `
    <path d="M8 33C7 20 15 10 24 10s17 10 16 23c0 4-7 7-16 7S8 37 8 33Z" fill="currentColor" fill-opacity=".12"/>
    <path d="M16 21c2-4 6-6 10-6"/>
    <path d="M13 34c7 3 15 3 22 0"/>`,
  // เข่ง — round woven basket
  keng: `
    <path d="M9 14l3.5 24c.8 3 5.8 5.2 11.5 5.2S34.7 41 35.5 38L39 14Z" fill="currentColor" fill-opacity=".12"/>
    <ellipse cx="24" cy="14" rx="15" ry="4.5" fill="#fff"/>
    <path d="M11 22c4 2.5 9 3.6 13 3.6s9-1.1 13-3.6"/>
    <path d="M12 30c3.6 2.2 8 3.2 12 3.2s8.4-1 12-3.2"/>
    <path d="M18 18.6l1.2 23M24 19v24.2M30 18.6l-1.2 23"/>`,
  // ตะกร้า — plastic basket with handle slot (scaled per size)
  basket: `
    <path d="M9 14h30l-3.4 23.5a3.5 3.5 0 0 1-3.4 3H15.8a3.5 3.5 0 0 1-3.4-3L9 14Z" fill="currentColor" fill-opacity=".12"/>
    <path d="M7 14h34"/>
    <rect x="18" y="17.5" width="12" height="3.2" rx="1.6"/>
    <path d="M14.5 26h19M15.5 33h17"/>`,
}

export const basketTransform = (scale) => `translate(24 41) scale(${scale}) translate(-24 -41)`
