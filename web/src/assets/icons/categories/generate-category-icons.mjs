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
  mealFood: '#E96F51',
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
  coffee: '#B9794D',
  takeout: '#F0803C',
  alcohol: '#A16BC1',
  tobacco: '#7C8797',
  shopping: '#E9608E',
  pets: '#E99545',
  petFood: '#BF8654',
  veterinary: '#E5687C',
  babyCare: '#EB83AD',
  toys: '#EDA42F',
  fitness: '#4B96CF',
  music: '#8465D7',
  dental: '#43AEB9',
  glasses: '#5879C7',
  cosmetics: '#D65E9A',
  jewelry: '#A56BDB',
  fuel: '#4A85D0',
  carMaintenance: '#607F99',
  carWash: '#36A5CB',
  toll: '#5578BC',
  hotel: '#3FAE72',
  luggage: '#40977F',
  camping: '#5A9E57',
  laundry: '#39AD98',
  homeAppliance: '#43A19D',
  homeRepair: '#D28A37',
  expressDelivery: '#DE7840',
  insurance: '#5077BE',
}

const CUSTOM_GLYPHS = {
  tableware:
    '<path fill="#fff" d="M4 2h2v6h2V2h2v7a3 3 0 0 1-2 2.8V22H6V11.8A3 3 0 0 1 4 9V2Zm13 0c1.7 0 3 2.7 3 6v5h-2v9h-2v-9h-2V8c0-3.3 1.3-6 3-6Zm0 3c-.4.7-1 1.9-1 3v3h2V8c0-1.1-.6-2.3-1-3Z" fill-rule="evenodd"/>',
  groceryBag:
    '<path fill="#fff" d="M9 7V5a3 3 0 1 1 6 0v2h3l2 15H4L6 7h3Zm2 0h2V5a1 1 0 1 0-2 0v2Zm1 3c-2.2 0-4 1.8-4 4 0 3 4 5 4 5s4-2 4-5c0-2.2-1.8-4-4-4Zm0 2a2 2 0 0 1 2 2c0 1.1-1.1 2.1-2 2.7-.9-.6-2-1.6-2-2.7a2 2 0 0 1 2-2Z" fill-rule="evenodd"/>',
  hanger:
    '<path fill="#fff" d="M12 2a4 4 0 0 1 4 4c0 2.3-1.3 3.4-2.5 4.3-.4.3-.7.6-.9.9l9.4 6.3V21H2v-3.5l9-6.3V9.8l.9-.6c1.3-.9 2.1-1.5 2.1-3.2a2 2 0 1 0-4 0H8a4 4 0 0 1 4-4Zm0 11-7.4 5.2v.8h14.8v-.8L12 13Z" fill-rule="evenodd"/>',
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
  coffee:
    '<path fill="#fff" d="M4 7h13v2h1.5a4.5 4.5 0 0 1 0 9H17v1a3 3 0 0 1-3 3H7a3 3 0 0 1-3-3V7Zm3-5h2v3H7V2Zm5 0h2v3h-2V2ZM7 10v9h7v-9H7Zm10 2v3h1.5a1.5 1.5 0 0 0 0-3H17Z" fill-rule="evenodd"/>',
  takeout:
    '<path fill="#fff" d="m5 3 2.2 4H4l2 15h12l2-15h-3.2L19 3h-2.3l-2.2 4h-5L7.3 3H5Zm2.4 7h9.2l-1.2 9H8.6l-1.2-9Zm2.1 2h5l-.3 2h-4.4l-.3-2Zm.6 4h3.8l-.3 2h-3.2l-.3-2Z" fill-rule="evenodd"/>',
  tobacco:
    '<path fill="#fff" d="M3 13h13v6H3v-6Zm2 2v2h7v-2H5Zm13-2h3v6h-3v-6ZM15 3c0 1.5.7 2.2 1.5 3 .8.8 1.5 1.7 1.5 3h-2c0-.6-.4-1.1-1-1.7-1-.9-2-2.1-2-4.3h2Zm4 0c0 .8.3 1.2.9 1.8.8.8 1.6 1.7 1.6 3.2h-2c0-.7-.4-1.2-1-1.8C17.8 5.4 17 4.4 17 3h2Z"/>',
  petFood:
    '<path fill="#fff" d="M4 11h16l-1.2 7.2A4.6 4.6 0 0 1 14.3 22H9.7a4.6 4.6 0 0 1-4.5-3.8L4 11Zm3 3 .6 3.8A2.1 2.1 0 0 0 9.7 20h4.6a2.1 2.1 0 0 0 2.1-2.2L17 14H7Zm1-9a2 2 0 1 1 3.4 1.4l-.7.6.7.6A2 2 0 1 1 8 9l-.6-.7-.6.7a2 2 0 1 1-1.4-3.4l.6.7.6-.7A2 2 0 0 1 8 5Z" fill-rule="evenodd"/>',
  veterinary:
    '<path fill="#fff" d="M7 2a2.5 2.5 0 1 1 0 5 2.5 2.5 0 0 1 0-5Zm10 0a2.5 2.5 0 1 1 0 5 2.5 2.5 0 0 1 0-5ZM3.5 7a2.5 2.5 0 1 1 0 5 2.5 2.5 0 0 1 0-5Zm17 0a2.5 2.5 0 1 1 0 5 2.5 2.5 0 0 1 0-5ZM12 8c4 0 7 3.7 7 7.3 0 3.7-3 6.7-7 6.7s-7-3-7-6.7C5 11.7 8 8 12 8Zm-1.2 3v2.8H8v2.4h2.8V19h2.4v-2.8H16v-2.4h-2.8V11h-2.4Z" fill-rule="evenodd"/>',
  babyCare:
    '<path fill="#fff" d="M9 2h6v3l2 2v2.2a5 5 0 0 1 3 4.6V22H4v-8.2a5 5 0 0 1 3-4.6V7l2-2V2Zm2 2v2L9 8v1h6V8l-2-2V4h-2Zm-4 9v6h10v-6a2 2 0 0 0-2-2H9a2 2 0 0 0-2 2Zm3 1h4v2h-4v-2Z" fill-rule="evenodd"/>',
  toys:
    '<path fill="#fff" d="M3 3h8v8H3V3Zm2 2v4h4V5H5Zm8-2h8v8h-8V3Zm2 2v4h4V5h-4ZM3 13h8v8H3v-8Zm2 2v4h4v-4H5Zm8-2h8v8h-8v-8Zm4 2.2L15.2 19h3.6L17 15.2Z" fill-rule="evenodd"/>',
  fitness:
    '<path fill="#fff" d="M2 9h2V6h3v3h10V6h3v3h2v6h-2v3h-3v-3H7v3H4v-3H2V9Zm5 2v2h10v-2H7Z" fill-rule="evenodd"/>',
  dental:
    '<path fill="#fff" d="M7.4 2C5 2 3 4.2 3 7c0 2 .7 3.6 1.5 5.2.8 1.7 1.5 3.4 1.5 5.8 0 2.3 1.3 4 3 4 1.8 0 2.4-1.8 3-4 .6 2.2 1.2 4 3 4 1.7 0 3-1.7 3-4 0-2.4.7-4.1 1.5-5.8C20.3 10.6 21 9 21 7c0-2.8-2-5-4.4-5-1.3 0-2.2.5-3 .9-.6.3-1 .5-1.6.5s-1-.2-1.6-.5C9.6 2.5 8.7 2 7.4 2Zm0 3c.6 0 1 .2 1.7.5.8.4 1.7.9 2.9.9s2.1-.5 2.9-.9c.7-.3 1.1-.5 1.7-.5.7 0 1.4.8 1.4 2 0 1.3-.5 2.5-1.2 4-.9 1.9-1.8 4.1-1.8 7 0 .4-.1.7-.1.9-.2-.5-.4-1.2-.6-1.8-.5-1.9-1.1-4.1-2.3-4.1s-1.8 2.2-2.3 4.1c-.2.6-.4 1.3-.6 1.8 0-.2-.1-.5-.1-.9 0-2.9-.9-5.1-1.8-7C6.5 9.5 6 8.3 6 7c0-1.2.7-2 1.4-2Z" fill-rule="evenodd"/>',
  glasses:
    '<path fill="#fff" d="m4.3 6 2.2 1.1-.8 1.7A6 6 0 0 1 12 11a6 6 0 0 1 6.3-2.2l-.8-1.7L19.7 6 23 13.1V15h-2.1a5 5 0 0 1-9.4 1.2A5 5 0 0 1 2.1 15H0v-1.9L3.3 6h1Zm2.2 5A2.5 2.5 0 1 0 9 13.5 2.5 2.5 0 0 0 6.5 11Zm11 0a2.5 2.5 0 1 0 2.5 2.5 2.5 2.5 0 0 0-2.5-2.5Z" fill-rule="evenodd"/>',
  cosmetics:
    '<path fill="#fff" d="M10 2h6v7l3 3v10H7V12l3-3V2Zm2 2v4h2V4h-2Zm-.6 6L9 12.4V14h8v-1.6L14.6 10h-3.2ZM9 16v4h8v-4H9Z" fill-rule="evenodd"/>',
  jewelry:
    '<path fill="#fff" d="m8 2-4 5 8 7 8-7-4-5H8Zm1 2h6l1.6 2H7.4L9 4Zm3 7L7.7 8h8.6L12 11Zm0 3a5 5 0 1 1-5 5H4a8 8 0 1 0 16 0h-3a5 5 0 0 1-5 5 5 5 0 0 1 0-10Z" fill-rule="evenodd"/>',
  fuel:
    '<path fill="#fff" d="M4 2h11v20H3V4a2 2 0 0 1 1-2Zm2 3v5h6V5H6Zm0 8v6h6v-6H6Zm11-8 4 4v9a1 1 0 0 0 2 0v-5h-2v-2h2V8.8l-2-2V8h-2V5h-2Z" fill-rule="evenodd"/>',
  carMaintenance:
    '<path fill="#fff" d="m5 5 2-3 2 1-1.2 1.8L10 7l1.8-1.2 1.4 1.4L12 9l2.2 2.2L16 10l1.4 1.4-1.2 1.8 2.1 2.1L20 14l2 2-3 3-2-2 1.3-1.7-2.1-2.1-1.8 1.2L13 13l1.2-1.8L12 9 10.2 10 9 8.8l1-1.8-2.2-2.2L6 6 5 5ZM3 13h8l3 4h3v4H2v-6a2 2 0 0 1 1-2Zm1 3v2h8.3l-1.5-2H4Z" fill-rule="evenodd"/>',
  carWash:
    '<path fill="#fff" d="M6 2s2 2.2 2 3.5a2 2 0 1 1-4 0C4 4.2 6 2 6 2Zm6 0s2 2.2 2 3.5a2 2 0 1 1-4 0C10 4.2 12 2 12 2Zm6 0s2 2.2 2 3.5a2 2 0 1 1-4 0C16 4.2 18 2 18 2ZM5 10h14l3 5v6h-3v-2H5v2H2v-6l3-5Zm1.7 3-1.2 2h13l-1.2-2H6.7ZM6 16.5A1.5 1.5 0 1 0 6 19a1.5 1.5 0 0 0 0-3Zm12 0a1.5 1.5 0 1 0 0 3 1.5 1.5 0 0 0 0-3Z" fill-rule="evenodd"/>',
  toll:
    '<path fill="#fff" d="M2 3h20v4H2V3Zm2 6h7v13H4V9Zm2 3v3h3v-3H6Zm8-3h6v13h-3v-5h-3V9Zm0 3v2h3v-2h-3ZM1 20h22v2H1v-2Z" fill-rule="evenodd"/>',
  hotel:
    '<path fill="#fff" d="M3 3h3v9h5V7h6a4 4 0 0 1 4 4v11h-3v-3H6v3H3V3Zm11 7v2h4v-1a1 1 0 0 0-1-1h-3ZM6 15v2h12v-2H6Z" fill-rule="evenodd"/>',
  luggage:
    '<path fill="#fff" d="M9 2h6a2 2 0 0 1 2 2v2h3a2 2 0 0 1 2 2v11a2 2 0 0 1-2 2v1h-3v-1H7v1H4v-1a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h3V4a2 2 0 0 1 2-2Zm1 3v1h4V5h-4ZM5 9v9h2V9H5Zm5 0v9h4V9h-4Zm7 0v9h2V9h-2Z" fill-rule="evenodd"/>',
  camping:
    '<path fill="#fff" d="m12 2 10 19h-8l-2-4-2 4H2L12 2Zm0 6.4L7 18h1.2l3.8-7.6 3.8 7.6H17l-5-9.6Z" fill-rule="evenodd"/>',
  laundry:
    '<path fill="#fff" d="M4 2h16a2 2 0 0 1 2 2v18H2V4a2 2 0 0 1 2-2Zm1 3v3h14V5H5Zm7 5a5 5 0 1 0 0 10 5 5 0 0 0 0-10Zm0 2a3 3 0 0 1 2.8 2H9.2a3 3 0 0 1 2.8-2Zm-3 4h6a3 3 0 0 1-6 0ZM6 6h2v1H6V6Zm4 0h2v1h-2V6Z" fill-rule="evenodd"/>',
  homeAppliance:
    '<path fill="#fff" d="M6 2h12a2 2 0 0 1 2 2v18H4V4a2 2 0 0 1 2-2Zm1 3v6h10V5H7Zm0 9v5h10v-5H7Zm2-7h2v2H9V7Zm0 9h2v2H9v-2Z" fill-rule="evenodd"/>',
  homeRepair:
    '<path fill="#fff" d="M3 3h13a3 3 0 0 1 3 3v4h-6V8h3V6a1 1 0 0 0-1-1H3v5H1V5a2 2 0 0 1 2-2Zm7 5h3v5h-1v9H8v-9H7v-3h3V8Zm0 7v5h1v-5h-1Z" fill-rule="evenodd"/>',
  insurance:
    '<path fill="#fff" d="M12 2 21 6v6c0 5.2-3.3 8.7-9 10-5.7-1.3-9-4.8-9-10V6l9-4Zm0 3.3L6 8v4c0 3.6 2 5.9 6 7 4-1.1 6-3.4 6-7V8l-6-2.7Zm3.6 4.3 1.8 1.8-6.3 6.3-3.8-3.8 1.8-1.8 2 2 4.5-4.5Z" fill-rule="evenodd"/>',
}

