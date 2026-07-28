import {
  availableEncounterIds,
  type EncounterCharacterProgress,
  type EncounterDefinition,
  type EncounterTiming,
} from '@/core/encounters';

/** 首次 60 秒便于试玩，之后约每 10 分钟一次。 */
export const ENCOUNTER_TIMING: EncounterTiming = { firstSec: 60, intervalSec: 600, queueMax: 3 };

const DEFINITIONS: EncounterDefinition[] = [
  {
    id: 'enc_r1_petalsmith',
    regionIds: ['r1'],
    unlockChapterId: '1-1',
    title: '花径上的见习刀匠',
    story: '一位见习刀匠蹲在路旁，正为缺少柔韧的包刀材料发愁。',
    speaker: '见习刀匠·茜',
    glyph: '🔨',
    storyArc: {
      characterId: 'char_akane',
      characterName: '见习刀匠·茜',
      episode: 1,
      episodeLabel: '第一幕 · 不合规矩的刀柄',
      requiredEncounterIds: [],
      repeatable: false,
      storyChoices: [
        {
          id: 'lasting_grip',
          label: '“柔软些，反而能握得更久。”',
          responseDialogue: [
            { speaker: '见习刀匠·茜', text: '握得更久……原来你不是只看它够不够威风。' },
            { speaker: '见习刀匠·茜', text: '这句话，我想记在今天的草图旁边。' },
          ],
        },
        {
          id: 'prove_it',
          label: '“先做出来，再让师父评价。”',
          responseDialogue: [
            { speaker: '见习刀匠·茜', text: '对哦，连成品都没有，怎么能先认输呢！' },
            { text: '她把皱巴巴的草图重新铺平，眼睛也亮了起来。' },
          ],
        },
      ],
    },
    dialogue: [
      { text: '花径的拐角传来叮叮当当的声音。' },
      { speaker: '见习刀匠·茜', text: '啊、有人来了！那个……你身上有柔软一点的材料吗？' },
      { speaker: '见习刀匠·茜', text: '我想给新刀做个包柄，可师父说我挑的料子太硬了……' },
    ],
    choices: [
      {
        id: 'trade',
        label: '送她一些材料',
        outcome: '刀匠把一份沉甸甸的谢礼塞到了你手里。',
        costs: { items: { petal_sakura: 3, grass_soft: 2 } },
        rewardPool: [
          {
            weight: 90,
            rewards: { gold: { min: 20, max: 60 }, items: { stone_enhance: { min: 1, max: 3 } } },
          },
          {
            weight: 10,
            rewards: { gold: { min: 60, max: 120 }, items: { stone_reforge: { min: 1, max: 1 } } },
          },
        ],
      },
      { id: 'leave', label: '祝她顺利', outcome: '你们互相挥手，继续各自的旅程。' },
    ],
  },
  {
    id: 'enc_r1_petalsmith_doubt',
    regionIds: ['r1'],
    unlockChapterId: '1-3',
    title: '被退回的试作品',
    story: '茜抱着被师父退回的刀柄，躲在花房后面不肯回工坊。',
    speaker: '见习刀匠·茜',
    glyph: '🔨',
    storyArc: {
      characterId: 'char_akane',
      characterName: '见习刀匠·茜',
      episode: 2,
      episodeLabel: '第二幕 · 师父说不行',
      requiredEncounterIds: ['enc_r1_petalsmith'],
      repeatable: false,
      storyChoices: [
        {
          id: 'ask_herself',
          label: '“先别管师父。你自己喜欢它吗？”',
          responseDialogue: [
            { speaker: '见习刀匠·茜', text: '我……喜欢。握上去的时候，手心会觉得很安心。' },
            { speaker: '见习刀匠·茜', text: '原来这也可以成为继续做下去的理由。' },
          ],
        },
        {
          id: 'not_wrong',
          label: '“被否定，不等于做错了。”',
          responseDialogue: [
            { speaker: '见习刀匠·茜', text: '师父只说它不像传统刀柄，却没说它真的不能用。' },
            { speaker: '见习刀匠·茜', text: '哼哼……我好像找到能反驳他的地方了。' },
          ],
        },
      ],
      memoryCallbacks: [
        {
          fromEncounterId: 'enc_r1_petalsmith',
          choiceId: 'lasting_grip',
          dialogue: [{ speaker: '见习刀匠·茜', text: '你上次说“握得久”更重要……我真的照着改了。' }],
        },
        {
          fromEncounterId: 'enc_r1_petalsmith',
          choiceId: 'prove_it',
          dialogue: [
            { speaker: '见习刀匠·茜', text: '我照你说的先做出了成品，可师父还是把它退回来了。' },
          ],
        },
      ],
    },
    dialogue: [
      { text: '花房后传来压得很低的抽鼻子声，一截粉白刀柄露在花盆旁。' },
      { speaker: '见习刀匠·茜', text: '师父说它不合规矩，叫我全部拆掉重来。' },
      { speaker: '见习刀匠·茜', text: '是不是只有照着旧样子做，才算真正的刀匠？' },
    ],
    choices: [
      {
        id: 'supply',
        label: '补上改造用的材料',
        outcome: '茜把木铃拆成轻巧的尾坠，试作品发出了清亮的第一声。',
        costs: { items: { bell_wood: 3, petal_sakura: 2 } },
        rewardPool: [
          {
            weight: 85,
            rewards: { gold: { min: 90, max: 150 }, items: { stone_enhance: { min: 3, max: 5 } } },
          },
          {
            weight: 15,
            rewards: { gold: { min: 150, max: 220 }, items: { stone_reforge: { min: 1, max: 1 } } },
          },
        ],
      },
      {
        id: 'encourage',
        label: '让她按自己的想法完成',
        outcome: '茜抱紧试作品，决定明早再去敲一次工坊的门。',
      },
    ],
  },
  {
    id: 'enc_r1_petalsmith_first_blade',
    regionIds: ['r1'],
    unlockChapterId: '1-5',
    title: '属于自己的第一把刀',
    story: '结界前，茜正等待一个愿意替她试刀的人。',
    speaker: '见习刀匠·茜',
    glyph: '🗡️',
    storyArc: {
      characterId: 'char_akane',
      characterName: '见习刀匠·茜',
      episode: 3,
      episodeLabel: '第三幕 · 第一把自己的刀',
      requiredEncounterIds: ['enc_r1_petalsmith_doubt'],
      repeatable: false,
      storyChoices: [
        {
          id: 'give_name',
          label: '“先给它起个名字吧。”',
          responseDialogue: [
            { speaker: '见习刀匠·茜', text: '名字？我一直只敢叫它“试作第七号”……' },
            { speaker: '见习刀匠·茜', text: '那就叫“久握”。因为有人教我，能陪伴很久也很了不起。' },
          ],
        },
        {
          id: 'test_blade',
          label: '“让我来试试它的手感。”',
          responseDialogue: [
            { text: '你接过刀。柔软的包柄稳稳贴合掌心，没有一丝滑动。' },
            { speaker: '见习刀匠·茜', text: '你的表情已经告诉我答案了……成功了，对吧？' },
          ],
        },
      ],
      memoryCallbacks: [
        {
          fromEncounterId: 'enc_r1_petalsmith_doubt',
          choiceId: 'ask_herself',
          dialogue: [{ speaker: '见习刀匠·茜', text: '我终于做完了那把“自己也喜欢”的刀。' }],
        },
        {
          fromEncounterId: 'enc_r1_petalsmith_doubt',
          choiceId: 'not_wrong',
          dialogue: [
            { speaker: '见习刀匠·茜', text: '师父没有夸我，但也没再说它是错的。这样就够了。' },
          ],
        },
      ],
    },
    dialogue: [
      { text: '结界的微光落在一把短刀上，粉白包柄已经磨得圆润妥帖。' },
      { speaker: '见习刀匠·茜', text: '这是我没有照任何旧图纸做的第一把刀。' },
      { speaker: '见习刀匠·茜', text: '你愿意当第一个接过它的人吗？' },
    ],
    choices: [
      {
        id: 'finish',
        label: '为刀补上最后的结界芯',
        outcome: '刀身亮起一线樱光。茜把第一枚正式刀铭郑重交给了你。',
        costs: { items: { core_barrier: 1, petal_sakura: 5 } },
        rewardPool: [
          {
            weight: 75,
            rewards: { gold: { min: 180, max: 280 }, items: { stone_reforge: { min: 1, max: 2 } } },
          },
          {
            weight: 25,
            rewards: { gold: { min: 280, max: 360 }, items: { stone_enhance: { min: 6, max: 9 } } },
          },
        ],
      },
      {
        id: 'witness',
        label: '只替她见证这一刻',
        outcome: '你将刀稳稳递回。茜第一次以刀匠的礼节向你鞠躬。',
      },
    ],
  },
  {
    id: 'enc_r1_petalsmith_daily',
    regionIds: ['r1'],
    unlockChapterId: '1-5',
    title: '刀匠的例行试握',
    story: '茜又带着新的包柄样品来找她最信任的试握人。',
    speaker: '刀匠·茜',
    glyph: '🌸',
    storyArc: {
      characterId: 'char_akane',
      characterName: '刀匠·茜',
      episode: 4,
      episodeLabel: '日常 · 新作试握',
      requiredEncounterIds: ['enc_r1_petalsmith_first_blade'],
      repeatable: true,
      storyChoices: [
        {
          id: 'soft',
          label: '“这次更柔软了。”',
          responseDialogue: [
            { speaker: '刀匠·茜', text: '你的手感还是这么准！我又少走一条弯路。' },
          ],
        },
        {
          id: 'steady',
          label: '“握起来很稳。”',
          responseDialogue: [{ speaker: '刀匠·茜', text: '嘿嘿，那我就敢把它交给真正的客人了。' }],
        },
      ],
    },
    dialogue: [
      { speaker: '刀匠·茜', text: '来得正好！闭上眼，只凭手感帮我挑一条。' },
      { text: '她把两截包柄藏在背后，神情已经比第一次见面时从容许多。' },
    ],
    choices: [
      {
        id: 'materials',
        label: '留下些下次试作用的材料',
        outcome: '茜记下你的评价，也塞来一小包工坊边角料。',
        costs: { items: { petal_sakura: 3, grass_soft: 2 } },
        rewardPool: [
          {
            weight: 90,
            rewards: { gold: { min: 40, max: 90 }, items: { stone_enhance: { min: 2, max: 4 } } },
          },
          {
            weight: 10,
            rewards: { gold: { min: 90, max: 140 }, items: { stone_reforge: { min: 1, max: 1 } } },
          },
        ],
      },
      {
        id: 'next_time',
        label: '约好下次再来',
        outcome: '茜挥着草图跑回工坊，背影像一瓣轻快的樱花。',
      },
    ],
  },
  {
    id: 'enc_r1_bell',
    regionIds: ['r1'],
    unlockChapterId: '1-3',
    title: '会自己响的木铃',
    story: '林间传来清脆铃声，一只小木灵想收回散落的木铃。',
    speaker: '木铃',
    glyph: '🔔',
    dialogue: [
      { text: '林间小径的树枝上，挂着一只没有风也在响的木铃。' },
      { speaker: '木铃', text: '叮铃——叮铃——' },
      { text: '铃声听起来……像是在叫你过去。' },
    ],
    choices: [
      {
        id: 'return',
        label: '归还木铃',
        outcome: '小木灵开心地翻出一袋旧日矿石作为谢礼。',
        costs: { items: { bell_wood: 3 } },
        rewardPool: [
          {
            weight: 85,
            rewards: { gold: { min: 60, max: 100 }, items: { stone_enhance: { min: 2, max: 4 } } },
          },
          {
            weight: 15,
            rewards: { gold: { min: 100, max: 160 }, items: { stone_reforge: { min: 1, max: 1 } } },
          },
        ],
      },
      { id: 'listen', label: '听一会儿铃声', outcome: '风声和铃声交织，让这段路轻快了不少。' },
    ],
  },
  {
    id: 'enc_r1_barrier',
    regionIds: ['r1'],
    unlockChapterId: '1-5',
    title: '微微发亮的裂隙',
    story: '落樱结界裂开了一道细缝，温暖的光正一点点漏出来。',
    speaker: '结界裂隙',
    glyph: '✨',
    dialogue: [
      { text: '落樱结界的边缘裂开一道细缝，缝里透出温吞吞的光。' },
      { text: '把手伸进去似乎能摸到什么，但也可能只是错觉。' },
    ],
    choices: [
      {
        id: 'mend',
        label: '修补结界',
        outcome: '裂隙恢复平静，结界凝成了一份看不透的回礼。',
        costs: { items: { core_barrier: 1, petal_sakura: 4 } },
        rewardPool: [
          {
            weight: 75,
            rewards: { gold: { min: 120, max: 220 }, items: { stone_reforge: { min: 1, max: 2 } } },
          },
          {
            weight: 25,
            rewards: { gold: { min: 220, max: 300 }, items: { stone_enhance: { min: 5, max: 8 } } },
          },
        ],
      },
      { id: 'leave', label: '先不触碰', outcome: '你记下了位置，安静地离开了结界。' },
    ],
  },
  {
    id: 'enc_r2_napper',
    regionIds: ['r2'],
    unlockChapterId: '2-2',
    title: '睡过站的草原信使',
    story: '信使抱着包裹睡在草垛旁，醒来后发现捆包材料全散了。',
    speaker: '草原信使·穗',
    glyph: '💤',
    storyArc: {
      characterId: 'char_sui',
      characterName: '草原信使·穗',
      episode: 1,
      episodeLabel: '第一幕 · 睡过站的信使',
      requiredEncounterIds: [],
      repeatable: false,
      storyChoices: [
        {
          id: 'take_breath',
          label: '“先喝口水，再想怎么补救。”',
          responseDialogue: [
            { speaker: '草原信使·穗', text: '你居然没先骂我……那我、我只休息这一小口！' },
            { text: '她认真喝了一口水，终于把信袋背正。' },
          ],
        },
        {
          id: 'go_together',
          label: '“走吧，我陪你把这趟送完。”',
          responseDialogue: [
            { speaker: '草原信使·穗', text: '真、真的？有人一起走，我肯定不会再睡着！' },
            { text: '她握紧肩带，第一次跑在了你的前面。' },
          ],
        },
      ],
    },
    dialogue: [
      { text: '草垛上趴着一个背着信袋的少女，睡得正香。' },
      { speaker: '草原信使·穗', text: '呼……嗯……再、再五分钟……' },
      { text: '她的信袋上写着「加急」，落款日期是三天前。' },
    ],
    choices: [
      {
        id: 'bundle',
        label: '帮她重新捆好',
        outcome: '包裹终于扎稳，信使从行囊里摸出了一份谢礼。',
        costs: { items: { straw_sleepy: 4, jelly_cotton: 3 } },
        rewardPool: [
          {
            weight: 90,
            rewards: { gold: { min: 40, max: 80 }, items: { stone_enhance: { min: 2, max: 4 } } },
          },
          {
            weight: 10,
            rewards: { gold: { min: 80, max: 140 }, items: { stone_reforge: { min: 1, max: 1 } } },
          },
        ],
      },
      { id: 'wake', label: '提醒她别再睡了', outcome: '她认真地点头，然后站着又打了个哈欠。' },
    ],
  },
  {
    id: 'enc_r2_napper_old_letter',
    regionIds: ['r2'],
    unlockChapterId: '2-3',
    title: '迟到了三天的旧信',
    story: '穗在蜂巢外踌躇不前，信袋里那封旧信仍没有送出去。',
    speaker: '草原信使·穗',
    glyph: '✉️',
    storyArc: {
      characterId: 'char_sui',
      characterName: '草原信使·穗',
      episode: 2,
      episodeLabel: '第二幕 · 迟到的信',
      requiredEncounterIds: ['enc_r2_napper'],
      repeatable: false,
      storyChoices: [
        {
          id: 'apologize',
          label: '“亲手交出去，也亲口道歉。”',
          responseDialogue: [
            { speaker: '草原信使·穗', text: '就算会被骂，也比让它永远躺在袋子里好。' },
            { speaker: '草原信使·穗', text: '你能……在门外等我一下吗？' },
          ],
        },
        {
          id: 'still_matters',
          label: '“迟到的信，也可能仍有人等。”',
          responseDialogue: [
            { speaker: '草原信使·穗', text: '原来送信不是和时间赛跑，是把心意送到啊。' },
            { speaker: '草原信使·穗', text: '那我更不能把它丢掉。' },
          ],
        },
      ],
      memoryCallbacks: [
        {
          fromEncounterId: 'enc_r2_napper',
          choiceId: 'take_breath',
          dialogue: [{ speaker: '草原信使·穗', text: '我有照你说的先冷静，可走到门口还是害怕。' }],
        },
        {
          fromEncounterId: 'enc_r2_napper',
          choiceId: 'go_together',
          dialogue: [
            { speaker: '草原信使·穗', text: '上次有你陪着才送完，这次我想试着自己走到门前。' },
          ],
        },
      ],
    },
    dialogue: [
      { text: '蜂巢小屋近在眼前，穗却绕着同一块石头走了第三圈。' },
      { speaker: '草原信使·穗', text: '这封信已经迟到三天了。现在送进去，只会让人更生气吧？' },
      { speaker: '草原信使·穗', text: '要不……就当它从来没有寄出过？' },
    ],
    choices: [
      {
        id: 'sweeten',
        label: '准备一份迟到的赔礼',
        outcome: '门很快打开。收信人没有责怪，只递给穗一杯温热的蜜茶。',
        costs: { items: { honey_bee: 2, jelly_cotton: 2 } },
        rewardPool: [
          {
            weight: 85,
            rewards: { gold: { min: 90, max: 150 }, items: { stone_enhance: { min: 3, max: 5 } } },
          },
          {
            weight: 15,
            rewards: { gold: { min: 150, max: 210 }, items: { stone_reforge: { min: 1, max: 1 } } },
          },
        ],
      },
      {
        id: 'wait_outside',
        label: '在门外等她',
        outcome: '片刻后，穗红着眼睛跑出来，却笑得比草原上的太阳还亮。',
      },
    ],
  },
  {
    id: 'enc_r2_napper_true_delivery',
    regionIds: ['r2'],
    unlockChapterId: '2-5',
    title: '绝对不能迟到的一封信',
    story: '祭坛风暴将道路吹得模糊，穗却第一次没有停下脚步。',
    speaker: '草原信使·穗',
    glyph: '📨',
    storyArc: {
      characterId: 'char_sui',
      characterName: '草原信使·穗',
      episode: 3,
      episodeLabel: '第三幕 · 这次不会迟到',
      requiredEncounterIds: ['enc_r2_napper_old_letter'],
      repeatable: false,
      storyChoices: [
        {
          id: 'trust_her',
          label: '“这一次，我在终点等你。”',
          responseDialogue: [
            { speaker: '草原信使·穗', text: '嗯！如果终点有人等，我就不会在半路停下。' },
            { text: '她压低身体冲进草浪，没有再回头确认你是否跟上。' },
          ],
        },
        {
          id: 'run_beside',
          label: '“最后一段，我们并肩跑。”',
          responseDialogue: [
            { speaker: '草原信使·穗', text: '这次可不是你带着我，是我带路！' },
            { text: '她迎着风笑起来，脚步清楚而坚定。' },
          ],
        },
      ],
      memoryCallbacks: [
        {
          fromEncounterId: 'enc_r2_napper_old_letter',
          choiceId: 'apologize',
          dialogue: [
            { speaker: '草原信使·穗', text: '我已经学会为迟到道歉，所以这次更想准时抵达。' },
          ],
        },
        {
          fromEncounterId: 'enc_r2_napper_old_letter',
          choiceId: 'still_matters',
          dialogue: [
            { speaker: '草原信使·穗', text: '有人在等这封信。光是想到这件事，我就一点也不困了。' },
          ],
        },
      ],
    },
    dialogue: [
      { text: '祭坛方向的风把路标吹歪，一封加急信在穗的怀里发出轻响。' },
      { speaker: '草原信使·穗', text: '从前的我一定会找个草垛躲到风停。' },
      { speaker: '草原信使·穗', text: '但今天，我想成为一个真正能把信送到的人。' },
    ],
    choices: [
      {
        id: 'wind_charm',
        label: '用祭坛结晶做一枚避风符',
        outcome: '穗准时将信送到。回程时，她把盖着新邮戳的回信交给了你。',
        costs: { items: { crystal_altar: 1, straw_sleepy: 4 } },
        rewardPool: [
          {
            weight: 75,
            rewards: { gold: { min: 200, max: 300 }, items: { stone_reforge: { min: 1, max: 2 } } },
          },
          {
            weight: 25,
            rewards: { gold: { min: 300, max: 400 }, items: { stone_enhance: { min: 6, max: 9 } } },
          },
        ],
      },
      {
        id: 'send_off',
        label: '目送她独自出发',
        outcome: '很久以后，远处传来一声清亮的呼喊：“送到啦——！”',
      },
    ],
  },
  {
    id: 'enc_r2_napper_daily',
    regionIds: ['r2'],
    unlockChapterId: '2-5',
    title: '准时路过的信使',
    story: '穗准时从路口经过，还特意停下来和你打了声招呼。',
    speaker: '草原信使·穗',
    glyph: '🌾',
    storyArc: {
      characterId: 'char_sui',
      characterName: '草原信使·穗',
      episode: 4,
      episodeLabel: '日常 · 今日准时',
      requiredEncounterIds: ['enc_r2_napper_true_delivery'],
      repeatable: true,
      storyChoices: [
        {
          id: 'praise',
          label: '“今天也很准时。”',
          responseDialogue: [
            { speaker: '草原信使·穗', text: '那当然！我现在还会提前一刻钟出门呢。' },
          ],
        },
        {
          id: 'rest',
          label: '“忙完记得好好休息。”',
          responseDialogue: [
            { speaker: '草原信使·穗', text: '放心，我已经会分清休息和偷懒啦……大概！' },
          ],
        },
      ],
    },
    dialogue: [
      { speaker: '草原信使·穗', text: '早上好！这次不是睡在路边，是专门停下来找你说话。' },
      { text: '她身后的信袋整理得整整齐齐，最上面还别着一朵小花。' },
    ],
    choices: [
      {
        id: 'supplies',
        label: '补充些路上用的捆包材料',
        outcome: '穗重新扎紧信袋，送给你几枚沿途收集的小石头。',
        costs: { items: { straw_sleepy: 3, jelly_cotton: 2 } },
        rewardPool: [
          {
            weight: 90,
            rewards: { gold: { min: 50, max: 100 }, items: { stone_enhance: { min: 2, max: 4 } } },
          },
          {
            weight: 10,
            rewards: { gold: { min: 100, max: 150 }, items: { stone_reforge: { min: 1, max: 1 } } },
          },
        ],
      },
      {
        id: 'wave',
        label: '挥手祝她一路顺风',
        outcome: '穗踩着轻快的步子继续赶路，这次没有错过任何一个路口。',
      },
    ],
  },
  {
    id: 'enc_r2_honey',
    regionIds: ['r2'],
    unlockChapterId: '2-3',
    title: '蜂娘的下午茶',
    story: '巡逻的蜂娘想泡一壶甜茶，却怎么也找不到合适的杯垫。',
    speaker: '蜜蜂娘·芃',
    glyph: '🍯',
    dialogue: [
      { text: '蜂巢外摆着一张小桌子，桌上是刚倒好的两杯蜜茶。' },
      { speaker: '蜜蜂娘·芃', text: '欸？你不是来抢蜜的吧？' },
      { speaker: '蜜蜂娘·芃', text: '……算了，反正我也一个人喝不完。坐嘛坐嘛。' },
    ],
    choices: [
      {
        id: 'tea',
        label: '凑齐茶会材料',
        outcome: '茶会大成功，蜂娘神秘地递来一个甜香的小包。',
        costs: { items: { honey_bee: 2, jelly_cotton: 4 } },
        rewardPool: [
          {
            weight: 85,
            rewards: { gold: { min: 70, max: 130 }, items: { stone_enhance: { min: 3, max: 5 } } },
          },
          {
            weight: 15,
            rewards: { gold: { min: 130, max: 190 }, items: { stone_reforge: { min: 1, max: 1 } } },
          },
        ],
      },
      { id: 'decline', label: '下次再来', outcome: '蜂娘给你指了路，继续忙着准备茶点。' },
    ],
  },
  {
    id: 'enc_r2_altar',
    regionIds: ['r2'],
    unlockChapterId: '2-5',
    title: '草原祭坛的回声',
    story: '古老祭坛发出轻柔回声，似乎在等待一块失落的结晶。',
    speaker: '祭坛回声',
    glyph: '🌀',
    dialogue: [
      { text: '草原祭坛的石缝间回荡着某种低语，听不清词句。' },
      { speaker: '祭坛回声', text: '……交换……等价的……' },
      { text: '回声停下了，像是在等你的答复。' },
    ],
    choices: [
      {
        id: 'answer',
        label: '回应祭坛',
        outcome: '祭坛亮起星光，一份古老的馈赠落入你的掌心。',
        costs: { items: { crystal_altar: 1, straw_sleepy: 5 } },
        rewardPool: [
          {
            weight: 75,
            rewards: { gold: { min: 180, max: 280 }, items: { stone_reforge: { min: 1, max: 2 } } },
          },
          {
            weight: 25,
            rewards: { gold: { min: 280, max: 380 }, items: { stone_enhance: { min: 6, max: 9 } } },
          },
        ],
      },
      { id: 'leave', label: '尊重这份安静', outcome: '回声渐渐远去，草浪重新盖住祭坛。' },
    ],
  },
];

export const ENCOUNTERS: Record<string, EncounterDefinition> = Object.fromEntries(
  DEFINITIONS.map((encounter) => [encounter.id, encounter]),
);

export function requireEncounter(id: string): EncounterDefinition {
  const encounter = ENCOUNTERS[id];
  if (!encounter) throw new Error(`[配置错误] 奇遇不存在：${id}`);
  return encounter;
}

export function encounterIdsForRegion(regionId: string): string[] {
  return DEFINITIONS.filter((e) => e.regionIds.includes(regionId)).map((e) => e.id);
}

export function encounterIdsForProgress(
  regionId: string,
  unlockedChapterIds: ReadonlySet<string>,
  characters: Readonly<Record<string, EncounterCharacterProgress>> = {},
  pendingEncounterIds: ReadonlySet<string> = new Set(),
): string[] {
  return availableEncounterIds(
    DEFINITIONS,
    regionId,
    unlockedChapterIds,
    characters,
    pendingEncounterIds,
  );
}
