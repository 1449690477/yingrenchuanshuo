import type { AffectionMood } from '@/core/affection';
import type { EncounterLine } from '@/core/encounters';
import type { ClassId } from '@/core/types';
import { affectionDateStories } from '@/data/affectionDates';

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

const rememberedChoices = (
  fromStoryId: string,
  speaker: string,
  entries: readonly (readonly [choiceId: string, text: string])[],
): AffectionMemoryCallback[] =>
  entries.map(([choiceId, text]) => ({
    fromStoryId,
    choiceId,
    dialogue: [{ speaker, text }],
  }));

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
  {
    id: 'aff_swordsman_04_backguard',
    classId: 'swordsman',
    episode: 4,
    title: '把背后交给你',
    episodeLabel: '第四幕 · 并肩战术',
    unlockPoints: 520,
    requiredStoryIds: ['aff_swordsman_03_victory'],
    completionPoints: 60,
    backgroundAsset: 'assets/affection/scenes/swordsman-paired-trial-sunset.webp',
    memoryCallbacks: [
      ...rememberedChoices('aff_swordsman_01_dawn', '剑姬', [
        ['watch_breath', '你最先看见的总是我有没有勉强自己。今晚也请你看着我。'],
        ['wooden_sword', '晨练时你选择并肩而立，这次也请与我一起核对每个信号。'],
        ['ask_guard', '那次你先问过才替我系护腕，所以我愿意把背后交给你。'],
      ]),
      ...rememberedChoices('aff_swordsman_03_victory', '剑姬', [
        ['her_smile', '你看见过我卸下防备的样子，所以这份手札也不必对你藏着。'],
        ['looking_for_me', '我每次收剑都会确认你的位置，正好可以把它定成安全信号。'],
        ['remember_her', '你记住的是握剑的人，而这本手札要记住我们两个人的判断。'],
      ]),
    ],
    openingDialogue: [
      { text: '训练后的樱木作战室里，摊开的战术手札有几页被剑风划破。' },
      { speaker: '剑姬', text: '旧手札只写了我如何挡在前面。现在看来，那不是完整的并肩。' },
      { text: '她递来修补纸与缎带，空白页上留着信号、背后与共同撤退三个位置。' },
    ],
    choices: [
      {
        id: 'agree_safety_signal',
        label: '“先约定一个只有我们懂的安全信号。”',
        mood: 'moved',
        responseDialogue: [
          { speaker: '剑姬', text: '收到信号就互相确认，不许任何人独自逞强。' },
          { text: '她在修好的页角画下两道并行剑纹，与你一起试过信号。' },
        ],
      },
      {
        id: 'rotate_backguard',
        label: '“轮流守住背后，谁都不永远站在最前面。”',
        mood: 'bright',
        responseDialogue: [
          { speaker: '剑姬', text: '把背后交给你，并不削弱我的剑。它让我们的视野完整。' },
          { text: '她把背靠背阵形画进手札，也将你的名字写在与自己平齐的位置。' },
        ],
      },
      {
        id: 'retreat_together',
        label: '“再写一条：形势不对时必须共同撤退。”',
        mood: 'shy',
        responseDialogue: [
          { text: '她停笔片刻，认真把“共同”二字描得更深。' },
          { speaker: '剑姬', text: '不是谁拖累谁，是为了下一次仍能并肩出发。约定。' },
        ],
      },
    ],
  },
  {
    id: 'aff_swordsman_05_dayoff',
    classId: 'swordsman',
    episode: 5,
    title: '今夜不必守在最前面',
    episodeLabel: '第五幕 · 灯下休息日',
    unlockPoints: 900,
    requiredStoryIds: ['aff_swordsman_04_backguard'],
    completionPoints: 60,
    backgroundAsset: 'assets/affection/scenes/swordsman-lantern-dayoff.webp',
    memoryCallbacks: [
      ...rememberedChoices('aff_swordsman_02_rain', '剑姬', [
        ['ask_closer', '雨伞下你先问能否靠近；今晚我也想先问你愿不愿意一起坐下。'],
        ['share_half', '你教会我保护可以平分，所以担忧也不该由一个人藏着。'],
        ['hold_umbrella', '你替我握过伞柄，今晚能否也替我把茶盏放稳？'],
      ]),
      ...rememberedChoices('aff_swordsman_04_backguard', '剑姬', [
        ['agree_safety_signal', '我们的安全信号今晚不用于出战，只用来提醒彼此好好休息。'],
        ['rotate_backguard', '你说轮流守住背后，所以这次请让我放心坐在你身边。'],
        ['retreat_together', '共同撤退也包括从忙碌里撤退。手札上写得很清楚。'],
      ]),
    ],
    openingDialogue: [
      { text: '灯笼暖光铺满廊下，她没有佩剑，只在两张相邻坐垫旁放了茶与点心。' },
      { speaker: '剑姬', text: '今晚没有巡逻表。我却习惯站在最外侧，一时不知道怎样休息。' },
      { speaker: '剑姬', text: '你愿意陪我练习一次什么都不守护的夜晚吗？' },
    ],
    choices: [
      {
        id: 'share_quiet_tea',
        label: '“先坐下喝茶，沉默也算今晚的安排。”',
        mood: 'moved',
        responseDialogue: [
          { text: '她终于从廊柱旁坐下，把佩剑习惯放置的位置留空。' },
          { speaker: '剑姬', text: '原来不说话也不会错过什么。你在这里，夜色就很完整。' },
        ],
      },
      {
        id: 'choose_snack',
        label: '“选一种点心吧，今晚只讨论喜欢什么。”',
        mood: 'shy',
        responseDialogue: [
          { speaker: '剑姬', text: '这么简单的问题，竟比战术选择更难。' },
          { text: '她把选中的点心分成两半，笑意在灯影里慢慢松开。' },
        ],
      },
      {
        id: 'one_safety_check',
        label: '“若还是想确认安全，我们就轮流看一眼，然后继续休息。”',
        mood: 'calm',
        responseDialogue: [
          { speaker: '剑姬', text: '不是禁止警觉，而是不让它把整晚都占满。这个办法很好。' },
          { text: '她只确认一次庭院，回来后便把座位向你这边挪近。' },
        ],
      },
    ],
  },
  {
    id: 'aff_swordsman_06_homecoming',
    classId: 'swordsman',
    episode: 6,
    title: '归来时，座位仍在这里',
    episodeLabel: '第六幕 · 晨光归席',
    unlockPoints: 1_400,
    requiredStoryIds: ['aff_swordsman_05_dayoff'],
    completionPoints: 60,
    backgroundAsset: 'assets/affection/scenes/swordsman-homecoming-sunrise.webp',
    cgAsset: 'assets/affection/cg/swordsman-homecoming-knot.webp',
    memoryCallbacks: [
      ...rememberedChoices('aff_swordsman_03_victory', '剑姬', [
        ['her_smile', '你记得我卸下防备后的笑，所以今天我想坦然地笑给你看。'],
        ['looking_for_me', '我收剑后寻找的人，此刻就在晨光里等我。'],
        ['remember_her', '你记住握剑的人，我也早已记住接住我真心的人。'],
      ]),
      ...rememberedChoices('aff_swordsman_04_backguard', '剑姬', [
        ['agree_safety_signal', '我们约好的安全信号仍在，往后的路更不必谁独自判断。'],
        ['rotate_backguard', '背后可以轮流交给彼此，归来的方向也可以共同确认。'],
        ['retreat_together', '手札写着共同撤退，所以每一次远征都要一起回来。'],
      ]),
      ...rememberedChoices('aff_swordsman_05_dayoff', '剑姬', [
        ['share_quiet_tea', '灯下那段安静让我知道，归来后有人同坐就已经足够。'],
        ['choose_snack', '我们分享过不谈战术的夜晚，所以今天也不必急着汇报战果。'],
        ['one_safety_check', '你允许我只确认一次安全；现在我能安心走向为我留着的座位。'],
      ]),
    ],
    openingDialogue: [
      { text: '远征后的晨光穿过樱木窗格，作战室里那张相邻座位仍保持着离开前的样子。' },
      { speaker: '剑姬', text: '我一路都记得：归来时，不必先证明自己赢得多漂亮。' },
      { speaker: '剑姬', text: '只要还能回到这里，与你一起解开这枚归来结。' },
    ],
    choices: [
      {
        id: 'choose_each_day',
        label: '“欢迎回来。先坐下，战报可以以后再说。”',
        mood: 'moved',
        responseDialogue: [
          { speaker: '剑姬', text: '原来这四个字，比任何凯旋礼都更让我安心。' },
          { text: '她坐到一直为她保留的位置，将归来结的一端交给你。' },
        ],
      },
      {
        id: 'share_future_map',
        label: '“一起把归来结系好，再约定下一次共同撤退。”',
        mood: 'bright',
        responseDialogue: [
          { speaker: '剑姬', text: '无论出发几次，都要把彼此带回这张座位旁。' },
          { text: '两段缎带在你们手中合成一枚不束缚任何人的并肩结。' },
        ],
      },
      {
        id: 'stand_as_equals',
        label: '“座位会留着，但我们也可以一起去创造新的归处。”',
        mood: 'shy',
        responseDialogue: [
          { speaker: '剑姬', text: '归处不是让人停下的锁，而是让人敢继续向前的理由。' },
          { text: '她与你并肩推开作战室的门，晨樱正落在下一段路上。' },
        ],
      },
    ],
  },
  {
    id: 'aff_swordsman_07_gift',
    classId: 'swordsman',
    episode: 7,
    title: '礼物不写进军需单',
    episodeLabel: '第七幕 · 樱叶茶礼',
    unlockPoints: 1_700,
    requiredStoryIds: ['aff_swordsman_06_homecoming'],
    completionPoints: 60,
    backgroundAsset: 'assets/affection/scenes/swordsman-gift-tea-dawn.webp',
    memoryCallbacks: [
      ...rememberedChoices('aff_swordsman_05_dayoff', '剑姬', [
        ['share_quiet_tea', '你曾陪我安静喝茶，所以这份茶礼不需要热闹的答谢。'],
        ['choose_snack', '你记得我不喜欢太甜；更重要的是，你仍愿意问我今天想选什么。'],
        ['one_safety_check', '你允许我只确认一次安全；这次我也只确认一次礼物是否安全，然后安心收下。'],
      ]),
    ],
    openingDialogue: [
      { text: '晨光落进小茶室，一只未拆的樱叶茶罐放在两只空杯之间，军需簿却被合在一旁。' },
      { speaker: '剑姬', text: '我第一反应是把它登记，再想办法回赠同等价值的物资。' },
      { speaker: '剑姬', text: '可你说这是礼物。那我想先学会，不把心意换算成欠款。' },
    ],
    choices: [
      {
        id: 'gift_without_debt',
        label: '“它不是军需，也不需要用战果偿还。”',
        mood: 'moved',
        responseDialogue: [
          { speaker: '剑姬', text: '那我只说谢谢，不列补给清单。' },
          { text: '她把军需簿推远，亲自为相邻的两只杯子添上热茶。' },
        ],
      },
      {
        id: 'open_at_own_pace',
        label: '“你可以现在拆，也可以等想独处时再看。”',
        mood: 'calm',
        responseDialogue: [
          { speaker: '剑姬', text: '选择收礼的时机，也属于收到礼物的人。谢谢你留出这个位置。' },
          { text: '她没有急着拆封，只先把属于你的杯子放到身旁。' },
        ],
      },
      {
        id: 'next_gift_by_request',
        label: '“下次想要什么，可以直接告诉我；我也会告诉你。”',
        mood: 'shy',
        responseDialogue: [
          { speaker: '剑姬', text: '不必靠猜测证明在意……好。那下一次，由我先开口。' },
          { text: '她认真记住约定，却没有再把它写进任何值勤表。' },
        ],
      },
    ],
  },
  {
    id: 'aff_swordsman_08_preference',
    classId: 'swordsman',
    episode: 8,
    title: '喜欢可以说得更具体',
    episodeLabel: '第八幕 · 雨市试味',
    unlockPoints: 2_100,
    requiredStoryIds: ['aff_swordsman_07_gift'],
    completionPoints: 60,
    backgroundAsset: 'assets/affection/scenes/swordsman-rain-market-tasting.webp',
    memoryCallbacks: [
      ...rememberedChoices('aff_swordsman_07_gift', '剑姬', [
        ['gift_without_debt', '今天不谈价格和战果，只谈各自真正喜欢的味道。'],
        ['open_at_own_pace', '你把选择时机留给我，所以这一次我想主动告诉你答案。'],
        ['next_gift_by_request', '我们约好不让对方一直猜；今天轮到我先开口。'],
      ]),
    ],
    openingDialogue: [
      { text: '细雨落在有顶小市集外，试味桌上摆着三份不同甜度的茶点。' },
      { speaker: '剑姬', text: '以前有人问我喜欢什么，我总回答“都可以”。那其实只是在省略自己。' },
      { speaker: '剑姬', text: '今天我想认真选，也想知道你的口味。' },
    ],
    choices: [
      {
        id: 'ask_today_preference',
        label: '“我记得你偏爱低糖，但今天仍由你重新选择。”',
        mood: 'moved',
        responseDialogue: [
          { speaker: '剑姬', text: '被记住，却不被过去的答案困住……这样的体贴很温柔。' },
          { text: '她选了带淡淡樱叶香的一份，也把另一只小碟推到你面前。' },
        ],
      },
      {
        id: 'taste_separately',
        label: '“我们各选一份；想交换试味时，再先问对方。”',
        mood: 'bright',
        responseDialogue: [
          { speaker: '剑姬', text: '各自保留选择，也能主动分享。很像我们现在的并肩。' },
          { text: '她认真比较三份茶点，最后笑着问你愿不愿意交换一小块。' },
        ],
      },
      {
        id: 'allow_changed_mind',
        label: '“喜好会变。改口不算辜负礼物，只是更诚实地认识彼此。”',
        mood: 'shy',
        responseDialogue: [
          { speaker: '剑姬', text: '那我以后不再用“都可以”挡住你，也不挡住自己。' },
          { text: '雨声轻落，她第一次自然地说出自己还想再尝哪一种。' },
        ],
      },
    ],
  },
  {
    id: 'aff_swordsman_09_reciprocal',
    classId: 'swordsman',
    episode: 9,
    title: '回礼不是还债',
    episodeLabel: '第九幕 · 双向心意',
    unlockPoints: 2_600,
    requiredStoryIds: ['aff_swordsman_08_preference'],
    completionPoints: 60,
    backgroundAsset: 'assets/affection/scenes/swordsman-reciprocal-gift-sunset.webp',
    cgAsset: 'assets/affection/cg/swordsman-two-way-gift-ribbons.webp',
    memoryCallbacks: [
      ...rememberedChoices('aff_swordsman_06_homecoming', '剑姬', [
        ['choose_each_day', '你说归来时不必先交战报，所以今天也不必先报告礼物价值。'],
        ['share_future_map', '归来结由我们一起系好，这次回礼也该由两个人一起定义。'],
        ['stand_as_equals', '你说归处可以共同创造；这件回礼正想成为那段路的书签。'],
      ]),
    ],
    openingDialogue: [
      { text: '晚霞落在木桌上，她准备了一枚由旧胜利绶带编成的地图书签，旁边放着你送的茶罐。' },
      { speaker: '剑姬', text: '这不是偿还那份茶礼。我只是看见它时，第一时间想把它送给你。' },
      { speaker: '剑姬', text: '若你愿意收下，也请允许我不计算两件礼物是否等价。' },
    ],
    choices: [
      {
        id: 'receive_without_balance',
        label: '“我愿意收下。我们不说两清，只说谢谢。”',
        mood: 'moved',
        responseDialogue: [
          { speaker: '剑姬', text: '好。不是结清，是心意从一个人走向另一个人。' },
          { text: '两份礼物在桌上并排展开，缎带没有绑住任何一件物品。' },
        ],
      },
      {
        id: 'tell_each_reason',
        label: '“不比较价格；我们各自说说为什么想送它。”',
        mood: 'bright',
        responseDialogue: [
          { speaker: '剑姬', text: '我选它，是因为每次展开地图时，我都希望你在下一条路上。' },
          { text: '她听完你的理由，把两段独立缎带轻轻摆成并肩方向。' },
        ],
      },
      {
        id: 'leave_future_ribbon',
        label: '“留一条不打结的丝带，给以后改变心意与礼物的我们。”',
        mood: 'shy',
        responseDialogue: [
          { speaker: '剑姬', text: '空白不是犹豫，是把未来也当作平等的选择。' },
          { text: '她将未打结的丝带放在两份礼物之间，晚樱落在柔软留白上。' },
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
  {
    id: 'aff_witch_04_miscalculation',
    classId: 'witch',
    episode: 4,
    title: '不完美也会发光',
    episodeLabel: '第四幕 · 误差星光',
    unlockPoints: 520,
    requiredStoryIds: ['aff_witch_03_recipe'],
    completionPoints: 60,
    backgroundAsset: 'assets/affection/scenes/witch-atelier-afterglow.webp',
    memoryCallbacks: [
      ...rememberedChoices('aff_witch_01_star', '魔女', [
        ['ask_both', '偏航星还记得你会先问过我们两个，所以今晚它主动飞来邀请你。'],
        ['hold_notes', '你替我按住过笔记，这次也来陪我把误差记录完整。'],
        ['name_star', '你说星星只是想被记住；我把今晚的每一颗都记在你的名字旁边。'],
      ]),
      ...rememberedChoices('aff_witch_03_recipe', '魔女', [
        ['wait_home', '你把回程坐标写成等我的地方，所以算错一步也不代表无法回来。'],
        ['no_hiding', '你说不必把失控藏成玩笑，那我就承认：这次实验算错了。'],
        ['every_secret', '你要参与每个秘密实验。很好，失败记录也算秘密实验的一部分。'],
      ]),
    ],
    openingDialogue: [
      { text: '夕照落进工坊，一枚算错刻度的星晶正忽明忽暗，桌边散着未完成的公式。' },
      { speaker: '魔女', text: '它没有按预计变成完美球体，却还在发光。' },
      { speaker: '魔女', text: '我知道失败记录也有价值，只是今天想听你陪我给它一个新结论。' },
    ],
    choices: [
      {
        id: 'keep_unique_shape',
        label: '“保留它的形状吧，不完美也是这次实验独有的结果。”',
        mood: 'moved',
        responseDialogue: [
          { speaker: '魔女', text: '独有，而不是残次品……这个分类比我的公式更准确。' },
          { text: '歪斜星晶在她掌心亮起柔软余辉，像认真接受了自己的模样。' },
        ],
      },
      {
        id: 'review_without_blame',
        label: '“一起复盘误差，但今天不急着把它修正。”',
        mood: 'bright',
        responseDialogue: [
          { speaker: '魔女', text: '把求知欲留下，把责备拿走。不错的复盘原则。' },
          { text: '你们并排补完记录，并在最后一栏共同画下一颗仍在发光的小星。' },
        ],
      },
      {
        id: 'treasure_accident',
        label: '“如果你愿意，把它送给我；我喜欢这次意外。”',
        mood: 'shy',
        responseDialogue: [
          { speaker: '魔女', text: '你这样说，会让天才魔女开始期待下一次小误差。' },
          { text: '她为星晶系上细绳，郑重放进你伸出的掌心。' },
        ],
      },
    ],
  },
  {
    id: 'aff_witch_05_nightflight',
    classId: 'witch',
    episode: 5,
    title: '把暂停咒语交给你',
    episodeLabel: '第五幕 · 星舟夜航',
    unlockPoints: 900,
    requiredStoryIds: ['aff_witch_04_miscalculation'],
    completionPoints: 60,
    backgroundAsset: 'assets/affection/scenes/witch-star-skiff-night.webp',
    memoryCallbacks: [
      ...rememberedChoices('aff_witch_02_observatory', '魔女', [
        ['sit_near', '你总会先问能否靠近。今晚我先回答：可以，坐到我身边。'],
        ['soft_cushion', '观星台的软垫还在；星舟上也给你留了同样的位置。'],
        ['came_for_you', '那晚你主要是来见我……现在这句话成了归航咒最稳定的坐标。'],
      ]),
      ...rememberedChoices('aff_witch_04_miscalculation', '魔女', [
        ['keep_unique_shape', '那枚不规则星晶还在发光，它提醒我不必把每一步都算得完美。'],
        ['review_without_blame', '你教我复盘时拿走责备，所以暂停也不会变成失败。'],
        ['treasure_accident', '你喜欢那次意外；这次夜航偏离一点，也许会看见新的星河。'],
      ]),
    ],
    openingDialogue: [
      { text: '星舟划过夜空，她同时修正航线、记录星象，指尖的魔光越来越急。' },
      { speaker: '魔女', text: '我给所有法术都写过停止条件，唯独没给自己准备暂停咒语。' },
      { speaker: '魔女', text: '现在想把它交给你，但何时使用仍要由我们一起判断。' },
    ],
    choices: [
      {
        id: 'ask_before_pause',
        label: '“我会先问你，再念暂停咒；决定权仍在你。”',
        mood: 'calm',
        responseDialogue: [
          { text: '她把咒语写进你的航图，也在旁边标下注释：先确认。' },
          { speaker: '魔女', text: '很好。关心不是擅自夺走控制权。' },
        ],
      },
      {
        id: 'shared_pause_signal',
        label: '“我们设一个共同信号，谁太累都可以提出暂停。”',
        mood: 'moved',
        responseDialogue: [
          { speaker: '魔女', text: '双向生效才公平。那我也有权提醒你休息。' },
          { text: '两枚暂停符号同时落在星舟舵盘两侧，亮度完全相同。' },
        ],
      },
      {
        id: 'pause_for_stars',
        label: '“现在就试一次。停下来看看星河，不做任何记录。”',
        mood: 'shy',
        responseDialogue: [
          { speaker: '魔女', text: '命令已确认——暂停。原来星星不写进报告也不会消失。' },
          { text: '星舟放慢速度，她与你靠在舷边，看无须计算的光从身旁流过。' },
        ],
      },
    ],
  },
  {
    id: 'aff_witch_06_constellation',
    classId: 'witch',
    episode: 6,
    title: '不会偏航的坐标',
    episodeLabel: '第六幕 · 共享星座',
    unlockPoints: 1_400,
    requiredStoryIds: ['aff_witch_05_nightflight'],
    completionPoints: 60,
    backgroundAsset: 'assets/affection/scenes/witch-observatory-dawn.webp',
    cgAsset: 'assets/affection/cg/witch-shared-constellation.webp',
    memoryCallbacks: [
      ...rememberedChoices('aff_witch_03_recipe', '魔女', [
        ['wait_home', '归航坐标仍是你等待的地方，而今天我们要一起写下出发方向。'],
        ['no_hiding', '我不再把不安藏成玩笑，也不会把喜欢藏成谜题。'],
        ['every_secret', '每个秘密实验都有你的位置，这张星图当然也不例外。'],
      ]),
      ...rememberedChoices('aff_witch_04_miscalculation', '魔女', [
        ['keep_unique_shape', '那枚不完美星晶仍在发光，正适合成为共享星座的第一颗星。'],
        ['review_without_blame', '我们一起记录过误差，今天也一起写下不会偏航的公式。'],
        ['treasure_accident', '你愿意珍藏意外的光，所以这张星图也不必追求标准答案。'],
      ]),
      ...rememberedChoices('aff_witch_05_nightflight', '魔女', [
        ['ask_before_pause', '你答应先确认再念暂停咒，所以这份坐标不会剥夺任何人的选择。'],
        ['shared_pause_signal', '我们的暂停信号双向生效，共享坐标也该让两个人都能改写。'],
        ['pause_for_stars', '夜航时我们停下来只看星河，才发现最清楚的坐标一直在身边。'],
      ]),
    ],
    openingDialogue: [
      { text: '晨光进入观星台，一张由两条独立星轨组成的共享星座悬在穹顶下。' },
      { speaker: '魔女', text: '它不是让谁围着谁转，而是让两条航线都知道怎样找到对方。' },
      { speaker: '魔女', text: '最后一个坐标，应该由我们共同写下。' },
    ],
    choices: [
      {
        id: 'two_home_stars',
        label: '“画两颗各自发光、却能彼此找到的归航星。”',
        mood: 'moved',
        responseDialogue: [
          { speaker: '魔女', text: '不会互相吞没，也永远知道对方在哪里。完美。' },
          { text: '共享星座中亮起两颗归航星，各自映着另一条航线的微光。' },
        ],
      },
      {
        id: 'open_route',
        label: '“先画一条没有终点的路线，以后边走边补。”',
        mood: 'bright',
        responseDialogue: [
          { speaker: '魔女', text: '那这会是全世界唯一一幅持续更新的星座。' },
          { text: '她与你同时落笔，星路朝尚未命名的远方延伸。' },
        ],
      },
      {
        id: 'shared_blank',
        label: '“留一块空白，给以后改变主意的我们。”',
        mood: 'shy',
        responseDialogue: [
          { speaker: '魔女', text: '誓约里也允许修改答案……你果然很适合和我研究一辈子。' },
          { text: '她把空白处认真圈起，与你各留下一颗尚未连线的星点。' },
        ],
      },
    ],
  },
  {
    id: 'aff_witch_07_gift',
    classId: 'witch',
    episode: 7,
    title: '先让礼物通过安全咒',
    episodeLabel: '第七幕 · 偏航墨水',
    unlockPoints: 1_700,
    requiredStoryIds: ['aff_witch_06_constellation'],
    completionPoints: 60,
    backgroundAsset: 'assets/affection/scenes/witch-gift-safety-atelier.webp',
    memoryCallbacks: [
      ...rememberedChoices('aff_witch_04_miscalculation', '魔女', [
        ['keep_unique_shape', '你不会因为形状不标准就否定它，所以我愿意认真检查这瓶奇怪星墨。'],
        ['review_without_blame', '我们检查的是风险，不是在审问送礼的人。你一直分得很清楚。'],
        ['treasure_accident', '你连意外形成的星晶都愿意珍藏，这瓶偏航墨大概会很合你的眼光。'],
      ]),
    ],
    openingDialogue: [
      { text: '安全光环围住一瓶尚未开封的偏航星墨，检测台被转到两张座位中间。' },
      { speaker: '魔女', text: '礼物很迷人。但越迷人的实验材料，越应该先确认边界和风险。' },
      { speaker: '魔女', text: '所以今天由我们共同决定：检查、保留密封，或者退回。' },
    ],
    choices: [
      {
        id: 'inspect_together',
        label: '“由你主持检测；我只操作你明确交给我的部分。”',
        mood: 'bright',
        responseDialogue: [
          { speaker: '魔女', text: '优秀的共犯从来不是乱碰东西，而是知道什么时候该递工具。' },
          { text: '她把检测台转到中央，与你逐项确认星墨保持稳定。' },
        ],
      },
      {
        id: 'keep_sealed',
        label: '“先保持密封。等你想研究时，它仍然是你的礼物。”',
        mood: 'moved',
        responseDialogue: [
          { speaker: '魔女', text: '你不把好奇心当通行证……这条我很喜欢。' },
          { text: '她为墨瓶罩上柔光玻璃罩，把开启日期留成空白。' },
        ],
      },
      {
        id: 'decline_is_allowed',
        label: '“若不合适就退回，不需要编一个照顾我面子的理由。”',
        mood: 'shy',
        responseDialogue: [
          { speaker: '魔女', text: '连拒收权都包装进礼物里了。你比很多魔法契约聪明。' },
          { text: '确认安全后，她才弯起眼睛，把星墨郑重移到自己的实验区。' },
        ],
      },
    ],
  },
  {
    id: 'aff_witch_08_secret',
    classId: 'witch',
    episode: 8,
    title: '秘密也有赠送日期',
    episodeLabel: '第八幕 · 未拆星页',
    unlockPoints: 2_100,
    requiredStoryIds: ['aff_witch_07_gift'],
    completionPoints: 60,
    backgroundAsset: 'assets/affection/scenes/witch-secret-library-night.webp',
    memoryCallbacks: [
      ...rememberedChoices('aff_witch_05_nightflight', '魔女', [
        ['ask_before_pause', '你答应念暂停咒前先确认，所以翻开秘密前当然也会先问。'],
        ['shared_pause_signal', '我们的暂停信号双向有效；这页星图的开启规则也由两个人确认。'],
        ['pause_for_stars', '那晚我们没有记录星河，所以今晚这页空白也不需要立刻填满。'],
      ]),
    ],
    openingDialogue: [
      { text: '深夜观星藏书室里，一页封在透明星袋中的空白手札放在两张相邻座位之间。' },
      { speaker: '魔女', text: '我想把一项尚未公开的研究送给你，但不是让你立刻证明值得信任。' },
      { speaker: '魔女', text: '开启日期由我说明，是否收下以及何时阅读，仍由你决定。' },
    ],
    choices: [
      {
        id: 'ask_opening_rule',
        label: '“先告诉我开启边界；内容可以等你准备好再解释。”',
        mood: 'moved',
        responseDialogue: [
          { speaker: '魔女', text: '问规则，不追问答案。你总能把好奇和尊重同时留下。' },
          { text: '她只说明安全边界，没有被迫透露星页中的任何秘密。' },
        ],
      },
      {
        id: 'guard_unopened',
        label: '“我愿意替你保管未拆的这一页，直到你主动说可以。”',
        mood: 'shy',
        responseDialogue: [
          { speaker: '魔女', text: '把秘密交给你，竟然不需要立刻失去它……感觉很新鲜。' },
          { text: '她为星袋留下只有自己能解除的柔光封印。' },
        ],
      },
      {
        id: 'share_blank_page',
        label: '“我也放一张空白页在旁边；想分享什么，由我们各自决定。”',
        mood: 'bright',
        responseDialogue: [
          { speaker: '魔女', text: '两份秘密都拥有自己的门，却愿意把门开向同一张桌子。' },
          { text: '两页空白手札并排放好，没有任何一页被擅自翻开。' },
        ],
      },
    ],
  },
  {
    id: 'aff_witch_09_reciprocal',
    classId: 'witch',
    episode: 9,
    title: '偏航也会抵达彼此',
    episodeLabel: '第九幕 · 双瓶星墨',
    unlockPoints: 2_600,
    requiredStoryIds: ['aff_witch_08_secret'],
    completionPoints: 60,
    backgroundAsset: 'assets/affection/scenes/witch-reciprocal-star-dawn.webp',
    cgAsset: 'assets/affection/cg/witch-reciprocal-star-ink.webp',
    memoryCallbacks: [
      ...rememberedChoices('aff_witch_06_constellation', '魔女', [
        ['two_home_stars', '两颗归航星各自发光；这两瓶星墨也不需要混成同一种颜色。'],
        ['open_route', '我们的星路可以持续更新，回礼当然也允许边走边改。'],
        ['shared_blank', '你为未来保留空白，所以我把第二瓶尚未命名的星墨留给你。'],
      ]),
    ],
    openingDialogue: [
      { text: '黎明实验台上，两瓶颜色不同的星墨停在独立黄铜底座，光轨在中间相遇又各自延伸。' },
      { speaker: '魔女', text: '一瓶是你送来的偏航星墨，另一瓶是我重新调出的回礼。' },
      { speaker: '魔女', text: '它们不用变成同一种颜色，也能在同一张星图上找到彼此。' },
    ],
    choices: [
      {
        id: 'two_independent_colors',
        label: '“保留两种颜色，让每条轨迹都能看见对方。”',
        mood: 'moved',
        responseDialogue: [
          { speaker: '魔女', text: '不互相覆盖，却能共同完成一幅星图。很像我们。' },
          { text: '两束独立星墨越过玻璃，在中央留下不相吞没的交汇光点。' },
        ],
      },
      {
        id: 'rewrite_coordinates',
        label: '“坐标可以改写；想偏航时，我们先告诉彼此。”',
        mood: 'bright',
        responseDialogue: [
          { speaker: '魔女', text: '长期实验最重要的不是永不变化，而是诚实报告新的方向。' },
          { text: '她把两只可移动底座推到中间，邀请你共同调整下一段星轨。' },
        ],
      },
      {
        id: 'opt_in_experiment',
        label: '“每次共同实验都重新确认，秘密与陪伴都不视为默认权限。”',
        mood: 'shy',
        responseDialogue: [
          { speaker: '魔女', text: '批准。看来你很适合当一位长期、但随时可以说暂停的共犯。' },
          { text: '她轻轻碰响自己的墨瓶，另一瓶随即亮起温柔回应。' },
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
  {
    id: 'aff_shaman_04_quiet',
    classId: 'shaman',
    episode: 4,
    title: '把沉默也分给你',
    episodeLabel: '第四幕 · 午后茶席',
    unlockPoints: 520,
    requiredStoryIds: ['aff_shaman_03_wish'],
    completionPoints: 60,
    backgroundAsset: 'assets/affection/scenes/shaman-quiet-tea-afternoon.webp',
    memoryCallbacks: [
      ...rememberedChoices('aff_shaman_01_bell', '灵巫', [
        ['wait_silently', '你曾陪我等风铃回答，所以今天也愿意陪我慢慢喝完这壶茶吗？'],
        ['leave_tea', '那杯没有打扰我的热茶，让我第一次期待与你共享闲暇。'],
        ['ask_to_sit', '你总会先问能否留下；今天这个位置已经主动替你留好。'],
      ]),
      ...rememberedChoices('aff_shaman_03_wish', '灵巫', [
        ['wish_for_her', '你让我先写自己的愿望，今天我想要的只是与你共享这段安静。'],
        ['guard_each_other', '守护是一个圆，沉默也可以在我们之间平等流动。'],
        ['share_tomorrow', '你预约过一小段明天；我把今天的茶席留成了两人份。'],
      ]),
    ],
    openingDialogue: [
      { text: '午后茶席被树影分成柔软的明暗，壶中热气缓慢升起，没有任何仪式等她主持。' },
      { speaker: '灵巫', text: '我今天不想解释沉默，也不想急着寻找答案。' },
      { speaker: '灵巫', text: '如果你愿意，可以陪我把这段安静分成两人份。' },
    ],
    choices: [
      {
        id: 'share_silence',
        label: '“好。我们先喝茶，谁想说话时再开口。”',
        mood: 'bright',
        responseDialogue: [
          { speaker: '灵巫', text: '谢谢你没有把安静误解成疏远。' },
          { text: '她替两只茶杯添满热茶，杯沿在桌上保持着自在的距离。' },
        ],
      },
      {
        id: 'rest_as_equals',
        label: '“我也有想安静的时候。今天不需要谁照顾谁。”',
        mood: 'calm',
        responseDialogue: [
          { speaker: '灵巫', text: '平等地分享沉默，原来也能让人感到被理解。' },
          { text: '风穿过庭院，茶香与安静同时停在两人之间。' },
        ],
      },
      {
        id: 'leave_choice_space',
        label: '“若你想结束茶席，随时告诉我；留下也由你决定。”',
        mood: 'shy',
        responseDialogue: [
          { speaker: '灵巫', text: '选择离开也不会伤害关系……这样的余地让我更愿意留下。' },
          { text: '她轻轻点头，将下一盏茶也倒成了两人份。' },
        ],
      },
    ],
  },
  {
    id: 'aff_shaman_05_storm',
    classId: 'shaman',
    episode: 5,
    title: '这次让我也被守护',
    episodeLabel: '第五幕 · 暴雨灯路',
    unlockPoints: 900,
    requiredStoryIds: ['aff_shaman_04_quiet'],
    completionPoints: 60,
    backgroundAsset: 'assets/affection/scenes/shaman-storm-lantern-path.webp',
    memoryCallbacks: [
      ...rememberedChoices('aff_shaman_02_firefly', '灵巫', [
        ['wait_until_safe', '你愿意等我放心才接过灵火，所以今晚我也愿意说出不安。'],
        ['walk_together', '那次绕湖的路不再漫长；今夜也请陪我走过这一小段。'],
        ['name_light', '归灯会带人回到想见的人身边，而它已经停在你这里。'],
      ]),
      ...rememberedChoices('aff_shaman_04_quiet', '灵巫', [
        ['share_silence', '茶席上你愿意等我开口，所以这次我也能坦白说需要帮助。'],
        ['rest_as_equals', '我们共享过不必互相照顾的安静；现在我愿意接受一次守护。'],
        ['leave_choice_space', '你把留下或离开的选择交给我；暴雨里我选择与你并肩走。'],
      ]),
    ],
    openingDialogue: [
      { text: '暴雨压低山路灯笼，她护送最后一簇灵火归位后，脚步终于在石阶边停住。' },
      { speaker: '灵巫', text: '我习惯替所有人举灯，可今晚确实有些走不动了。' },
      { speaker: '灵巫', text: '这次……可以让我也被守护一段路吗？' },
    ],
    choices: [
      {
        id: 'carry_lantern_together',
        label: '“把灯交给我，我们按你的速度一起走。”',
        mood: 'moved',
        responseDialogue: [
          { speaker: '灵巫', text: '不是催我追上，而是愿意陪我放慢……谢谢。' },
          { text: '你接过灯柄，她仍握着另一侧，暖光稳稳落在共同的路上。' },
        ],
      },
      {
        id: 'rest_under_eaves',
        label: '“先到避雨处休息，路不会因为暂停而消失。”',
        mood: 'calm',
        responseDialogue: [
          { speaker: '灵巫', text: '我总告诉别人可以休息，却忘了这句话也适用于自己。' },
          { text: '你们在檐下并肩坐好，灯火隔着雨幕照亮前方石阶。' },
        ],
      },
      {
        id: 'take_guard_turn',
        label: '“前半程你护送灵火，后半程换我守着你。”',
        mood: 'shy',
        responseDialogue: [
          { speaker: '灵巫', text: '守护原来真的会回到自己身边。那就拜托你了，同行者。' },
          { text: '她不再走在最前面，而是与你共享灯下同一片干燥位置。' },
        ],
      },
    ],
  },
  {
    id: 'aff_shaman_06_firstsnow',
    classId: 'shaman',
    episode: 6,
    title: '愿望里已经有你',
    episodeLabel: '第六幕 · 初雪愿灯',
    unlockPoints: 1_400,
    requiredStoryIds: ['aff_shaman_05_storm'],
    completionPoints: 60,
    backgroundAsset: 'assets/affection/scenes/shaman-first-snow-garden.webp',
    cgAsset: 'assets/affection/cg/shaman-paired-lantern-charm.webp',
    memoryCallbacks: [
      ...rememberedChoices('aff_shaman_03_wish', '灵巫', [
        ['wish_for_her', '你曾让我先写自己的愿望；现在我知道它是拥有可以回去的地方。'],
        ['guard_each_other', '守护是一个圆，而我们已经站在圆的两端彼此照看。'],
        ['share_tomorrow', '那张愿纸的一半仍在你那里，今天我们来补上明天。'],
      ]),
      ...rememberedChoices('aff_shaman_04_quiet', '灵巫', [
        ['share_silence', '午后那杯安静的茶，让平凡日子也值得认真期待。'],
        ['rest_as_equals', '茶席的安静不是空白，而是我们都可以自在呼吸的地方。'],
        ['leave_choice_space', '你把停留的选择留给我；往后我也愿意尊重你的方向。'],
      ]),
      ...rememberedChoices('aff_shaman_05_storm', '灵巫', [
        ['carry_lantern_together', '暴雨里你按我的速度举灯，所以初雪中也不必催促任何答案。'],
        ['rest_under_eaves', '你提醒我暂停不会让道路消失，愿望也可以慢慢写。'],
        ['take_guard_turn', '那晚守护回到我身边；今天我的愿望里自然也有你的位置。'],
      ]),
    ],
    openingDialogue: [
      { text: '初雪落在庭院，两盏成对愿灯映着未被踩乱的白色小径。' },
      { speaker: '灵巫', text: '以前我的愿望总写给别人。现在再落笔，里面已经自然地有了你。' },
      { speaker: '灵巫', text: '不是替你决定未来，只是邀请你一起点亮这对愿灯。' },
    ],
    choices: [
      {
        id: 'write_each_names',
        label: '“各写自己的名字，让两盏灯自由选择相互照亮。”',
        mood: 'moved',
        responseDialogue: [
          { speaker: '灵巫', text: '各自完整，又愿意把光分给对方。正是我想要的答案。' },
          { text: '两枚灯形护符同时亮起，光线在空中温柔交汇。' },
        ],
      },
      {
        id: 'write_open_door',
        label: '“写‘随时欢迎回来’，但谁都不必放弃自己的旅途。”',
        mood: 'bright',
        responseDialogue: [
          { speaker: '灵巫', text: '门永远可以打开，脚步也永远可以向前。' },
          { text: '她在灯面添上一条通往远方、又折返回来的细线。' },
        ],
      },
      {
        id: 'leave_space',
        label: '“先留一面空白，以后的愿望由未来的我们补写。”',
        mood: 'shy',
        responseDialogue: [
          { speaker: '灵巫', text: '好。心意不是一次写完的符咒，而是长久的共同练习。' },
          { text: '她把空白灯面朝向你，与你一起放入第一簇归灯火。' },
        ],
      },
    ],
  },
  {
    id: 'aff_shaman_07_gift',
    classId: 'shaman',
    episode: 7,
    title: '空白也可以被珍惜',
    episodeLabel: '第七幕 · 无字礼纸',
    unlockPoints: 1_700,
    requiredStoryIds: ['aff_shaman_06_firstsnow'],
    completionPoints: 60,
    backgroundAsset: 'assets/affection/scenes/shaman-blank-gift-paper-morning.webp',
    memoryCallbacks: [
      ...rememberedChoices('aff_shaman_03_wish', '灵巫', [
        ['wish_for_her', '你曾让我先写自己的愿望，所以这本空白纸册没有替我决定内容。'],
        ['guard_each_other', '守护是一个圆；礼物也该让赠与和接受都保留选择。'],
        ['share_tomorrow', '那张愿纸的一半仍被好好保管，新的纸页便从空白开始吧。'],
      ]),
    ],
    openingDialogue: [
      { text: '清晨纸作间里，一册无字愿纸放在两盏小灯之间，旁边只有可以随时取下的花夹。' },
      { speaker: '灵巫', text: '很多人送愿纸时，已经替收礼的人写好了应该许下什么。' },
      { speaker: '灵巫', text: '而这一本什么都没有。它让我觉得，沉默也被当成了完整的答案。' },
    ],
    choices: [
      {
        id: 'blank_is_complete',
        label: '“不写也可以。空白本身就是你拥有的选择。”',
        mood: 'moved',
        responseDialogue: [
          { speaker: '灵巫', text: '谢谢你没有把安静当作等待填补的缺口。' },
          { text: '她轻轻翻过第一页，没有落笔，却把纸册珍重地留在身边。' },
        ],
      },
      {
        id: 'removable_flower',
        label: '“花夹可以取下；装饰也不该替你固定愿望。”',
        mood: 'bright',
        responseDialogue: [
          { speaker: '灵巫', text: '可以留下，也可以改变。这样的花，比永不凋谢更温柔。' },
          { text: '她将花夹换到另一页，也把选择位置的权利稳稳留在自己手中。' },
        ],
      },
      {
        id: 'ask_where_to_keep',
        label: '“它放在哪里由你决定；我不会用礼物换取查看的权利。”',
        mood: 'shy',
        responseDialogue: [
          { speaker: '灵巫', text: '被赠予，并不等于被要求公开。你总能听见没有说出口的边界。' },
          { text: '她把纸册收进自己的抽屉，只将一枚无字书签留在茶席上。' },
        ],
      },
    ],
  },
  {
    id: 'aff_shaman_08_rest',
    classId: 'shaman',
    episode: 8,
    title: '今晚由你先被照顾',
    episodeLabel: '第八幕 · 月茶歇灯',
    unlockPoints: 2_100,
    requiredStoryIds: ['aff_shaman_07_gift'],
    completionPoints: 60,
    backgroundAsset: 'assets/affection/scenes/shaman-moontea-rest-evening.webp',
    memoryCallbacks: [
      ...rememberedChoices('aff_shaman_05_storm', '灵巫', [
        ['carry_lantern_together', '暴雨里我们共同举灯；今晚也共同决定什么时候把灯熄下。'],
        ['rest_under_eaves', '你提醒我暂停不会让道路消失，所以这次我愿意先坐下。'],
        ['take_guard_turn', '那晚守护回到我身边；今晚我想让照顾也真正轮换。'],
      ]),
    ],
    openingDialogue: [
      { text: '月色落在有顶茶廊，一盏值夜灯已经熄下，两杯月白茶在相邻坐垫前冒着热气。' },
      { speaker: '灵巫', text: '我总会先问别人需要什么，却很少练习回答自己的需要。' },
      { speaker: '灵巫', text: '今晚我想先休息。若你愿意，可以陪我把这件小事认真做完。' },
    ],
    choices: [
      {
        id: 'brew_side_by_side',
        label: '“茶由我们一起泡；照顾不必由一个人包办。”',
        mood: 'bright',
        responseDialogue: [
          { speaker: '灵巫', text: '不是替我完成，而是与我一起完成。这样很好。' },
          { text: '她分出茶叶，你添上热水，两杯茶在同一阵香气里慢慢安静。' },
        ],
      },
      {
        id: 'quiet_counts',
        label: '“不想说话也可以。安静陪伴同样算完整的回应。”',
        mood: 'moved',
        responseDialogue: [
          { speaker: '灵巫', text: '那今晚，我把沉默和疲倦都放心交给这张茶席。' },
          { text: '她靠回自己的坐垫，月灯没有催促任何一句话出现。' },
        ],
      },
      {
        id: 'care_in_turns',
        label: '“今晚我提醒你休息；下次累的人也可以是我。”',
        mood: 'shy',
        responseDialogue: [
          { speaker: '灵巫', text: '照顾若能轮流，就不会把任何人永远固定成守护者。' },
          { text: '她认真答应，也替你把第二杯茶推到最顺手的位置。' },
        ],
      },
    ],
  },
  {
    id: 'aff_shaman_09_reciprocal',
    classId: 'shaman',
    episode: 9,
    title: '想送给你的，是归处',
    episodeLabel: '第九幕 · 松结回礼',
    unlockPoints: 2_600,
    requiredStoryIds: ['aff_shaman_08_rest'],
    completionPoints: 60,
    backgroundAsset: 'assets/affection/scenes/shaman-return-charm-night.webp',
    cgAsset: 'assets/affection/cg/shaman-open-knot-keepsakes.webp',
    memoryCallbacks: [
      ...rememberedChoices('aff_shaman_06_firstsnow', '灵巫', [
        ['write_each_names', '两盏灯各有自己的名字，这两枚护符也各自完整。'],
        ['write_open_door', '门可以欢迎归来，也允许脚步继续向前；护符不会变成束缚。'],
        ['leave_space', '你为未来留下空白，所以我特意没有把这枚松结系死。'],
      ]),
    ],
    openingDialogue: [
      { text: '月夜归灯亭里，两枚无字护符由一条可以随时解开的松结相连，远处小径通向敞开的门。' },
      { speaker: '灵巫', text: '我想送你一件回礼。它不召回、不追踪，也不会替你决定方向。' },
      { speaker: '灵巫', text: '它只在你想起归处时亮起；是否佩带，始终由你决定。' },
    ],
    choices: [
      {
        id: 'use_when_wanted',
        label: '“我愿意收下；需要时佩带，不需要时也会妥善珍藏。”',
        mood: 'moved',
        responseDialogue: [
          { speaker: '灵巫', text: '被珍惜不等于必须时刻使用。谢谢你也尊重礼物的休息。' },
          { text: '两枚护符各自亮起，又在不被触碰时安静归于柔光。' },
        ],
      },
      {
        id: 'hang_side_by_side',
        label: '“让它们并排挂在归灯亭，各自照亮来去的方向。”',
        mood: 'bright',
        responseDialogue: [
          { speaker: '灵巫', text: '不把谁带回谁身边，只让彼此知道门仍然开着。' },
          { text: '两枚护符被分别挂好，灯光在中间形成温柔而开放的通路。' },
        ],
      },
      {
        id: 'keep_knot_open',
        label: '“保留这个松结；关系长久，也仍能重新确认与调整。”',
        mood: 'shy',
        responseDialogue: [
          { speaker: '灵巫', text: '愿望不是系得越紧越真。能被重新选择，才会一直有温度。' },
          { text: '她没有收紧丝绳，只与你共同确认两端都能自由解开。' },
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
  {
    id: 'aff_catkin_04_expansion',
    classId: 'catkin',
    episode: 4,
    title: '两把平等的钥匙',
    episodeLabel: '第四幕 · 据点扩建',
    unlockPoints: 520,
    requiredStoryIds: ['aff_catkin_03_rooftop'],
    completionPoints: 60,
    backgroundAsset: 'assets/affection/scenes/catkin-base-expansion-day.webp',
    memoryCallbacks: [
      ...rememberedChoices('aff_catkin_01_box', '喵喵', [
        ['knock_first', '你第一次进据点会认真敲门，所以新区域也可以放心给你平等钥匙。'],
        ['warm_milk', '那杯莓奶换到的半个位置，早就扩建成副队长专席了。'],
        ['reinforce_box', '你尊重我的据点规划，所以扩建规则也要听听你的专业意见。'],
      ]),
      ...rememberedChoices('aff_catkin_03_rooftop', '喵喵', [
        ['wait_invite', '屋顶上你等我发出邀请，所以新据点的钥匙也由我正式交给你。'],
        ['share_candy', '战利品糖能公平分，新据点的权限当然也能一人一半。'],
        ['came_for_her', '你说那晚是来找我的……所以我想给你一把随时能来找我的钥匙。'],
      ]),
    ],
    openingDialogue: [
      { text: '白天的据点扩建刚结束，两把造型相同的钥匙并排放在新门前。' },
      { speaker: '喵喵', text: '不是备用钥匙，也不是谁替谁保管。两把权限完全一样。' },
      { speaker: '喵喵', text: '新区域的第一条使用规则，我们一起定。' },
    ],
    choices: [
      {
        id: 'equal_door_rights',
        label: '“谁先回来谁开门，不需要向另一位申请。”',
        mood: 'moved',
        responseDialogue: [
          { speaker: '喵喵', text: '通过！平等钥匙就该有平等的开门权。' },
          { text: '她把其中一把推给你，自己拿起另一把同时试锁。' },
        ],
      },
      {
        id: 'respect_work_zones',
        label: '“各自的工作区先敲门，共享区随时欢迎。”',
        mood: 'shy',
        responseDialogue: [
          { speaker: '喵喵', text: '边界明确，集合方便。副队长提案非常专业！' },
          { text: '她在平面图上圈出两个独立角落，也画出宽敞的共同桌面。' },
        ],
      },
      {
        id: 'renegotiate_rules',
        label: '“若规则不合适，任何一方都能提出重谈。”',
        mood: 'bright',
        responseDialogue: [
          { speaker: '喵喵', text: '批准。搭档协议当然要能升级，不能把谁困住。' },
          { text: '她将两把钥匙再次并排放好，认真与你确认这项规则。' },
        ],
      },
    ],
  },
  {
    id: 'aff_catkin_05_rainwatch',
    classId: 'catkin',
    episode: 5,
    title: '队长也可以说累',
    episodeLabel: '第五幕 · 雨夜轮值',
    unlockPoints: 900,
    requiredStoryIds: ['aff_catkin_04_expansion'],
    completionPoints: 60,
    backgroundAsset: 'assets/affection/scenes/catkin-rainy-workshop-night.webp',
    memoryCallbacks: [
      ...rememberedChoices('aff_catkin_02_glove', '喵喵', [
        ['ask_buckle', '你会先问过才碰装备，所以雨夜里我也能放心请你确认工具安全。'],
        ['hold_light', '你替我照过灯却把修理权留给我，这才是优秀搭档的配合。'],
        ['glove_highfive', '搭档集合暗号仍然有效，开工和收工都要击掌确认！'],
      ]),
      ...rememberedChoices('aff_catkin_04_expansion', '喵喵', [
        ['equal_door_rights', '两把钥匙权限相同，所以累的时候也有同样的休息权。'],
        ['respect_work_zones', '你替独立工作区保留边界，所以我可以放心说现在想安静一会儿。'],
        ['renegotiate_rules', '规则可以重谈——那我现在正式提出：今晚暂停队长值班。'],
      ]),
    ],
    openingDialogue: [
      { text: '雨夜的工作间里，修理工具已经收好，她却还守着熄暗一半的台灯。' },
      { speaker: '喵喵', text: '队长今天判断失误：明明很累，还安排了额外检修。' },
      { speaker: '喵喵', text: '我不需要命令，只想听搭档提出一个平等的休息方案。' },
    ],
    choices: [
      {
        id: 'two_work_desks',
        label: '“今晚一起收工，剩下的工作明天平分。”',
        mood: 'moved',
        responseDialogue: [
          { speaker: '喵喵', text: '不是替我包办，是把明天也一起分担。批准。' },
          { text: '她关掉剩下的台灯，与你一起确认工具都安全归位。' },
        ],
      },
      {
        id: 'quiet_corner',
        label: '“你可以去安静角落休息，我在共享区处理自己的事。”',
        mood: 'calm',
        responseDialogue: [
          { speaker: '喵喵', text: '不追问、不围观，也不把独处当成生气。优秀搭档。' },
          { text: '她带着自己的钥匙走向安静角落，回头向你比了个安心手势。' },
        ],
      },
      {
        id: 'rain_window_seat',
        label: '“去窗边听雨吧。想聊天就聊，不想说话也可以。”',
        mood: 'shy',
        responseDialogue: [
          { speaker: '喵喵', text: '队长申请一份不需要活跃气氛的陪伴。' },
          { text: '她与你各坐长椅一侧，雨声把工作间变成安静的休息站。' },
        ],
      },
    ],
  },
  {
    id: 'aff_catkin_06_departure',
    classId: 'catkin',
    episode: 6,
    title: '下一次也并肩出发',
    episodeLabel: '第六幕 · 晨光站台',
    unlockPoints: 1_400,
    requiredStoryIds: ['aff_catkin_05_rainwatch'],
    completionPoints: 60,
    backgroundAsset: 'assets/affection/scenes/catkin-sunrise-departure-platform.webp',
    cgAsset: 'assets/affection/cg/catkin-partner-badges.webp',
    memoryCallbacks: [
      ...rememberedChoices('aff_catkin_03_rooftop', '喵喵', [
        ['wait_invite', '你从不擅自靠近，而我现在会主动向你发出并肩邀请。'],
        ['share_candy', '连战利品糖都公平分过，我们当然能平等决定更大的事情。'],
        ['came_for_her', '你来找的是我；而我每次集合第一个想找的也是你。'],
      ]),
      ...rememberedChoices('aff_catkin_04_expansion', '喵喵', [
        ['equal_door_rights', '两把钥匙权限平等，两枚启程徽章当然也属于平等搭档。'],
        ['respect_work_zones', '独立工作区的边界一直有效，远行也不需要放弃自己的方向。'],
        ['renegotiate_rules', '规则随时可以重谈，所以每一次出发都由现在的我们重新确认。'],
      ]),
      ...rememberedChoices('aff_catkin_05_rainwatch', '喵喵', [
        ['two_work_desks', '雨夜我们共同收工，今天也要一起决定出发，而不是谁催促谁。'],
        ['quiet_corner', '你尊重我独处休息，所以远行时我们也能保留各自的节奏。'],
        ['rain_window_seat', '那场雨里我们可以安静同坐，这次也可以安静并肩等车。'],
      ]),
    ],
    openingDialogue: [
      { text: '晨光铺上启程站台，两枚搭档徽章放在并排的行囊之间，远处列车即将到站。' },
      { speaker: '喵喵', text: '这次不是队长带副队长出发，是两位搭档共同选择下一站。' },
      { speaker: '喵喵', text: '无论答案是哪条路线，我们都保留说累、暂停和改道的权利。' },
    ],
    choices: [
      {
        id: 'renew_by_choice',
        label: '“每次出发都重新确认愿意同行，不把陪伴当成理所当然。”',
        mood: 'moved',
        responseDialogue: [
          { speaker: '喵喵', text: '通过！下一次、下下次，也都要听见彼此亲口说愿意。' },
          { text: '她拿起自己的徽章，与你同时别在各自行囊上。' },
        ],
      },
      {
        id: 'equal_captains',
        label: '“路线一人提案、一起确认，任何时候都能改道。”',
        mood: 'bright',
        responseDialogue: [
          { speaker: '喵喵', text: '并列领航员制度成立！第一站由我提案，你负责审核。' },
          { text: '她将路线图放在两人中间，没有替你圈定任何终点。' },
        ],
      },
      {
        id: 'keep_own_dreams',
        label: '“并肩出发，也允许各自探索，想会合时就用集合暗号。”',
        mood: 'shy',
        responseDialogue: [
          { speaker: '喵喵', text: '这才是最厉害的搭档：各自看世界，也总能认出集合信号。' },
          { text: '她与你碰了碰徽章，清脆声响与进站铃一同响起。' },
        ],
      },
    ],
  },
  {
    id: 'aff_catkin_07_gift',
    classId: 'catkin',
    episode: 7,
    title: '礼物要先过搭档验收',
    episodeLabel: '第七幕 · 远征收纳匣',
    unlockPoints: 1_700,
    requiredStoryIds: ['aff_catkin_06_departure'],
    completionPoints: 60,
    backgroundAsset: 'assets/affection/scenes/catkin-gift-inspection-workshop.webp',
    memoryCallbacks: [
      ...rememberedChoices('aff_catkin_04_expansion', '喵喵', [
        ['equal_door_rights', '两把钥匙权限平等，所以礼物验收当然也不是单方面突袭。'],
        ['respect_work_zones', '你一直尊重独立工作区，这只收纳匣也不会擅自合并私人空间。'],
        ['renegotiate_rules', '据点规则可以重谈，礼物的用途和权限当然也随时能改。'],
      ]),
    ],
    openingDialogue: [
      { text: '白昼工坊里，一只珊瑚粉与湖蓝模块化远征匣停在检测台上，所有标签牌都保持空白。' },
      { speaker: '喵喵', text: '防水、可拆、抗冲击。外观分先拿高分，权限设计还需要搭档验收。' },
      { speaker: '喵喵', text: '先说明：收到礼物的人拥有最终分类权，也有不共享内容的权利。' },
    ],
    choices: [
      {
        id: 'owner_sets_labels',
        label: '“标签由你填写；送礼的人不替你定义里面该放什么。”',
        mood: 'moved',
        responseDialogue: [
          { speaker: '喵喵', text: '准确！空白标签不是漏做，是最高级的权限设计。' },
          { text: '她把标签片逐一收好，只在自己选中的位置装上一枚蓝色识别扣。' },
        ],
      },
      {
        id: 'inspection_invite',
        label: '“拆解检查由你主持；需要协助时再向我发出搭档邀请。”',
        mood: 'bright',
        responseDialogue: [
          { speaker: '喵喵', text: '不抢工具、不突然接管。副队长专业等级提升。' },
          { text: '她打开检测灯，主动把其中一项耐压测试分配给你。' },
        ],
      },
      {
        id: 'privacy_compartments',
        label: '“共享工具格与私人收纳格分开，谁都不默认拥有查看权。”',
        mood: 'shy',
        responseDialogue: [
          { speaker: '喵喵', text: '搭档可以共享任务，不代表要上交全部私人物资。批准。' },
          { text: '她装好两种不同锁扣，又把共享格的双控开关放在正中央。' },
        ],
      },
    ],
  },
  {
    id: 'aff_catkin_08_sentimental',
    classId: 'catkin',
    episode: 8,
    title: '喜欢不是物资编号',
    episodeLabel: '第八幕 · 私藏展示格',
    unlockPoints: 2_100,
    requiredStoryIds: ['aff_catkin_07_gift'],
    completionPoints: 60,
    backgroundAsset: 'assets/affection/scenes/catkin-sentimental-shelf-rain.webp',
    memoryCallbacks: [
      ...rememberedChoices('aff_catkin_05_rainwatch', '喵喵', [
        ['two_work_desks', '雨夜我们共同收工，所以今天这次展示也不算额外值班。'],
        ['quiet_corner', '你尊重我的独处角落，私藏展示格也可以只打开我想分享的部分。'],
        ['rain_window_seat', '那场雨里我们安静同坐；现在我也能安静告诉你某些物品为什么重要。'],
      ]),
    ],
    openingDialogue: [
      { text: '雨夜工坊的一面收纳墙打开小半，旧票片、空白徽章与被修补过的纸箱角整齐放在独立格中。' },
      { speaker: '喵喵', text: '它们没有战斗数值，也不属于任务必需品。按物资标准，应该早就清理。' },
      { speaker: '喵喵', text: '可我喜欢。今天只展示我主动打开的这些，其他格仍然保密。' },
    ],
    choices: [
      {
        id: 'ask_before_view',
        label: '“我只看你主动打开的格子；想关上时不用解释。”',
        mood: 'moved',
        responseDialogue: [
          { speaker: '喵喵', text: '收到。参观权限按实时意愿生效，不自动续期。' },
          { text: '她放松地打开第二个小格，又保留其余遮板原样不动。' },
        ],
      },
      {
        id: 'no_inventory_report',
        label: '“喜欢不需要提交用途报告，也不必证明值得保留。”',
        mood: 'shy',
        responseDialogue: [
          { speaker: '喵喵', text: '副队长批准一批“没有用途但就是舍不得”的最高级物资。' },
          { text: '她把旧徽章摆得更正了一点，语气得意，动作却格外轻。' },
        ],
      },
      {
        id: 'shared_memory_slot',
        label: '“若你愿意，我们可以留一个共同纪念格；各自私藏仍归各自。”',
        mood: 'bright',
        responseDialogue: [
          { speaker: '喵喵', text: '中央共享格成立，但新增物品必须双人确认。' },
          { text: '她打开最中间的空格，与你约定第一件纪念物以后共同选择。' },
        ],
      },
    ],
  },
  {
    id: 'aff_catkin_09_reciprocal',
    classId: 'catkin',
    episode: 9,
    title: '下一站也有你的收纳格',
    episodeLabel: '第九幕 · 双格远征柜',
    unlockPoints: 2_600,
    requiredStoryIds: ['aff_catkin_08_sentimental'],
    completionPoints: 60,
    backgroundAsset: 'assets/affection/scenes/catkin-shared-expedition-locker-sunrise.webp',
    cgAsset: 'assets/affection/cg/catkin-two-way-supply-tags.webp',
    memoryCallbacks: [
      ...rememberedChoices('aff_catkin_06_departure', '喵喵', [
        ['renew_by_choice', '每次出发都重新确认同行，所以远征柜权限也不会默认永久续订。'],
        ['equal_captains', '并列领航员各有个人收纳格，中央共享格则一起审核。'],
        ['keep_own_dreams', '我们允许各自探索；两枚标签只负责帮助我们重新会合。'],
      ]),
    ],
    openingDialogue: [
      { text: '朝阳照进远征整备室，两只独立储物格分列左右，中央是一只需要双控开启的共享格。' },
      { speaker: '喵喵', text: '这是我准备的回礼：一枚属于你的远征标签，以及一格不会被我擅自整理的空间。' },
      { speaker: '喵喵', text: '别误会，不是把你固定在据点。它只是表示——下一次集合仍然有你的位置。' },
    ],
    choices: [
      {
        id: 'two_plus_shared',
        label: '“保留两个私人格，再留一个由双方确认的共享格。”',
        mood: 'bright',
        responseDialogue: [
          { speaker: '喵喵', text: '完美结构！并肩不等于合并库存，这才叫成熟搭档。' },
          { text: '她分别检查两边锁扣，最后与你同时点亮中央共享格。' },
        ],
      },
      {
        id: 'renew_access',
        label: '“每次远征前重新确认权限，任何一方都能调整或收回。”',
        mood: 'moved',
        responseDialogue: [
          { speaker: '喵喵', text: '长期搭档也要尊重今天的答案。权限协议正式通过。' },
          { text: '两枚空白标签各自亮起，没有任何一枚覆盖另一枚的控制信号。' },
        ],
      },
      {
        id: 'signal_for_meeting',
        label: '“各自探索也没关系；想会合时，用这枚标签发集合信号。”',
        mood: 'shy',
        responseDialogue: [
          { speaker: '喵喵', text: '那我大概会经常测试信号……只是为了确认设备稳定。' },
          { text: '她让两枚标签轻轻相触，珊瑚与湖蓝光点同时跳亮。' },
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
    stories: [...SWORDSMAN_STORIES, ...affectionDateStories('swordsman')],
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
    stories: [...WITCH_STORIES, ...affectionDateStories('witch')],
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
    stories: [...SHAMAN_STORIES, ...affectionDateStories('shaman')],
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
    stories: [...CATKIN_STORIES, ...affectionDateStories('catkin')],
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
