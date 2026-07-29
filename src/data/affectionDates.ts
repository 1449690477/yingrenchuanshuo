import type { AffectionStoryDefinition } from '@/data/affection';
import type { ClassId } from '@/core/types';

/**
 * A-4 约会日程：四角色各三幕（第十~十二幕），对应上午/午后/夜晚三个时段。
 * 约会剧情复用 AffectionStoryDefinition 的全部结构与奖励管线：
 * 线性前置（幕九→幕十→幕十一→幕十二）、三等价选择、一次性 +60 心意、
 * 回看零奖励、不消耗每日互动、不追加任何战斗加护。
 * 时段只影响日程板呈现与主题，选中即进剧情，不做真实时间等待。
 */

export type AffectionDateSlot = 'morning' | 'afternoon' | 'night';

export interface AffectionDateSlotMeta {
  label: string;
  tagline: string;
  icon: string;
}

export const AFFECTION_DATE_SLOT_META: Readonly<Record<AffectionDateSlot, AffectionDateSlotMeta>> = {
  morning: { label: '上午', tagline: '趁阳光还轻，一起出门', icon: '🌤️' },
  afternoon: { label: '午后', tagline: '把最慢的时光留给她', icon: '☕' },
  night: { label: '夜晚', tagline: '灯亮以后，并肩回去', icon: '🌙' },
} as const;

export interface AffectionDateDefinition {
  slot: AffectionDateSlot;
  story: AffectionStoryDefinition;
}