const primaryCategories = [
  ['meals', '三餐', 'EXPENSE', PALETTES.meals, null, 'tableware'],
  ['meal-food', '正餐食品', 'EXPENSE', PALETTES.mealFood, null, 'groceryBag'],
  ['snacks-drinks', '零食饮品', 'EXPENSE', PALETTES.snacks, 'hamburger'],
  ['entertainment', '休闲娱乐', 'EXPENSE', PALETTES.entertainment, 'play-circle'],
  ['household', '日用家居', 'EXPENSE', PALETTES.household, 'home'],
  ['clothing', '服饰穿搭', 'EXPENSE', PALETTES.clothing, null, 'hanger'],
  ['personal-care', '个人护理', 'EXPENSE', PALETTES.personalCare, 'mirror'],
  ['housing', '住房', 'EXPENSE', PALETTES.housing, 'houses'],
  ['digital', '数码产品', 'EXPENSE', PALETTES.digital, 'device'],
  ['transport', '交通出行', 'EXPENSE', PALETTES.transport, 'map-route-planning'],
  ['communication', '通讯网络', 'EXPENSE', PALETTES.communication, 'chat-double'],
  ['medical', '医疗健康', 'EXPENSE', PALETTES.medical, 'hospital-1'],
  ['education', '学习教育', 'EXPENSE', PALETTES.education, 'education'],
  ['digital-services', '数字服务', 'EXPENSE', PALETTES.digitalServices, 'cloud'],
  ['social', '人情往来', 'EXPENSE', PALETTES.social, 'usergroup-circle'],
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
    ],
  ],
  [
    'meal-food',
    [
      ['staple-food', '基础食品', 'corn'],
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
      ['home-furnishing', '家居用品', 'lightbulb'],
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
      ['network-service', '网络服务', 'internet'],
    ],
  ],
  [
    'social',
    [
      ['family-support', '孝亲支出', 'heart'],
      ['red-packet', '红包礼金', null, 'envelope'],
      ['donation', '捐赠', 'undertake'],
      ['gifts', '礼物', 'gift'],
    ],
  ],
]

