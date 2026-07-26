<script setup lang="ts">
// M0 阶段为静态占位。真实数据在 M2-11 接入 player store。
const placeholder = {
  name: '未创建角色',
  level: 1,
  expPercent: 0,
  cp: 0,
  gold: 0,
  stamina: 120,
  staminaMax: 120,
};
</script>

<template>
  <header class="topbar">
    <div class="avatar">樱</div>

    <div class="info">
      <div class="line1">
        <span class="name">{{ placeholder.name }}</span>
        <span class="lv">Lv.{{ placeholder.level }}</span>
      </div>
      <div class="expbar">
        <div class="expbar-fill" :style="{ width: placeholder.expPercent + '%' }" />
      </div>
    </div>

    <div class="stats">
      <div class="stat">
        <span class="stat-icon">⚔</span>
        <span class="stat-val">{{ placeholder.cp }}</span>
      </div>
      <div class="stat">
        <span class="stat-icon">⚡</span>
        <span class="stat-val">{{ placeholder.stamina }}/{{ placeholder.staminaMax }}</span>
      </div>
    </div>
  </header>
</template>

<style scoped>
.topbar {
  display: flex;
  align-items: center;
  gap: 10px;
  height: calc(var(--topbar-h) + var(--sat));
  padding: var(--sat) 12px 0;
  background: linear-gradient(180deg, var(--bg-panel-2), var(--bg-panel));
  border-bottom: 1px solid rgb(167 139 250 / 15%);
  flex-shrink: 0;
}

.avatar {
  width: 36px;
  height: 36px;
  border-radius: 50%;
  display: grid;
  place-items: center;
  font-size: 16px;
  font-weight: 700;
  color: var(--bg-base);
  background: linear-gradient(135deg, var(--accent), var(--purple));
  flex-shrink: 0;
}

.info {
  flex: 1;
  min-width: 0;
}

.line1 {
  display: flex;
  align-items: baseline;
  gap: 6px;
}

.name {
  font-size: 13px;
  font-weight: 600;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.lv {
  font-size: 11px;
  color: var(--gold);
  flex-shrink: 0;
}

.expbar {
  height: 4px;
  margin-top: 4px;
  border-radius: 2px;
  background: rgb(0 0 0 / 40%);
  overflow: hidden;
}

.expbar-fill {
  height: 100%;
  background: linear-gradient(90deg, var(--accent), var(--gold));
  transition: width 0.3s;
}

.stats {
  display: flex;
  flex-direction: column;
  gap: 2px;
  font-size: 11px;
  text-align: right;
  flex-shrink: 0;
}

.stat {
  display: flex;
  align-items: center;
  justify-content: flex-end;
  gap: 3px;
}

.stat-icon {
  font-size: 10px;
  opacity: 0.7;
}

.stat-val {
  color: var(--text-dim);
  font-variant-numeric: tabular-nums;
}
</style>
