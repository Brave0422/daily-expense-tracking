/**
 * @author Brave
 * @date 2026-09-21T14:43:11+08:00
 * @description 为账单分类生成兼容阿里 Iconfont Symbol 模式的多色 SVG、清单和预览。
 */

import { mkdir, readFile, readdir, unlink, writeFile } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const currentDirectory = dirname(fileURLToPath(import.meta.url))
const tdesignIconDirectory = join(
  currentDirectory,
  '../../../../node_modules/tdesign-icons-vue-next/esm/components',
)
const ICONFONT_PROJECT_NAME = 'DET-category-icon'
const ICONFONT_SYMBOL_PREFIX = 'icon-'

const PALETTES = {
  meals: '#FF873D',
  snacks: '#F2A82F',
  clothing: '#EC6683',
  entertainment: '#8A63E8',
  digital: '#4F8BE8',
  household: '#35B99D',
  personalCare: '#DC65A0',
  transport: '#3290DF',
  housing: '#3EBB70',
  communication: '#6674D9',
  medical: '#EB6076',
  education: '#D59419',
  digitalServices: '#5368D8',
  social: '#EF5B7A',
  salaryIncome: '#29AD68',
  bonusIncome: '#36B577',
  sideIncome: '#2EA982',
  investmentIncome: '#25A1A1',
  secondhandIncome: '#45AA6F',
}

