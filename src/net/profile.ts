/**
 * 玩家自定义身份的网络 IO（docs/51 附录 A）。
 *
 * 与 leaderboard.ts 同样只做「发请求、摆平类型」，不含规则。
 *
 * 一条边界要记住：**昵称与游戏角色名从此解耦**。
 * leaderboard.ts 的 upsertProfile 原本把角色名写进 display_name，
 * 那会导致玩家一换职业榜上名字就变。这里的档案是玩家自己设的身份，
 * 只有玩家自己能改。
 */

import type { SupabaseClient } from '@supabase/supabase-js';
import { NetRequestError } from './supabase';

const AVATAR_BUCKET = 'avatars';
/**
 * 固定文件名，天然覆盖式。
 *
 * 用随机名会在桶里堆一辈子的垃圾 —— 玩家换十次头像就留下十个文件，
 * 而 Storage RLS 只允许写自己目录、删除得靠客户端记住旧路径，很容易漏。
 */
const AVATAR_OBJECT = 'avatar.webp';

export interface PlayerProfile {
  displayName: string;
  bio: string | null;
  avatarUrl: string | null;
}

/** 读自己的档案；从未创建过时返回 null（调用方据此引导玩家填写）。 */
export async function fetchOwnProfile(
  client: SupabaseClient,
  userId: string,
): Promise<PlayerProfile | null> {
  const { data, error } = await client
    .from('profiles')
    .select('display_name, bio, avatar_url')
    .eq('id', userId)
    .maybeSingle();
  if (error) throw new NetRequestError(`读取档案失败：${error.message}`);
  if (!data) return null;
  const row = data as { display_name: string; bio: string | null; avatar_url: string | null };
  return { displayName: row.display_name, bio: row.bio, avatarUrl: row.avatar_url };
}

/**
 * 保存玩家自设的昵称与简介。
 *
 * 长度上限与数据库 check 约束保持一致（昵称 20 / 简介 60）——
 * 这里先截断是为了给玩家即时反馈，而不是依赖服务端报错。
 */
export async function saveProfileIdentity(
  client: SupabaseClient,
  userId: string,
  identity: { displayName: string; bio: string },
): Promise<void> {
  const displayName = identity.displayName.trim().slice(0, 20);
  const bio = identity.bio.trim().slice(0, 60);
  if (displayName.length === 0) throw new NetRequestError('昵称不能为空');

  const { error } = await client
    .from('profiles')
    .update({
      display_name: displayName,
      bio: bio.length > 0 ? bio : null,
      updated_at: new Date().toISOString(),
    })
    .eq('id', userId);
  if (error) throw new NetRequestError(`保存失败：${error.message}`);
}

/**
 * 上传头像并回写 avatar_url，返回可直接显示的公开地址。
 *
 * 传入的 blob 必须已经过 `compressAvatar` 预压 —— 这里不再压第二遍，
 * 但桶上的 200KB 与 MIME 限制会兜底，绕过预压直接调用会被服务端拒。
 */
export async function uploadAvatar(
  client: SupabaseClient,
  userId: string,
  blob: Blob,
): Promise<string> {
  const path = `${userId}/${AVATAR_OBJECT}`;
  const { error: uploadError } = await client.storage.from(AVATAR_BUCKET).upload(path, blob, {
    contentType: 'image/webp',
    // 固定文件名 + 覆盖写，避免桶里堆积历史头像
    upsert: true,
  });
  if (uploadError) throw new NetRequestError(`头像上传失败：${uploadError.message}`);

  const { data } = client.storage.from(AVATAR_BUCKET).getPublicUrl(path);
  // 加时间戳绕过 CDN 与浏览器缓存，否则换了头像界面上还是旧图
  const publicUrl = `${data.publicUrl}?v=${Date.now()}`;

  const { error } = await client
    .from('profiles')
    .update({ avatar_url: publicUrl, updated_at: new Date().toISOString() })
    .eq('id', userId);
  if (error) throw new NetRequestError(`头像已上传但档案更新失败：${error.message}`);
  return publicUrl;
}

/** 移除自己的头像（同时删存储对象，不留孤儿文件）。 */
export async function removeAvatar(client: SupabaseClient, userId: string): Promise<void> {
  await client.storage.from(AVATAR_BUCKET).remove([`${userId}/${AVATAR_OBJECT}`]);
  const { error } = await client
    .from('profiles')
    .update({ avatar_url: null, updated_at: new Date().toISOString() })
    .eq('id', userId);
  if (error) throw new NetRequestError(`移除头像失败：${error.message}`);
}

/**
 * 举报某个玩家的档案内容。
 *
 * 自由上传必须配可处置入口，否则出现违规头像时只能靠所有者刷榜发现。
 * 同一个人对同一目标只能举报一次（数据库唯一约束），重复举报按成功处理 ——
 * 对玩家而言「我已经报过了」和「报成功了」是同一件事，不该报错吓他。
 */
export async function reportProfile(
  client: SupabaseClient,
  input: { reporterId: string; targetId: string; reason: string },
): Promise<void> {
  const reason = input.reason.trim().slice(0, 200);
  if (reason.length === 0) throw new NetRequestError('请填写举报理由');
  if (input.reporterId === input.targetId) throw new NetRequestError('不能举报自己');

  const { error } = await client.from('profile_reports').insert({
    target_id: input.targetId,
    reporter_id: input.reporterId,
    reason,
  });
  // 23505 = 唯一约束冲突，说明此前已举报过，对玩家视作成功
  if (error && error.code !== '23505') {
    throw new NetRequestError(`举报失败：${error.message}`);
  }
}
