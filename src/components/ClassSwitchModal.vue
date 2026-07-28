<script setup lang="ts">
import { computed, nextTick, onMounted, onUnmounted, ref } from 'vue';
import { CLASS_IDS, type ClassId } from '@/core/types';
import { CLASS_INFO } from '@/data/constants';
import ClassArtwork from './ClassArtwork.vue';

const props = withDefaults(
  defineProps<{
    currentClass: ClassId;
    busy?: boolean;
  }>(),
  {
    busy: false,
  },
);

const emit = defineEmits<{
  close: [];
  confirm: [target: ClassId];
}>();

const dialog = ref<HTMLElement | null>(null);
const closeButton = ref<HTMLButtonElement | null>(null);
const picked = ref<ClassId | null>(null);
let returnFocus: HTMLElement | null = null;

const pickedInfo = computed(() => (picked.value ? CLASS_INFO[picked.value] : null));

function requestClose(): void {
  if (!props.busy) emit('close');
}

function selectClass(classId: ClassId): void {
  if (props.busy || classId === props.currentClass) return;
  picked.value = classId;
}

function confirm(): void {
  if (!picked.value || props.busy) return;
  emit('confirm', picked.value);
}

function onKeydown(event: KeyboardEvent): void {
  if (event.key === 'Escape') {
    event.preventDefault();
    requestClose();
    return;
  }
  if (event.key !== 'Tab' || !dialog.value) return;

  const focusable = [
    ...dialog.value.querySelectorAll<HTMLElement>(
      'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])',
    ),
  ].filter((element) => !element.hasAttribute('hidden'));
  const first = focusable[0];
  const last = focusable.at(-1);
  if (!first || !last) {
    event.preventDefault();
    return;
  }

  const active = document.activeElement;
  if (event.shiftKey && (active === first || !dialog.value.contains(active))) {
    event.preventDefault();
    last.focus();
  } else if (!event.shiftKey && active === last) {
    event.preventDefault();
    first.focus();
  }
}

onMounted(async () => {
  returnFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null;
  window.addEventListener('keydown', onKeydown);
  await nextTick();
  closeButton.value?.focus();
});

onUnmounted(() => {
  window.removeEventListener('keydown', onKeydown);
  returnFocus?.focus();
});
</script>

<template>
  <Teleport to="body">
    <Transition name="class-switch" appear>
      <div class="class-switch-overlay" @click.self="requestClose">
        <section
          ref="dialog"
          class="class-switch-sheet"
          role="dialog"
          aria-modal="true"
          aria-labelledby="class-switch-title"
          aria-describedby="class-switch-desc"
          :aria-busy="busy"
        >
          <header class="switch-head">
            <span>
              <small>同一角色 · 自由转职</small>
              <strong id="class-switch-title">切换喜欢的角色职业</strong>
            </span>
            <button
              ref="closeButton"
              type="button"
              class="close-button"
              aria-label="关闭角色切换"
              :disabled="busy"
              @click="requestClose"
            >
              ×
            </button>
          </header>

          <div class="switch-content scroll-y">
            <p id="class-switch-desc" class="switch-intro">
              选择新职业后会立即更换角色外形、技能演出和职业属性，已有养成进度不会重置。
            </p>

            <div class="class-grid" aria-label="可切换职业">
              <button
                v-for="classId in CLASS_IDS"
                :key="classId"
                type="button"
                class="class-option"
                :class="{
                  current: classId === currentClass,
                  selected: classId === picked,
                }"
                :disabled="busy || classId === currentClass"
                :aria-pressed="classId === picked"
                @click="selectClass(classId)"
              >
                <span class="class-portrait">
                  <ClassArtwork :class-id="classId" variant="thumb" />
                </span>
                <span class="class-copy">
                  <strong :style="{ color: CLASS_INFO[classId].color }">
                    {{ CLASS_INFO[classId].name }}
                  </strong>
                  <small>{{ CLASS_INFO[classId].role }}</small>
                  <em v-if="classId === currentClass">当前职业</em>
                  <em v-else-if="classId === picked">已选择</em>
                  <em v-else>点击选择</em>
                </span>
              </button>
            </div>

            <div v-if="pickedInfo" class="picked-desc" role="status" aria-live="polite">
              <strong>将切换为 {{ pickedInfo.name }}</strong>
              <span>{{ pickedInfo.desc }}</span>
            </div>

            <section class="progress-note">
              <strong>这些进度全部保留</strong>
              <div class="progress-chips">
                <span>等级与经验</span>
                <span>金币与材料</span>
                <span>关卡进度</span>
                <span>商店与奇遇</span>
              </div>
              <p>
                当前穿戴中不适合新职业的专属装备，会安全收回背包并自动锁定，避免被批量分解；其强化等级和属性也会完整保留。
              </p>
            </section>
          </div>

          <footer class="switch-actions">
            <button type="button" class="cancel-button" :disabled="busy" @click="requestClose">
              暂不切换
            </button>
            <button
              type="button"
              class="confirm-button"
              :disabled="!picked || busy"
              @click="confirm"
            >
              {{
                busy
                  ? '正在安全切换…'
                  : pickedInfo
                    ? `确认切换为${pickedInfo.name}`
                    : '请先选择职业'
              }}
            </button>
          </footer>
        </section>
      </div>
    </Transition>
  </Teleport>