const CUSTOM_GLYPHS = {
  shirt:
    '<path fill="#fff" d="M8.1 3.2 11 2h2l2.9 1.2L21 6l-2.2 4.4-2.8-1.1V21H8V9.3l-2.8 1.1L3 6l5.1-2.8Zm2 .7A3 3 0 0 0 12 5a3 3 0 0 0 1.9-1.1l-.9-.4h-2l-.9.4Z" fill-rule="evenodd"/>',
  pants:
    '<path fill="#fff" d="M6.8 2h10.4l-.4 5.4L16.2 22h-4.1L12 12.2 11.9 22H7.8L7.2 7.4 6.8 2Zm2.1 2 .1 2h6l.1-2H8.9Z" fill-rule="evenodd"/>',
  shoe: '<path fill="#fff" d="M4 10.2c2.8 0 5.1-1.8 6-4.2l3 1.2c.5 2.9 2.8 4.8 6.7 5.8 1.4.4 2.3 1.6 2.3 3.1V19H3a2 2 0 0 1-2-2v-3.8c0-1.7 1.3-3 3-3Zm-.9 5.3V17h16.8v-.9c0-.5-.3-.9-.8-1-1.4-.4-2.6-.8-3.6-1.4l-1.1 1.1-1.4-1.4.9-.9-1.2-1.2-1 1-1.4-1.4.9-.9-.2-.5c-1.7 1.8-4 2.8-7 2.8-.5 0-.9.4-.9.9v2.3Z" fill-rule="evenodd"/>',
  underwear:
    '<path fill="#fff" d="M4 3h16v6.2c0 5.4-3.3 9.9-8 11.8-4.7-1.9-8-6.4-8-11.8V3Zm3 3v3.2c0 3.5 1.9 6.7 5 8.4 3.1-1.7 5-4.9 5-8.4V6h-3.5L12 9 10.5 6H7Z" fill-rule="evenodd"/>',
  scissors:
    '<path fill="#fff" d="M7 13a5 5 0 1 0 3.9 8.1l2.4-4.2 2.4 4.2A5 5 0 1 0 18 17a5 5 0 0 0-.6 0L14.5 12l5.2-9H17l-4 6.8L9 3H6.3l5.2 9-2.9 5A5 5 0 0 0 7 13Zm0 3a2 2 0 1 1 0 4 2 2 0 0 1 0-4Zm10 0a2 2 0 1 1 0 4 2 2 0 0 1 0-4Z" fill-rule="evenodd"/>',
  bottle:
    '<path fill="#fff" d="M9 2h6v3l2 2v3.2c1.2.7 2 2 2 3.5V22H5v-8.3c0-1.5.8-2.8 2-3.5V7l2-2V2Zm2 2v2L9 8v1h6V8l-2-2V4h-2Zm-4 9v7h10v-7.1c0-1-.8-1.9-1.9-1.9H8.9C7.8 11 7 11.9 7 13Z" fill-rule="evenodd"/>',
  bicycle:
    '<path fill="#fff" d="M6 12a5 5 0 1 0 4.7 6.7h2.6A5 5 0 1 0 15 13l-1.2-2H16V9h-3.4l-1-2H14V5H9v2h.4l1.1 2H8.8l-1.1 3.3A5 5 0 0 0 6 12Zm0 2c.4 0 .7.1 1 .2L5.1 20h3.4A3 3 0 1 1 6 14Zm5.6-3 2.7 4.6a5 5 0 0 0-.8 1.1h-3.2A5 5 0 0 0 9.5 14l1-3h1.1Zm6.4 3a3 3 0 1 1-2.6 1.5A3 3 0 0 1 18 14Z" fill-rule="evenodd"/>',
  train:
    '<path fill="#fff" d="M6 2h12a3 3 0 0 1 3 3v10a4 4 0 0 1-3 3.9L20 22h-3l-2-3h-6l-2 3H4l2-3.1A4 4 0 0 1 3 15V5a3 3 0 0 1 3-3Zm0 3v6h12V5H6Zm1 9a1.5 1.5 0 1 0 0 3 1.5 1.5 0 0 0 0-3Zm10 0a1.5 1.5 0 1 0 0 3 1.5 1.5 0 0 0 0-3Z" fill-rule="evenodd"/>',
  highSpeedRail:
    '<path fill="#fff" d="M8 2h10a3 3 0 0 1 3 3v9.2c0 2.4-1.7 4.4-4 4.8l2 3h-3l-2-3h-4l-2 3H5l2-3.1A4 4 0 0 1 4 15V7h14V5H8V2ZM7 10v3h11v-3H7Zm1 5a1.5 1.5 0 1 0 0 3 1.5 1.5 0 0 0 0-3Zm9 0a1.5 1.5 0 1 0 0 3 1.5 1.5 0 0 0 0-3ZM1 3h5v2H1V3Zm0 4h2v2H1V7Z" fill-rule="evenodd"/>',
  cruiseShip:
    '<path fill="#fff" d="M9 2h6v4h4l2 8h2l-2.3 5.2A4.7 4.7 0 0 1 16.4 22H7.6a4.7 4.7 0 0 1-4.3-2.8L1 14h2l2-8h4V2Zm2 2v2h2V4h-2ZM7 8l-1.5 6h13L17 8H7Zm-3.8 8 1.9 2.4c.6.8 1.5 1.2 2.5 1.2h8.8c1 0 1.9-.4 2.5-1.2l1.9-2.4H3.2Z" fill-rule="evenodd"/>',
  paperRoll:
    '<path fill="#fff" d="M8 2h8a6 6 0 0 1 6 6v14h-8v-5H8a6 6 0 0 1 0-12h1.1A6 6 0 0 1 8 2Zm0 5a4 4 0 1 0 0 8 4 4 0 0 0 0-8Zm8-3h-4.5A6 6 0 0 1 14 9v11h6V8a4 4 0 0 0-4-4ZM8 9a2 2 0 1 1 0 4 2 2 0 0 1 0-4Z" fill-rule="evenodd"/>',
  waterDrop:
    '<path fill="#fff" d="M12 2s8 8.2 8 13a8 8 0 1 1-16 0c0-4.8 8-13 8-13Zm-4 13a4 4 0 0 0 4 4v-2a2 2 0 0 1-2-2H8Z" fill-rule="evenodd"/>',
  flame:
    '<path fill="#fff" d="M13.5 2c.7 4.3-2.6 5.3-2.6 8 0 1.2.7 2.1 1.6 2.7-.1-2.3 1.6-3.8 3.4-5.1 2.5 2.1 4.1 5.1 4.1 8.2A8 8 0 0 1 4 16c0-4.2 2.4-7.6 5.8-10.4.1 2 .7 2.9 1.2 3.4.5-2.6 1.3-4.7 2.5-7Zm.8 11.8c-.7.9-1.1 1.8-.8 3.2a4.7 4.7 0 0 1-2.3-1.9A3 3 0 1 0 17 16.5c0-1.3-.6-2.5-1.4-3.6-.4.4-.9.7-1.3.9Z" fill-rule="evenodd"/>',
  pill: '<path fill="#fff" d="M7.1 3.5a6 6 0 0 1 8.5 0l4.9 4.9a6 6 0 0 1-8.5 8.5L7.1 12a6 6 0 0 1 0-8.5Zm1.4 1.4a4 4 0 0 0 0 5.7l1.1 1.1 5.7-5.7-1.1-1.1a4 4 0 0 0-5.7 0Zm2.6 8.2 2.3 2.3a4 4 0 1 0 5.7-5.7l-2.3-2.3-5.7 5.7Z" fill-rule="evenodd"/>',
  envelope:
    '<path fill="#fff" d="M3 5h18a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2Zm0 3.2V19h18V8.2l-9 6.3-9-6.3Zm1.7-1.2 7.3 5.1L19.3 7H4.7Z" fill-rule="evenodd"/>',
  ellipsis:
    '<path fill="#fff" d="M4 9a3 3 0 1 1 0 6 3 3 0 0 1 0-6Zm8 0a3 3 0 1 1 0 6 3 3 0 0 1 0-6Zm8 0a3 3 0 1 1 0 6 3 3 0 0 1 0-6Z"/>',
}

