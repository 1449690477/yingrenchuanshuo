import type { AffectionMood } from '@/core/affection';
import type { EncounterLine } from '@/core/encounters';
import type { ClassId } from '@/core/types';

export type AffectionStageAction = 'idle' | 'cast' | 'victory';

export interface AffectionInteractionDefinition {
  id: string;
  label: string;
  shortDescription: string;
  points: number;
  mood: AffectionMood;
  action: AffectionStageAction;
  requiredStoryId?: string;
  lines: readonly [string, string];
}

export interface AffectionStoryChoiceDefinition {
  id: string;
  label: string;
  mood: AffectionMood;
  responseDialogue: readonly EncounterLine[];
}

export interface AffectionMemoryCallback {
  fromStoryId: string;
  choiceId: string;
  dialogue: readonly EncounterLine[];
}

export interface AffectionStoryDefinition {
  id: string;
  classId: ClassId;
  episode: number;
  title: string;
  episodeLabel: string;
  unlockPoints: number;
  requiredStoryIds: readonly string[];
  completionPoints: number;
  backgroundAsset: string;
  cgAsset?: string;
  openingDialogue: readonly EncounterLine[];
  choices: readonly [
    AffectionStoryChoiceDefinition,
    AffectionStoryChoiceDefinition,
    AffectionStoryChoiceDefinition,
  ];
  memoryCallbacks?: readonly AffectionMemoryCallback[];
}

export interface AffectionCharacterDefinition {
  classId: ClassId;
  adult: true;
  name: string;
  roomTitle: string;
  personality: string;
  boundaries: readonly string[];
  accent: string;
  glow: string;
  hubBackgroundAsset: string;
  interactions: readonly AffectionInteractionDefinition[];
  stories: readonly AffectionStoryDefinition[];
}

const interaction = (
  id: string,
  label: string,
  shortDescription: string,
  mood: AffectionMood,
  action: AffectionStageAction,
  lines: readonly [string, string],
  requiredStoryId?: string,
): AffectionInteractionDefinition => ({
  id,
  label,
  shortDescription,
  points: 10,
  mood,
  action,
  lines,
  ...(requiredStoryId ? { requiredStoryId } : {}),
});

