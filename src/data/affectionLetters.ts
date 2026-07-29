import type { ClassId } from '@/core/types';
import { AFFECTION_CHARACTERS } from './affection';

export interface AffectionLetterVariant {
  choiceId: string;
  paragraphs: readonly [string, string];
}

export interface AffectionLetterDefinition {
  id: string;
  classId: ClassId;
  sourceEpisode: number;
  requiredStoryId: string;
  title: string;
  preface: string;
  salutation: string;
  signature: string;
  variants: readonly [AffectionLetterVariant, AffectionLetterVariant, AffectionLetterVariant];
}

type VariantSeed = readonly [choiceId: string, firstParagraph: string, secondParagraph: string];

function letter(
  classId: ClassId,
  sourceEpisode: number,
  title: string,
  preface: string,
  salutation: string,
  signature: string,
  variants: readonly [VariantSeed, VariantSeed, VariantSeed],
): AffectionLetterDefinition {
  const story = AFFECTION_CHARACTERS[classId].stories.find(
    (entry) => entry.episode === sourceEpisode,
  );
  if (!story) {
    throw new Error(`[好感来信] ${classId} 不存在第 ${sourceEpisode} 幕`);
  }
  const storyChoiceIds = new Set(story.choices.map((choice) => choice.id));
  for (const [choiceId] of variants) {
    if (!storyChoiceIds.has(choiceId)) {
      throw new Error(`[好感来信] ${story.id} 不存在选项 ${choiceId}`);
    }
  }
  return {
    id: `letter_${classId}_${String(sourceEpisode).padStart(2, '0')}`,
    classId,
    sourceEpisode,
    requiredStoryId: story.id,
    title,
    preface,
    salutation,
    signature,
    variants: [
      {
        choiceId: variants[0][0],
        paragraphs: [variants[0][1], variants[0][2]],
      },
      {
        choiceId: variants[1][0],
        paragraphs: [variants[1][1], variants[1][2]],
      },
      {
        choiceId: variants[2][0],
        paragraphs: [variants[2][1], variants[2][2]],
      },
    ],
  };
}

const SWORDSMAN_LETTERS: readonly AffectionLetterDefinition[] = [
  letter(
    'swordsman',
    3,
    '胜利之后，我记住的事',
    '信纸边缘压着那天的红色剑穗。',
    '给总能看见我的你：',
    '——今天也与你并肩的剑姬',
    [
      [
        'her_smile',
        '你说，胜利里最先注意到的是我的笑。回去以后我对着镜子练了很久，却怎么也复现不了。',
        '后来我明白了。那不是因为赢了，而是因为抬眼时看见了你。下一次，我也想先看见你的笑。',
      ],
      [
        'looking_for_me',
        '你承认一直在找我。那句话让我在喧闹的人群里，忽然清楚听见自己的心跳。',
        '以后不用费力寻找。战斗结束时，我会站在约好的地方，也会主动朝你走去。',
      ],
      [
        'remember_her',
        '你把那场胜利说成“我们会一起记住的事”。我很喜欢“我们”这两个字。',
        '剑痕会褪色，欢呼也会散去。但只要我们还愿意讲给彼此听，那一天就不会离开。',
      ],
    ],
  ),
  letter(
    'swordsman',
    6,
    '归途地图的背面',
    '地图背面多了两行工整的小字。',
    '给愿意和我谈以后的人：',
    '——把归途画成双线的剑姬',
    [
      [
        'choose_each_day',
        '你说，不用一次决定永远，只要每天都重新选择。我起初觉得这不够像誓言。',
        '现在却觉得，它比一句永不改变更勇敢。明天醒来，我还会认真地再选你一次。',
      ],
      [
        'share_future_map',
        '我们在地图上各画了一半未来。你的线没有盖住我的，我的也没有替你决定终点。',
        '两条路相遇、分开，又在远处汇合。这样的以后，我愿意走得很久很久。',
      ],
      [
        'stand_as_equals',
        '你说要站在我身边，不在前面替我挡完一切，也不在后面等我回头。',
        '我把这句话系进了新的剑穗。每次拔剑，它都会提醒我：我们是相等的守望者。',
      ],
    ],
  ),
  letter(
    'swordsman',
    9,
    '礼物不是一场结算',
    '信封里没有回礼，只有一片保存得很好的花瓣。',
    '给教会我安心收下的人：',
    '——不再计算亏欠的剑姬',
    [
      [
        'receive_without_balance',
        '那天你让我先收下，不必马上寻找等价的东西。我其实紧张得握紧了手指。',
        '现在我会把喜欢坦然说出来：我很珍惜那份礼物，也很珍惜送礼物时看着我的你。',
      ],
      [
        'tell_each_reason',
        '我们轮流讲为什么选中那份礼物。原来一件东西最珍贵的部分，是对方挑选它时想过什么。',
        '以后我仍会告诉你理由。不是解释价值，而是邀请你走进我的心意。',
      ],
      [
        'leave_future_ribbon',
        '你把最后一段丝带留给未来。它现在仍在我的抽屉里，没有被任何礼盒用掉。',
        '等某一天我们都觉得“就是今天”，再一起剪开它。未来不急，我会和你慢慢等。',
      ],
    ],
  ),
  letter(
    'swordsman',
    12,
    '桥上的两枚流苏',
    '纸上落着一小片桥边晚樱。',
    '给与我走过整座桥的人：',
    '——在下一次晨光里等你的剑姬',
    [
      [
        'walk_on_outside',
        '你走在靠外的一侧，却先问我是否介意。我喜欢的不是被安排保护，而是你把选择留给我。',
        '下次换我走外侧。我们可以轮流照顾，也可以并肩挤在桥中央看河光。',
      ],
      [
        'tie_two_tassels',
        '两枚流苏系在一起时，我听见风里有很轻的铃声。它们各自完整，却会在相碰时发出新声音。',
        '我想，我们也是这样。靠近不是失去自己，而是多了一种只有彼此能听见的回响。',
      ],
      [
        'promise_next_morning',
        '你没有许下遥远到看不清的保证，只约我看下一次晨光。我因此格外安心。',
        '等明天到了，我们就再约一个明天。愿很多年以后，仍有这样的下一次。',
      ],
    ],
  ),
];