const generalIcons = [
  ['coffee', '咖啡', 'food', PALETTES.coffee, null, 'coffee'],
  ['takeout', '外卖', 'food', PALETTES.takeout, null, 'takeout'],
  ['alcohol', '酒水', 'food', PALETTES.alcohol, 'beer'],
  ['tobacco', '烟草', 'lifestyle', PALETTES.tobacco, null, 'tobacco'],
  ['shopping', '购物', 'lifestyle', PALETTES.shopping, 'cart'],
  ['pets', '宠物', 'family', PALETTES.pets, 'cat'],
  ['pet-food', '宠物食品', 'family', PALETTES.petFood, null, 'petFood'],
  ['veterinary', '宠物医疗', 'family', PALETTES.veterinary, null, 'veterinary'],
  ['baby-care', '母婴', 'family', PALETTES.babyCare, null, 'babyCare'],
  ['toys', '玩具', 'family', PALETTES.toys, null, 'toys'],
  ['fitness', '健身', 'health', PALETTES.fitness, null, 'fitness'],
  ['music', '音乐娱乐', 'entertainment', PALETTES.music, 'music'],
  ['dental', '牙科', 'health', PALETTES.dental, null, 'dental'],
  ['glasses', '眼镜', 'health', PALETTES.glasses, null, 'glasses'],
  ['cosmetics', '美妆', 'personal', PALETTES.cosmetics, null, 'cosmetics'],
  ['jewelry', '珠宝首饰', 'personal', PALETTES.jewelry, null, 'jewelry'],
  ['fuel', '汽车加油', 'vehicle', PALETTES.fuel, null, 'fuel'],
  [
    'car-maintenance',
    '汽车保养',
    'vehicle',
    PALETTES.carMaintenance,
    null,
    'carMaintenance',
  ],
  ['car-wash', '洗车', 'vehicle', PALETTES.carWash, null, 'carWash'],
  ['toll', '高速过路费', 'vehicle', PALETTES.toll, null, 'toll'],
  ['hotel', '酒店住宿', 'travel', PALETTES.hotel, null, 'hotel'],
  ['luggage', '旅行行李', 'travel', PALETTES.luggage, null, 'luggage'],
  ['camping', '露营', 'travel', PALETTES.camping, null, 'camping'],
  ['laundry', '洗衣', 'household', PALETTES.laundry, null, 'laundry'],
  [
    'home-appliance',
    '家用电器',
    'household',
    PALETTES.homeAppliance,
    null,
    'homeAppliance',
  ],
  ['home-repair', '装修维修', 'household', PALETTES.homeRepair, null, 'homeRepair'],
  [
    'express-delivery',
    '快递物流',
    'service',
    PALETTES.expressDelivery,
    'undertake-delivery',
  ],
  ['insurance', '保险', 'service', PALETTES.insurance, null, 'insurance'],
].map(([id, label, group, color, source, custom], index) => ({
  id,
  label,
  group,
  color,
  source,
  custom,
  sortOrder: index,
  isGeneral: true,
}))

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
  if (category.isGeneral) {
    return `category-${category.id}`
  }
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
  <path fill="var(--category-icon-background, ${category.color})" d="M32 2a30 30 0 1 1 0 60 30 30 0 1 1 0-60Z"/>
  <g transform="translate(17 17) scale(1.25)">${glyph}</g>
