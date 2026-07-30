<script setup lang="ts">
import { ref } from 'vue';
import { RefreshCw } from '@lucide/vue';
import { registerPwaUpdates } from '@/pwa/register';

const needRefresh = ref(false);
const updating = ref(false);
const updateError = ref(false);

const updateServiceWorker = registerPwaUpdates({
  onNeedRefresh() {
    needRefresh.value = true;
    updateError.value = false;
  },
  onRegisterError() {
    // 注册失败时旧版本仍可离线运行；这里不伪装成已经更新成功。
    updateError.value = true;
  },
});

async function applyUpdate(): Promise<void> {
  if (updating.value) return;
  updating.value = true;
  updateError.value = false;
  try {
    await updateServiceWorker(true);
    // 成功后由 vite-plugin-pwa 在新 SW 接管时刷新整页。
  } catch {
    updating.value = false;
    updateError.value = true;
  }
}
</script>

<template>
  <Transition name="pwa-update">
    <aside
      v-if="needRefresh"
      class="pwa-update"
      role="status"
      aria-live="polite"
      aria-label="发现游戏新版本"
    >
      <div class="pwa-update-copy">
        <strong>发现新版本</strong>
        <span v-if="updateError">更新没有完成，请保持联网后重试。</span>
        <span v-else>刷新后再继续，榜单与游戏资源会同步到同一版本。</span>
      </div>
      <button type="button" :disabled="updating" @click="applyUpdate">
        <RefreshCw :size="14" :class="{ spinning: updating }" aria-hidden="true" />
        {{ updating ? '更新中…' : updateError ? '重试更新' : '立即刷新' }}
      </button>
    </aside>
  </Transition>
</template>

<style scoped>
.pwa-update {
  position: fixed;
  z-index: 120;
  left: 50%;
  bottom: calc(72px + env(safe-area-inset-bottom));
  width: min(calc(100% - 28px), 362px);
  min-height: 64px;
  padding: 10px 10px 10px 13px;
  display: flex;
  align-items: center;
  gap: 10px;
  color: #334660;
  background: rgb(250 253 255 / 97%);
  border: 1px solid rgb(138 194 235 / 70%);
  border-radius: 16px;
  box-shadow:
    0 12px 32px rgb(64 107 145 / 22%),
    inset 0 1px 0 rgb(255 255 255 / 90%);
  transform: translateX(-50%);
  backdrop-filter: blur(14px);
}

.pwa-update-copy {
  min-width: 0;
  display: grid;
  gap: 3px;
  flex: 1;
}

.pwa-update-copy strong {
  font-size: 13px;
  color: #243d5c;
}

.pwa-update-copy span {
  font-size: 10px;
  line-height: 1.45;
  color: #667b91;
}

.pwa-update button {
  min-width: 92px;
  min-height: 38px;
  padding: 0 11px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 5px;
  font: inherit;
  font-size: 11px;
  font-weight: 700;
  color: #fff;
  background: linear-gradient(135deg, #6eb9e7, #ee8fbd);
  border: 0;
  border-radius: 12px;
  box-shadow: 0 5px 13px rgb(117 166 207 / 28%);
}

.pwa-update button:disabled {
  cursor: wait;
  opacity: 0.75;
}

.spinning {
  animation: pwa-update-spin 0.9s linear infinite;
}

.pwa-update-enter-active,
.pwa-update-leave-active {
  transition:
    opacity 0.2s ease,
    transform 0.2s ease;
}

.pwa-update-enter-from,
.pwa-update-leave-to {
  opacity: 0;
  transform: translate(-50%, 10px);
}

@keyframes pwa-update-spin {
  to {
    transform: rotate(360deg);
  }
}

@media (max-width: 350px), (max-height: 700px) {
  .pwa-update {
    bottom: calc(64px + env(safe-area-inset-bottom));
    width: calc(100% - 16px);
    padding-left: 10px;
  }

  .pwa-update button {
    min-width: 86px;
    padding-inline: 9px;
  }
}

@media (prefers-reduced-motion: reduce) {
  .pwa-update-enter-active,
  .pwa-update-leave-active,
  .spinning {
    transition: none;
    animation: none;
  }
}
</style>