const WITCH_LETTERS: readonly AffectionLetterDefinition[] = [
  letter(
    'witch',
    3,
    '坐标旁的补充公式',
    '信纸上画着一枚从两端同时亮起的晶体。',
    '给我的共同观测者：',
    '——正在修正心跳参数的魔女',
    [
      [
        'wait_home',
        '你说会等我回家。那一刻，“家”第一次从地点变成了一个正在等待的人。',
        '下次我不会让传送阵把你晾得太久。若实验延迟，我会先发一颗会报平安的小星星。',
      ],
      [
        'no_hiding',
        '你说不用藏起失败的数据，也不用把狼狈修正得漂亮。我重新看了那页全是涂改的记录。',
        '它现在被我放在最前面。因为你看见了不完美的我，却没有降低任何一分期待。',
      ],
      [
        'every_secret',
        '你说秘密可以慢慢分享，不必一次交出全部答案。谢谢你没有把亲近当成审问。',
        '我会一页页打开自己的笔记。速度由我决定，而你一直有权说今天先读到这里。',
      ],
    ],
  ),
  letter(
    'witch',
    6,
    '两颗归航星的观测报告',
    '报告没有编号，标题却被描了两遍。',
    '给与我共同画星座的人：',
    '——把空白页留在中间的魔女',
    [
      [
        'two_home_stars',
        '你画了两颗都能指向归途的星，而不是一颗围着另一颗旋转。',
        '我把它设成所有远行实验的校准图。看见它，就知道我们都可以自由出发，也能彼此找到。',
      ],
      [
        'open_route',
        '你坚持在星图边缘留一条开放路线。未知没有让你害怕，反而让未来显得宽阔。',
        '我愿意和你一起探索，也愿意在任何时刻重新规划。我们的方向永远可以讨论。',
      ],
      [
        'shared_blank',
        '那一格共同保留的空白，我至今没有偷偷填上。偶尔我会去看它，然后期待你的新想法。',
        '谢谢你提醒我，最好的计划不是写满每一步，而是始终有地方容纳两个人的变化。',
      ],
    ],
  ),
  letter(
    'witch',
    9,
    '双色星墨的干燥记录',
    '两种颜色在信纸中央相遇，却仍能看见各自的纹理。',
    '给不会替我选颜色的你：',
    '——偏爱共同实验的魔女',
    [
      [
        'two_independent_colors',
        '你保留了两种独立颜色。我原以为混成一种才叫亲密，实验结果却证明我错了。',
        '原来最漂亮的图案，是我们都不必褪色，却愿意在边缘一次次相遇。',
      ],
      [
        'rewrite_coordinates',
        '我们把旧坐标一起擦掉重写。没有人坚持“原本就该如此”，所以新路线比旧的更准确。',
        '以后若哪里不再舒服，也请和我重算。改变不是失败，是我们仍然认真对待彼此。',
      ],
      [
        'opt_in_experiment',
        '你先问我是否愿意继续实验，而不是默认我的好奇心等于同意。那个停顿让我很心动。',
        '我愿意。不是因为实验本身，而是因为和一个尊重答案的人一起，未知也会变得安全。',
      ],
    ],
  ),
  letter(
    'witch',
    12,
    '流星日志的最后一页',
    '最后一页之后，又被她亲手装订了许多空白纸。',
    '给与我看完流星雨的人：',
    '——准备继续写下一册的魔女',
    [
      [
        'wish_for_her',
        '你把愿望留给了我。我没有追问内容，因为被认真放在愿望里，本身就已足够。',
        '我的愿望也与你有关：希望你一直拥有选择自己的自由，也愿意偶尔选择靠近我。',
      ],
      [
        'record_for_journal',
        '我们一颗颗记录流星，最后发现写得最多的却是当时说过的话。',
        '数据并不完美，但我决定永久保存。因为那晚真正稀有的现象，是我们共同度过的时间。',
      ],
      [
        'admit_cold_together',
        '你承认冷，我也终于不再假装保温咒万无一失。我们挤在同一条毯子里笑了很久。',
        '谢谢你让脆弱变成可以分享的小事。下次我会多带一条，也会继续诚实地靠近你。',
      ],
    ],
  ),
];

