import { BookOpen, ExternalLink, CodeXml } from "lucide-react";
import { Modal } from "./components";
import { SITE } from "./site-config";
import authorAvatar from "./assets/author.jpg";

const GUIDE = [
  {
    id: "start",
    title: "01 · 从一个方案开始",
    paragraphs: [
      "先配置四位角色和装备，再定义技能与效果，编排时间轴，最后点击“开始计算”。页面顶部可修改方案名称、导入或导出整份方案。",
      "编辑会自动保存在当前浏览器。换设备、清理浏览器数据或改用另一个网站地址前，请导出JSON备份。未完成的技能草稿需要点击“完成编辑”，弹窗中的导入需要确认。重置支持取消、保存当前方案并重置、直接重置。",
    ],
  },
  {
    id: "characters",
    title: "02 · 角色与装备",
    paragraphs: [
      "角色、武器和圣遗物每次显示一位角色，点击上方卡片切换。调整角色顺序会同步装备、技能和天赋/命座的排列。角色名称用于展示，单字简写与等级、命座和武器简写共同生成队伍名。等级可选1～90、95、100；1～89级点击展开。",
      "角色基础生命、攻击、防御填写角色自身数值，武器基础攻击力单独填写。基础暴击率固定5%，暴击伤害固定50%；突破属性另外选择类型并填数值。头像可选择现有角色或填入图片地址。",
      "武器最多一条副词条；圣遗物可添加多条。词条可直接填数值，也可按平均词条数填写（支持小数）。NOT IMPORTANT表示不参与伤害。圣遗物勾选“20级5星圣遗物”使用固定主词条，取消后可输入对应类型的自定义数值。",
      "整队方案、角色和武器均可从官方预设库浏览并导入；欢迎提交Pull Request，作者审核后收录。角色和武器也可各自保存、导入本地预设。主副词条与装备提供的效果分别编辑，避免把同一加成重复填写。沙漏可选择元素充能效率，20级5星值为51.8%。",
    ],
  },
  {
    id: "import",
    title: "03 · 快速导入与四人批量导入",
    paragraphs: [
      "支持GGScanner导出的GOOD JSON，或输入UID读取Enka公开展柜。使用UID前，请在游戏展柜中放入角色并开启“显示角色详情”；接口有缓存，游戏修改后可能需要等待。UID会记住上次输入。",
      "单角色导入选择来源和目标；四角色批量导入逐槽对应，也可跳过槽位。同一个来源只能匹配一次。所有可读取的字段默认勾选，可按需取消；缺失字段保留原值，确认前不会修改方案。",
      "Enka基础攻击力包含武器，本工具会拆出角色自身基础攻击力，避免重复叠加。角色基础三维只有在数据足够可靠时可导入；突破属性仍需自行填写。已定义效果、技能和时间轴保留。",
      "激活4件套使用套装花图标；2+2显示两个套装名与双花图标。UID查询默认直连MicroGG，可手动切换Cloudflare转发读取Enka官方数据；切换会清空旧预览，需要重新读取。网络或跨域错误时可切换接口；导入窗口另提供打开该UID的Enka官方JSON并粘贴预览的免账号方式，不必下载文件。",
    ],
  },
  {
    id: "skills",
    title: "04 · 技能与伤害类型",
    paragraphs: [
      "技能先选所属角色和名称，再选造成伤害、提供效果或不造成伤害。伤害技能指定元素/物理、普攻/重击/战技/大招、生命/攻击/防御/精通乘区及百分比倍率。五种星月高级属性只能选一个。",
      "每个时间轴伤害技能事件代表一次命中，多段技能需分开编排。不造成伤害的技能不生成伤害记录，但计入统计时长并可绑定效果；释放技能不会自动切换前台角色。",
      "普通火、水、冰命中可逐事件勾选增幅反应；水锁定蒸发、冰锁定融化，火可选二者。星月伤害不显示此选项。星超导层数1～13对应上周期元素力0～12，仅作用于当前事件。",
    ],
  },
  {
    id: "effects",
    title: "05 · 效果、变量和层数",
    paragraphs: [
      "效果原位置和效果列表编辑同一份定义。先选全局/实时：全局效果始终生效，0秒灰色展示；勾选“局外生效”才参与局外面板。实时效果通过时间轴或技能绑定触发。全局变量与实时变量均在每次伤害时按当前数值解析。",
      "生效对象可选自己、全队、指定角色、指定元素或前台角色。敌方抗性不需要选角色对象。技能绑定可多选，释放时在该次伤害前生效。来源不同的效果层数池独立，同一效果的手动触发与绑定触发共用层数池。",
      "变量三种取值：基础只含角色基础值与武器基础攻击；局外包含突破和装备主副词条及勾选局外生效的全局效果；实时再计入当前有效效果。高级公式用x代表变量，可填写多条条件公式或使用阈值换算预设。生命、攻击、防御、精通的变量结果直接作为数值；百分比结果20表示20%。",
      "固定效果重复触发刷新时间。独立计时多层效果逐批到期，触发输入正数加层、负数扣层，满层刷新最早到期层；共用计时多层效果触发时重置层数和整条持续时间。定时版本还会按间隔增减层数，重新触发重置定时器。",
      "初始层数默认0，非零时从0秒计时。“使用预设”只锁定时间参数，本次层数一直可修改。共用计时的定时范围不得超过共用持续时间；范围终点计入预期次数，但效果先到期或扣到0会提前结束。",
      "基础增伤、改变倍率、基础值加成、星月基础提升/增伤、擢升等有各自公式位置。擢升填百分数并加算，例如10%与5%合为×1.15；独立乘区直接填系数，例如1.2，多条相乘。",
    ],
  },
  {
    id: "timeline",
    title: "06 · 时间轴与批量操作",
    paragraphs: [
      "所有时间均为起始时间，从0.00s开始，自动排序。同秒先处理到期与已有定时变化，再按添加顺序处理手动事件及其绑定效果。技能、效果、切换角色使用不同背景；自动事件颜色较灰且有斜纹。",
      "设置初始前台角色，后续用“切换角色”事件改变。技能绑定效果显示在父事件右下方。效果到期、定时层数变化自动展示；超出最后操作的已知结束时刻显示在后续区域，不延长DPS时长。",
      "多选工具常驻屏幕。点击“多选”后勾选事件，支持全选、批量删除、移动、复制。“移动到第X秒”把最早选中事件对齐X秒，其余保留相对间隔；复制同理。早于0秒的操作会被拒绝。子事件随父事件处理。",
      "批量添加技能：在接下来的X秒，每隔Y秒释放一次，首次发生于一个间隔后。有限批量生成可编辑事件；永久循环只展开到当前方案的统计终点，生成项不可直接编辑。起始时间禁止滚轮误改，其它数字输入保持原行为。",
    ],
  },
  {
    id: "results",
    title: "07 · 计算结果与伤害&效果轴",
    paragraphs: [
      "只有点击“开始计算”才会计算。修改参数后旧结果保留并标为待更新，可以取消正在运行的计算。默认按期望显示，切换暴击/非暴击/期望会同步总伤害、DPS、伤害占比和图表，不重新计算。",
      "统计时长取最后有效操作的起始时间，包含不造成伤害的技能。效果持续时间与自动到期不会延长时长。时长为0可统计总伤害，但无法给出DPS。某个事件出错时显示已完成部分，请展开该事件检查。",
      "圆环与列表显示各角色总伤害和占比，点击角色可查看局外面板。伤害详情每页40条，展开后读取当时四人面板、有效效果与完整公式。",
      "伤害&效果轴上方是带纵轴参考的细伤害柱，下方是实时效果持续区间与层数。悬停查看信息，点击伤害柱定位伤害详情，点击区间定位具体效果变化。全局效果在最下方，点击总览展开；图表截止本次DPS统计终点。",
    ],
  },
  {
    id: "scope",
    title: "08 · 公式范围、保存与常见问题",
    paragraphs: [
      "当前支持普通直伤、五种星月直伤及手动指定蒸发/融化；不自动模拟元素附着、激化、剧变或多人反应。计算用于比较已配置方案，技能倍率、效果对象和时序仍需按实际机制填写。",
      "效果没有生效：检查全局/实时分类、是否触发或绑定、对象及伤害筛选、层数、持续时间和变量来源。发现循环引用或无效公式时按错误提示修正。导入失败时原方案不会被覆盖。",
      "头像和装备图标依赖Enka图片服务，网络失败时会回退为简写/占位图标。在线域名与本地地址的浏览器存储相互独立，使用导出/导入方案迁移。请定期备份重要方案。",
    ],
  },
];
export function UsageDialog({ onClose }: { onClose: () => void }) {
  return (
    <Modal
      wide
      title="使用说明"
      subtitle="提瓦特伤害工作台 · 配置、编排、计算"
      onClose={onClose}
    >
      <div className="usage-intro">
        <BookOpen size={24} />
        <div>
          <strong>从配置到结果，一步步完成你的方案</strong>
          <p>推荐顺序：角色 → 装备 → 技能与效果 → 时间轴 → 开始计算。</p>
        </div>
      </div>
      <div className="usage-toc">
        {GUIDE.map((g) => (
          <button
            key={g.id}
            onClick={() =>
              document
                .getElementById(`guide-${g.id}`)
                ?.scrollIntoView({ behavior: "smooth", block: "start" })
            }
          >
            {g.title}
          </button>
        ))}
      </div>
      <div className="usage-guide">
        {GUIDE.map((g) => (
          <section id={`guide-${g.id}`} key={g.id}>
            <h3>{g.title}</h3>
            {g.paragraphs.map((p) => (
              <p key={p}>{p}</p>
            ))}
          </section>
        ))}
      </div>
    </Modal>
  );
}
export function AboutDialog({ onClose }: { onClose: () => void }) {
  return (
    <Modal wide title="关于&作者" subtitle="提瓦特伤害工作台" onClose={onClose}>
      <div className="author-profile">
        <img src={authorAvatar} alt="WYH827 的头像" />
        <div>
          <span className="eyebrow">CREATED BY</span>
          <h2>WYH827</h2>
          <p>关注@WYH827喵~</p>
          <div className="author-socials">
            <a href={SITE.github} target="_blank" rel="noreferrer">
              <CodeXml size={16} /> GitHub · @WYH827
            </a>
            <a href={SITE.bilibili} target="_blank" rel="noreferrer">
              哔哩哔哩 · 544854596 <ExternalLink size={14} />
            </a>
          </div>
        </div>
      </div>
      <section className="about-links">
        <h3>网站与仓库</h3>
        <p>
          {SITE.published
            ? "项目链接"
            : "以下为预设发布地址，尚未创建仓库或发布网站。"}
        </p>
        <a href={SITE.website} target="_blank" rel="noreferrer">
          {SITE.website}
          <ExternalLink size={14} />
        </a>
        <a href={SITE.repository} target="_blank" rel="noreferrer">
          {SITE.repository}
          <ExternalLink size={14} />
        </a>
      </section>
      <section className="usage-terms">
        <h3>使用协议</h3>
        <p>
          本工具是非官方的玩家计算工具，与《原神》及其运营方无隶属关系。计算结果取决于输入参数和已实现公式，供构筑分析与比较使用。
        </p>
        <p>
          方案保存在当前浏览器，默认不会上传至作者服务器。使用UID导入时，输入的UID会发送至Enka查询服务（GitHub
          Pages版默认使用MicroGG，也可选择Cloudflare转发读取Enka官方数据），读取公开展柜；头像和装备图标从Enka加载。请自行备份重要方案。
        </p>
        <p>
          项目代码沿用ISC许可：允许使用、复制、修改与分发，但需保留版权和许可声明。软件按原样提供，不承诺适用于所有场景。作者头像、游戏图片、元素图标等素材不因代码许可而转让版权，相关权利归原权利人所有。
        </p>
      </section>
      <section className="about-credits">
        <h3>数据与素材</h3>
        <p>
          <a
            href="https://alioth.wiki/gi/formulae"
            target="_blank"
            rel="noreferrer"
          >
            Alioth 伤害公式
          </a>{" "}
          ·{" "}
          <a href="https://enka.network/" target="_blank" rel="noreferrer">
            Enka.Network
          </a>{" "}
          ·{" "}
          <a
            href="https://github.com/Anyrainel/GGScanner"
            target="_blank"
            rel="noreferrer"
          >
            GGScanner
          </a>{" "}
          ·{" "}
          <a
            href="https://github.com/Sacr3d/genshin-icons"
            target="_blank"
            rel="noreferrer"
          >
            genshin-icons
          </a>
        </p>
        <p>
          原神角色与装备素材归原权利人所有。感谢上述社区项目提供资料、接口与图标。
        </p>
      </section>
    </Modal>
  );
}