const SWORDSMAN_DATES: readonly AffectionDateDefinition[] = [
  {
    slot: 'morning',
    story: {
      id: 'aff_swordsman_10_market',
      classId: 'swordsman',
      episode: 10,
      title: '替她挑一条剑穗',
      episodeLabel: '第十幕 · 晨市剑穗',
      unlockPoints: 3_000,
      requiredStoryIds: ['aff_swordsman_09_reciprocal'],
      completionPoints: 60,
      backgroundAsset: 'assets/affection/scenes/swordsman-morning-market.webp',
      openingDialogue: [
        { text: '晨市刚开，剑穗铺子的丝绦在晓风里一排排晃。她停在摊前，看得比看剑谱还专注。' },
        { speaker: '剑姬', mood: 'shy', text: '旧穗磨到起毛了。本来想随便换一条……既然你在，就《认真挑一次》。' },
        { text: '她把你让到里侧，自己站在市声外面——像替你挡着一个看不见的队形。' },
      ],
      choices: [
        {
          id: 'pick_quiet_color',
          label: '“这条哑光的。像你的人，耐看。”',
          mood: 'moved',
          responseDialogue: [
            { text: '她把那条穗子贴在剑柄上比了比，耳根慢慢红了。' },
            { speaker: '剑姬', mood: 'shy', text: '夸穗子就夸穗子……怎么连我也一起夸了。' },
            { speaker: '剑姬', mood: 'moved', text: '《那就它吧》。以后每次收剑，都会看见。' },
          ],
        },
        {
          id: 'let_her_test_swing',
          label: '“先系上试挥三下，顺手才作数。”',
          mood: 'bright',
          responseDialogue: [
            { text: '她真的退开半步，在巷空里试了三式，穗尾划出的弧线一次比一次稳。' },
            { speaker: '剑姬', mood: 'bright', text: '《第三下最顺》。你挑的位置，重心刚好。' },
            { text: '摊主在旁边鼓掌，她难得没有反驳“我们不是那种关系”。' },
          ],
        },
        {
          id: 'ask_before_touch',
          label: '“我能拿起来比比长度吗？先问摊主，也先问你。”',
          mood: 'shy',
          responseDialogue: [
            { text: '她怔了一下，把剑柄主动递过来一寸。' },
            { speaker: '剑姬', mood: 'moved', text: '你总是先问。所以答案永远是——《可以》。' },
          ],
        },
      ],
      memoryCallbacks: [
        {
          fromStoryId: 'aff_swordsman_07_gift',
          choiceId: 'gift_without_debt',
          dialogue: [
            { speaker: '剑姬', text: '还记得吗，你说过它不是军需。那今天这条穗子，也不是。' },
          ],
        },
      ],
    },
  },
  {
    slot: 'afternoon',
    story: {
      id: 'aff_swordsman_11_bento',
      classId: 'swordsman',
      episode: 11,
      title: '湖畔便当的一半',
      episodeLabel: '第十一幕 · 湖畔便当',
      unlockPoints: 3_500,
      requiredStoryIds: ['aff_swordsman_10_market'],
      completionPoints: 60,
      backgroundAsset: 'assets/affection/scenes/swordsman-lakeside-bento.webp',
      openingDialogue: [
        { text: '午后的湖风把荷叶吹得翻起银边。她打开两层的便当盒，摆得像是校阅阵型。' },
        { speaker: '剑姬', mood: 'bright', text: '下层是你提过想吃的那几样。上层……是我坚持要做的。《公平分配》。' },
        { text: '筷子递到你手里时，她先把自己那双摆正了——连野餐都透着认真。' },
      ],
      choices: [
        {
          id: 'trade_half',
          label: '“上层下层各分一半，谁也别让谁。”',
          mood: 'bright',
          responseDialogue: [
            { text: '她盯着你把玉子烧对半切开，终于忍不住笑出声。' },
            { speaker: '剑姬', mood: 'bright', text: '行军打仗都没这么分配过……但这样，《最好吃》。' },
          ],
        },
        {
          id: 'praise_her_cooking',
          label: '“先吃她做的那层，认真说哪里好。”',
          mood: 'moved',
          responseDialogue: [
            { text: '她假装看湖，却把“哪里好”三个字听得一字不落。' },
            { speaker: '剑姬', mood: 'moved', text: '练剑有人看招式，做饭……第一次有人看火候。' },
            { speaker: '剑姬', mood: 'shy', text: '下次还做。这句话不是客套，是《预定》。' },
          ],
        },
        {
          id: 'save_dessert_for_her',
          label: '“甜点留到最后，推回她那边。”',
          mood: 'shy',
          responseDialogue: [
            { text: '她把甜点又推回来，推了三个回合，最后用小签把它分成了整齐的两半。' },
            { speaker: '剑姬', mood: 'shy', text: '各退一步。这是我能接受的《唯一战果》。' },
          ],
        },
      ],
      memoryCallbacks: [
        {
          fromStoryId: 'aff_swordsman_08_preference',
          choiceId: 'ask_today_preference',
          dialogue: [
            { speaker: '剑姬', text: '今天也是低糖。我记得你问过我一次，从那以后，我记得每一次。' },
          ],
        },
      ],
    },
  },
  {
    slot: 'night',
    story: {
      id: 'aff_swordsman_12_bridge',
      classId: 'swordsman',
      episode: 12,
      title: '灯桥上并肩归营',
      episodeLabel: '第十二幕 · 灯桥归营',
      unlockPoints: 4_100,
      requiredStoryIds: ['aff_swordsman_11_bento'],
      completionPoints: 60,
      backgroundAsset: 'assets/affection/scenes/swordsman-lantern-bridge.webp',
      cgAsset: 'assets/affection/cg/swordsman-paired-tassels.webp',
      openingDialogue: [
        { text: '夜训结束，灯桥一串灯笼次第亮起。她没有走快，把回营的路让给了慢慢走。' },
        { speaker: '剑姬', text: '以前这条路是用来赶的。赶回去擦剑、复盘、睡够五个时辰。' },
        { speaker: '剑姬', mood: 'shy', text: '现在我想让它长一点。就因为旁边多了一个人——这话我《只说一遍》。' },
      ],
      choices: [
        {
          id: 'walk_on_outside',
          label: '“换我走外侧。今晚换我护着你。”',
          mood: 'moved',
          responseDialogue: [
            { text: '她停下脚步看你换到外侧，灯笼的光在她眼里晃了一下。' },
            { speaker: '剑姬', mood: 'moved', text: '被人护着……原来不是卸下责任，是多了一个《想一起回去的人》。' },
            { speaker: '剑姬', mood: 'shy', text: '那就拜托你了。这一段路。' },
          ],
        },
        {
          id: 'tie_two_tassels',
          label: '“把新穗和旧穗并在一起，系成一对。”',
          mood: 'shy',
          responseDialogue: [
            { text: '她看着两条穗子在桥灯下并排垂着，伸手替它们理齐了尾端。' },
            { speaker: '剑姬', mood: 'moved', text: '旧的留着功勋，新的留着你。《谁也不替谁》。' },
            { text: '回营之后，她把这对穗子挂在了床头最顺手的位置。' },
          ],
        },
        {
          id: 'promise_next_morning',
          label: '“明早晨钟前，我还来替你数剑。”',
          mood: 'bright',
          responseDialogue: [
            { speaker: '剑姬', mood: 'bright', text: '那我今晚会早睡半个时辰。' },
            { text: '她说得郑重，像在签署一份只有两个人的军令。' },
            { speaker: '剑姬', mood: 'playful', text: '违约的那一方，要负责带《第二天的早餐》。' },
          ],
        },
      ],
      memoryCallbacks: [
        {
          fromStoryId: 'aff_swordsman_09_reciprocal',
          choiceId: 'leave_future_ribbon',
          dialogue: [
            { speaker: '剑姬', text: '你说过把将来的绶带留到将来。那对穗子，就当是它提前来报到了。' },
          ],
        },
      ],
    },
  },
] as const;

