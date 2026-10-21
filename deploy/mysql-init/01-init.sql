-- 初始化项目数据库、全部 9 张业务表和分类基础数据。
-- 默认数据库 daily-expense-tracking，与当前 .env.development 的 DB_DATABASE 一致。
-- 如需其他数据库，请同时修改本文件和 mock-data.sql 中的数据库名。
-- 适用于 MySQL 8.0；表结构、列名、时间精度、索引和外键与当前 TypeORM 实体保持一致。
-- 分类图标 112 个，默认分类模板 84 个（一级 20 个、二级 64 个）。
-- 建表使用 IF NOT EXISTS，基础数据按主键更新；不清空已有用户数据，也不迁移旧表结构。
-- 假数据请在此脚本之后单独执行 mock-data.sql。

SET NAMES utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE DATABASE IF NOT EXISTS `daily-expense-tracking`
  DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
USE `daily-expense-tracking`;

-- 用户。
CREATE TABLE IF NOT EXISTS `users` (
  `id` int NOT NULL AUTO_INCREMENT,
  `email` varchar(100) NOT NULL,
  `password_hash` varchar(255) NOT NULL,
  `created_time` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
  `update_time` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
  UNIQUE INDEX `IDX_97672ac88f789774dd47f7c8be` (`email`),
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 登录会话。
CREATE TABLE IF NOT EXISTS `auth_sessions` (
  `id` int NOT NULL AUTO_INCREMENT,
  `sid` varchar(255) NOT NULL,
  `user_id` int NOT NULL,
  `refresh_token_hash` varchar(255) NOT NULL,
  `expires_time` datetime NOT NULL,
  `revoked_time` datetime NULL,
  `created_time` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
  UNIQUE INDEX `IDX_345526d65dffbf56777e9a0e18` (`sid`),
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 用户验证码。
CREATE TABLE IF NOT EXISTS `user_verification_codes` (
  `id` int NOT NULL AUTO_INCREMENT,
  `user_id` int NULL,
  `email` varchar(100) NOT NULL,
  `purpose` varchar(45) NOT NULL,
  `code_hash` varchar(64) NOT NULL,
  `expires_time` datetime NOT NULL,
  `consumed_time` datetime NULL,
  `invalidated_time` datetime NULL,
  `created_time` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 分类图标库。
CREATE TABLE IF NOT EXISTS `category_icons` (
  `icon_key` varchar(100) NOT NULL,
  `name` varchar(50) NOT NULL,
  `background_color` char(7) NOT NULL,
  `default_sort` int NOT NULL,
  PRIMARY KEY (`icon_key`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 默认分类模板。
CREATE TABLE IF NOT EXISTS `category_templates` (
  `id` int NOT NULL AUTO_INCREMENT,
  `type` varchar(255) NOT NULL,
  `parent_id` int NULL,
  `name` varchar(50) NOT NULL,
  `default_sort` int NOT NULL,
  `level` int NOT NULL,
  `icon_key` varchar(100) NOT NULL,
  `archived_time` datetime NULL,
  `created_time` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
  `updated_time` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
  CONSTRAINT `fk_category_templates_icon_key` FOREIGN KEY (`icon_key`) REFERENCES `category_icons` (`icon_key`) ON DELETE RESTRICT ON UPDATE RESTRICT,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 用户分类。
CREATE TABLE IF NOT EXISTS `user_categories` (
  `id` int NOT NULL AUTO_INCREMENT,
  `owner_user_id` int NOT NULL,
  `source_template_id` int NULL,
  `type` varchar(20) NOT NULL,
  `parent_id` int NULL,
  `name` varchar(50) NOT NULL,
  `sort_order` int NOT NULL,
  `level` int NOT NULL,
  `icon_key` varchar(100) NOT NULL,
  `archived_time` datetime NULL,
  `created_time` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
  `updated_time` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
  CONSTRAINT `FK_0db1b8f5d81633f2f9c92a86b60` FOREIGN KEY (`parent_id`) REFERENCES `user_categories` (`id`) ON DELETE RESTRICT ON UPDATE RESTRICT,
  CONSTRAINT `FK_2fc9318443339b4eb0149f5d109` FOREIGN KEY (`icon_key`) REFERENCES `category_icons` (`icon_key`) ON DELETE RESTRICT ON UPDATE RESTRICT,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 用户标签。
CREATE TABLE IF NOT EXISTS `tags` (
  `id` int NOT NULL AUTO_INCREMENT,
  `owner_user_id` int NOT NULL,
  `name` varchar(50) NOT NULL,
  `archived_time` datetime NULL,
  `created_time` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
  `updated_time` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 用户流水。
CREATE TABLE IF NOT EXISTS `transactions` (
  `id` int NOT NULL AUTO_INCREMENT,
  `owner_user_id` int NOT NULL,
  `type` varchar(20) NOT NULL,
  `amount` decimal(15,2) NOT NULL,
  `category_id` int NOT NULL,
  `title` varchar(50) NULL,
  `remark` varchar(100) NULL,
  `occurred` date NOT NULL,
  `archived_time` datetime NULL,
  `created_time` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
  `updated_time` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
  CONSTRAINT `FK_c8a60a73c96ea66c86a168de863` FOREIGN KEY (`owner_user_id`) REFERENCES `users` (`id`) ON DELETE NO ACTION ON UPDATE NO ACTION,
  CONSTRAINT `FK_c9e41213ca42d50132ed7ab2b0f` FOREIGN KEY (`category_id`) REFERENCES `user_categories` (`id`) ON DELETE NO ACTION ON UPDATE NO ACTION,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 流水标签关联。
CREATE TABLE IF NOT EXISTS `transaction_tags` (
  `transaction_id` int NOT NULL,
  `tag_id` int NOT NULL,
  CONSTRAINT `FK_6a8b1add6b564b10240a9b930bc` FOREIGN KEY (`transaction_id`) REFERENCES `transactions` (`id`) ON DELETE NO ACTION ON UPDATE NO ACTION,
  CONSTRAINT `FK_319b507343ce97b2873641bfe54` FOREIGN KEY (`tag_id`) REFERENCES `tags` (`id`) ON DELETE NO ACTION ON UPDATE NO ACTION,
  PRIMARY KEY (`transaction_id`, `tag_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 初始化应用注册、分类选择所需的基础数据。
START TRANSACTION;

-- 分类图标库初始化数据。
-- 数据来源：web/src/assets/icons/categories/manifest.json。
-- default_sort 按 manifest 中一级分类、二级分类、通用图标的声明顺序从 0 连续编号。

-- 默认一级分类图标：支出 15 个，收入 5 个。
INSERT INTO `category_icons` (`icon_key`, `name`, `background_color`, `default_sort`)
VALUES
  ('icon-expense-meals', '三餐', '#FF873D', 0),
  ('icon-expense-meal-food', '正餐食品', '#E96F51', 1),
  ('icon-expense-snacks-drinks', '零食饮品', '#F2A82F', 2),
  ('icon-expense-entertainment', '休闲娱乐', '#8A63E8', 3),
  ('icon-expense-household', '日用家居', '#35B99D', 4),
  ('icon-expense-clothing', '服饰穿搭', '#EC6683', 5),
  ('icon-expense-personal-care', '个人护理', '#DC65A0', 6),
  ('icon-expense-housing', '住房', '#3EBB70', 7),
  ('icon-expense-digital', '数码产品', '#4F8BE8', 8),
  ('icon-expense-transport', '交通出行', '#3290DF', 9),
  ('icon-expense-communication', '通讯网络', '#6674D9', 10),
  ('icon-expense-medical', '医疗健康', '#EB6076', 11),
  ('icon-expense-education', '学习教育', '#D59419', 12),
  ('icon-expense-digital-services', '数字服务', '#5368D8', 13),
  ('icon-expense-social', '人情往来', '#EF5B7A', 14),
  ('icon-income-salary', '工资', '#29AD68', 15),
  ('icon-income-bonus', '奖金', '#36B577', 16),
  ('icon-income-side-business', '兼职副业', '#2EA982', 17),
  ('icon-income-investment', '投资收益', '#25A1A1', 18),
  ('icon-income-secondhand-sale', '二手出售', '#45AA6F', 19)
ON DUPLICATE KEY UPDATE
  `name` = VALUES(`name`),
  `background_color` = VALUES(`background_color`),
  `default_sort` = VALUES(`default_sort`);

-- 默认二级分类图标：仅支出分类拥有二级分类，共 64 个。
INSERT INTO `category_icons` (`icon_key`, `name`, `background_color`, `default_sort`)
VALUES
  ('icon-expense-meals-breakfast', '早餐', '#FF873D', 20),
  ('icon-expense-meals-lunch', '午餐', '#FF873D', 21),
  ('icon-expense-meals-dinner', '晚餐', '#FF873D', 22),
  ('icon-expense-meals-groceries', '买菜食材', '#FF873D', 23),
  ('icon-expense-meal-food-staple-food', '基础食品', '#E96F51', 24),
  ('icon-expense-meal-food-daily-fruit', '日常水果', '#E96F51', 25),
  ('icon-expense-meal-food-instant-food', '方便速食', '#E96F51', 26),
  ('icon-expense-snacks-drinks-leisure-snacks', '休闲零食', '#F2A82F', 27),
  ('icon-expense-snacks-drinks-cooked-snacks', '小吃熟食', '#F2A82F', 28),
  ('icon-expense-snacks-drinks-beverages', '饮料茶饮', '#F2A82F', 29),
  ('icon-expense-snacks-drinks-desserts-bakery', '甜品烘焙', '#F2A82F', 30),
  ('icon-expense-entertainment-games', '游戏', '#8A63E8', 31),
  ('icon-expense-entertainment-tickets', '门票', '#8A63E8', 32),
  ('icon-expense-entertainment-movies', '电影', '#8A63E8', 33),
  ('icon-expense-household-personal-cleaning', '个人清洁', '#35B99D', 34),
  ('icon-expense-household-home-cleaning', '家居清洁', '#35B99D', 35),
  ('icon-expense-household-paper-consumables', '纸品耗材', '#35B99D', 36),
  ('icon-expense-household-kitchen', '厨房用品', '#35B99D', 37),
  ('icon-expense-household-home-furnishing', '家居用品', '#35B99D', 38),
  ('icon-expense-household-other-daily', '其他日用', '#35B99D', 39),
  ('icon-expense-clothing-tops', '上衣', '#EC6683', 40),
  ('icon-expense-clothing-bottoms', '下装', '#EC6683', 41),
  ('icon-expense-clothing-shoes', '鞋子', '#EC6683', 42),
  ('icon-expense-clothing-underwear-socks', '内衣袜子', '#EC6683', 43),
  ('icon-expense-personal-care-haircut', '理发', '#DC65A0', 44),
  ('icon-expense-personal-care-skincare', '护肤品', '#DC65A0', 45),
  ('icon-expense-personal-care-medical-beauty', '医疗美容', '#DC65A0', 46),
  ('icon-expense-housing-rent', '房租', '#3EBB70', 47),
  ('icon-expense-housing-water', '水费', '#3EBB70', 48),
  ('icon-expense-housing-electricity', '电费', '#3EBB70', 49),
  ('icon-expense-housing-gas', '燃气费', '#3EBB70', 50),
  ('icon-expense-housing-mortgage', '房贷', '#3EBB70', 51),
  ('icon-expense-housing-property-fee', '物业费', '#3EBB70', 52),
  ('icon-expense-digital-phone', '手机平板', '#4F8BE8', 53),
  ('icon-expense-digital-computer', '电脑', '#4F8BE8', 54),
  ('icon-expense-digital-digital-accessories', '数码配件', '#4F8BE8', 55),
  ('icon-expense-digital-digital-repair', '数码维修', '#4F8BE8', 56),
  ('icon-expense-transport-public-transit', '公交地铁', '#3290DF', 57),
  ('icon-expense-transport-taxi', '打车', '#3290DF', 58),
  ('icon-expense-transport-shared-bike', '共享单车', '#3290DF', 59),
  ('icon-expense-transport-train', '火车', '#3290DF', 60),
  ('icon-expense-transport-high-speed-rail', '高铁', '#3290DF', 61),
  ('icon-expense-transport-flight', '飞机', '#3290DF', 62),
  ('icon-expense-transport-cruise', '游轮', '#3290DF', 63),
  ('icon-expense-transport-parking', '停车', '#3290DF', 64),
  ('icon-expense-communication-phone-bill', '手机话费', '#6674D9', 65),
  ('icon-expense-communication-mobile-data', '流量费', '#6674D9', 66),
  ('icon-expense-communication-broadband', '宽带费', '#6674D9', 67),
  ('icon-expense-medical-medicine', '药品', '#EB6076', 68),
  ('icon-expense-medical-doctor', '就诊', '#EB6076', 69),
  ('icon-expense-medical-examination', '检查', '#EB6076', 70),
  ('icon-expense-education-books', '书籍资料', '#D59419', 71),
  ('icon-expense-education-exam-certification', '考试认证', '#D59419', 72),
  ('icon-expense-education-course-training', '课程培训', '#D59419', 73),
  ('icon-expense-education-tuition', '学费', '#D59419', 74),
  ('icon-expense-education-study-supplies', '学习用品', '#D59419', 75),
  ('icon-expense-digital-services-software-subscription', '软件订阅', '#5368D8', 76),
  ('icon-expense-digital-services-cloud-server', '云服务器', '#5368D8', 77),
  ('icon-expense-digital-services-cloud-storage', '云存储', '#5368D8', 78),
  ('icon-expense-digital-services-network-service', '网络服务', '#5368D8', 79),
  ('icon-expense-social-family-support', '孝亲支出', '#EF5B7A', 80),
  ('icon-expense-social-red-packet', '红包礼金', '#EF5B7A', 81),
  ('icon-expense-social-donation', '捐赠', '#EF5B7A', 82),
  ('icon-expense-social-gifts', '礼物', '#EF5B7A', 83)
ON DUPLICATE KEY UPDATE
  `name` = VALUES(`name`),
  `background_color` = VALUES(`background_color`),
  `default_sort` = VALUES(`default_sort`);

-- 通用预选图标：28 个。
INSERT INTO `category_icons` (`icon_key`, `name`, `background_color`, `default_sort`)
VALUES
  ('icon-category-coffee', '咖啡', '#B9794D', 84),
  ('icon-category-takeout', '外卖', '#F0803C', 85),
  ('icon-category-alcohol', '酒水', '#A16BC1', 86),
  ('icon-category-tobacco', '烟草', '#7C8797', 87),
  ('icon-category-shopping', '购物', '#E9608E', 88),
  ('icon-category-pets', '宠物', '#E99545', 89),
  ('icon-category-pet-food', '宠物食品', '#BF8654', 90),
  ('icon-category-veterinary', '宠物医疗', '#E5687C', 91),
  ('icon-category-baby-care', '母婴', '#EB83AD', 92),
  ('icon-category-toys', '玩具', '#EDA42F', 93),
  ('icon-category-fitness', '健身', '#4B96CF', 94),
  ('icon-category-music', '音乐娱乐', '#8465D7', 95),
  ('icon-category-dental', '牙科', '#43AEB9', 96),
  ('icon-category-glasses', '眼镜', '#5879C7', 97),
  ('icon-category-cosmetics', '美妆', '#D65E9A', 98),
  ('icon-category-jewelry', '珠宝首饰', '#A56BDB', 99),
  ('icon-category-fuel', '汽车加油', '#4A85D0', 100),
  ('icon-category-car-maintenance', '汽车保养', '#607F99', 101),
  ('icon-category-car-wash', '洗车', '#36A5CB', 102),
  ('icon-category-toll', '高速过路费', '#5578BC', 103),
  ('icon-category-hotel', '酒店住宿', '#3FAE72', 104),
  ('icon-category-luggage', '旅行行李', '#40977F', 105),
  ('icon-category-camping', '露营', '#5A9E57', 106),
  ('icon-category-laundry', '洗衣', '#39AD98', 107),
  ('icon-category-home-appliance', '家用电器', '#43A19D', 108),
  ('icon-category-home-repair', '装修维修', '#D28A37', 109),
  ('icon-category-express-delivery', '快递物流', '#DE7840', 110),
  ('icon-category-insurance', '保险', '#5077BE', 111)
ON DUPLICATE KEY UPDATE
  `name` = VALUES(`name`),
  `background_color` = VALUES(`background_color`),
  `default_sort` = VALUES(`default_sort`);

-- 默认分类模板初始化数据。
-- icon_key 保存 Iconfont Symbol 的完整 ID；一级、二级分类分别在各自同级范围内从 0 排序。

-- 一级分类：支出 15 个，收入 5 个。
INSERT INTO `category_templates` (`id`, `type`, `parent_id`, `name`, `default_sort`, `level`, `icon_key`)
VALUES
  (1, 'expense', NULL, '三餐', 0, 1, 'icon-expense-meals'),
  (2, 'expense', NULL, '正餐食品', 1, 1, 'icon-expense-meal-food'),
  (3, 'expense', NULL, '零食饮品', 2, 1, 'icon-expense-snacks-drinks'),
  (4, 'expense', NULL, '休闲娱乐', 3, 1, 'icon-expense-entertainment'),
  (5, 'expense', NULL, '日用家居', 4, 1, 'icon-expense-household'),
  (6, 'expense', NULL, '服饰穿搭', 5, 1, 'icon-expense-clothing'),
  (7, 'expense', NULL, '个人护理', 6, 1, 'icon-expense-personal-care'),
  (8, 'expense', NULL, '住房', 7, 1, 'icon-expense-housing'),
  (9, 'expense', NULL, '数码产品', 8, 1, 'icon-expense-digital'),
  (10, 'expense', NULL, '交通出行', 9, 1, 'icon-expense-transport'),
  (11, 'expense', NULL, '通讯网络', 10, 1, 'icon-expense-communication'),
  (12, 'expense', NULL, '医疗健康', 11, 1, 'icon-expense-medical'),
  (13, 'expense', NULL, '学习教育', 12, 1, 'icon-expense-education'),
  (14, 'expense', NULL, '数字服务', 13, 1, 'icon-expense-digital-services'),
  (15, 'expense', NULL, '人情往来', 14, 1, 'icon-expense-social'),
  (16, 'income', NULL, '工资', 0, 1, 'icon-income-salary'),
  (17, 'income', NULL, '奖金', 1, 1, 'icon-income-bonus'),
  (18, 'income', NULL, '兼职副业', 2, 1, 'icon-income-side-business'),
  (19, 'income', NULL, '投资收益', 3, 1, 'icon-income-investment'),
  (20, 'income', NULL, '二手出售', 4, 1, 'icon-income-secondhand-sale')
ON DUPLICATE KEY UPDATE
  `type` = VALUES(`type`),
  `parent_id` = VALUES(`parent_id`),
  `name` = VALUES(`name`),
  `default_sort` = VALUES(`default_sort`),
  `level` = VALUES(`level`),
  `icon_key` = VALUES(`icon_key`);

-- 二级分类：仅支出分类拥有二级分类，共 64 个。
INSERT INTO `category_templates` (`id`, `type`, `parent_id`, `name`, `default_sort`, `level`, `icon_key`)
VALUES
  (21, 'expense', 1, '早餐', 0, 2, 'icon-expense-meals-breakfast'),
  (22, 'expense', 1, '午餐', 1, 2, 'icon-expense-meals-lunch'),
  (23, 'expense', 1, '晚餐', 2, 2, 'icon-expense-meals-dinner'),
  (24, 'expense', 1, '买菜食材', 3, 2, 'icon-expense-meals-groceries'),
  (25, 'expense', 2, '基础食品', 0, 2, 'icon-expense-meal-food-staple-food'),
  (26, 'expense', 2, '日常水果', 1, 2, 'icon-expense-meal-food-daily-fruit'),
  (83, 'expense', 2, '方便速食', 2, 2, 'icon-expense-meal-food-instant-food'),
  (27, 'expense', 3, '休闲零食', 0, 2, 'icon-expense-snacks-drinks-leisure-snacks'),
  (28, 'expense', 3, '小吃熟食', 1, 2, 'icon-expense-snacks-drinks-cooked-snacks'),
  (29, 'expense', 3, '饮料茶饮', 2, 2, 'icon-expense-snacks-drinks-beverages'),
  (30, 'expense', 3, '甜品烘焙', 3, 2, 'icon-expense-snacks-drinks-desserts-bakery'),
  (31, 'expense', 4, '游戏', 0, 2, 'icon-expense-entertainment-games'),
  (32, 'expense', 4, '门票', 1, 2, 'icon-expense-entertainment-tickets'),
  (33, 'expense', 4, '电影', 2, 2, 'icon-expense-entertainment-movies'),
  (34, 'expense', 5, '个人清洁', 0, 2, 'icon-expense-household-personal-cleaning'),
  (35, 'expense', 5, '家居清洁', 1, 2, 'icon-expense-household-home-cleaning'),
  (36, 'expense', 5, '纸品耗材', 2, 2, 'icon-expense-household-paper-consumables'),
  (37, 'expense', 5, '厨房用品', 3, 2, 'icon-expense-household-kitchen'),
  (38, 'expense', 5, '家居用品', 4, 2, 'icon-expense-household-home-furnishing'),
  (39, 'expense', 5, '其他日用', 5, 2, 'icon-expense-household-other-daily'),
  (40, 'expense', 6, '上衣', 0, 2, 'icon-expense-clothing-tops'),
  (41, 'expense', 6, '下装', 1, 2, 'icon-expense-clothing-bottoms'),
  (42, 'expense', 6, '鞋子', 2, 2, 'icon-expense-clothing-shoes'),
  (43, 'expense', 6, '内衣袜子', 3, 2, 'icon-expense-clothing-underwear-socks'),
  (44, 'expense', 7, '理发', 0, 2, 'icon-expense-personal-care-haircut'),
  (45, 'expense', 7, '护肤品', 1, 2, 'icon-expense-personal-care-skincare'),
  (84, 'expense', 7, '医疗美容', 2, 2, 'icon-expense-personal-care-medical-beauty'),
  (46, 'expense', 8, '房租', 0, 2, 'icon-expense-housing-rent'),
  (47, 'expense', 8, '水费', 1, 2, 'icon-expense-housing-water'),
  (48, 'expense', 8, '电费', 2, 2, 'icon-expense-housing-electricity'),
  (49, 'expense', 8, '燃气费', 3, 2, 'icon-expense-housing-gas'),
  (50, 'expense', 8, '房贷', 4, 2, 'icon-expense-housing-mortgage'),
  (51, 'expense', 8, '物业费', 5, 2, 'icon-expense-housing-property-fee'),
  (52, 'expense', 9, '手机平板', 0, 2, 'icon-expense-digital-phone'),
  (53, 'expense', 9, '电脑', 1, 2, 'icon-expense-digital-computer'),
  (54, 'expense', 9, '数码配件', 2, 2, 'icon-expense-digital-digital-accessories'),
  (55, 'expense', 9, '数码维修', 3, 2, 'icon-expense-digital-digital-repair'),
  (56, 'expense', 10, '公交地铁', 0, 2, 'icon-expense-transport-public-transit'),
  (57, 'expense', 10, '打车', 1, 2, 'icon-expense-transport-taxi'),
  (58, 'expense', 10, '共享单车', 2, 2, 'icon-expense-transport-shared-bike'),
  (59, 'expense', 10, '火车', 3, 2, 'icon-expense-transport-train'),
  (60, 'expense', 10, '高铁', 4, 2, 'icon-expense-transport-high-speed-rail'),
  (61, 'expense', 10, '飞机', 5, 2, 'icon-expense-transport-flight'),
  (62, 'expense', 10, '游轮', 6, 2, 'icon-expense-transport-cruise'),
  (63, 'expense', 10, '停车', 7, 2, 'icon-expense-transport-parking'),
  (64, 'expense', 11, '手机话费', 0, 2, 'icon-expense-communication-phone-bill'),
  (65, 'expense', 11, '流量费', 1, 2, 'icon-expense-communication-mobile-data'),
  (66, 'expense', 11, '宽带费', 2, 2, 'icon-expense-communication-broadband'),
  (67, 'expense', 12, '药品', 0, 2, 'icon-expense-medical-medicine'),
  (68, 'expense', 12, '就诊', 1, 2, 'icon-expense-medical-doctor'),
  (69, 'expense', 12, '检查', 2, 2, 'icon-expense-medical-examination'),
  (70, 'expense', 13, '书籍资料', 0, 2, 'icon-expense-education-books'),
  (71, 'expense', 13, '考试认证', 1, 2, 'icon-expense-education-exam-certification'),
  (72, 'expense', 13, '课程培训', 2, 2, 'icon-expense-education-course-training'),
  (73, 'expense', 13, '学费', 3, 2, 'icon-expense-education-tuition'),
  (74, 'expense', 13, '学习用品', 4, 2, 'icon-expense-education-study-supplies'),
  (75, 'expense', 14, '软件订阅', 0, 2, 'icon-expense-digital-services-software-subscription'),
  (76, 'expense', 14, '云服务器', 1, 2, 'icon-expense-digital-services-cloud-server'),
  (77, 'expense', 14, '云存储', 2, 2, 'icon-expense-digital-services-cloud-storage'),
  (78, 'expense', 14, '网络服务', 3, 2, 'icon-expense-digital-services-network-service'),
  (79, 'expense', 15, '孝亲支出', 0, 2, 'icon-expense-social-family-support'),
  (80, 'expense', 15, '红包礼金', 1, 2, 'icon-expense-social-red-packet'),
  (81, 'expense', 15, '捐赠', 2, 2, 'icon-expense-social-donation'),
  (82, 'expense', 15, '礼物', 3, 2, 'icon-expense-social-gifts')
ON DUPLICATE KEY UPDATE
  `type` = VALUES(`type`),
  `parent_id` = VALUES(`parent_id`),
  `name` = VALUES(`name`),
  `default_sort` = VALUES(`default_sort`),
  `level` = VALUES(`level`),
  `icon_key` = VALUES(`icon_key`);

COMMIT;