const SWORDSMAN_STORIES: readonly AffectionStoryDefinition[] = [
  {
    id: 'aff_swordsman_01_dawn',
    classId: 'swordsman',
    episode: 1,
    title: '比晨光早一步',
    episodeLabel: '第一幕 · 晨樱陪练',
    unlockPoints: 0,
    requiredStoryIds: [],
    completionPoints: 30,
    backgroundAsset: 'assets/affection/scenes/swordsman-training-dawn.webp',
    openingDialogue: [
      { text: '晨钟还没响，樱花训练场已经传来整齐的破风声。' },
      { speaker: '剑姬', text: '你来得比晨钟还早。正好，能替我数到一百吗？' },
      { text: '她仍握着剑，目光却已经安静地停在你身上。' },
    ],
    choices: [
      {
        id: 'watch_breath',
        label: '“可以。但你呼吸乱了，我就喊停。”',
        mood: 'moved',
        responseDialogue: [
          { text: '她微微一怔，把剑尖压低了一寸。' },
          { speaker: '剑姬', text: '比起挥了多少次，你先看见的是我累不累……' },
          { speaker: '剑姬', text: '那就劳你盯紧了。' },
        ],
      },
      {
        id: 'wooden_sword',
        label: '“我拿木剑陪你，数数交给晨钟。”',
        mood: 'bright',
        responseDialogue: [
          { speaker: '剑姬', text: '不许偷懒。' },
          { text: '她转过身藏住笑意，又把另一把木剑推到你手边。' },
          { speaker: '剑姬', text: '不过，两个人的脚步声……确实比钟声好听。' },
        ],
      },
      {
        id: 'ask_guard',
        label: '“护腕松了。需要我帮你重新系吗？”',
        mood: 'shy',
        responseDialogue: [
          { text: '她确认你的手停在原处，才主动把手腕递来。' },
          { speaker: '剑姬', text: '只许系护腕，不许趁机笑我。' },
          { text: '最后一个结系好时，她没有立刻收回手。' },
        ],
      },
    ],
  },
  {
    id: 'aff_swordsman_02_rain',
    classId: 'swordsman',
    episode: 2,
    title: '一把只容两人的伞',
    episodeLabel: '第二幕 · 雨廊同行',
    unlockPoints: 80,
    requiredStoryIds: ['aff_swordsman_01_dawn'],
    completionPoints: 45,
    backgroundAsset: 'assets/affection/scenes/swordsman-rain-gate.webp',
    openingDialogue: [
      { text: '训练结束时骤雨落下，她撑着伞站在廊外，半边肩膀已经湿透。' },
      { speaker: '剑姬', text: '伞明明够大，怎么还是淋到了？' },
      { text: '伞沿朝你的方向偏得太明显，答案其实就在眼前。' },
    ],
    choices: [
      {
        id: 'ask_closer',
        label: '“我可以靠近一点吗？这样两边都不会淋湿。”',
        mood: 'shy',
        responseDialogue: [
          { text: '她轻轻点头，把伞柄握得更稳。' },
          { speaker: '剑姬', text: '先问过再靠近……很好。那就别离开伞沿。' },
        ],
      },
      {
        id: 'share_half',
        label: '“你总挡在前面，这次伞也该分你一半。”',
        mood: 'moved',
        responseDialogue: [
          { text: '你把伞推回正中，她却又悄悄向你这边倾了一点。' },
          { speaker: '剑姬', text: '保护不是单方面的……这句话，我记住了。' },
        ],
      },
      {
        id: 'hold_umbrella',
        label: '“把伞柄交给我，你只管走。”',
        mood: 'bright',
        responseDialogue: [
          { text: '她松手前看了你一会儿。' },
          { speaker: '剑姬', text: '只准送到廊下。别擅自把这段路变长。' },
          { text: '可她的脚步，明显比平时慢。' },
        ],
      },
    ],
  },
  {
    id: 'aff_swordsman_03_victory',
    classId: 'swordsman',
    episode: 3,
    title: '胜利之后，别只看剑',
    episodeLabel: '第三幕 · 胜利绶带',
    unlockPoints: 240,
    requiredStoryIds: ['aff_swordsman_02_rain'],
    completionPoints: 60,
    backgroundAsset: 'assets/affection/scenes/swordsman-victory-night.webp',
    cgAsset: 'assets/affection/cg/swordsman-ribbon-promise.webp',
    memoryCallbacks: [
      {
        fromStoryId: 'aff_swordsman_02_rain',
        choiceId: 'ask_closer',
        dialogue: [{ speaker: '剑姬', text: '上次你先问我能不能靠近……今天也可以。' }],
      },
      {
        fromStoryId: 'aff_swordsman_02_rain',
        choiceId: 'share_half',
        dialogue: [{ speaker: '剑姬', text: '你说保护不是单方面的，所以这次也让我等你。' }],
      },
      {
        fromStoryId: 'aff_swordsman_02_rain',
        choiceId: 'hold_umbrella',
        dialogue: [{ speaker: '剑姬', text: '那段雨路被你擅自走长了……我其实没有生气。' }],
      },
    ],
    openingDialogue: [
      { text: '夜间庆典里，所有人都围着她的新剑赞叹。' },
      { speaker: '剑姬', text: '大家都在看剑……可我想知道，你刚才在看什么。' },
    ],
    choices: [
      {
        id: 'her_smile',
        label: '“看你松开剑时，终于肯笑的样子。”',
        mood: 'shy',
        responseDialogue: [
          { speaker: '剑姬', text: '那个笑容本来只出现了一瞬。' },
          { text: '她避开目光，把胜利绶带的一端系到你腕上。' },
          { speaker: '剑姬', text: '看来它早就落到你这里了。' },
        ],
      },
      {
        id: 'looking_for_me',
        label: '“看你每次收剑，都会先确认我在不在。”',
        mood: 'moved',
        responseDialogue: [
          { speaker: '剑姬', text: '因为看见你，我才知道这一战真的结束了。' },
          { text: '另一端绶带仍系在她的剑穗，两端在夜风里轻轻靠近。' },
        ],
      },
      {
        id: 'remember_her',
        label: '“剑很漂亮，但握剑的人更值得我记住。”',
        mood: 'shy',
        responseDialogue: [
          { text: '她耳尖微红，第一次没能立刻回话。' },
          { speaker: '剑姬', text: '这样的夸奖……比正面接一剑更让人没防备。' },
        ],
      },
    ],
  },
] as const;

