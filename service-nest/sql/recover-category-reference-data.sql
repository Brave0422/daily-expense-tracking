-- 修复表名改为复数后，TypeORM 已创建新表、但分类基础数据仍留在旧表的情况。
-- 前提：category_icon/category_icons 和 category_template/category_templates 同时存在。
-- 在应用停止时执行；只补充新表缺失的记录，保留旧表和新表已有数据。

SET NAMES utf8mb4;

START TRANSACTION;

-- 先补图标，保证分类模板和用户分类的 icon_key 可以通过外键校验。
INSERT INTO `category_icons` (`icon_key`, `name`, `background_color`, `default_sort`)
SELECT legacy.`icon_key`, legacy.`name`, legacy.`background_color`, legacy.`default_sort`
FROM `category_icon` legacy
LEFT JOIN `category_icons` target ON target.`icon_key` = legacy.`icon_key`
WHERE target.`icon_key` IS NULL;

-- 保留模板 id 和时间，保证已有用户分类的 source_template_id 仍指向原模板。
INSERT INTO `category_templates` (
  `id`, `type`, `parent_id`, `name`, `default_sort`, `level`, `icon_key`,
  `archived_time`, `created_time`, `updated_time`
)
SELECT
  legacy.`id`, legacy.`type`, legacy.`parent_id`, legacy.`name`, legacy.`default_sort`,
  legacy.`level`, legacy.`icon_key`, legacy.`archived_time`, legacy.`created_time`, legacy.`updated_time`
FROM `category_template` legacy
LEFT JOIN `category_templates` target ON target.`id` = legacy.`id`
WHERE target.`id` IS NULL;

COMMIT;

-- 以下两个结果应为 0；若仍有缺失，先补齐对应图标再启动应用。
SELECT COUNT(*) AS `user_categories_missing_icons`
FROM `user_categories` category
LEFT JOIN `category_icons` icon ON icon.`icon_key` = category.`icon_key`
WHERE icon.`icon_key` IS NULL;

SELECT COUNT(*) AS `category_templates_missing_icons`
FROM `category_templates` template
LEFT JOIN `category_icons` icon ON icon.`icon_key` = template.`icon_key`
WHERE icon.`icon_key` IS NULL;