const WITCH_DATES: readonly AffectionDateDefinition[] = [
  {
    slot: 'morning',
    story: {
      id: 'aff_witch_10_starcandy',
      classId: 'witch',
      episode: 10,
      title: '星糖实验约会',
      episodeLabel: '第十幕 · 星糖约会',
      unlockPoints: 3_000,
      requiredStoryIds: ['aff_witch_09_reciprocal'],
      completionPoints: 60,
      backgroundAsset: 'assets/affection/scenes/witch-starcandy-atelier.webp',
      openingDialogue: [
        { text: '上午的工坊飘着焦糖香。她把一排星糖试管推成弧形，像你才是今天的主要实验。' },
        { speaker: '魔女', mood: 'playful', text: '本次课题：两种口味的星糖，在“一起尝”的前提下会不会更甜。' },
        { speaker: '魔女', mood: 'shy', text: '对照组早就做完了——我一个人吃的时候，答案是《“还行”》。' },
      ],
      choices: [
        {
          id: 'volunteer_taster',
          label: '“我报名当唯一试吃员，记录交给你写。”',
          mood: 'bright',
          responseDialogue: [
            { speaker: '魔女', mood: 'playful', text: '批准。试吃员的第一条记录是——《表情不许作假》。' },
            { text: '她盯着你的反应，笔尖却迟迟没有动，因为她也想先笑一会儿。' },
          ],
        },
        {
          id: 'adjust_ratio_together',
          label: '“配方比例我们一起改，失败作也一起吃掉。”',
          mood: 'moved',
          responseDialogue: [
            { text: '她把失败作倒进两个杯子，自己先喝了一大口。' },
            { speaker: '魔女', mood: 'moved', text: '以前失败是要立刻销毁的。和你一起之后，它们改名叫《“过程”》。' },
            { speaker: '魔女', mood: 'shy', text: '这杯不算好喝。但这一口，我想记下来。' },
          ],
        },
        {
          id: 'ask_lab_rules',
          label: '“进工坊前，先告诉我哪些东西不许碰。”',
          mood: 'calm',
          responseDialogue: [
            { text: '她明显松了口气，把三样危险品逐一点名，然后把其余的推到你面前。' },
            { speaker: '魔女', mood: 'moved', text: '别人进门先碰再问，你是反过来……所以我才敢把工坊《给你看》。' },
          ],
        },
      ],
      memoryCallbacks: [
        {
          fromStoryId: 'aff_witch_08_secret',
          choiceId: 'ask_opening_rule',
          dialogue: [
            { speaker: '魔女', text: '你看，先问边界的人，最后会被允许走进来最远的地方。' },
          ],
        },
      ],
    },
  },
  {
    slot: 'afternoon',
    story: {
      id: 'aff_witch_11_planetarium',
      classId: 'witch',
      episode: 11,
      title: '修好那座小星象馆',
      episodeLabel: '第十一幕 · 星象馆修复',
      unlockPoints: 3_500,
      requiredStoryIds: ['aff_witch_10_starcandy'],
      completionPoints: 60,
      backgroundAsset: 'assets/affection/scenes/witch-planetarium-repair.webp',
      openingDialogue: [
        { text: '午后，阁楼的旧星象仪卡在某个年代，投出的星星全歪向一边。她踩着梯子，回头看你。' },
        { speaker: '魔女', mood: 'shy', text: '它是我小时候照着书做的。修得好就继续转，修不好……《也不许笑》。' },
        { text: '扳手递下来时，她先把可能夹手的部位包了一层软布。' },
      ],
      choices: [
        {
          id: 'hold_ladder',
          label: '“你修，我扶梯子。高度交给我盯着。”',
          mood: 'moved',
          responseDialogue: [
            { text: '她低头确认你的手扶稳了，才继续往上够。' },
            { speaker: '魔女', mood: 'moved', text: '奇怪。明明只是扶梯子，我却敢站到《以前不敢站的高度》。' },
          ],
        },
        {
          id: 'recalibrate_together',
          label: '“星图我来对坐标，齿轮归你。”',
          mood: 'bright',
          responseDialogue: [
            { speaker: '魔女', mood: 'bright', text: '成交。错了就一起重拧，谁也不甩锅。' },
            { text: '半小时后，第一颗星星准确地落回它该有的位置，你们同时“哦”了一声。' },
            { speaker: '魔女', mood: 'moved', text: '记一下：这是我们合力校准的《第一颗星》。编号……就用今天吧。' },
          ],
        },
        {
          id: 'keep_old_quirk',
          label: '“留一颗歪的别修，那是它认识你的年代。”',
          mood: 'shy',
          responseDialogue: [
            { text: '她愣在梯子上，好一会儿才小声笑出来。' },
            { speaker: '魔女', mood: 'shy', text: '你居然给一台旧机器留“当年”……好，那就留一颗。' },
            { speaker: '魔女', mood: 'moved', text: '最歪的那颗，从今天起叫《“认识你之前”》。' },
          ],
        },
      ],
      memoryCallbacks: [
        {
          fromStoryId: 'aff_witch_09_reciprocal',
          choiceId: 'two_independent_colors',
          dialogue: [
            { speaker: '魔女', text: '两种颜色都要能看见对方——所以今天星图上也留着你的坐标。' },
          ],
        },
      ],
    },
  },
  {
    slot: 'night',
    story: {
      id: 'aff_witch_12_meteor',
      classId: 'witch',
      episode: 12,
      title: '夜台并肩看流星',
      episodeLabel: '第十二幕 · 流星夜台',
      unlockPoints: 4_100,
      requiredStoryIds: ['aff_witch_11_planetarium'],
      completionPoints: 60,
      backgroundAsset: 'assets/affection/scenes/witch-meteor-terrace.webp',
      cgAsset: 'assets/affection/cg/witch-meteor-journal.webp',
      openingDialogue: [
        { text: '夜台的望远镜已经架好，星图摊在两人中间，手边是两杯还冒热气的星糖饮。' },
        { speaker: '魔女', mood: 'playful', text: '流星雨预报误差率三成。所以今晚无论有没有流星，观测都算成功——' },
        { speaker: '魔女', mood: 'shy', text: '因为《观测对象》，已经就位了。' },
      ],
      choices: [
        {
          id: 'wish_for_her',
          label: '“如果只有一颗流星，愿望让给你。”',
          mood: 'moved',
          responseDialogue: [
            { text: '她嗤了一声说“不科学”，却把星图往你那边挪了半寸。' },
            { speaker: '魔女', mood: 'moved', text: '那如果出现两颗，我们一人一个。如果出现一颗……就一起许《同一个》。' },
            { speaker: '魔女', mood: 'playful', text: '方案已锁定，不许改。' },
          ],
        },
        {
          id: 'record_for_journal',
          label: '“你负责看，我负责记，名字写两个人。”',
          mood: 'bright',
          responseDialogue: [
            { text: '她把观测日志翻开到新的一页，页眉端端正正写了两个名字。' },
            { speaker: '魔女', mood: 'bright', text: '从今天起，这本日志叫“联合观测”。以前的单人卷，《归档》。' },
          ],
        },
        {
          id: 'admit_cold_together',
          label: '“手冷了就说，别逞强。我这边也是。”',
          mood: 'shy',
          responseDialogue: [
            { text: '夜风正好掠过台沿，她看了你一眼，把手套分了一只给你。' },
            { speaker: '魔女', mood: 'shy', text: '一人一只。剩下的那只手……《自己想办法靠近热源》。' },
            { text: '她说完自己先笑了，星光落在她肩上，一动没动。' },
          ],
        },
      ],
      memoryCallbacks: [
        {
          fromStoryId: 'aff_witch_07_gift',
          choiceId: 'inspect_together',
          dialogue: [
            { speaker: '魔女', text: '那次的规矩还记得吧——你主持。今晚的观测记录，也由你来念给我听。' },
          ],
        },
      ],
    },
  },
] as const;

