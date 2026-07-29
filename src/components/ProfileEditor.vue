<script setup lang="ts">
/**
 * 榜单档案编辑（docs/51 附录 A）。
 *
 * 这是玩家在排行榜上的公开身份，**与游戏角色名解耦** ——
 * 换职业不该让榜上的名字跟着变。
 *
 * 头像走「选图 → 客户端压到 512×512 webp → 上传」三步，
 * 压缩在 ui/imageResize.ts，上传在 net/profile.ts，本组件只管交互。
 */
import { computed, ref, watch } from 'vue';
import type { SupabaseClient } from '@supabase/supabase-js';
import { AVATAR_ACCEPT, compressAvatar } from '@/ui/imageResize';
import {
  fetchOwnProfile,
  removeAvatar,
  saveProfileIdentity,
  uploadAvatar,
  type PlayerProfile,
} from '@/net/profile';

const props = defineProps<{
  client: SupabaseClient;
  userId: string;
  /** 没填过档案时用它作为昵称初值，省得玩家从空白开始 */
  fallbackName: string;
}>();

const emit = defineEmits<{ close: []; saved: [profile: PlayerProfile] }>();

const NAME_MAX = 20;
const BIO_MAX = 60;

const displayName = ref('');
const bio = ref('');
const avatarUrl = ref<string | null>(null);
const loading = ref(true);
const busy = ref(false);
const feedback = ref('');
const fileInput = ref<HTMLInputElement | null>(null);

const nameLeft = computed(() => NAME_MAX - [...displayName.value].length);
const bioLeft = computed(() => BIO_MAX - [...bio.value].length);
const canSave = computed(
  () => !busy.value && displayName.value.trim().length > 0 && nameLeft.value >= 0 && bioLeft.value >= 0,
);

const acceptAttr = AVATAR_ACCEPT.join(',');

watch(
  () => props.userId,
  async (id) => {
    if (!id) return;
    loading.value = true;
    try {
      const profile = await fetchOwnProfile(props.client, id);
      displayName.value = profile?.displayName ?? props.fallbackName;
      bio.value = profile?.bio ?? '';
      avatarUrl.value = profile?.avatarUrl ?? null;
    } catch (error) {
      feedback.value = error instanceof Error ? error.message : '读取档案失败';
    } finally {
      loading.value = false;
    }
  },
  { immediate: true },
);

async function onPickFile(event: Event): Promise<void> {
  const input = event.target as HTMLInputElement;
  const file = input.files?.[0];
  // 立刻清空，否则连选同一张图两次不会再触发 change
  input.value = '';
  if (!file) return;

  busy.value = true;
  feedback.value = '正在处理图片…';
  try {
    const { blob } = await compressAvatar(file);
    avatarUrl.value = await uploadAvatar(props.client, props.userId, blob);
    feedback.value = '头像已更新';
  } catch (error) {
    feedback.value = error instanceof Error ? error.message : '头像上传失败';
  } finally {
    busy.value = false;
  }
}

async function onRemoveAvatar(): Promise<void> {
  busy.value = true;
  try {
    await removeAvatar(props.client, props.userId);
    avatarUrl.value = null;
    feedback.value = '已移除头像';
  } catch (error) {
    feedback.value = error instanceof Error ? error.message : '移除失败';
  } finally {
    busy.value = false;
  }
}

async function onSave(): Promise<void> {
  if (!canSave.value) return;
  busy.value = true;
  try {
    await saveProfileIdentity(props.client, props.userId, {
      displayName: displayName.value,
      bio: bio.value,
    });
    emit('saved', {
      displayName: displayName.value.trim(),
      bio: bio.value.trim() || null,
      avatarUrl: avatarUrl.value,
    });
    emit('close');
  } catch (error) {
    feedback.value = error instanceof Error ? error.message : '保存失败';
  } finally {
    busy.value = false;
  }
}
</script>

<template>
  <div class="overlay" role="dialog" aria-modal="true" aria-label="编辑榜单档案">
    <section class="editor">
      <header>
        <h2>榜单档案</h2>
        <small>这是别人在排行榜上看到的你，和游戏角色名无关</small>
      </header>

      <p v-if="loading" class="hint">读取中…</p>

      <template v-else>
        <div class="avatar-row">
          <div class="avatar-frame">
            <img v-if="avatarUrl" :src="avatarUrl" alt="当前头像" />
            <span v-else aria-hidden="true">＋</span>
          </div>
          <div class="avatar-actions">
            <button class="btn sm" :disabled="busy" @click="fileInput?.click()">
              {{ avatarUrl ? '换一张' : '上传头像' }}
            </button>
            <button v-if="avatarUrl" class="btn btn-plain sm" :disabled="busy" @click="onRemoveAvatar">
              移除
            </button>
            <small>JPG / PNG / WebP，会自动压缩</small>
          </div>
          <input
            ref="fileInput"
            type="file"
            :accept="acceptAttr"
            hidden
            @change="onPickFile"
          />
        </div>

        <label class="field">
          <span>昵称<em :class="{ over: nameLeft < 0 }">还可输入 {{ nameLeft }} 字</em></span>
          <input v-model="displayName" type="text" :maxlength="NAME_MAX" placeholder="给自己起个名字" />
        </label>

        <label class="field">
          <span>简介<em :class="{ over: bioLeft < 0 }">还可输入 {{ bioLeft }} 字</em></span>
          <textarea v-model="bio" :maxlength="BIO_MAX" rows="2" placeholder="一句话介绍自己（可留空）" />
        </label>

        <p v-if="feedback" class="hint" role="status">{{ feedback }}</p>

        <footer>
          <button class="btn btn-plain" :disabled="busy" @click="emit('close')">取消</button>
          <button class="btn" :disabled="!canSave" @click="onSave">保存</button>
        </footer>
      </template>
    </section>
  </div>
</template>

<style scoped>
.editor {
  width: min(100%, 420px);
  display: flex;
  flex-direction: column;
  gap: 12px;
  padding: 16px;
  background: var(--panel);
  border-radius: 18px;
}

.editor > header h2 {
  margin: 0;
  font-size: 16px;
}

.editor > header small {
  color: var(--text-dim);
  font-size: 11px;
}

.avatar-row {
  display: flex;
  align-items: center;
  gap: 12px;
}

.avatar-frame {
  width: 72px;
  height: 72px;
  display: flex;
  flex: none;
  align-items: center;
  justify-content: center;
  overflow: hidden;
  color: var(--text-dim);
  font-size: 24px;
  background: rgb(0 0 0 / 4%);
  border: 1px solid var(--line);
  border-radius: 50%;
}

.avatar-frame img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.avatar-actions {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 6px;
}

.avatar-actions small {
  width: 100%;
  color: var(--text-dim);
  font-size: 10px;
}

.field {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.field > span {
  display: flex;
  justify-content: space-between;
  color: var(--text-mid);
  font-size: 12px;
}

.field em {
  color: var(--text-dim);
  font-style: normal;
  font-size: 10px;
}

.field em.over {
  color: var(--danger, #d9534f);
}

.field input,
.field textarea {
  padding: 8px 10px;
  color: var(--text);
  font: inherit;
  font-size: 13px;
  background: rgb(255 255 255 / 70%);
  border: 1px solid var(--line);
  border-radius: 10px;
  resize: none;
}

.hint {
  margin: 0;
  color: var(--text-dim);
  font-size: 11px;
}

footer {
  display: flex;
  justify-content: flex-end;
  gap: 8px;
}
</style>