const SHAMAN_LETTERS: readonly AffectionLetterDefinition[] = [
  letter(
    'shaman',
    3,
    '愿望被分成两半以后',
    '信纸有淡淡的萤火香，折痕平整而郑重。',
    '给愿意与我共享愿望的人：',
    '——在灯下想起你的巫女',
    [
      [
        'wish_for_her',
        '你把愿望留给我，却没有替我决定该许什么。那份温柔没有重量，却被我记了很久。',
        '我最终许愿：希望我们都能成为自己想成为的人，并且还有许多机会互相看见。',
      ],
      [
        'guard_each_other',
        '你说要互相守护。不是把我藏在身后，而是在我伸手时也愿意把自己的疲惫交给我。',
        '从今以后，灯笼可以轮流提，夜路也可以轮流说“今天让我依靠一下”。',
      ],
      [
        'share_tomorrow',
        '你没有许诺遥远的永恒，只邀请我共享明天。我喜欢这份真实。',
        '明天到来后，我们可以再谈下一个明天。愿每一次靠近，都仍是清醒而自由的选择。',
      ],
    ],
  ),
  letter(
    'shaman',
    6,
    '初雪护符的背面',
    '护符背面添了一根可随时解开的细绳。',
    '给在雪地里与我并肩写字的人：',
    '——为两个人留着灯的巫女',
    [
      [
        'write_each_names',
        '雪地里两个名字并排，却各自清晰。我一直舍不得踩乱那一小块雪。',
        '后来雪融了，我也没有难过。名字不必永远留在地上，只要我们还愿意互相呼唤。',
      ],
      [
        'write_open_door',
        '你写下“一扇开着的门”。我喜欢它既是邀请，也不是束缚。',
        '门会一直亮着灯，但你可以选择什么时候来、停多久。被尊重的靠近，才会让人真正安心。',
      ],
      [
        'leave_space',
        '我们特意在护符上留了空白。起初它看起来像没做完，现在却是我最喜欢的地方。',
        '那里装得下改变、迟疑和以后才想到的话。我们不必急着成为一个固定答案。',
      ],
    ],
  ),
  letter(
    'shaman',
    9,
    '解得开的结',
    '信封用活结系着，轻轻一拉就能打开。',
    '给珍惜心意、也珍惜边界的你：',
    '——愿意把结重新系好的巫女',
    [
      [
        'use_when_wanted',
        '你说护符只在我想用时才佩戴。那句话让礼物不再像必须履行的约定。',
        '我今天主动戴上了它。不是因为应该，而是因为想让你的心意陪我走这一段路。',
      ],
      [
        'hang_side_by_side',
        '两枚纪念物并排挂着，没有谁更高。我经过时常会听见它们轻轻相碰。',
        '那声音像在说：我们各有来处，也愿意把此刻放在一起珍藏。',
      ],
      [
        'keep_knot_open',
        '你留下一个随时能解开的结。我后来才懂，能离开的关系反而让留下变得更真诚。',
        '今天我重新系好了它。每一次系上，都代表我仍然愿意，而不是从此失去选择。',
      ],
    ],
  ),
  letter(
    'shaman',
    12,
    '雨停以前的两只茶杯',
    '信角留着一圈很淡的茶渍，像两个相交的圆。',
    '给陪我把雨听完的人：',
    '——为下场雨备好茶叶的巫女',
    [
      [
        'pour_for_each_other',
        '我们轮流为对方添茶，谁也没有忙到忘记自己的杯子。',
        '我很喜欢这样的照顾：不是一个人永远付出，而是两个人都能给予，也都安心接受。',
      ],
      [
        'listen_to_rain_together',
        '那天我们什么大事也没谈，只把每一种雨声听到最后。',
        '原来心动不一定要发生在盛大的时刻。有你在，普通的下午也会被记得很久。',
      ],
      [
        'leave_cups_unwashed',
        '你提议先不洗杯子，让那段时间多停一会儿。我竟真的答应了。',
        '后来我还是洗净了它们，因为我知道不必抓住旧茶渍——我们还会一起倒很多次新茶。',
      ],
    ],
  ),
];