const SHAMAN_DATES: readonly AffectionDateDefinition[] = [
  {
    slot: 'morning',
    story: {
      id: 'aff_shaman_10_shrine_market',
      classId: 'shaman',
      episode: 10,
      title: '神社早市同行',
      episodeLabel: '第十幕 · 早市同行',
      unlockPoints: 3_000,
      requiredStoryIds: ['aff_shaman_09_reciprocal'],
      completionPoints: 60,
      backgroundAsset: 'assets/affection/scenes/shaman-shrine-market.webp',
      openingDialogue: [
        { text: '神社下的早市刚醒，香火气和蒸饼的白雾混在一起。她拎着一只空篮，走得不急。' },
        { speaker: '灵巫', mood: 'shy', text: '以前来早市，是采买清单上的东西。今天清单只有一行——《和你慢慢走一遍》。' },
        { text: '她把你让到靠里的一侧，衣袖在人流里始终离你半拳的距离。' },
      ],
      choices: [
        {
          id: 'carry_basket',
          label: '“篮子给我。你只负责挑。”',
          mood: 'moved',
          responseDialogue: [
            { text: '她把篮子交给你时，顺手把最重的那袋米也放了进去——然后偷偷看你吃不吃力。' },
            { speaker: '灵巫', mood: 'moved', text: '很重吧。重就对了，这样我才敢承认《自己提了很久》。' },
          ],
        },
        {
          id: 'taste_breakfast_stall',
          label: '“早餐摊先停一下，我请客，你点。”',
          mood: 'bright',
          responseDialogue: [
            { speaker: '灵巫', mood: 'playful', text: '那我要那份限量的。' },
            { text: '她点完才发现自己难得任性了一次，低头笑了很久。' },
            { speaker: '灵巫', mood: 'moved', text: '原来被人请客，是可以不用想《“回礼”》两个字的。' },
          ],
        },
        {
          id: 'walk_in_comfortable_silence',
          label: '“不说话也行。走到哪算哪。”',
          mood: 'calm',
          responseDialogue: [
            { text: '她点点头，两个人的脚步渐渐落在同一个节拍上。' },
            { speaker: '灵巫', mood: 'calm', text: '和你走路，《安静》也有了去处。' },
          ],
        },
      ],
      memoryCallbacks: [
        {
          fromStoryId: 'aff_shaman_08_rest',
          choiceId: 'quiet_counts',
          dialogue: [
            { speaker: '灵巫', text: '你说过安静也算数。所以今天这条街，我们一句客套都不用讲。' },
          ],
        },
      ],
    },
  },
  {
    slot: 'afternoon',
    story: {
      id: 'aff_shaman_11_firefly_ferry',
      classId: 'shaman',
      episode: 11,
      title: '萤火渡舟同乘',
      episodeLabel: '第十一幕 · 萤火渡舟',
      unlockPoints: 3_500,
      requiredStoryIds: ['aff_shaman_10_shrine_market'],
      completionPoints: 60,
      backgroundAsset: 'assets/affection/scenes/shaman-firefly-ferry.webp',
      openingDialogue: [
        { text: '午后将尽，渡口的萤火一盏盏醒来。木舟不大，船家说这趟只载两位。' },
        { speaker: '灵巫', text: '这条水路我巡过很多次，都是替别人引灯。' },
        { speaker: '灵巫', mood: 'shy', text: '今天没有人要等接引。灯亮着，只是因为好看——这句话，《只想在船上说给你听》。' },
      ],
      choices: [
        {
          id: 'sit_opposite_balance',
          label: '“我坐你对面，船才稳。”',
          mood: 'calm',
          responseDialogue: [
            { text: '船身轻轻一晃又稳下来，她隔着一臂的距离看你，眼里落着水光。' },
            { speaker: '灵巫', mood: 'moved', text: '平衡原来不是各坐一边，是两个人都愿意《先稳住自己》。' },
          ],
        },
        {
          id: 'offer_to_row',
          label: '“这一段我来撑，你只管看萤火。”',
          mood: 'bright',
          responseDialogue: [
            { text: '她把竹篙交给你，自己第一次在航程里做了乘客。' },
            { speaker: '灵巫', mood: 'moved', text: '被渡的感觉……原来水声这么清楚。以前都是我听别人上岸。' },
            { speaker: '灵巫', mood: 'shy', text: '慢一点撑。我想《迟一点到》。' },
          ],
        },
        {
          id: 'ask_before_lantern',
          label: '“放一盏引路灯陪你？先听你愿不愿意。”',
          mood: 'shy',
          responseDialogue: [
            { text: '她想了一会儿，亲手把灯点亮，却把它留在了船舱里。' },
            { speaker: '灵巫', mood: 'moved', text: '愿意。但今天不放走它——就让它《跟着船走》，跟你我一样。' },
          ],
        },
      ],
      memoryCallbacks: [
        {
          fromStoryId: 'aff_shaman_09_reciprocal',
          choiceId: 'hang_side_by_side',
          dialogue: [
            { speaker: '灵巫', text: '那两盏并排的灯还在神社门口。今天船舱里这盏，是第三盏。' },
          ],
        },
      ],
    },
  },
  {
    slot: 'night',
    story: {
      id: 'aff_shaman_12_rainy_teahouse',
      classId: 'shaman',
      episode: 12,
      title: '雨夜茶屋共享安静',
      episodeLabel: '第十二幕 · 雨夜茶屋',
      unlockPoints: 4_100,
      requiredStoryIds: ['aff_shaman_11_firefly_ferry'],
      completionPoints: 60,
      backgroundAsset: 'assets/affection/scenes/shaman-rainy-teahouse.webp',
      cgAsset: 'assets/affection/cg/shaman-paired-teacups.webp',
      openingDialogue: [
        { text: '夜雨敲着茶屋的檐角，屋里只有煮水的轻响。她把两只茶盏并排摆好，雾气在两人之间升起来。' },
        { speaker: '灵巫', text: '很多人找我，是为了把心里的话倒出来。' },
        { speaker: '灵巫', mood: 'shy', text: '可今晚我什么都不想倒。只想和你把这一壶喝完——《这也算一种倾诉》，你懂吗？' },
      ],
      choices: [
        {
          id: 'pour_for_each_other',
          label: '“第一巡我斟，第二巡换你。”',
          mood: 'moved',
          responseDialogue: [
            { text: '两轮茶下来，她捧着盏沿的手放松了许多。' },
            { speaker: '灵巫', mood: 'moved', text: '被照顾和照顾人，原来可以在同一张桌上《轮班》。以前我总是一个人包场。' },
          ],
        },
        {
          id: 'listen_to_rain_together',
          label: '“不听心事，听雨。听到雨停。”',
          mood: 'calm',
          responseDialogue: [
            { text: '她顺着你的目光看向檐外，很久没有说话，肩膀却一点点松下来。' },
            { speaker: '灵巫', mood: 'calm', text: '原来最像回答的声音，是两个人一起听见的《那场雨》。' },
            { speaker: '灵巫', mood: 'moved', text: '今晚什么都不用解决。这样就够了。' },
          ],
        },
        {
          id: 'leave_cups_unwashed',
          label: '“茶盏先别收。让它们也坐一会儿。”',
          mood: 'shy',
          responseDialogue: [
            { text: '她失笑，真的把两只空盏并排留在桌上，像留两位小小的客人。' },
            { speaker: '灵巫', mood: 'playful', text: '好。让它们也听听雨。——你看，我也学会《不讲道理》了。' },
          ],
        },
      ],
      memoryCallbacks: [
        {
          fromStoryId: 'aff_shaman_07_gift',
          choiceId: 'blank_is_complete',
          dialogue: [
            { speaker: '灵巫', text: '空白的愿纸你替我留住了。今晚这壶茶，我也替你留了一盏空白——什么都不说，也是满的。' },
          ],
        },
      ],
    },
  },
] as const;