const primaryCategories = [
  ['meals', '三餐', 'EXPENSE', PALETTES.meals, 'rice'],
  ['snacks-drinks', '零食饮品', 'EXPENSE', PALETTES.snacks, 'cake'],
  ['entertainment', '休闲娱乐', 'EXPENSE', PALETTES.entertainment, 'gamepad'],
  ['household', '日用家居', 'EXPENSE', PALETTES.household, 'home'],
  ['clothing', '服饰穿搭', 'EXPENSE', PALETTES.clothing, null, 'shirt'],
  ['personal-care', '个人护理', 'EXPENSE', PALETTES.personalCare, 'face-retouching'],
  ['housing', '住房', 'EXPENSE', PALETTES.housing, 'houses'],
  ['digital', '数码产品', 'EXPENSE', PALETTES.digital, 'mobile'],
  ['transport', '交通出行', 'EXPENSE', PALETTES.transport, 'vehicle'],
  ['communication', '通讯网络', 'EXPENSE', PALETTES.communication, 'call'],
  ['medical', '医疗健康', 'EXPENSE', PALETTES.medical, 'hospital'],
  ['education', '学习教育', 'EXPENSE', PALETTES.education, 'education'],
  ['digital-services', '数字服务', 'EXPENSE', PALETTES.digitalServices, 'cloud'],
  ['social', '人情往来', 'EXPENSE', PALETTES.social, 'gift'],
  ['income-salary', '工资', 'INCOME', PALETTES.salaryIncome, 'work'],
  ['income-bonus', '奖金', 'INCOME', PALETTES.bonusIncome, 'money'],
  ['income-side-business', '兼职副业', 'INCOME', PALETTES.sideIncome, 'usercase'],
  ['income-investment', '投资收益', 'INCOME', PALETTES.investmentIncome, 'chart-line-board'],
  ['income-secondhand-sale', '二手出售', 'INCOME', PALETTES.secondhandIncome, 'shop'],
].map(([id, label, direction, color, source, custom]) => ({
  id,
  label,
  direction,
  color,
  source,
  custom,
}))