const WITCH_STORIES: readonly AffectionStoryDefinition[] = [
  {
    id: 'aff_witch_01_star',
    classId: 'witch',
    episode: 1,
    title: '不听话的星星',
    episodeLabel: '第一幕 · 偏航星',
    unlockPoints: 0,
    requiredStoryIds: [],
    completionPoints: 30,
    backgroundAsset: 'assets/affection/scenes/witch-atelier-spark.webp',
    openingDialogue: [
      { text: '一颗小星火绕着魔法桌乱飞，最后停在你面前。' },
      { speaker: '魔女', text: '它今天不肯回瓶子。奇怪，它倒是很喜欢你。' },
      { text: '星火在你们之间晃了晃，像是在等待共同的决定。' },
    ],
    choices: [
      {
        id: 'ask_both',
        label: '“我伸手以前，先问问它和你都同不同意。”',
        mood: 'shy',
        responseDialogue: [
          { speaker: '魔女', text: '它同意了。' },
          { text: '她故意停顿，星火也跟着悬在半空。' },
          { speaker: '魔女', text: '我也……勉强同意。掌心放平。' },
        ],
      },
      {
        id: 'hold_notes',
        label: '“我替你按住笔记，你专心把它引回来。”',
        mood: 'bright',
        responseDialogue: [
          { speaker: '魔女', text: '左边第三页，别让风翻过去。' },
          { text: '星火顺着她的指尖回到瓶中，动作一气呵成。' },
          { speaker: '魔女', text: '配合得这么顺，会让我误以为我们练习过很多次。' },
        ],
      },
      {
        id: 'name_star',
        label: '“给它起个名字吧，也许它只是想被记住。”',
        mood: 'playful',
        responseDialogue: [
          { speaker: '魔女', text: '那就叫“偏航星”。' },
          { speaker: '魔女', text: '因为它总会偏到你那里……这个理由不许笑。' },
        ],
      },
    ],
  },
  {
    id: 'aff_witch_02_observatory',
    classId: 'witch',
    episode: 2,
    title: '两人份的观测记录',
    episodeLabel: '第二幕 · 今夜的座位',
    unlockPoints: 80,
    requiredStoryIds: ['aff_witch_01_star'],
    completionPoints: 45,
    backgroundAsset: 'assets/affection/scenes/witch-observatory-night.webp',
    openingDialogue: [
      { text: '观星台只有一把椅子，桌上却摆着两杯热饮。' },
      { speaker: '魔女', text: '椅子只有一张是我故意的。我想看看你会怎么办。' },
    ],
    choices: [
      {
        id: 'sit_near',
        label: '“我可以坐近一点吗？你说可以我再过去。”',
        mood: 'shy',
        responseDialogue: [
          { speaker: '魔女', text: '先问过才挤进来，合格。' },
          { text: '她把披肩往你这边分了一半。' },
        ],
      },
      {
        id: 'soft_cushion',
        label: '“我坐软垫，把椅子留给你。”',
        mood: 'bright',
        responseDialogue: [
          { text: '她用法杖把另一只软垫拉到身边。' },
          { speaker: '魔女', text: '故作体贴也不许离太远，记录纸在这里。' },
        ],
      },
      {
        id: 'came_for_you',
        label: '“星星可以慢慢看。我今晚主要是来见你的。”',
        mood: 'shy',
        responseDialogue: [
          { text: '魔法笔在纸上划出一道慌乱的弧线。' },
          { speaker: '魔女', text: '害我把日期写成你的名字了……你负责重写。' },
        ],
      },
    ],
  },
  {
    id: 'aff_witch_03_recipe',
    classId: 'witch',
    episode: 3,
    title: '魔女的秘密配方',
    episodeLabel: '第三幕 · 归航坐标',
    unlockPoints: 240,
    requiredStoryIds: ['aff_witch_02_observatory'],
    completionPoints: 60,
    backgroundAsset: 'assets/affection/scenes/witch-secret-festival.webp',
    cgAsset: 'assets/affection/cg/witch-coordinate-crystal.webp',
    memoryCallbacks: [
      {
        fromStoryId: 'aff_witch_02_observatory',
        choiceId: 'sit_near',
        dialogue: [{ speaker: '魔女', text: '今晚不用再问座位了，我已经替你留好。' }],
      },
      {
        fromStoryId: 'aff_witch_02_observatory',
        choiceId: 'soft_cushion',
        dialogue: [{ speaker: '魔女', text: '我多准备了一只软垫，不过还是放在我旁边。' }],
      },
      {
        fromStoryId: 'aff_witch_02_observatory',
        choiceId: 'came_for_you',
        dialogue: [{ speaker: '魔女', text: '观测记录的日期重写了，可那行名字我没有擦。' }],
      },
    ],
    openingDialogue: [
      { text: '她将一枚尚未刻字的星晶推到你面前。' },
      { speaker: '魔女', text: '最后一道配方要写一个愿望。既然它会认你，你来决定。' },
    ],
    choices: [
      {
        id: 'wait_home',
        label: '“愿每次冒险都平安回来，换我在门口等你。”',
        mood: 'moved',
        responseDialogue: [
          { speaker: '魔女', text: '那我把回程坐标写成你站着的地方。' },
          { text: '星晶在两人掌心之间亮起柔软的归航光。' },
        ],
      },
      {
        id: 'no_hiding',
        label: '“愿你不必总把失控藏成玩笑。”',
        mood: 'moved',
        responseDialogue: [
          { text: '她安静了片刻，星晶的光也柔下来。' },
          { speaker: '魔女', text: '观察得太仔细了……不过，我并不讨厌。' },
        ],
      },
      {
        id: 'every_secret',
        label: '“愿以后每一个秘密实验，都有我的位置。”',
        mood: 'shy',
        responseDialogue: [
          { speaker: '魔女', text: '不是下一个，是以后每一个。' },
          { text: '她把星晶递到你掌心。' },
          { speaker: '魔女', text: '这样写……你同意吗？' },
        ],
      },
    ],
  },
] as const;

