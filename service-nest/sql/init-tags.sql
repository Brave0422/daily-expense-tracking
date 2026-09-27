-- @author Brave
-- @date 2026-09-27T21:36:06+08:00
-- @description 为指定用户初始化500个测试标签，用于验证标签列表、滚动和搜索交互。

SET NAMES utf8mb4;

-- 执行前请将该值修改为需要初始化标签的真实用户id。
SET @tag_owner_user_id := 1;

START TRANSACTION;

-- 通过三个0至9的数字集合生成1至500，标签名称依次为“初始化标签001”至“初始化标签500”。
-- 再次执行时跳过该用户已有的同名未归档标签；同名标签已归档时允许重新创建。
INSERT INTO `tag` (
  `owner_user_id`,
  `name`,
  `archived_time`,
  `created_time`,
  `updated_time`
)
SELECT
  @tag_owner_user_id,
  CONCAT('初始化标签', LPAD(`tag_number`.`value`, 3, '0')),
  NULL,
  CURRENT_TIMESTAMP,
  CURRENT_TIMESTAMP
FROM (
  SELECT
    (`hundreds`.`value` * 100) + (`tens`.`value` * 10) + `ones`.`value` + 1 AS `value`
  FROM
    (
      SELECT 0 AS `value` UNION ALL SELECT 1 UNION ALL SELECT 2 UNION ALL SELECT 3 UNION ALL SELECT 4
      UNION ALL SELECT 5 UNION ALL SELECT 6 UNION ALL SELECT 7 UNION ALL SELECT 8 UNION ALL SELECT 9
    ) AS `hundreds`
  CROSS JOIN
    (
      SELECT 0 AS `value` UNION ALL SELECT 1 UNION ALL SELECT 2 UNION ALL SELECT 3 UNION ALL SELECT 4
      UNION ALL SELECT 5 UNION ALL SELECT 6 UNION ALL SELECT 7 UNION ALL SELECT 8 UNION ALL SELECT 9
    ) AS `tens`
  CROSS JOIN
    (
      SELECT 0 AS `value` UNION ALL SELECT 1 UNION ALL SELECT 2 UNION ALL SELECT 3 UNION ALL SELECT 4
      UNION ALL SELECT 5 UNION ALL SELECT 6 UNION ALL SELECT 7 UNION ALL SELECT 8 UNION ALL SELECT 9
    ) AS `ones`
) AS `tag_number`
WHERE
  `tag_number`.`value` BETWEEN 1 AND 500
  AND NOT EXISTS (
    SELECT 1
    FROM `tag` AS `existing_tag`
    WHERE
      `existing_tag`.`owner_user_id` = @tag_owner_user_id
      AND `existing_tag`.`name` = CONCAT('初始化标签', LPAD(`tag_number`.`value`, 3, '0'))
      AND `existing_tag`.`archived_time` IS NULL
  )
ORDER BY `tag_number`.`value`;

SET @inserted_tag_count := ROW_COUNT();

COMMIT;

SELECT @tag_owner_user_id AS `owner_user_id`, @inserted_tag_count AS `inserted_tag_count`;