const CATKIN_DATES: readonly AffectionDateDefinition[] = [
  {
    slot: 'morning',
    story: {
      id: 'aff_catkin_10_supply_market',
      classId: 'catkin',
      episode: 10,
      title: '补给市集大采购',
      episodeLabel: '第十幕 · 补给市集',
      unlockPoints: 3_000,
      requiredStoryIds: ['aff_catkin_09_reciprocal'],
      completionPoints: 60,
      backgroundAsset: 'assets/affection/scenes/catkin-supply-market.webp',
      openingDialogue: [
        { text: '上午的补给市集吵吵闹闹，她已经列好了一张双人清单，左上角还盖了个小小的爪印章。' },
        { speaker: '喵喵', mood: 'bright', text: '第一副队长！今天的远征目标是——把这张清单《全部打勾》！' },
        { speaker: '喵喵', mood: 'playful', text: '规则照旧：我的格子我自己背，你的那份不许偷偷加码。' },
      ],
      choices: [
        {
          id: 'race_checklist',
          label: '“分头行动，比谁先集齐，输的提袋子。”',
          mood: 'bright',
          responseDialogue: [
            { text: '她嗖地窜出去，又折返回来把清单撕成整齐的两半。' },
            { speaker: '喵喵', mood: 'bright', text: '这样才公平！——不过终点要《一起冲线》，这是搭档条款！' },
          ],
        },
        {
          id: 'inspect_supplies_together',
          label: '“干粮要挑保质期的，我陪你一包一包看。”',
          mood: 'moved',
          responseDialogue: [
            { text: '她把每包干粮举到光底下，和你一起看完才放进篮子，神情像在检阅武器。' },
            { speaker: '喵喵', mood: 'moved', text: '以前我都是抓到就走……原来慢慢挑，挑到的都是《好日子》。' },
          ],
        },
        {
          id: 'ask_budget_first',
          label: '“预算上限先说清楚，超了的我自己想办法。”',
          mood: 'calm',
          responseDialogue: [
            { text: '她认真地在清单角落写下数字，又在旁边画了一个小小的“+惊喜额度”。' },
            { speaker: '喵喵', mood: 'playful', text: '惊喜额度是《搭档专用》！用不用由你，准不准备由我。' },
          ],
        },
      ],
      memoryCallbacks: [
        {
          fromStoryId: 'aff_catkin_07_gift',
          choiceId: 'owner_sets_labels',
          dialogue: [
            { speaker: '喵喵', text: '清单的标签也是我填的！你的那一栏我只写了两个字——“搭档”。' },
          ],
        },
      ],
    },
  },
  {
    slot: 'afternoon',
    story: {
      id: 'aff_catkin_11_workshop_coffee',
      classId: 'catkin',
      episode: 11,
      title: '纸箱工坊的咖啡时间',
      episodeLabel: '第十一幕 · 咖啡工坊',
      unlockPoints: 3_500,
      requiredStoryIds: ['aff_catkin_10_supply_market'],
      completionPoints: 60,
      backgroundAsset: 'assets/affection/scenes/catkin-workshop-coffee.webp',
      openingDialogue: [
        { text: '午后的纸箱工坊飘着咖啡香。她搬出两个杯子，一个是远征纪念款，一个是崭新的。' },
        { speaker: '喵喵', mood: 'bright', text: '新杯子是给你《定制》的！把手朝左还是朝右，要你自己试出来才算数。' },
        { text: '她说完就退开半步，把挑选的位置完完整整留给你——这是她学来的礼貌。' },
      ],
      choices: [
        {
          id: 'test_both_hands',
          label: '“左右手都试一遍，结果要向她汇报。”',
          mood: 'bright',
          responseDialogue: [
            { text: '她捧着本子一本正经地记录“握姿评估”，最后给你盖了个“合格”章。' },
            { speaker: '喵喵', mood: 'bright', text: '结论：两只手都合格！所以杯子要做成《两边都能拿》的！' },
          ],
        },
        {
          id: 'build_cardboard_counter',
          label: '“咖啡吧台一起搭，图纸她出，力气我出。”',
          mood: 'moved',
          responseDialogue: [
            { speaker: '喵喵', mood: 'playful', text: '批准！钉子你敲，验收我来。' },
            { text: '吧台搭好时她绕着走了三圈，最后在台面上并排摆了两个杯垫。' },
            { speaker: '喵喵', mood: 'moved', text: '这个位置以后叫《“搭档专席”》。仅限两人，永久有效。' },
          ],
        },
        {
          id: 'ask_scritch_permission',
          label: '“她忙出汗了——先问一句，能不能帮她擦。”',
          mood: 'shy',
          responseDialogue: [
            { text: '她愣了一下，自己先把毛巾接过去，又笑着把另一头递回你手里。' },
            { speaker: '喵喵', mood: 'shy', text: '问得好！所以答案是——《一人拿一头》，一起叠好它。' },
          ],
        },
      ],
      memoryCallbacks: [
        {
          fromStoryId: 'aff_catkin_08_sentimental',
          choiceId: 'ask_before_view',
          dialogue: [
            { speaker: '喵喵', text: '“先问”这两个字，是你教我的。现在轮到我用在你身上啦。' },
          ],
        },
      ],
    },
  },
  {
    slot: 'night',
    story: {
      id: 'aff_catkin_12_night_train',
      classId: 'catkin',
      episode: 12,
      title: '月台屋顶看夜车',
      episodeLabel: '第十二幕 · 夜车月台',
      unlockPoints: 4_100,
      requiredStoryIds: ['aff_catkin_11_workshop_coffee'],
      completionPoints: 60,
      backgroundAsset: 'assets/affection/scenes/catkin-rooftop-platform.webp',
      cgAsset: 'assets/affection/cg/catkin-two-tickets.webp',
      openingDialogue: [
        { text: '夜班的列车从远处进站，灯光在轨道上一节节亮过来。她坐在月台屋顶的老位置，拍了拍身边。' },
        { speaker: '喵喵', text: '以前看夜车，是在数“大家都去多远的地方”。' },
        { speaker: '喵喵', mood: 'moved', text: '现在数的是——有一班车进站的时候，《我身边的人没有走》。' },
      ],
      choices: [
        {
          id: 'keep_two_tickets',
          label: '“买两张下一班的票，不上车，就留着。”',
          mood: 'moved',
          responseDialogue: [
            { text: '她把两张票对齐撕角，郑重地收进远征柜的共享格。' },
            { speaker: '喵喵', mood: 'moved', text: '票根留着，不是为了走。是为了证明——想去的地方，《已经有人陪我到了》。' },
          ],
        },
        {
          id: 'wave_at_train',
          label: '“车进站时一起挥手，管它看不看得见。”',
          mood: 'bright',
          responseDialogue: [
            { text: '夜车缓缓进站，你们挥得像两个送行的孩子。她笑得差点从屋顶上滑下去。' },
            { speaker: '喵喵', mood: 'bright', text: '司机刚刚闪了一下灯！那是《回礼》！我们的！' },
          ],
        },
        {
          id: 'promise_no_sendoff',
          label: '“下次远征，不许一个人偷偷上车。”',
          mood: 'shy',
          responseDialogue: [
            { text: '她盯着你看了好一会儿，伸出尾巴尖轻轻碰了碰你的袖口——这是她主动的约定方式。' },
            { speaker: '喵喵', mood: 'shy', text: '条款成立。违反的人，要在月台上《等到被原谅为止》。' },
            { speaker: '喵喵', mood: 'moved', text: '不过我觉得……我们可能永远用不上这条。' },
          ],
        },
      ],
      memoryCallbacks: [
        {
          fromStoryId: 'aff_catkin_09_reciprocal',
          choiceId: 'two_plus_shared',
          dialogue: [
            { speaker: '喵喵', text: '共享格的第一件藏品想好了——今晚这两张票，还有一闪一闪的车灯。' },
          ],
        },
      ],
    },
  },
] as const;