const SHAMAN_STORIES: readonly AffectionStoryDefinition[] = [
  {
    id: 'aff_shaman_01_bell',
    classId: 'shaman',
    episode: 1,
    title: '风铃回答以前',
    episodeLabel: '第一幕 · 安静的答案',
    unlockPoints: 0,
    requiredStoryIds: [],
    completionPoints: 30,
    backgroundAsset: 'assets/affection/scenes/shaman-shrine-morning.webp',
    openingDialogue: [
      { text: '清晨神社里没有风，檐下风铃却轻轻摇着。' },
      { speaker: '灵巫', text: '它今天不肯回答。也许在等一个不会催促它的人。' },
    ],
    choices: [
      {
        id: 'wait_silently',
        label: '“那我陪你安静等一会儿。”',
        mood: 'moved',
        responseDialogue: [
          { text: '很久以后，铃声终于响起。' },
          { speaker: '灵巫', text: '你没有说话，可它好像已经听懂了。' },
        ],
      },
      {
        id: 'leave_tea',
        label: '“我把热茶放在这里，不打断你。”',
        mood: 'calm',
        responseDialogue: [
          { speaker: '灵巫', text: '谢谢。茶的热气也是一种很温柔的回答。' },
          { text: '她把另一只茶杯放到自己身旁，位置离你很近。' },
        ],
      },
      {
        id: 'ask_to_sit',
        label: '“我可以坐在这里吗？”',
        mood: 'shy',
        responseDialogue: [
          { text: '她把身旁坐垫移开一点。' },
          { speaker: '灵巫', text: '可以。靠近些也没关系；需要安静时，我会告诉你。' },
        ],
      },
    ],
  },
  {
    id: 'aff_shaman_02_firefly',
    classId: 'shaman',
    episode: 2,
    title: '借给你一盏灵火',
    episodeLabel: '第二幕 · 归灯巡夜',
    unlockPoints: 80,
    requiredStoryIds: ['aff_shaman_01_bell'],
    completionPoints: 45,
    backgroundAsset: 'assets/affection/scenes/shaman-firefly-lake.webp',
    openingDialogue: [
      { text: '一簇小灵火离开她的灯盏，固执地跟在你肩边。' },
      { speaker: '灵巫', text: '它平时不会靠近陌生人。' },
    ],
    choices: [
      {
        id: 'wait_until_safe',
        label: '“先让它陪着你，等你放心了再借给我。”',
        mood: 'moved',
        responseDialogue: [
          { text: '灵火已经先一步落到你的肩头。' },
          { speaker: '灵巫', text: '看来它比我更早知道……我已经放心了。' },
        ],
      },
      {
        id: 'walk_together',
        label: '“陪我绕湖走一圈吧，你和它一起。”',
        mood: 'bright',
        responseDialogue: [
          { text: '水面映出两个人和一簇灵火，像三道并肩的影子。' },
          { speaker: '灵巫', text: '这样的巡夜，似乎不再漫长了。' },
        ],
      },
      {
        id: 'name_light',
        label: '“给它起个只有我们知道的名字。”',
        mood: 'shy',
        responseDialogue: [
          { speaker: '灵巫', text: '叫“归灯”吧。' },
          { speaker: '灵巫', text: '因为无论走多远，它都会带人回到想见的人身边。' },
        ],
      },
    ],
  },
  {
    id: 'aff_shaman_03_wish',
    classId: 'shaman',
    episode: 3,
    title: '心愿不必说给神明',
    episodeLabel: '第三幕 · 两半愿纸',
    unlockPoints: 240,
    requiredStoryIds: ['aff_shaman_02_firefly'],
    completionPoints: 60,
    backgroundAsset: 'assets/affection/scenes/shaman-bell-corridor-rain.webp',
    cgAsset: 'assets/affection/cg/shaman-split-wish.webp',
    memoryCallbacks: [
      {
        fromStoryId: 'aff_shaman_02_firefly',
        choiceId: 'wait_until_safe',
        dialogue: [{ speaker: '灵巫', text: '归灯今天直接飞向你。它和我都不再迟疑了。' }],
      },
      {
        fromStoryId: 'aff_shaman_02_firefly',
        choiceId: 'walk_together',
        dialogue: [{ speaker: '灵巫', text: '湖边那圈路不长，我却记住了每一步。' }],
      },
      {
        fromStoryId: 'aff_shaman_02_firefly',
        choiceId: 'name_light',
        dialogue: [{ speaker: '灵巫', text: '你还记得“归灯”的名字吗？它正在替我等你。' }],
      },
    ],
    openingDialogue: [
      { text: '雨声盖住祈愿铃，她拿着空白愿纸迟迟没有落笔。' },
      { speaker: '灵巫', text: '大家都把愿望交给我。我却忽然不知道，自己的愿望是什么。' },
    ],
    choices: [
      {
        id: 'wish_for_her',
        label: '“这一次先写你的，不替任何人。”',
        mood: 'moved',
        responseDialogue: [
          { speaker: '灵巫', text: '那我想写——愿有人也会问我累不累。' },
          { text: '她把愿纸折成两半，一半轻轻放入你手中。' },
        ],
      },
      {
        id: 'guard_each_other',
        label: '“若你总替我守夜，以后也让我守着你。”',
        mood: 'shy',
        responseDialogue: [
          { speaker: '灵巫', text: '守护原来不是一个方向，而是一个圆。' },
          { text: '归灯沿着你们之间画出一圈温柔光轨。' },
        ],
      },
      {
        id: 'share_tomorrow',
        label: '“把明天留一小段给我，我们一起决定做什么。”',
        mood: 'bright',
        responseDialogue: [
          { text: '她写下愿望，将纸折成两半。' },
          { speaker: '灵巫', text: '一半给神明，一半给你保管。这样明天就不会走丢。' },
        ],
      },
    ],
  },
] as const;

