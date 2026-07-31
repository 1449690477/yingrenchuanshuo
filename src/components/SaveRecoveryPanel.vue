<script setup lang="ts">
import { nextTick, onMounted, ref } from 'vue';
import { Download, RotateCcw, Trash2 } from '@lucide/vue';
import {
  downloadRawSaveDiagnostics,
  forceClearCorruptedSave,
  recoverBackup,
  type SaveIntegrityStatus,
} from '@/save/storage';

const props = defineProps<{
  error: string;
  status: SaveIntegrityStatus;
}>();

const busy = ref<'recover' | 'export' | 'clear' | null>(null);
const actionError = ref<string | null>(null);
const confirmClear = ref(false);
const primaryButton = ref<HTMLButtonElement | null>(null);
const clearButton = ref<HTMLButtonElement | null>(null);

onMounted(() => primaryButton.value?.focus());

async function recover() {
  busy.value = 'recover';
  actionError.value = null;
  try {
    await recoverBackup();
    window.location.reload();
  } catch (error) {
    actionError.value = error instanceof Error ? error.message : '备份恢复失败';
    busy.value = null;
  }
}

async function exportDiagnostics() {
  busy.value = 'export';
  actionError.value = null;
  try {
    await downloadRawSaveDiagnostics();
  } catch (error) {
    actionError.value = error instanceof Error ? error.message : '诊断文件导出失败';
  } finally {
    busy.value = null;
  }
}

async function askClear() {
  confirmClear.value = true;
  await nextTick();
  clearButton.value?.focus();
}

async function cancelClear() {
  confirmClear.value = false;
  await nextTick();
  primaryButton.value?.focus();
}

async function clearCorrupted() {
  busy.value = 'clear';
  actionError.value = null;
  try {
    await forceClearCorruptedSave();
    window.location.reload();
  } catch (error) {
    actionError.value = error instanceof Error ? error.message : '损坏存档清除失败';
    busy.value = null;
  }
}
</script>

<template>
  <section class="recovery-panel" aria-labelledby="recovery-title">
    <div class="recovery-heading">
      <small>LOCAL SAVE INTEGRITY</small>
      <h1 id="recovery-title">存档完整性需要你确认</h1>
    </div>

    <p class="recovery-error" role="alert">{{ props.error }}</p>
    <p class="recovery-explain">
      为避免把异常内容覆盖成“正常存档”，游戏已经停止自动写入。原始主档和备份都还保留着。
    </p>

    <div v-if="!confirmClear" class="recovery-actions">
      <button
        v-if="props.status.backupAvailable"
        ref="primaryButton"
        type="button"
        class="recovery-button primary"
        :disabled="busy !== null"
        @click="recover"
      >
        <RotateCcw :size="17" />
        {{ busy === 'recover' ? '正在恢复…' : '恢复上一版备份' }}
      </button>
      <button
        v-else
        ref="primaryButton"
        type="button"
        class="recovery-button"
        :disabled="busy !== null"
        @click="exportDiagnostics"
      >
        <Download :size="17" />
        {{ busy === 'export' ? '正在整理…' : '先导出诊断文件' }}
      </button>
      <button
        v-if="props.status.backupAvailable"
        type="button"
        class="recovery-button"
        :disabled="busy !== null"
        @click="exportDiagnostics"
      >
        <Download :size="17" />
        {{ busy === 'export' ? '正在整理…' : '导出原始诊断' }}
      </button>
      <button
        type="button"
        class="recovery-button danger"
        :disabled="busy !== null"
        @click="askClear"
      >
        <Trash2 :size="17" />
        放弃并重新开始
      </button>
    </div>

    <div v-else class="clear-confirm" role="group" aria-label="确认清除损坏存档">
      <strong>最后确认</strong>
      <p>这会删除主档、备份与隔离副本，无法撤销。建议先导出诊断文件。</p>
      <div class="clear-actions">
        <button
          type="button"
          class="recovery-button"
          :disabled="busy !== null"
          @click="cancelClear"
        >
          返回
        </button>
        <button
          ref="clearButton"
          type="button"
          class="recovery-button danger-solid"
          :disabled="busy !== null"
          @click="clearCorrupted"
        >
          {{ busy === 'clear' ? '正在清除…' : '确认永久清除' }}
        </button>
      </div>
    </div>

    <p v-if="actionError" class="action-error" role="alert">{{ actionError }}</p>
    <p class="security-boundary">
      此处使用公开摘要检测损坏与普通修改；真正影响其他玩家的资产仍需服务端账本验证。
    </p>
  </section>