const secondaryCategoryGroups = [
  [
    'meals',
    [
      ['breakfast', '早餐', 'bread'],
      ['lunch', '午餐', 'rice'],
      ['dinner', '晚餐', 'noodle'],
      ['groceries', '买菜食材', 'cabbage'],
      ['staple-food', '基础食品', 'bread'],
      ['daily-fruit', '日常水果', 'apple'],
    ],
  ],
  [
    'snacks-drinks',
    [
      ['leisure-snacks', '休闲零食', 'rice-ball'],
      ['late-night-snack', '夜宵', 'moon'],
      ['beverages', '饮料茶饮', 'drink'],
      ['desserts-snacks', '甜品小吃', 'cake'],
    ],
  ],
  [
    'entertainment',
    [
      ['games', '游戏', 'gamepad'],
      ['tickets', '门票', 'ticket'],
      ['movies', '电影', 'movie-clapper'],
    ],
  ],
  [
    'household',
    [
      ['personal-cleaning', '个人清洁', null, 'bottle'],
      ['home-cleaning', '家居清洁', 'brush'],
      ['paper-consumables', '纸品耗材', null, 'paperRoll'],
      ['kitchen', '厨房用品', 'fork'],
      ['home-furnishing', '家居用品', 'home'],
      ['other-daily', '其他日用', null, 'ellipsis'],
    ],
  ],
  [
    'clothing',
    [
      ['tops', '上衣', null, 'shirt'],
      ['bottoms', '下装', null, 'pants'],
      ['shoes', '鞋子', null, 'shoe'],
      ['underwear-socks', '内衣袜子', null, 'underwear'],
    ],
  ],
  [
    'personal-care',
    [
      ['haircut', '理发', null, 'scissors'],
      ['skincare', '护肤品', 'face-retouching'],
    ],
  ],
  [
    'housing',
    [
      ['rent', '房租', 'key'],
      ['water', '水费', null, 'waterDrop'],
      ['electricity', '电费', 'lighting-circle'],
      ['gas', '燃气费', null, 'flame'],
      ['mortgage', '房贷', 'building'],
      ['property-fee', '物业费', 'houses-2'],
    ],
  ],
  [
    'digital',
    [
      ['phone', '手机平板', 'mobile'],
      ['computer', '电脑', 'desktop'],
      ['digital-accessories', '数码配件', 'earphone'],
      ['digital-repair', '数码维修', 'tools'],
    ],
  ],
  [
    'transport',
    [
      ['public-transit', '公交地铁', 'subway-line'],
      ['taxi', '打车', 'vehicle'],
      ['shared-bike', '共享单车', null, 'bicycle'],
      ['train', '火车', null, 'train'],
      ['high-speed-rail', '高铁', null, 'highSpeedRail'],
      ['flight', '飞机', 'flight-takeoff'],
      ['cruise', '游轮', null, 'cruiseShip'],
      ['parking', '停车', 'location-parking-place'],
    ],
  ],
  [
    'communication',
    [
      ['phone-bill', '手机话费', 'call'],
      ['mobile-data', '流量费', 'sim-card'],
      ['broadband', '宽带费', 'router-wave'],
    ],
  ],
  [
    'medical',
    [
      ['medicine', '药品', null, 'pill'],
      ['doctor', '就诊', 'hospital'],
      ['examination', '检查', 'file-search'],
    ],
  ],
  [
    'education',
    [
      ['books', '书籍资料', 'book'],
      ['exam-certification', '考试认证', 'certificate'],
      ['course-training', '课程培训', 'course'],
      ['tuition', '学费', 'institution'],
      ['study-supplies', '学习用品', 'pen-ball'],
    ],
  ],
  [
    'digital-services',
    [
      ['software-subscription', '软件订阅', 'cardmembership'],
      ['cloud-server', '云服务器', 'server'],
      ['cloud-storage', '云存储', 'hard-disk-storage'],
      ['network-service', '网络服务', 'router-wave'],
    ],
  ],
  [
    'social',
    [
      ['family-support', '孝亲支出', 'heart'],
      ['red-packet', '红包礼金', null, 'envelope'],
      ['donation', '捐赠', 'money'],
      ['gifts', '礼物', 'gift'],
    ],
  ],
]

const primaryById = new Map(primaryCategories.map((category) => [category.id, category]))
const secondaryCategories = secondaryCategoryGroups.flatMap(([parentId, children]) => {
  const parent = primaryById.get(parentId)
  return children.map(([id, label, source, custom]) => ({
    id,
    label,
    parentId,
    parentLabel: parent.label,
    direction: parent.direction,
    color: parent.color,
    source,
    custom,
  }))
})