const CATKIN_STORIES: readonly AffectionStoryDefinition[] = [
  {
    id: 'aff_catkin_01_box',
    classId: 'catkin',
    episode: 1,
    title: '纸箱的优先席',
    episodeLabel: '第一幕 · 第一副队长',
    unlockPoints: 0,
    requiredStoryIds: [],
    completionPoints: 30,
    backgroundAsset: 'assets/affection/scenes/catkin-box-base.webp',
    openingDialogue: [
      { text: '房间中央多了一座纸箱据点，门口郑重摆着“只容一人”的坐垫。' },
      { speaker: '喵喵', text: '贵宾席只有一个。除非你有很有说服力的申请。' },
      { text: '她抱臂守在门边，神情像一位等待正式文书的可靠队长。' },
    ],
    choices: [
      {
        id: 'knock_first',
        label: '“先敲门。请问我可以进去吗？”',
        mood: 'bright',
        responseDialogue: [
          { speaker: '喵喵', text: '会敲门的人加分！' },
          { speaker: '喵喵', text: '可以进，但不许动我的战利品地图。' },
        ],
      },
      {
        id: 'warm_milk',
        label: '“我带了热莓奶，放在门口，由你决定。”',
        mood: 'shy',
        responseDialogue: [
          { speaker: '喵喵', text: '礼物可以进。' },
          { text: '她向旁边挪了挪。' },
          { speaker: '喵喵', text: '送礼的人……也能挤进半个位置。' },
        ],
      },
      {
        id: 'reinforce_box',
        label: '“我帮你加固架子，东西放哪都听你的。”',
        mood: 'playful',
        responseDialogue: [
          { speaker: '喵喵', text: '你记得这是我的据点，不是普通纸箱。很好。' },
          { speaker: '喵喵', text: '正式任命你为第一副队长！' },
        ],
      },
    ],
  },
  {
    id: 'aff_catkin_02_glove',
    classId: 'catkin',
    episode: 2,
    title: '只借你一下的肉球',
    episodeLabel: '第二幕 · 搭档集合',
    unlockPoints: 80,
    requiredStoryIds: ['aff_catkin_01_box'],
    completionPoints: 45,
    backgroundAsset: 'assets/affection/scenes/catkin-workbench-evening.webp',
    openingDialogue: [
      { text: '训练后，她的手套扣松开了，一只戴着晶爪手套的手伸到你面前。' },
      { speaker: '喵喵', text: '只检查手套，不许顺手摸耳朵。先说好！' },
    ],
    choices: [
      {
        id: 'ask_buckle',
        label: '“我可以碰手套扣吗？你点头我再动。”',
        mood: 'shy',
        responseDialogue: [
          { text: '她认真点头，把手放稳。' },
          { speaker: '喵喵', text: '三秒钟。……你的手怎么比晶爪还凉。' },
        ],
      },
      {
        id: 'hold_light',
        label: '“修理带给你，你自己来，我替你照明。”',
        mood: 'moved',
        responseDialogue: [
          { speaker: '喵喵', text: '尊重专业猫爪，判断正确。' },
          { speaker: '喵喵', text: '不过你要留在这里，不许把光拿走。' },
        ],
      },
      {
        id: 'glove_highfive',
        label: '“隔着手套击个掌，修好就当庆祝。”',
        mood: 'bright',
        responseDialogue: [
          { text: '清脆一声，蓝色小火花从掌心跳开。' },
          { speaker: '喵喵', text: '这个声音以后就代表“搭档集合”！' },
        ],
      },
    ],
  },
  {
    id: 'aff_catkin_03_rooftop',
    classId: 'catkin',
    episode: 3,
    title: '屋顶上抓住的月亮',
    episodeLabel: '第三幕 · 月下座位',
    unlockPoints: 240,
    requiredStoryIds: ['aff_catkin_02_glove'],
    completionPoints: 60,
    backgroundAsset: 'assets/affection/scenes/catkin-rooftop-moon.webp',
    cgAsset: 'assets/affection/cg/catkin-paw-highfive.webp',
    memoryCallbacks: [
      {
        fromStoryId: 'aff_catkin_02_glove',
        choiceId: 'ask_buckle',
        dialogue: [{ speaker: '喵喵', text: '手套扣很牢。你上次修得……勉强有专业水准。' }],
      },
      {
        fromStoryId: 'aff_catkin_02_glove',
        choiceId: 'hold_light',
        dialogue: [{ speaker: '喵喵', text: '今晚不用替我照明，坐在旁边就够亮了。' }],
      },
      {
        fromStoryId: 'aff_catkin_02_glove',
        choiceId: 'glove_highfive',
        dialogue: [{ speaker: '喵喵', text: '听见集合暗号了吗？这次是屋顶特别行动。' }],
      },
    ],
    openingDialogue: [
      { text: '她坐在屋顶边缘，尾巴规规矩矩盘在自己身侧。' },
      { speaker: '喵喵', text: '月亮追了我半晚。不过我知道，你其实是来找我的。' },
    ],
    choices: [
      {
        id: 'wait_invite',
        label: '“我坐远一点。想让我靠近时，你再叫我。”',
        mood: 'moved',
        responseDialogue: [
          { text: '她的尾尖在两人之间轻轻敲了一下瓦片。' },
          { speaker: '喵喵', text: '这是召集信号，可不是不小心。' },
        ],
      },
      {
        id: 'share_candy',
        label: '“战利品糖一人一半，你先挑。”',
        mood: 'bright',
        responseDialogue: [
          { speaker: '喵喵', text: '明明两块一样大……' },
          { text: '她把其中一块推给你。' },
          { speaker: '喵喵', text: '我量过了，真的一样大。' },
        ],
      },
      {
        id: 'came_for_her',
        label: '“我是来找你的，月亮只是顺便。”',
        mood: 'shy',
        responseDialogue: [
          { text: '她的尾巴一下扬起，又立刻压回身边。' },
          { speaker: '喵喵', text: '再说一次。刚才我在看月亮，没听清。' },
        ],
      },
    ],
  },
] as const;