</template>

<style scoped>
.recovery-panel {
  width: min(100%, 22rem);
  padding: 1rem;
  text-align: left;
  background:
    radial-gradient(circle at 100% 0%, rgb(222 244 255 / 90%), transparent 38%),
    linear-gradient(155deg, rgb(255 255 255 / 96%), rgb(255 242 248 / 94%));
  border: 1px solid rgb(255 255 255 / 92%);
  border-radius: 1.25rem;
  box-shadow:
    0 1rem 2.5rem rgb(78 103 126 / 18%),
    inset 0 0 0 1px rgb(126 190 226 / 22%);
}

.recovery-heading small {
  display: block;
  margin-bottom: 0.3rem;
  font-size: 0.62rem;
  font-weight: 800;
  letter-spacing: 0.12em;
  color: var(--blue-deep);
}

.recovery-heading h1 {
  margin: 0;
  font-size: clamp(1.05rem, 5vw, 1.35rem);
  color: var(--text);
}

.recovery-error,
.recovery-explain,
.security-boundary,
.action-error {
  overflow-wrap: anywhere;
  line-height: 1.6;
}

.recovery-error {
  max-height: 9rem;
  overflow: auto;
  margin: 0.8rem 0 0;
  padding: 0.7rem;
  font-size: 0.75rem;
  color: var(--danger);
  background: rgb(255 236 240 / 82%);
  border: 1px solid rgb(231 121 140 / 24%);
  border-radius: 0.75rem;
  user-select: text;
}

.recovery-explain,
.security-boundary {
  margin: 0.65rem 0 0;
  font-size: 0.72rem;
  color: var(--text-mid);
}

.recovery-actions,
.clear-actions {
  display: grid;
  grid-template-columns: 1fr;
  gap: 0.5rem;
  margin-top: 0.85rem;
}

.recovery-button {
  min-width: 0;
  min-height: 2.75rem;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 0.4rem;
  padding: 0.6rem 0.75rem;
  font-size: 0.75rem;
  font-weight: 750;
  color: var(--text-mid);
  background: rgb(255 255 255 / 86%);
  border: 1px solid var(--hairline);
  border-radius: 0.75rem;
}

.recovery-button.primary {
  color: #fff;
  background: linear-gradient(120deg, var(--blue-deep), #77bde3);
  border-color: transparent;
  box-shadow: 0 0.4rem 1rem rgb(73 156 202 / 25%);
}

.recovery-button.danger {
  color: var(--danger);
  border-color: rgb(224 108 126 / 28%);
}

.recovery-button.danger-solid {
  color: #fff;
  background: var(--danger);
  border-color: transparent;
}

.recovery-button:disabled {
  opacity: 0.55;
}

.clear-confirm {
  margin-top: 0.85rem;
  padding: 0.75rem;
  background: rgb(255 239 242 / 88%);
  border: 1px solid rgb(222 102 122 / 25%);
  border-radius: 0.8rem;
}

.clear-confirm strong {
  font-size: 0.8rem;
  color: var(--danger);
}

.clear-confirm p,
.action-error {
  margin: 0.35rem 0 0;
  font-size: 0.72rem;
}

.action-error {
  color: var(--danger);
}

.security-boundary {
  padding-top: 0.65rem;
  color: var(--text-dim);
  border-top: 1px dashed var(--hairline);
}

@media (min-width: 360px) {
  .clear-actions {
    grid-template-columns: 1fr 1fr;
  }
}

@media (prefers-reduced-motion: reduce) {
  .recovery-button {
    transition: none;
  }
}
</style>
