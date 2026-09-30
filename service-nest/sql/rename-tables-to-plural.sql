-- 将早期单数表名迁移为统一的复数表名。
-- 仅针对仍使用旧表名的现有数据库执行一次；新建数据库不需要执行。

RENAME TABLE
  `user_verification_code` TO `user_verification_codes`,
  `category_icon` TO `category_icons`,
  `category_template` TO `category_templates`,
  `user_category` TO `user_categories`,
  `tag` TO `tags`,
  `transaction` TO `transactions`,
  `transaction_tag` TO `transaction_tags`;

ALTER TABLE `transaction_tags`
  RENAME COLUMN `transactionId` TO `transaction_id`,
  RENAME COLUMN `tagId` TO `tag_id`;

ALTER TABLE `category_templates`
  DROP FOREIGN KEY `fk_category_template_icon_key`,
  ADD CONSTRAINT `fk_category_templates_icon_key`
    FOREIGN KEY (`icon_key`) REFERENCES `category_icons` (`icon_key`)
    ON DELETE RESTRICT ON UPDATE RESTRICT;

ALTER TABLE `user_categories`
  DROP FOREIGN KEY `fk_user_category_icon_key`,
  ADD CONSTRAINT `fk_user_categories_icon_key`
    FOREIGN KEY (`icon_key`) REFERENCES `category_icons` (`icon_key`)
    ON DELETE RESTRICT ON UPDATE RESTRICT;
