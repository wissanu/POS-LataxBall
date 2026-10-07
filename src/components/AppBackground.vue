<template>
  <div class="orbs" aria-hidden="true">
    <i class="orb o1" /><i class="orb o2" /><i class="orb o3" />
  </div>
</template>

<style scoped>
.orbs { position: fixed; inset: 0; overflow: hidden; z-index: 0; pointer-events: none;
  background: linear-gradient(135deg, #e3eefb 0%, #dbe7f6 55%, #d3e2f6 100%); }
.orb { position: absolute; width: 384px; height: 384px; border-radius: 9999px; filter: blur(32px); }
.o1 { left: -128px; top: -128px; background: rgba(191, 219, 254, 0.5); }
.o2 { right: 320px; top: 256px; background: rgba(199, 210, 254, 0.4); }
.o3 { left: 42%; bottom: -128px; background: rgba(186, 230, 253, 0.5); }
</style>