const CATKIN_LETTERS: readonly AffectionLetterDefinition[] = [
  letter(
    'catkin',
    3,
    '屋顶会谈纪要（私人版）',
    '纪要右上角盖着一枚歪歪的爪印章。',
    '致优秀搭档：',
    '——与你共享屋顶席位的喵喵',
    [
      [
        'wait_invite',
        '你在边界外等我发出邀请，没有把沉默理解成默认同意。这个细节通过了最高等级评估。',
        '因此我决定：以后屋顶右侧席位为你长期保留。仍需敲门，但我会很快回应。',
      ],
      [
        'share_candy',
        '那颗糖被我们分成两半，味道没有因此变淡。相反，我记得比独自吃掉任何一颗都清楚。',
        '下次由我准备两种口味。不是平均分配，是让我们都能挑真正喜欢的。',
      ],
      [
        'came_for_her',
        '你说来屋顶不是为了风景，是为了见我。我的尾巴当场泄露了不应公开的反应数据。',
        '经过复核，我决定不删除那段记录。因为我也承认：那天等的人，就是你。',
      ],
    ],
  ),
  letter(
    'catkin',
    6,
    '搭档协议的手写附页',
    '附页没有公章，只有两种颜色的签字笔。',
    '致协议共同起草人：',
    '——坚持平等席位的喵喵',
    [
      [
        'renew_by_choice',
        '你提议协议按选择续期，而不是自动绑定。我非常赞成。',
        '所以这是今天的续期通知：我依然想与你做搭档。明天，我也会认真再决定一次。',
      ],
      [
        'equal_captains',
        '两张船长证已经贴好，没有副职，也没有谁拥有最终解释权。',
        '方向由我们讨论，分歧也不算叛变。能和你平等争论，让出发本身变得可靠。',
      ],
      [
        'keep_own_dreams',
        '你说我们要保留各自的梦想。我把这条写成了协议中最重要的一款。',
        '我会为自己的目标努力，也会为你的目标鼓掌。并肩不是缩小彼此的世界。',
      ],
    ],
  ),
  letter(
    'catkin',
    9,
    '双向物资标签说明书',
    '说明书背面画着两个互相挥手的小人。',
    '致共同珍藏柜管理员：',
    '——保留私人抽屉的喵喵',
    [
      [
        'two_plus_shared',
        '你选择了“你的、我的、共享的”三个区域。分类清楚后，共享反而不再让人紧张。',
        '我把第一张共同票根放进去了。你可以随时查看，也可以添加自己的那一张。',
      ],
      [
        'renew_access',
        '访问权限不是永久默认，而是可以重新确认。这使每一次“欢迎进入”都有真正的意义。',
        '本日权限状态：开放。附加说明：我很期待你来，但你也可以选择改天。',
      ],
      [
        'signal_for_meeting',
        '我们约定了会面信号。它不是召唤命令，只是一句“如果方便，我想见你”。',
        '今天我先发出信号。你若也愿意，就来工作台边，我准备了两杯咖啡。',
      ],
    ],
  ),
  letter(
    'catkin',
    12,
    '没有用于告别的车票',
    '两张小车票被分别装好，又一起放进同一只透明袋。',
    '致下一站同行者：',
    '——已经整理好轻便行囊的喵喵',
    [
      [
        'keep_two_tickets',
        '你坚持保留两张车票，而不是把一张当纪念、一张当送行证明。',
        '非常正确。我们都有自己的座位，也会在同一站下车。透明袋只是暂存，不是终点。',
      ],
      [
        'wave_at_train',
        '我们朝经过的夜车挥手，却没有任何一个人站在月台上被留下。',
        '我喜欢这种告别方式：送走过去的一站，然后转身一起规划下一段。',
      ],
      [
        'promise_no_sendoff',
        '你答应不把“送别”写进我们的固定流程。我把这一条圈了三遍。',
        '若有一天路线暂时分开，也只是各自出发。我们会平等约定再会，而不是谁等待谁归来。',
      ],
    ],
  ),
];

export const AFFECTION_LETTERS: readonly AffectionLetterDefinition[] = [
  ...SWORDSMAN_LETTERS,
  ...WITCH_LETTERS,
  ...SHAMAN_LETTERS,
  ...CATKIN_LETTERS,
];

export function affectionLettersForClass(classId: ClassId): readonly AffectionLetterDefinition[] {
  return AFFECTION_LETTERS.filter((letterEntry) => letterEntry.classId === classId);
}
