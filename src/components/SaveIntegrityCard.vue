<script setup lang="ts">
import { computed, ref } from 'vue';
import { Download, FileWarning, ShieldAlert, ShieldCheck } from '@lucide/vue';
import { downloadRawSaveDiagnostics } from '@/save/storage';
import { useSettingsStore } from '@/stores/settings';

const settings = useSettingsStore();
const exporting = ref(false);
const exportError = ref<string | null>(null);

const status = computed(() => settings.integrityStatus);
const tone = computed(() => {
  if (status.value.state === 'verified') return 'verified';
  if (status.value.state === 'imported' || status.value.state === 'legacy') return 'local';
  return status.value.state === 'error' ? 'error' : 'empty';
});
const title = computed(() => {
  switch (status.value.state) {
    case 'verified':
      return '完整性链已验证';
    case 'imported':
      return '本地导入档';
    case 'legacy':
      return '旧存档等待升级保护';
    case 'error':
      return '检测到完整性异常';
    default:
      return '尚未建立完整性链';
  }
});
const description = computed(() => {
  switch (status.value.state) {
    case 'verified':
      return `主档与上一版备份的摘要链正常 · revision ${status.value.revision ?? 0}`;
    case 'imported':
      return '这份进度来自 JSON 导入，可继续单机游玩；未来联网资产需重新与服务端对账。';
    case 'legacy':
      return '存档内容未改变；下一次自动保存会无损升级为带摘要和备份链的新格式。';
    case 'error':
      return status.value.message ?? '自动写入已停止，请先导出诊断文件并从启动页选择恢复。';
    default:
      return '创建角色并首次保存后，会自动建立主档与备份的摘要链。';
  }
});

async function exportDiagnostics() {
  exporting.value = true;
  exportError.value = null;
  try {
    await downloadRawSaveDiagnostics();
  } catch (error) {
    exportError.value = error instanceof Error ? error.message : '诊断文件导出失败';
  } finally {
    exporting.value = false;
  }
}
</script>

<template>
  <section class="integrity-card" :class="`tone-${tone}`" aria-label="存档完整性状态">
    <div class="integrity-mark" aria-hidden="true">
      <ShieldCheck v-if="tone === 'verified'" :size="21" />
      <ShieldAlert v-else-if="tone === 'error'" :size="21" />
      <FileWarning v-else :size="21" />
    </div>
    <div class="integrity-copy">
      <strong>{{ title }}</strong>
      <p>{{ description }}</p>
      <small>
        公开摘要用于发现损坏和普通修改，不是绝对防作弊；影响他人的装备、货币与奖励仍由服务端记录裁定。
      </small>
    </div>
    <button
      type="button"
      class="diagnostic-button"
      :disabled="exporting"
      @click="exportDiagnostics"
    >
      <Download :size="16" />
      {{ exporting ? '正在整理…' : '导出诊断' }}
    </button>
    <p v-if="exportError" class="diagnostic-error" role="alert">{{ exportError }}</p>
  </section>
</template>

<style scoped>
.integrity-card {
  --integrity-accent: #5da4d4;
  --integrity-soft: rgb(232 247 255 / 92%);

  display: grid;
  grid-template-columns: 2.6rem minmax(0, 1fr);
  gap: 0.65rem;
  margin: 0.7rem 0.75rem 0;
  padding: 0.75rem;
  overflow: hidden;
  color: var(--text-mid);
  background:
    radial-gradient(circle at 95% 0%, rgb(255 255 255 / 90%), transparent 42%),
    var(--integrity-soft);
  border: 1px solid color-mix(in srgb, var(--integrity-accent) 34%, white);
  border-radius: var(--r-sm);
  box-shadow: inset 0 1px 0 rgb(255 255 255 / 80%);
}

.tone-local {
  --integrity-accent: #d58ab0;
  --integrity-soft: rgb(255 241 248 / 94%);
}

.tone-error {
  --integrity-accent: #d66776;
  --integrity-soft: rgb(255 238 240 / 94%);
}

.integrity-mark {
  width: 2.6rem;
  height: 2.6rem;
  display: grid;
  place-items: center;
  color: #fff;
  background: linear-gradient(
    145deg,
    color-mix(in srgb, var(--integrity-accent) 72%, white),
    var(--integrity-accent)
  );
  border: 1px solid rgb(255 255 255 / 82%);
  border-radius: 0.9rem;
  box-shadow: 0 0.35rem 0.8rem color-mix(in srgb, var(--integrity-accent) 24%, transparent);
}

.integrity-copy {
  min-width: 0;
}

.integrity-copy strong {
  display: block;
  margin-bottom: 0.18rem;
  font-size: 0.8rem;
  color: var(--text);
}

.integrity-copy p,
.integrity-copy small {
  overflow-wrap: anywhere;
  line-height: 1.55;
}

.integrity-copy p {
  margin: 0;
  font-size: 0.72rem;
}

.integrity-copy small {
  display: block;
  margin-top: 0.35rem;
  font-size: 0.65rem;
  color: var(--text-dim);
}

.diagnostic-button {
  grid-column: 1 / -1;
  min-height: 2.75rem;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 0.4rem;
  width: 100%;
  font-size: 0.75rem;
  font-weight: 700;
  color: color-mix(in srgb, var(--integrity-accent) 72%, #354052);
  background: rgb(255 255 255 / 78%);
  border: 1px solid color-mix(in srgb, var(--integrity-accent) 28%, white);
  border-radius: 0.75rem;
}

.diagnostic-button:disabled {
  opacity: 0.58;
}

.diagnostic-error {
  grid-column: 1 / -1;
  margin: 0;
  font-size: 0.7rem;
  line-height: 1.5;
  color: var(--danger);
}

@media (min-width: 480px) {
  .integrity-card {
    grid-template-columns: 2.6rem minmax(0, 1fr) auto;
    align-items: start;
  }

  .diagnostic-button {
    grid-column: auto;
    min-width: 7.5rem;
  }
}
</style>