export const AFFECTION_DATES: Readonly<Record<ClassId, readonly AffectionDateDefinition[]>> = {
  swordsman: SWORDSMAN_DATES,
  witch: WITCH_DATES,
  shaman: SHAMAN_DATES,
  catkin: CATKIN_DATES,
} as const;

export const AFFECTION_DATE_STORIES: readonly AffectionStoryDefinition[] = Object.values(
  AFFECTION_DATES,
).flatMap((dates) => dates.map((date) => date.story));

/** 约会剧情按角色并入既有 stories 序列，保持幕次升序。 */
export function affectionDateStories(classId: ClassId): readonly AffectionStoryDefinition[] {
  return AFFECTION_DATES[classId].map((date) => date.story);
}

/** 由剧情 id 反查约会定义；非约会剧情返回 null。 */
export function findAffectionDate(storyId: string): AffectionDateDefinition | null {
  for (const dates of Object.values(AFFECTION_DATES)) {
    const hit = dates.find((date) => date.story.id === storyId);
    if (hit) return hit;
  }
  return null;
}

/** 日程板卡面用：该约会在其角色三幕中的次序（0/1/2），非约会返回 -1。 */
export function affectionDateOrder(storyId: string): number {
  const date = findAffectionDate(storyId);
  if (!date) return -1;
  return AFFECTION_DATES[date.story.classId].indexOf(date);
}