</svg>
`
}

function assertUniqueGlyphs(resolvedCategories) {
  const categoryByGlyph = new Map()

  for (const { category, glyph } of resolvedCategories) {
    const existingCategory = categoryByGlyph.get(glyph)
    if (existingCategory) {
      throw new Error(`Duplicate category glyph: ${existingCategory.label} and ${category.label}`)
    }
    categoryByGlyph.set(glyph, category)
  }
}

async function resolveCategoryGlyphs(categories) {
  return Promise.all(
    categories.map(async (category) => ({ category, glyph: await resolveGlyph(category) })),
  )
}

async function writeCategoryIcon(resolvedCategory, directory) {
  const { category, glyph } = resolvedCategory
  const iconfontName = getIconfontName(category)
  const fileName = `${iconfontName}.svg`
  const relativePath = `${directory}/${fileName}`
  await writeFile(join(currentDirectory, relativePath), renderIconSvg(category, glyph), 'utf8')
  return {
    id: category.id,
    label: category.label,
    ...(category.group ? { group: category.group } : {}),
    ...(category.sortOrder !== undefined ? { sortOrder: category.sortOrder } : {}),
    ...(category.parentId
      ? { parentId: category.parentId, parentLabel: category.parentLabel }
      : {}),
    ...(category.direction ? { direction: category.direction } : {}),
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
        ? `\n      <text x="${x + cellWidth / 2}" y="${y + 104}" fill="#8A94A6" font-size="11" text-anchor="middle">${escapeXml(item.parentLabel)}</text>`
        : ''
      return `<g>
      <rect x="${x + 8}" y="${y}" width="${cellWidth - 16}" height="${cellHeight - 10}" rx="18" fill="#F7F8FA"/>
      <image href="../${item.file}" x="${x + 40}" y="${y + 10}" width="56" height="56"/>
      <text x="${x + cellWidth / 2}" y="${y + 86}" fill="#1F2937" font-size="14" font-weight="600" text-anchor="middle">${escapeXml(item.label)}</text>${parent}
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
  const [resolvedPrimary, resolvedSecondary, resolvedGeneral] = await Promise.all([
    resolveCategoryGlyphs(primaryCategories),
    resolveCategoryGlyphs(secondaryCategories),
    resolveCategoryGlyphs(generalIcons),
  ])
  assertUniqueGlyphs([...resolvedPrimary, ...resolvedSecondary, ...resolvedGeneral])

  const expectedLevel1Files = new Set(
    primaryCategories.map((category) => `${getIconfontName(category)}.svg`),
  )
  const expectedLevel2Files = new Set(
    secondaryCategories.map((category) => `${getIconfontName(category)}.svg`),
  )
  const expectedGeneralFiles = new Set(
    generalIcons.map((category) => `${getIconfontName(category)}.svg`),
  )
  const expectedPreviewFiles = new Set([
    'expense-level1-catalog.svg',
    'expense-level2-catalog.svg',
    'general-catalog.svg',
    'income-level1-catalog.svg',
  ])
  const removedFiles = (
    await Promise.all([
      pruneSvgDirectory('level1', expectedLevel1Files),
      pruneSvgDirectory('level2', expectedLevel2Files),
      pruneSvgDirectory('general', expectedGeneralFiles),
      pruneSvgDirectory('preview', expectedPreviewFiles),
    ])
  ).flat()

  const generatedPrimary = await Promise.all(
    resolvedPrimary.map((category) => writeCategoryIcon(category, 'level1')),
  )
  const generatedSecondary = await Promise.all(
    resolvedSecondary.map((category) => writeCategoryIcon(category, 'level2')),
  )
  const generatedGeneral = await Promise.all(
    resolvedGeneral.map((category) => writeCategoryIcon(category, 'general')),
  )

  const manifest = {
    formatVersion: 2,
    iconfontMode: 'symbol',
    iconfontProject: {
      name: ICONFONT_PROJECT_NAME,
      symbolPrefix: ICONFONT_SYMBOL_PREFIX,
      namingPattern:
        'expense-{一级英文名}[-{二级英文名}] / income-{收入英文名} / category-{通用图标英文名}',
    },
    canvas: {
      viewBox: '0 0 64 64',
      background: 'circle',
      backgroundColorVariable: '--category-icon-background',
      glyphColor: '#FFFFFF',
    },
    primaryCategories: generatedPrimary,
    secondaryCategories: generatedSecondary,
    generalIcons: generatedGeneral,
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
  await writeFile(
    join(currentDirectory, 'preview/general-catalog.svg'),
    renderCatalog('通用预选图标', generatedGeneral, 7),
    'utf8',
  )

  console.log(
    `Generated ${generatedPrimary.length} level-1, ${generatedSecondary.length} level-2, and ${generatedGeneral.length} general icons.`,
  )
  if (removedFiles.length > 0) {
    console.log(`Removed ${removedFiles.length} obsolete SVG files:`)
    removedFiles.forEach((file) => console.log(`- ${file}`))
  }
}

await main()
