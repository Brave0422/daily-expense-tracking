-- 开发假数据：先执行 init.sql，再执行此脚本。
-- 显式选择项目数据库，避免误用当前选中的其他数据库中的同名表。
-- 如需其他数据库，请同时修改本文件和 init.sql 中的数据库名。
-- 新建 1 个用户，复制全部 82 个默认分类，添加 50 个标签、150 条流水和 300 条流水标签关联。
-- 默认账号 demo@example.com，密码 Demo123456；密码使用与应用一致的 bcrypt（10 轮）。
-- 流水为最近 90 天内的 120 条支出、30 条收入，全部未归档，每条关联 2 个标签。
-- 会话、验证码各补充 1 条已失效的记录，使全部 9 张表都有数据。
-- 重复执行时只补充缺失的示例记录；已有同邮箱用户的密码不会被修改。

SET NAMES utf8mb4 COLLATE utf8mb4_unicode_ci;

USE `daily-expense-tracking`;

-- 可修改示例邮箱；更换密码时，需同步替换为新密码的 bcrypt 哈希。
SET @mock_email := 'demo@example.com';
SET @mock_password_hash := '$2b$10$7dlKaWpWmz8Nu/tdd0uVtui0l6P30H/FtWdYNAuWi7ptofbA.YboO';
SET @mock_today := CURRENT_DATE;
SET @mock_expired_time := DATE_SUB(CURRENT_TIMESTAMP, INTERVAL 1 DAY);

-- 临时序号表只在当前连接存在，不新增业务表，也不占用任何业务表的固定 ID。
DROP TEMPORARY TABLE IF EXISTS `mock_data_numbers`;
CREATE TEMPORARY TABLE `mock_data_numbers` (
  `number` INT NOT NULL PRIMARY KEY
);

INSERT INTO `mock_data_numbers` (`number`)
SELECT `hundreds`.`value` * 100 + `tens`.`value` * 10 + `ones`.`value` + 1
FROM (SELECT 0 AS `value` UNION ALL SELECT 1) AS `hundreds`
CROSS JOIN (
  SELECT 0 AS `value` UNION ALL SELECT 1 UNION ALL SELECT 2 UNION ALL SELECT 3 UNION ALL SELECT 4
  UNION ALL SELECT 5 UNION ALL SELECT 6 UNION ALL SELECT 7 UNION ALL SELECT 8 UNION ALL SELECT 9
) AS `tens`
CROSS JOIN (
  SELECT 0 AS `value` UNION ALL SELECT 1 UNION ALL SELECT 2 UNION ALL SELECT 3 UNION ALL SELECT 4
  UNION ALL SELECT 5 UNION ALL SELECT 6 UNION ALL SELECT 7 UNION ALL SELECT 8 UNION ALL SELECT 9
) AS `ones`
WHERE `hundreds`.`value` * 100 + `tens`.`value` * 10 + `ones`.`value` + 1 <= 150
ORDER BY 1;

START TRANSACTION;

-- 用户 ID 从实际插入后的账号记录获取，兼容数据库中已有其他用户的情况。
INSERT INTO `users` (`email`, `password_hash`)
SELECT @mock_email, @mock_password_hash
WHERE NOT EXISTS (SELECT 1 FROM `users` WHERE `email` = @mock_email);

SET @mock_user_id := (SELECT `id` FROM `users` WHERE `email` = @mock_email);

-- 先创建一级分类，再将子分类的 parent_id 映射为该用户真实的一级分类 ID。
INSERT INTO `user_categories` (
  `owner_user_id`, `source_template_id`, `type`, `parent_id`,
  `name`, `sort_order`, `level`, `icon_key`
)
SELECT
  @mock_user_id, `template`.`id`, `template`.`type`, NULL,
  `template`.`name`, `template`.`default_sort`, `template`.`level`, `template`.`icon_key`
FROM `category_templates` AS `template`
WHERE `template`.`level` = 1
  AND `template`.`archived_time` IS NULL
  AND NOT EXISTS (
    SELECT 1 FROM `user_categories` AS `existing`
    WHERE `existing`.`owner_user_id` = @mock_user_id
      AND `existing`.`source_template_id` = `template`.`id`
  )
ORDER BY `template`.`id`;

INSERT INTO `user_categories` (
  `owner_user_id`, `source_template_id`, `type`, `parent_id`,
  `name`, `sort_order`, `level`, `icon_key`
)
SELECT
  @mock_user_id, `template`.`id`, `template`.`type`, `parent`.`id`,
  `template`.`name`, `template`.`default_sort`, `template`.`level`, `template`.`icon_key`
FROM `category_templates` AS `template`
INNER JOIN `user_categories` AS `parent`
  ON `parent`.`owner_user_id` = @mock_user_id
  AND `parent`.`source_template_id` = `template`.`parent_id`
  AND `parent`.`level` = 1
WHERE `template`.`level` = 2
  AND `template`.`archived_time` IS NULL
  AND NOT EXISTS (
    SELECT 1 FROM `user_categories` AS `existing`
    WHERE `existing`.`owner_user_id` = @mock_user_id
      AND `existing`.`source_template_id` = `template`.`id`
  )
ORDER BY `template`.`id`;

-- 50 个标签，名称为“示例标签001”至“示例标签050”。
INSERT INTO `tags` (`owner_user_id`, `name`)
SELECT @mock_user_id, CONCAT('示例标签', LPAD(`sequence`.`number`, 3, '0'))
FROM `mock_data_numbers` AS `sequence`
WHERE `sequence`.`number` <= 50
  AND NOT EXISTS (
    SELECT 1 FROM `tags` AS `existing`
    WHERE `existing`.`owner_user_id` = @mock_user_id
      AND `existing`.`name` = CONCAT('示例标签', LPAD(`sequence`.`number`, 3, '0'))
  )