export const AFFECTION_CHARACTERS: Readonly<Record<ClassId, AffectionCharacterDefinition>> = {
  swordsman: {
    classId: 'swordsman',
    adult: true,
    name: '剑姬',
    roomTitle: '晨樱剑庭',
    personality: '认真克制、习惯保护别人，也在慢慢学会接受你的照顾。',
    boundaries: ['接触护腕、剑穗或手部前先询问', '不拿她的认真与责任感开低俗玩笑'],
    accent: '#ff7fa6',
    glow: '#ffd6e4',
    hubBackgroundAsset: 'assets/affection/scenes/swordsman-training-dawn.webp',
    interactions: [
      interaction(
        'morning',
        '晨间问候',
        '陪她迎接今天的第一剑',
        'bright',
        'victory',
        ['你来了。今天的第一剑，我想让你看。', '晨钟还没响，不过你已经到了。很好。'],
      ),
      interaction(
        'training',
        '陪练计数',
        '替她数剑，也提醒休息',
        'calm',
        'cast',
        ['别只数剑，也替我记得什么时候该休息。', '数到一百就停——这次我会听你的。'],
      ),
      interaction(
        'tea',
        '递上热茶',
        '训练后的安静片刻',
        'moved',
        'idle',
        ['原来有人记得我喜欢不太甜的。谢谢。', '剑先放一会儿。茶凉以前，你也坐下吧。'],
      ),
      interaction(
        'walk',
        '雨后散步',
        '沿着樱廊并肩走走',
        'calm',
        'idle',
        ['伞留在中间，谁都不许淋到。', '今天没有雨，可你还是走在伞沿的位置。'],
        'aff_swordsman_01_dawn',
      ),
      interaction(
        'guard',
        '检查护腕',
        '先询问，再替她系好',
        'shy',
        'cast',
        ['可以。因为你有先问。', '最后一个结交给你……别系得太紧。'],
        'aff_swordsman_01_dawn',
      ),
      interaction(
        'ribbon',
        '整理剑穗',
        '把胜利绶带轻轻理顺',
        'shy',
        'victory',
        ['刀刃我来，剑穗……可以交给你。', '这一端留在剑上，另一端的位置你知道。'],
        'aff_swordsman_03_victory',
      ),
    ],
    stories: SWORDSMAN_STORIES,
  },
  witch: {
    classId: 'witch',
    adult: true,
    name: '魔女',
    roomTitle: '偏航星工坊',
    personality: '自信俏皮，常用玩笑藏起不安；她最珍惜被认真尊重的能力与秘密。',
    boundaries: ['不擅自触碰法杖、星火和实验品', '不强迫她把尚未准备好的秘密说出来'],
    accent: '#ff72b7',
    glow: '#d9c7ff',
    hubBackgroundAsset: 'assets/affection/scenes/witch-atelier-spark.webp',
    interactions: [
      interaction(
        'spark',
        '星火问候',
        '看看偏航星今天飞向谁',
        'playful',
        'cast',
        ['它一看见你就亮，真是毫无原则。', '偏航星又跑过去了……算了，替我照顾它一会儿。'],
      ),
      interaction(
        'notes',
        '整理笔记',
        '只翻她允许你看的页数',
        'calm',
        'idle',
        ['这页可以看，夹着书签的那页要等我主动告诉你。', '字迹乱的地方不许笑，那是魔力太活泼。'],
      ),
      interaction(
        'drink',
        '热饮休息',
        '让实验桌暂时安静',
        'shy',
        'idle',
        ['不是怕你冷，是实验需要稳定温度。', '第二杯只是刚好多做了……位置也刚好在你面前。'],
      ),
      interaction(
        'starmap',
        '观测星图',
        '共享望远镜旁的座位',
        'shy',
        'cast',
        ['坐近一点，望远镜不会替我保留位置。', '今晚的云很少，你迟到的理由也应该很少。'],
        'aff_witch_01_star',
      ),
      interaction(
        'spell-name',
        '咒语命名',
        '给新法术起一个秘密名字',
        'playful',
        'victory',
        ['名字归你起，但不许比“偏航星”更可爱。', '这个名字只写进我们的实验记录。'],
        'aff_witch_01_star',
      ),
      interaction(
        'secret',
        '秘密实验',
        '成为今晚唯一的共犯',
        'bright',
        'cast',
        ['护目镜戴好。今天的共犯只有你。', '回程坐标确认——还是你站着的地方。'],
        'aff_witch_03_recipe',
      ),
    ],
    stories: WITCH_STORIES,
  },
  shaman: {
    classId: 'shaman',
    adult: true,
    name: '灵巫',
    roomTitle: '归灯祈愿所',
    personality: '温柔安静，擅长照顾所有人；在你面前，她也可以慢慢说出自己的愿望。',
    boundaries: ['尊重沉默，不把安静误解成需要催促', '不强迫通灵或任何肢体接触'],
    accent: '#8e78df',
    glow: '#d8e4ff',
    hubBackgroundAsset: 'assets/affection/scenes/shaman-shrine-morning.webp',
    interactions: [
      interaction(
        'bell',
        '清晨听铃',
        '不催促风铃的回答',
        'calm',
        'idle',
        ['不用急着说话，我知道你已经来了。', '铃声刚好响了一下，像是在替我问候你。'],
      ),
      interaction(
        'tea',
        '共饮热茶',
        '把第二杯留给彼此',
        'moved',
        'idle',
        ['第一杯给神明，第二杯给你。', '茶还热。若不赶路，就再坐一会儿。'],
      ),
      interaction(
        'wish',
        '折愿纸',
        '替彼此把心愿收好',
        'calm',
        'cast',
        ['愿望不用告诉我，我替你把它折好。', '折痕会记得方向，就像归灯记得你。'],
      ),
      interaction(
        'firewalk',
        '灵火散步',
        '让归灯照亮并肩的路',
        'bright',
        'cast',
        ['归灯在前面，你走在我身边。', '它今天绕了远路，也许是想让我们多走一会儿。'],
        'aff_shaman_01_bell',
      ),
      interaction(
        'nightwatch',
        '并肩巡夜',
        '让夜路不再只属于一个人',
        'shy',
        'victory',
        ['两个人的夜路，风声也会轻一点。', '你若困了就告诉我；我也会告诉你。'],
        'aff_shaman_02_firefly',
      ),
      interaction(
        'charm',
        '系上护符',
        '由她主动完成最后一个结',
        'moved',
        'cast',
        ['我来系最后一个结；你若愿意，就别急着解开。', '这不是束缚，是提醒你有人在等。'],
        'aff_shaman_03_wish',
      ),
    ],
    stories: SHAMAN_STORIES,
  },
  catkin: {
    classId: 'catkin',
    adult: true,
    name: '喵喵',
    roomTitle: '第一副队长据点',
    personality: '成年的可靠搭档，活泼机灵又略带得意；她把真正信任的人邀请进自己的据点。',
    boundaries: ['耳朵与尾巴从不作为默认触摸入口', '只在她主动伸出手套时进行肉球击掌'],
    accent: '#f39d6a',
    glow: '#a9e8ff',
    hubBackgroundAsset: 'assets/affection/scenes/catkin-box-base.webp',
    interactions: [
      interaction(
        'knock',
        '敲据点门',
        '用正式暗号申请进入',
        'playful',
        'victory',
        ['暗号正确！副队长获准进入。', '今天的贵宾席还是一个——但可以挤成两个。'],
      ),
      interaction(
        'loot',
        '整理战利品',
        '按队长规定重新分类',
        'shy',
        'idle',
        ['不许偷看藏宝格……算了，可以看一眼。', '这颗亮晶晶归你保管，丢了要赔两次击掌。'],
      ),
      interaction(
        'light',
        '追光游戏',
        '一起抓住跑掉的小光点',
        'playful',
        'cast',
        ['抓到光点算我赢，抓到我旁边的位置也算你赢。', '这一局平手。下一局还是在这里集合。'],
      ),
      interaction(
        'highfive',
        '肉球击掌',
        '隔着手套确认搭档暗号',
        'bright',
        'victory',
        ['只隔着手套，一、二、啪！', '蓝色火花出现了——搭档集合成功。'],
        'aff_catkin_02_glove',
      ),
      interaction(
        'repair',
        '修理手套',
        '照明归你，晶爪归她',
        'calm',
        'cast',
        ['照明交给你，晶爪交给专业人士。', '别把光移开……我是说，工作还没结束。'],
        'aff_catkin_02_glove',
      ),
      interaction(
        'moon',
        '屋顶看月',
        '共享据点外的特别座位',
        'moved',
        'idle',
        ['月亮归天空，旁边这个位置归你。', '今天没有任务。只是队长想叫副队长来。'],
        'aff_catkin_03_rooftop',
      ),
    ],
    stories: CATKIN_STORIES,
  },
} as const;

export const AFFECTION_STORIES: readonly AffectionStoryDefinition[] = Object.values(
  AFFECTION_CHARACTERS,
).flatMap((character) => character.stories);

export function requireAffectionCharacter(classId: ClassId): AffectionCharacterDefinition {
  return AFFECTION_CHARACTERS[classId];
}

export function requireAffectionStory(
  classId: ClassId,
  storyId: string,
): AffectionStoryDefinition {
  const story = AFFECTION_CHARACTERS[classId].stories.find((entry) => entry.id === storyId);
  if (!story) throw new Error(`[配置错误] ${classId} 的好感剧情不存在：${storyId}`);
  return story;
}

export function affectionMemoryDialogue(
  story: AffectionStoryDefinition,
  choiceHistory: Readonly<Record<string, string>>,
): EncounterLine[] {
  return (story.memoryCallbacks ?? [])
    .filter((callback) => choiceHistory[callback.fromStoryId] === callback.choiceId)
    .flatMap((callback) => callback.dialogue.map((line) => ({ ...line })));
}
