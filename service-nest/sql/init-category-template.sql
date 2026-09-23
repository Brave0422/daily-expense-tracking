-- 默认分类模板初始化数据。
-- icon_key 保存 Iconfont Symbol 的完整 ID；一级、二级分类分别在各自同级范围内从 0 排序。

SET NAMES utf8mb4;

START TRANSACTION;

-- 一级分类：支出 15 个，收入 5 个。
INSERT INTO `category_template` (`id`, `type`, `parent_id`, `name`, `default_sort`, `level`, `icon_key`)
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

-- 二级分类：仅支出分类拥有二级分类，共 62 个。
INSERT INTO `category_template` (`id`, `type`, `parent_id`, `name`, `default_sort`, `level`, `icon_key`)
VALUES
  (21, 'expense', 1, '早餐', 0, 2, 'icon-expense-meals-breakfast'),
  (22, 'expense', 1, '午餐', 1, 2, 'icon-expense-meals-lunch'),
  (23, 'expense', 1, '晚餐', 2, 2, 'icon-expense-meals-dinner'),
  (24, 'expense', 1, '买菜食材', 3, 2, 'icon-expense-meals-groceries'),
  (25, 'expense', 2, '基础食品', 0, 2, 'icon-expense-meal-food-staple-food'),
  (26, 'expense', 2, '日常水果', 1, 2, 'icon-expense-meal-food-daily-fruit'),
  (27, 'expense', 3, '休闲零食', 0, 2, 'icon-expense-snacks-drinks-leisure-snacks'),
  (28, 'expense', 3, '夜宵', 1, 2, 'icon-expense-snacks-drinks-late-night-snack'),
  (29, 'expense', 3, '饮料茶饮', 2, 2, 'icon-expense-snacks-drinks-beverages'),
  (30, 'expense', 3, '甜品小吃', 3, 2, 'icon-expense-snacks-drinks-desserts-snacks'),
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