function toKebabCase(value) {
  return value.replace(/[A-Z]/g, (character) => `-${character.toLowerCase()}`)
}

function escapeXml(value) {
  return String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('"', '&quot;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
}

function normalizeAttribute(name, value) {
  if (typeof value !== 'string' || !value.startsWith('props.')) {
    return value
  }
  if (name === 'strokeWidth') return '2'
  if (name === 'mask') return undefined
  if (name === 'id') return undefined
  return '#fff'
}

function serializeNode(node) {
  if (!node || !node.tag || node.tag === 'defs') return ''
  const attributes = Object.entries(node.attrs ?? {})
    .map(([name, rawValue]) => [toKebabCase(name), normalizeAttribute(name, rawValue)])
    .filter(([, value]) => value !== undefined)
    .map(([name, value]) => `${name}="${escapeXml(value)}"`)
    .join(' ')
  const children = (node.children ?? []).map(serializeNode).join('')
  return `<${node.tag}${attributes ? ` ${attributes}` : ''}>${children}</${node.tag}>`
}

async function loadTdesignGlyph(source) {
  const sourceText = await readFile(join(tdesignIconDirectory, `${source}-filled.js`), 'utf8')
  const match = sourceText.match(/var element = (\{[\s\S]*?\n\});\nvar /)
  if (!match) {
    throw new Error(`Unable to read TDesign icon: ${source}`)
  }
  const element = JSON.parse(match[1])
  return element.children.map(serializeNode).join('')
}

async function resolveGlyph(category) {
  if (category.custom) return CUSTOM_GLYPHS[category.custom]
  return loadTdesignGlyph(category.source)
}

function getIconfontName(category) {
  if (category.direction === 'INCOME') {
    return category.id
  }
  return category.parentId
    ? `expense-${category.parentId}-${category.id}`
    : `expense-${category.id}`
}

function renderIconSvg(category, glyph) {
  const title = category.parentLabel
    ? `${category.parentLabel} - ${category.label}`
    : category.label
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64" role="img" aria-labelledby="title">
  <title id="title">${escapeXml(title)}</title>
  <path fill="${category.color}" d="M32 2a30 30 0 1 1 0 60 30 30 0 1 1 0-60Z"/>
  <g transform="translate(17 17) scale(1.25)">${glyph}</g>
</svg>
`
}

async function writeCategoryIcon(category, directory) {
  const glyph = await resolveGlyph(category)
  const iconfontName = getIconfontName(category)
  const fileName = `${iconfontName}.svg`
  const relativePath = `${directory}/${fileName}`
  await writeFile(join(currentDirectory, relativePath), renderIconSvg(category, glyph), 'utf8')
  return {
    id: category.id,
    label: category.label,
    ...(category.parentId
      ? { parentId: category.parentId, parentLabel: category.parentLabel }
      : {}),
    direction: category.direction,
    color: category.color,
    file: relativePath,
    iconfontName,
    symbolId: `${ICONFONT_SYMBOL_PREFIX}${iconfontName}`,
  }
}

async function pruneSvgDirectory(directory, expectedFileNames) {
  const absoluteDirectory = join(currentDirectory, directory)
  await mkdir(absoluteDirectory, { recursive: true })
  const entries = await readdir(absoluteDirectory, { withFileTypes: true })
  const removedFiles = []

  for (const entry of entries) {
    if (!entry.isFile() || !entry.name.endsWith('.svg') || expectedFileNames.has(entry.name)) {
      continue
    }
    await unlink(join(absoluteDirectory, entry.name))
    removedFiles.push(`${directory}/${entry.name}`)
  }

  return removedFiles
}

function renderCatalog(title, items, columns = 8) {
  const cellWidth = 136
  const cellHeight = 124
  const padding = 28
  const headerHeight = 70
  const rows = Math.ceil(items.length / columns)
  const width = padding * 2 + columns * cellWidth
  const height = headerHeight + padding + rows * cellHeight
  const cards = items
    .map((item, index) => {
      const column = index % columns
      const row = Math.floor(index / columns)
      const x = padding + column * cellWidth
      const y = headerHeight + row * cellHeight
      const parent = item.parentLabel
        ? `<text x="${x + cellWidth / 2}" y="${y + 104}" fill="#8A94A6" font-size="11" text-anchor="middle">${escapeXml(item.parentLabel)}</text>`
        : ''
      return `<g>
      <rect x="${x + 8}" y="${y}" width="${cellWidth - 16}" height="${cellHeight - 10}" rx="18" fill="#F7F8FA"/>
      <image href="../${item.file}" x="${x + 40}" y="${y + 10}" width="56" height="56"/>
      <text x="${x + cellWidth / 2}" y="${y + 86}" fill="#1F2937" font-size="14" font-weight="600" text-anchor="middle">${escapeXml(item.label)}</text>
      ${parent}
    </g>`
    })
    .join('')
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} ${height}">
  <rect width="100%" height="100%" fill="#fff"/>
  <text x="${padding}" y="42" fill="#111827" font-family="Microsoft YaHei, sans-serif" font-size="24" font-weight="700">${escapeXml(title)}</text>
  <g font-family="Microsoft YaHei, sans-serif">${cards}</g>
</svg>
`
}

async function main() {
  const expectedLevel1Files = new Set(
    primaryCategories.map((category) => `${getIconfontName(category)}.svg`),
  )
  const expectedLevel2Files = new Set(
    secondaryCategories.map((category) => `${getIconfontName(category)}.svg`),
  )
  const expectedPreviewFiles = new Set([
    'expense-level1-catalog.svg',
    'expense-level2-catalog.svg',
    'income-level1-catalog.svg',
  ])
  const removedFiles = (
    await Promise.all([
      pruneSvgDirectory('level1', expectedLevel1Files),
      pruneSvgDirectory('level2', expectedLevel2Files),
      pruneSvgDirectory('preview', expectedPreviewFiles),
    ])
  ).flat()

  const generatedPrimary = await Promise.all(
    primaryCategories.map((category) => writeCategoryIcon(category, 'level1')),
  )
  const generatedSecondary = await Promise.all(
    secondaryCategories.map((category) => writeCategoryIcon(category, 'level2')),
  )

  const manifest = {
    formatVersion: 1,
    iconfontMode: 'symbol',
    iconfontProject: {
      name: ICONFONT_PROJECT_NAME,
      symbolPrefix: ICONFONT_SYMBOL_PREFIX,
      namingPattern: 'expense-{一级英文名}[-{二级英文名}] / income-{收入英文名}',
    },
    canvas: { viewBox: '0 0 64 64', background: 'circle', glyphColor: '#FFFFFF' },
    primaryCategories: generatedPrimary,
    secondaryCategories: generatedSecondary,
  }

  await writeFile(
    join(currentDirectory, 'manifest.json'),
    `${JSON.stringify(manifest, null, 2)}\n`,
    'utf8',
  )
  await writeFile(
    join(currentDirectory, 'preview/expense-level1-catalog.svg'),
    renderCatalog(
      '支出一级分类图标',
      generatedPrimary.filter((category) => category.direction === 'EXPENSE'),
      7,
    ),
    'utf8',
  )
  await writeFile(
    join(currentDirectory, 'preview/expense-level2-catalog.svg'),
    renderCatalog('支出二级分类图标', generatedSecondary, 8),
    'utf8',
  )
  await writeFile(
    join(currentDirectory, 'preview/income-level1-catalog.svg'),
    renderCatalog(
      '收入一级分类图标',
      generatedPrimary.filter((category) => category.direction === 'INCOME'),
      5,
    ),
    'utf8',
  )

  console.log(
    `Generated ${generatedPrimary.length} level-1 and ${generatedSecondary.length} level-2 icons.`,
  )
  if (removedFiles.length > 0) {
    console.log(`Removed ${removedFiles.length} obsolete SVG files:`)
    removedFiles.forEach((file) => console.log(`- ${file}`))
  }
}

await main()