ORDER BY `sequence`.`number`;

-- 每 5 条流水中有 1 条收入；支出轮流使用 62 个二级分类，收入轮流使用 5 个一级分类。
-- 模板 ID 仅用于查找来源，category_id 始终写入当前用户真实的分类 ID。
INSERT INTO `transactions` (
  `owner_user_id`, `type`, `amount`, `category_id`, `title`, `remark`, `occurred`
)
SELECT
  @mock_user_id,
  `category`.`type`,
  CASE WHEN `category`.`type` = 'income'
    THEN 1000 + MOD(`sequence`.`number` * 13731, 900000) / 100
    ELSE 5 + MOD(`sequence`.`number` * 3719, 60000) / 100
  END,
  `category`.`id`,
  CONCAT(`category`.`name`, '示例', LPAD(`sequence`.`number`, 3, '0')),
  CONCAT('示例流水', LPAD(`sequence`.`number`, 3, '0')),
  DATE_SUB(@mock_today, INTERVAL MOD(`sequence`.`number` - 1, 90) DAY)
FROM `mock_data_numbers` AS `sequence`
INNER JOIN `user_categories` AS `category`
  ON `category`.`owner_user_id` = @mock_user_id
  AND `category`.`source_template_id` = CASE
    WHEN MOD(`sequence`.`number`, 5) = 0
      THEN 16 + MOD(FLOOR((`sequence`.`number` - 1) / 5), 5)
    ELSE 21 + MOD(`sequence`.`number` - 1 - FLOOR((`sequence`.`number` - 1) / 5), 62)
  END
WHERE NOT EXISTS (
  SELECT 1 FROM `transactions` AS `existing`
  WHERE `existing`.`owner_user_id` = @mock_user_id
    AND `existing`.`remark` = CONCAT('示例流水', LPAD(`sequence`.`number`, 3, '0'))
)
ORDER BY `sequence`.`number`;

-- 每条流水关联 2 个不同标签，覆盖全部 50 个标签，使用查询到的真实 ID。
INSERT INTO `transaction_tags` (`transaction_id`, `tag_id`)
SELECT `transaction`.`id`, `tag`.`id`
FROM `mock_data_numbers` AS `sequence`
INNER JOIN `transactions` AS `transaction`
  ON `transaction`.`owner_user_id` = @mock_user_id
  AND `transaction`.`remark` = CONCAT('示例流水', LPAD(`sequence`.`number`, 3, '0'))
INNER JOIN `tags` AS `tag`
  ON `tag`.`owner_user_id` = @mock_user_id
  AND `tag`.`name` IN (
    CONCAT('示例标签', LPAD(MOD(`sequence`.`number` - 1, 50) + 1, 3, '0')),
    CONCAT('示例标签', LPAD(MOD(`sequence`.`number` + 16, 50) + 1, 3, '0'))
  )
WHERE NOT EXISTS (
  SELECT 1 FROM `transaction_tags` AS `existing`
  WHERE `existing`.`transaction_id` = `transaction`.`id`
    AND `existing`.`tag_id` = `tag`.`id`
);

-- 已过期且已撤销的示例会话；refresh_token_hash 是 mock-refresh-token 的 bcrypt 哈希。
SET @mock_session_id := CONCAT('mock-session-user-', @mock_user_id);
INSERT INTO `auth_sessions` (
  `sid`, `user_id`, `refresh_token_hash`, `expires_time`, `revoked_time`
)
SELECT
  @mock_session_id, @mock_user_id,
  '$2b$10$1efpp5dtBx0gpIDI3cz2S.vIiH9h00iKzzWR.aRAlTf2Zb4UQHIFK',
  @mock_expired_time, @mock_expired_time
WHERE NOT EXISTS (SELECT 1 FROM `auth_sessions` WHERE `sid` = @mock_session_id);

-- 已过期且已消费的注册验证码，code_hash 只作为失效示例记录的占位哈希。
SET @mock_code_hash := SHA2(CONCAT(@mock_email, ':mock-consumed-code'), 256);
INSERT INTO `user_verification_codes` (
  `user_id`, `email`, `purpose`, `code_hash`, `expires_time`, `consumed_time`
)
SELECT @mock_user_id, @mock_email, 'register', @mock_code_hash, @mock_expired_time, @mock_expired_time
WHERE NOT EXISTS (
  SELECT 1 FROM `user_verification_codes`
  WHERE `user_id` = @mock_user_id AND `code_hash` = @mock_code_hash
);

COMMIT;

DROP TEMPORARY TABLE `mock_data_numbers`;

-- 在全新初始化的数据库中，结果应为：分类 82、标签 50、流水 150、关联 300、会话 1、验证码 1。
SELECT
  @mock_user_id AS `user_id`,
  @mock_email AS `email`,
  (SELECT COUNT(*) FROM `user_categories` WHERE `owner_user_id` = @mock_user_id) AS `category_count`,
  (SELECT COUNT(*) FROM `tags` WHERE `owner_user_id` = @mock_user_id) AS `tag_count`,
  (SELECT COUNT(*) FROM `transactions` WHERE `owner_user_id` = @mock_user_id) AS `transaction_count`,
  (SELECT COUNT(*) FROM `transaction_tags` AS `link`
    INNER JOIN `transactions` AS `transaction` ON `transaction`.`id` = `link`.`transaction_id`
    WHERE `transaction`.`owner_user_id` = @mock_user_id) AS `transaction_tag_count`,
  (SELECT COUNT(*) FROM `auth_sessions` WHERE `user_id` = @mock_user_id) AS `session_count`,
  (SELECT COUNT(*) FROM `user_verification_codes` WHERE `user_id` = @mock_user_id) AS `verification_code_count`;