</template>

<style scoped>
.class-switch-overlay {
  position: fixed;
  z-index: 220;
  inset: 0;
  width: 100%;
  max-width: var(--app-max-w);
  margin: 0 auto;

  /*
   * 可滚动 flex + 子元素 margin:auto —— 放得下居中，放不下从顶部开始且能滚完。
   * 溢出，顶部永远滚不到（副本「领取装备」按钮就是这么消失的）。
   * 详见 style.css 里 .overlay 的完整说明。
   */
  display: flex;
  overflow-y: auto;
  overscroll-behavior: contain;
  -webkit-overflow-scrolling: touch;
  padding: calc(var(--sat) + 10px) 10px calc(var(--sab) + 10px);
  background: rgb(35 40 58 / 52%);
  backdrop-filter: blur(5px);
  -webkit-backdrop-filter: blur(5px);
}

.class-switch-sheet {
  margin: auto;
  flex-shrink: 0;
  position: relative;
  width: min(100%, 390px);
  max-height: calc(100dvh - var(--sat) - var(--sab) - 20px);
  display: flex;
  flex-direction: column;
  overflow: hidden;
  background:
    radial-gradient(circle at 100% 0%, rgb(219 239 255 / 76%), transparent 38%),
    linear-gradient(150deg, #fff, #fff8fb 56%, #f1f8ff);
  border: 1px solid rgb(255 255 255 / 82%);
  border-radius: 24px;
  box-shadow:
    0 24px 60px rgb(27 34 52 / 30%),
    inset 0 1px rgb(255 255 255 / 80%);
}

.switch-head {
  flex: 0 0 auto;
  min-height: 68px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
  padding: 10px 11px 10px 15px;
  background: rgb(255 255 255 / 72%);
  border-bottom: 1px solid var(--line);
}

.switch-head > span {
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.switch-head small {
  font-size: 9px;
  font-weight: 700;
  color: var(--pink-deep);
}

.switch-head strong {
  overflow: hidden;
  font-size: 16px;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.close-button {
  width: 44px;
  height: 44px;
  flex: 0 0 44px;
  display: grid;
  place-items: center;
  font-size: 23px;
  line-height: 1;
  color: var(--text-mid);
  background: rgb(242 247 252 / 88%);
  border: 1px solid var(--line);
  border-radius: 50%;
}

.switch-content {
  min-height: 0;
  display: flex;
  flex-direction: column;
  gap: 10px;
  padding: 12px;
  overscroll-behavior: contain;
}

.switch-intro {
  font-size: 10px;
  line-height: 1.65;
  color: var(--text-mid);
}

.class-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 8px;
}

.class-option {
  position: relative;
  min-width: 0;
  min-height: 102px;
  display: grid;
  grid-template-columns: 43px minmax(0, 1fr);
  align-items: center;
  gap: 7px;
  padding: 9px 8px;
  text-align: left;
  background: rgb(255 255 255 / 86%);
  border: 2px solid var(--line);
  border-radius: 16px;
  box-shadow: 0 4px 12px rgb(83 105 135 / 8%);
  transition:
    transform var(--t-fast) var(--ease-spring),
    border-color var(--t-mid) var(--ease-soft),
    background-color var(--t-mid) var(--ease-soft);
}

.class-option:active:not(:disabled) {
  transform: scale(0.96);
}

.class-option.selected {
  background: linear-gradient(145deg, #fff0f6, #eef7ff);
  border-color: var(--pink);
  box-shadow:
    0 0 0 3px rgb(255 158 196 / 15%),
    0 7px 16px rgb(117 135 168 / 13%);
}

.class-option.current {
  color: var(--text-dim);
  background: rgb(239 244 249 / 78%);
  border-style: dashed;
  opacity: 0.72;
}

.class-portrait {
  width: 43px;
  height: 58px;
  display: grid;
  place-items: center;
  overflow: hidden;
  background: linear-gradient(155deg, #fff, #eaf5ff);
  border: 1px solid rgb(255 255 255 / 90%);
  border-radius: 14px;
}

.class-portrait :deep(.class-art) {
  width: 43px;
  height: 58px;
  border: 0;
  border-radius: 0;
  background: transparent;
}

.class-portrait :deep(.portrait) {
  transform: scale(1.82);
  transform-origin: 50% 18%;
}

.class-copy {
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 3px;
}

.class-copy strong {
  font-size: 13px;
}

.class-copy small {
  display: -webkit-box;
  overflow: hidden;
  font-size: 8px;
  line-height: 1.35;
  color: var(--text-dim);
  -webkit-box-orient: vertical;
  -webkit-line-clamp: 2;
}

.class-copy em {
  align-self: flex-start;
  padding: 2px 6px;
  font-size: 7px;
  font-style: normal;
  font-weight: 800;
  color: var(--blue-deep);
  background: var(--blue-soft);
  border-radius: 999px;
}

.selected .class-copy em {
  color: var(--pink-deep);
  background: var(--pink-soft);
}

.picked-desc {
  display: flex;
  flex-direction: column;
  gap: 3px;
  padding: 9px 11px;
  color: #7e5871;
  background: linear-gradient(120deg, #fff1f6, #fff8df);
  border: 1px solid #f3d4df;
  border-radius: 13px;
}

.picked-desc strong {
  font-size: 10px;
}

.picked-desc span {
  font-size: 9px;
  line-height: 1.55;
}

.progress-note {
  display: flex;
  flex-direction: column;
  gap: 8px;
  padding: 10px;
  background: rgb(237 248 255 / 74%);
  border: 1px solid #cfe7f6;
  border-radius: 15px;
}

.progress-note > strong {
  font-size: 11px;
  color: var(--blue-deep);
}

.progress-chips {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 5px;
}

.progress-chips span {
  min-width: 0;
  padding: 5px 6px;
  font-size: 8px;
  font-weight: 700;
  color: var(--text-mid);
  text-align: center;
  background: rgb(255 255 255 / 82%);
  border: 1px solid rgb(255 255 255 / 92%);
  border-radius: 9px;
}

.progress-note p {
  font-size: 8px;
  line-height: 1.6;
  color: var(--text-mid);
}

.switch-actions {
  flex: 0 0 auto;
  display: grid;
  grid-template-columns: minmax(92px, 0.75fr) minmax(0, 1.45fr);
  gap: 8px;
  padding: 10px 12px calc(10px + var(--sab));
  background: rgb(255 255 255 / 86%);
  border-top: 1px solid var(--line);
  backdrop-filter: blur(12px);
  -webkit-backdrop-filter: blur(12px);
}

.switch-actions button {
  min-width: 0;
  min-height: 48px;
  padding: 0 10px;
  overflow: hidden;
  font-size: 10px;
  font-weight: 800;
  text-overflow: ellipsis;
  white-space: nowrap;
  border-radius: 15px;
}

.cancel-button {
  color: var(--text-mid);
  background: var(--panel-3);
  border: 1px solid var(--line);
}

.confirm-button {
  color: #fff;
  background: linear-gradient(135deg, #f37fa8, #a780df 58%, #71b8e5);
  border: 1px solid rgb(255 255 255 / 62%);
  box-shadow: 0 7px 16px rgb(157 102 169 / 25%);
}

.class-switch-enter-active,
.class-switch-leave-active {
  transition: opacity 0.2s var(--ease-soft);
}

.class-switch-enter-active .class-switch-sheet,
.class-switch-leave-active .class-switch-sheet {
  transition: transform 0.24s var(--ease-spring);
}

.class-switch-enter-from,
.class-switch-leave-to {
  opacity: 0;
}

.class-switch-enter-from .class-switch-sheet,
.class-switch-leave-to .class-switch-sheet {
  transform: translateY(16px) scale(0.97);
}

@media (max-width: 350px) {
  .class-switch-overlay {
    padding-right: 8px;
    padding-left: 8px;
  }

  .switch-content {
    padding: 10px;
  }

  .class-option {
    grid-template-columns: 1fr;
    gap: 3px;
    min-height: 122px;
    padding: 7px 5px;
    text-align: center;
  }

  .class-portrait {
    justify-self: center;
    width: 42px;
    height: 54px;
  }

  .class-copy {
    align-items: center;
  }

  .class-copy em {
    align-self: center;
  }
}

@media (prefers-reduced-motion: reduce) {
  .class-option,
  .class-switch-enter-active,
  .class-switch-leave-active,
  .class-switch-enter-active .class-switch-sheet,
  .class-switch-leave-active .class-switch-sheet {
    transition: none;
  }
}
</style>
