<template>
  <span class="red-dot" aria-hidden="true" />
</template>

<style scoped>
/* M3-11 红点：小圆点，位置由父容器锚定 */
.red-dot {
  position: absolute;
  top: 3px;
  right: -4px;
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: #ff5a7a;
  box-shadow: 0 0 0 2px rgb(255 255 255 / 92%);
}
</style>
